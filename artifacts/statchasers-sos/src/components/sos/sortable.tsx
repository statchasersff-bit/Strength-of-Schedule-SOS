import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir } | null;
export type Accessor<T> = (row: T) => string | number | null | undefined;

/**
 * Client-side table sorting.
 *
 * `accessors` maps a column key to a value extractor. Pass a *stable* object
 * (module-level constant or useMemo) so the sort doesn't re-run every render.
 * Clicking a header cycles: default dir -> opposite dir -> unsorted.
 */
export function useSort<T>(rows: T[] | undefined, accessors: Record<string, Accessor<T>>) {
  const [sort, setSort] = useState<SortState>(null);

  const sorted = useMemo(() => {
    if (!rows || !sort) return rows;
    const accessor = accessors[sort.key];
    if (!accessor) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      // Missing values (e.g. BYE weeks) always sort to the bottom.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, sort, accessors]);

  const toggle = (key: string, defaultDir: SortDir = "asc") =>
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: defaultDir };
      if (cur.dir === defaultDir) return { key, dir: defaultDir === "asc" ? "desc" : "asc" };
      return null;
    });

  // Imperatively force a specific sort — used when an insight card "jumps" the
  // table to a column/direction rather than cycling through it.
  const setSortDirect = (key: string, dir: SortDir) => setSort({ key, dir });

  return { sorted, sort, toggle, setSortDirect };
}

interface SortHeaderProps {
  label: ReactNode;
  sortKey: string;
  sort: SortState;
  onSort: (key: string, defaultDir?: SortDir) => void;
  defaultDir?: SortDir;
  align?: "left" | "center";
  /** Hover explanation for this column. Adds a dotted underline cue. */
  tooltip?: ReactNode;
  className?: string;
}

export function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  defaultDir = "asc",
  align = "center",
  tooltip,
  className,
}: SortHeaderProps) {
  const active = sort?.key === sortKey;
  const button = (
    <button
      type="button"
      onClick={() => onSort(sortKey, defaultDir)}
      className={cn(
        "inline-flex items-center gap-1 w-full uppercase font-semibold cursor-pointer select-none transition-colors",
        active ? "text-amber-400" : "hover:text-primary",
        align === "center" ? "justify-center" : "justify-start",
      )}
    >
      <span className={cn(tooltip && "underline decoration-dotted decoration-from-font underline-offset-4")}>
        {label}
      </span>
    </button>
  );
  return (
    <th className={className} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-center font-normal normal-case leading-snug">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
    </th>
  );
}
