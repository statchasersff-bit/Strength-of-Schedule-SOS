import { createRoot } from "react-dom/client";
import App from "./App";
import { ShadowContainerProvider } from "./lib/shadow-container";
// Import the compiled CSS as a string (not auto-injected into <head>) so we can
// inject it into each mount's Shadow DOM instead. This is what keeps the tool's
// Tailwind styles fully isolated from the host WordPress/Divi theme.
import cssText from "./index.css?inline";

/**
 * Mount the app into a Shadow DOM under `host`, isolating its styles from (and
 * against) the surrounding page. `host` is the `.sos-app-root` wrapper the
 * WordPress plugin emits; in local dev it's the `#root` div from index.html.
 */
function mount(host: HTMLElement) {
  // Guard against double-mounting (e.g. HMR or a stray second script tag).
  if (host.shadowRoot) return;

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
