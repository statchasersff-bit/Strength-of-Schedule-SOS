import { createRoot } from "react-dom/client";
import App from "./App";
import { ShadowContainerProvider } from "./lib/shadow-container";
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

/** Roots keyed by host element — lets HMR re-renders re-use the existing root. */
const roots = new Map<HTMLElement, ReturnType<typeof createRoot>>();

/**
 * Mount the app into a Shadow DOM under `host`, isolating its styles from (and
 * against) the surrounding page. `host` is the `.sos-app-root` wrapper the
 * WordPress plugin emits; in local dev it's the `#root` div from index.html.
 */
function mount(host: HTMLElement) {
  try {
    registerTailwindProperties();

    let shadow = host.shadowRoot;
    let shell: HTMLElement;

    if (!shadow) {
      shadow = host.attachShadow({ mode: "open" });

      const style = document.createElement("style");
      style.textContent = cssText;
      shadow.appendChild(style);

      shell = document.createElement("div");
      shell.className = "sos-app-shell";
      shadow.appendChild(shell);
    } else {
      const existing = shadow.querySelector<HTMLElement>(".sos-app-shell");
      shell = existing ?? shadow.appendChild(Object.assign(document.createElement("div"), { className: "sos-app-shell" }));

      const style = shadow.querySelector("style");
      if (style) style.textContent = cssText;
    }

    if (!roots.has(host)) {
      roots.set(
        host,
        createRoot(shell),
      );
    }

    roots.get(host)!.render(
      <ShadowContainerProvider value={shell}>
        <App />
      </ShadowContainerProvider>,
    );
  } catch (err) {
    console.error("[SOS] mount() failed:", err);
  }
}

function mountAll() {
  const hosts = document.querySelectorAll<HTMLElement>(".sos-app-root");
  if (hosts.length > 0) {
    hosts.forEach(mount);
  } else {
    const root = document.getElementById("root");
    if (root) mount(root);
  }
}

mountAll();

// During Vite HMR, accept CSS/module updates gracefully by re-rendering into
// the existing React root rather than crashing on a double attachShadow call.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    mountAll();
  });
}
