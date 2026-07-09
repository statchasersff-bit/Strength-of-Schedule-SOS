import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Coordinates auto-fit text scaling across a row of insight cards.
 *
 * Each scalable card section measures the font scale it needs to avoid being
 * truncated and reports it under a shared "slot" key (e.g. all the aFPA stat
 * rows share one slot). The provider hands back the *smallest* scale any
 * sibling needs for that slot, so when one card's section has to shrink, every
 * card's matching section shrinks by the same amount — the row stays visually
 * consistent instead of having one odd card with tiny text.
 */

/** Never shrink text below this fraction of its design size. Kept low so the
 *  narrow 4-up tablet layout never has to truncate; in practice the nickname
 *  fallback and short values mean sections rarely approach this floor. */
const MIN_SCALE = 0.5;

interface FitApi {
  report: (slot: string, id: string, needed: number) => void;
  drop: (slot: string, id: string) => void;
}

// The stable command API and the reactive scale values live in separate
// contexts on purpose: the API keeps a constant identity (safe to leave out of
// effect deps, so reporting never retriggers its own effect), while only the
// scale map changes identity when a section needs to resize.
const FitApiContext = createContext<FitApi | null>(null);
const FitScaleContext = createContext<Record<string, number>>({});

export function InsightFitProvider({ children }: { children: ReactNode }) {
  const [scales, setScales] = useState<Record<string, number>>({});
  // slot -> (cardId -> scale that card needs). Kept in a ref so reporting never
  // depends on render state.
  const reports = useRef<Map<string, Map<string, number>>>(new Map());
  const apiRef = useRef<FitApi | null>(null);

  if (!apiRef.current) {
    const recompute = (slot: string) => {
      const perCard = reports.current.get(slot);
      const min = perCard && perCard.size ? Math.min(...perCard.values()) : 1;
      setScales((prev) => (prev[slot] === min ? prev : { ...prev, [slot]: min }));
    };
    apiRef.current = {
      report(slot, id, needed) {
        let perCard = reports.current.get(slot);
        if (!perCard) reports.current.set(slot, (perCard = new Map()));
        if (perCard.get(id) === needed) return;
        perCard.set(id, needed);
        recompute(slot);
      },
      drop(slot, id) {
        const perCard = reports.current.get(slot);
        if (perCard?.delete(id)) recompute(slot);
      },
    };
  }

  return (
    <FitApiContext.Provider value={apiRef.current}>
      <FitScaleContext.Provider value={scales}>{children}</FitScaleContext.Provider>
    </FitApiContext.Provider>
  );
}

/**
 * Auto-fit one text section against its siblings.
 *
 * Render the section's content twice: once inside `boxRef` scaled by the
 * returned `scale`, and once inside `probeRef` — an invisible, off-flow,
 * natural-size (`w-max`) copy that always measures the untruncated width. The
 * hook compares the probe's natural width against the box's available width,
 * reports the scale this card needs, and returns the coordinated scale (the
 * minimum any card in the row needs) to apply.
 *
 * The probe stays at design size regardless of the applied scale, so the
 * measurement is stable and fully reversible: as the card grows back the text
 * scales straight back up to 1.
 */
export function useSharedFit(slot: string, opts?: { lines?: number }) {
  const lines = opts?.lines ?? 1;
  const api = useContext(FitApiContext);
  const scales = useContext(FitScaleContext);
  const id = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const scale = scales[slot] ?? 1;
  // Latest coordinated scale, readable from inside the (non-rerunning) measure
  // closure so the pre-paint apply below can clamp to it.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useLayoutEffect(() => {
    const box = boxRef.current;
    const probe = probeRef.current;
    if (!api || !box || !probe) return;

    const measure = () => {
      const available = box.clientWidth;
      // The probe is a single unwrapped line, so its width is the text's total
      // length. A section allowed N lines has ~N× that width to work with; the
      // 0.92 factor allows for whitespace lost to word wrapping.
      const capacity = lines > 1 ? available * lines * 0.92 : available;
      const natural = probe.getBoundingClientRect().width;
      if (!capacity || !natural) return;
      // Round to 2 decimals so sub-pixel jitter doesn't churn the shared state.
      const needed = Math.max(MIN_SCALE, Math.min(1, Math.round((capacity / natural) * 100) / 100));
      // Apply the fit imperatively *before paint*. React also drives the box's
      // font-size from the coordinated `scale`, but that round-trips through a
      // state update — so when a web font loads and reflows the text wider, the
      // browser could paint one truncated frame before React catches up. Writing
      // the box's font-size here (clamped to the smaller of this card's need and
      // the current shared scale, so it always fits and stays row-consistent)
      // closes that gap. The probe carries the section's design size.
      const base = parseFloat(getComputedStyle(probe).fontSize) || 0;
      if (base) box.style.fontSize = `${base * Math.min(needed, scaleRef.current)}px`;
      api.report(slot, id, needed);
    };

    measure();
    // Watch the available width (box) and the natural width (probe, e.g. after
    // the text changes).
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(probe);
    // Web fonts change text metrics after they load; re-fit once they're ready
    // so the first stable paint (and any font-swap reflow) is measured correctly.
    let cancelled = false;
    const fonts = (document as { fonts?: { ready?: Promise<unknown> } }).fonts;
    fonts?.ready?.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
      ro.disconnect();
      api.drop(slot, id);
    };
    // api and id are stable; re-running only on slot/lines change is intentional.
  }, [api, id, slot, lines]);

  return { boxRef, probeRef, scale };
}
