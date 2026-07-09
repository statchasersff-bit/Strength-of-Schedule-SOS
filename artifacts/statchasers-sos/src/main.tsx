import { createRoot } from "react-dom/client";
import App from "./App";
import { ShadowContainerProvider } from "./lib/shadow-container";
// Import the compiled CSS as a string (not auto-injected into <head>) so we can
// inject it into each mount's Shadow DOM instead. This is what keeps the tool's
// Tailwind styles fully isolated from the host WordPress/Divi theme.
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

/**
 * Mount the app into a Shadow DOM under `host`, isolating its styles from (and
 * against) the surrounding page. `host` is the `.sos-app-root` wrapper the
 * WordPress plugin emits; in local dev it's the `#root` div from index.html.
 */
function mount(host: HTMLElement) {
  // Guard against double-mounting (e.g. HMR or a stray second script tag).
  if (host.shadowRoot) return;

  // Register Tailwind's `@property` custom props at the document level so they
  // apply inside the shadow root (they don't work when scoped to a shadow tree).
  registerTailwindProperties();

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = cssText;
  shadow.appendChild(style);

  // The React tree — and every Radix portal — lives inside this shell so it all
  // inherits the shadow-scoped styles. It doubles as the portal container.
  const shell = document.createElement("div");
  shell.className = "sos-app-shell";
  shadow.appendChild(shell);

  createRoot(shell).render(
    <ShadowContainerProvider value={shell}>
      <App />
    </ShadowContainerProvider>,
  );
}

// One embed per `.sos-app-root` on the page (the plugin emits one per shortcode);
// fall back to `#root` for the standalone dev/preview document.
const hosts = document.querySelectorAll<HTMLElement>(".sos-app-root");
if (hosts.length > 0) {
  hosts.forEach(mount);
} else {
  const root = document.getElementById("root");
  if (root) mount(root);
}
