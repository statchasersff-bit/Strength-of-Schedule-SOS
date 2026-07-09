import { useEffect, useState } from "react";
import type { SortDir } from "./sortable";
import type { CardFocus } from "./insight-cards";

/**
 * Reacts to an insight-card click: forces the table sort, then highlights and
 * scrolls to the picked row. Returns the data-testid that should currently be
 * highlighted (or null). Re-fires whenever `focus.nonce` changes.
 */
export function useCardFocus(
  focus: CardFocus | null | undefined,
  setSortDirect: (key: string, dir: SortDir) => void,
): string | null {
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!focus) return;
    setSortDirect(focus.sortKey, focus.dir);
    setHighlightId(focus.testId);
    // Let the re-sorted rows commit before scrolling to the target.
    const scrollTimer = setTimeout(() => {
      const el = document.querySelector(`[data-testid="${focus.testId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }, 60);
    const clearTimer = setTimeout(() => setHighlightId(null), 2400);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  return highlightId;
}
