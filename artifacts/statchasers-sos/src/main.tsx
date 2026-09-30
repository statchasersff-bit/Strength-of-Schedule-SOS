import { createRoot } from "react-dom/client";
import App from "./App";
import { ShadowContainerProvider } from "./lib/shadow-container";
import { initVitals } from "./lib/vitals";
import cssText from "./index.css?inline";

/**
 * `@property` at-rules are IGNORED inside a Shadow DOM — the browser only honors
 * them at the document level. Tailwind v4 leans on them heavily: `--tw-border-style`
 * (defaults to `solid`), the transform/gradient/ring vars, etc. all get their
 * initial values from `@property`. Inside our shadow root those registrations
 * never take effect, so e.g. `border-style: var(--tw-border-style)` resolves to
 * an empty value and every `border-*` utility collapses to `border-style: none` —
 * i.e. borders disappear tool-wide.
 *
 * Fix: lift the `@property` rules into the document head once. They only REGISTER
 * custom properties (no selectors, no visual styles), so nothing leaks into the
 * host WordPress/Divi page, but the registrations now apply to the shadow tree
 * too and Tailwind's borders/transforms/gradients render as intended.
 */
function registerTailwindProperties() {
  if (document.getElementById("sos-tw-properties")) return;
  const rules = cssText.match(/@property\s+--[\w-]+\s*\{[^}]*\}/g);
  if (!rules?.length) return;
  const style = document.createElement("style");
  style.id = "sos-tw-properties";
  style.textContent = rules.join("\n");
  document.head.appendChild(style);
}

// Augment HTMLElement so we can stash the React root directly on the DOM node.
// This survives Vite HMR module re-executions (the DOM outlives the module scope)
// so we never call createRoot() twice on the same shell.
declare global {
  interface HTMLElement {
    _sosReactRoot?: ReturnType<typeof createRoot>;
  }
}

/**
 * Mount the app into a Shadow DOM under `host`, isolating its styles from (and
 * against) the surrounding page. `host` is the `.sos-app-root` wrapper the
 * WordPress plugin emits; in local dev it's the `#root` div from index.html.
 *
 * Safe to call repeatedly (HMR re-executions). On repeat calls it:
 *   - reuses the existing shadow root
 *   - patches the inline CSS so styles stay up-to-date
 *   - calls root.render() on the existing React root (never createRoot() twice)
 */
function mount(host: HTMLElement) {
  try {
    registerTailwindProperties();

    // --- shadow root ---
    let shadow = host.shadowRoot;
    if (!shadow) {
      shadow = host.attachShadow({ mode: "open" });
    }

    // The WordPress shortcode server-renders the tool data (semantic tables)
    // into the wrapper's light DOM for SEO / no-JS visitors. Attaching the
    // shadow root already stops it from displaying; drop it from the DOM so
    // the page never carries the content twice.
    host
      .querySelectorAll(":scope > .sos-ssr")
      .forEach((node) => node.remove());

    // --- inline <style> (always refresh so CSS edits take effect via HMR) ---
    let styleEl = shadow.querySelector("style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      shadow.appendChild(styleEl);
    }
    styleEl.textContent = cssText;

    // --- shell div (Radix portal target + React mount point) ---
    let shell = shadow.querySelector<HTMLElement>(".sos-app-shell");
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "sos-app-shell";
      shadow.appendChild(shell);
    }

    // --- React root (reuse across HMR re-runs via the DOM-attached reference) ---
    if (!shell._sosReactRoot) {
      shell._sosReactRoot = createRoot(shell);
    }

    shell._sosReactRoot.render(
      <ShadowContainerProvider value={shell}>
        <App />
      </ShadowContainerProvider>,
    );
  } catch (err) {
    console.error("[SOS] mount() failed:", err);
  }
}

/**
 * Mount into every host currently in the DOM. Returns how many were found so
 * the bootstrap can decide whether to keep waiting for a late-injected one.
 * mount() is idempotent (it reuses the shadow/React root), so re-running this
 * over an already-mounted host is a no-op — safe to call repeatedly.
 */
function mountAll(): number {
  const hosts = document.querySelectorAll<HTMLElement>(".sos-app-root");
  if (hosts.length > 0) {
    hosts.forEach(mount);
    return hosts.length;
  }
  // Standalone dev shell (index.html) has no `.sos-app-root`, just `#root`.
  const root = document.getElementById("root");
  if (root) {
    mount(root);
    return 1;
  }
  return 0;
}

/**
 * Robust bootstrap for the WordPress/Divi embed. The bundle can start running
 * at awkward times: before the shortcode markup is parsed, or — with page
 * builders and "delay JS until interaction" optimizers — after the host is
 * injected via AJAX. So we (1) wait for the DOM to be ready, (2) try to mount,
 * and (3) if no host exists yet, watch for one to appear and mount it then,
 * rather than silently leaving a blank space.
 */
function bootstrap() {
  initVitals();
  if (mountAll() > 0) return;

  // No host yet — the shortcode markup may be injected later (Divi dynamic
  // content / AJAX). Watch for it, and give up after a short window so the
  // observer never lingers on pages that simply don't embed the tool.
  const observer = new MutationObserver(() => {
    if (mountAll() > 0) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  // Safety valve: stop watching after 10s regardless.
  window.setTimeout(() => observer.disconnect(), 10_000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}

// Tell Vite this module handles its own HMR updates. Without this, any change
// that touches main.tsx (including transitive CSS updates via the ?inline import)
// triggers a full-page reload. With it, Vite re-evaluates the module — but
// mount() now safely reuses the existing shadow root and React root.
if (import.meta.hot) {
  import.meta.hot.accept();
}
