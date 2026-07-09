import { createContext, useContext } from "react";

/**
 * Holds the element that Radix Portals (tooltips, popovers, …) should render
 * into. When the app is mounted inside a Shadow DOM — the inline WordPress/Divi
 * embed — portalled content must stay *inside* the shadow root, otherwise it
 * lands on `document.body` where none of the app's (shadow-scoped) styles reach
 * it and it renders unstyled.
 *
 * The provider is set up in `main.tsx` to the app's shadow root shell. When
 * absent (should not happen — we always mount in a shadow root) the value is
 * `undefined`, and Radix falls back to `document.body` as it does by default.
 */
const ShadowContainerContext = createContext<HTMLElement | undefined>(undefined);

export const ShadowContainerProvider = ShadowContainerContext.Provider;

/** The node Radix `Portal`s should use as their `container`. */
export function usePortalContainer(): HTMLElement | undefined {
  return useContext(ShadowContainerContext);
}
