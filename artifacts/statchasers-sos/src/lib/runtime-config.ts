/**
 * Runtime configuration hook for host environments (e.g. the WordPress plugin),
 * read from a global the host sets BEFORE the bundle executes:
 *
 *   <script>window.__STATCHASERS_SOS__ = { dataBase: "...", prettyUrls: false };</script>
 *
 * This lets the same compiled bundle find its static JSON wherever the host
 * serves it, and lets hosts that can't route deep pretty-URLs disable the
 * history rewriting. When the global is absent (local dev / Replit preview),
 * everything falls back to the build-time defaults — behavior is unchanged.
 */
export interface SosRuntimeConfig {
  /** Base URL for the static SOS JSON files (no trailing slash needed). */
  dataBase?: string;
  /** When explicitly false, the app stops rewriting the browser URL as a path. */
  prettyUrls?: boolean;
  /**
   * True when the tool is inline-embedded in a host page (WordPress/Divi) inside
   * its own Shadow DOM. In this mode the app reflects its view in the host page's
   * `?tab&pos&scoring` query string (not a pretty path), and does NOT touch the
   * host document's <title> or <meta> — those belong to the host page.
   */
  inline?: boolean;
  /** Initial view passed in by the host (slugs), e.g. { tab, position, scoring }. */
  initialState?: {
    tab?: string;
    position?: string;
    scoring?: string;
  };
  /**
   * Optional URL to beacon real-user Core Web Vitals to (JSON payloads via
   * navigator.sendBeacon). Independent of gtag/dataLayer, which are used
   * automatically when present on the host page.
   */
  vitalsEndpoint?: string;
}

export function getRuntimeConfig(): SosRuntimeConfig {
  if (typeof window === "undefined") return {};
  return (window as unknown as { __STATCHASERS_SOS__?: SosRuntimeConfig }).__STATCHASERS_SOS__ ?? {};
}
