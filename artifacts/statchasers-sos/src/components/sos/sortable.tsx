import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

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

  return { sorted, sort, toggle };
}

interface SortHeaderProps {
  label: ReactNode;
  sortKey: string;
  sort: SortState;
  onSort: (key: string, defaultDir?: SortDir) => void;
  defaultDir?: SortDir;
  align?: "left" | "center";
  className?: string;
}

export function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  defaultDir = "asc",
  align = "center",
  className,
}: SortHeaderProps) {
  const active = sort?.key === sortKey;
  const arrow = !active ? "↕" : sort!.dir === "asc" ? "▲" : "▼";
  return (
    <th className={className} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey, defaultDir)}
        className={cn(
          "inline-flex items-center gap-1 w-full uppercase font-semibold cursor-pointer select-none hover:text-primary transition-colors",
          align === "center" ? "justify-center" : "justify-start",
        )}
      >
        <span>{label}</span>
        <span className={cn("text-[10px] leading-none", active ? "opacity-100" : "opacity-40")}>{arrow}</span>
      </button>
    </th>
  );
}
