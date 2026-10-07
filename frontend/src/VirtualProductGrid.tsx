import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

type VirtualProductGridProps<T> = {
  items: T[];
  columns: 2 | 3 | 4 | 5 | 6;
  className?: string;
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
};

function getAvailableColumns(): number {
  if (window.matchMedia("(max-width: 620px)").matches) return 2;
  if (window.matchMedia("(max-width: 980px)").matches) return 3;
  if (window.matchMedia("(max-width: 1200px)").matches) return 5;
  return 6;
}

function useEffectiveColumns(columns: 2 | 3 | 4 | 5 | 6): number {
  const [effectiveColumns, setEffectiveColumns] = useState(() =>
    typeof window === "undefined" ? columns : Math.min(columns, getAvailableColumns()),
  );

  useEffect(() => {
    const updateColumns = () => {
      setEffectiveColumns(Math.min(columns, getAvailableColumns()));
    };
    const breakpoints = ["(max-width: 620px)", "(max-width: 980px)", "(max-width: 1200px)"]
      .map((query) => window.matchMedia(query));
    updateColumns();
    breakpoints.forEach((breakpoint) => breakpoint.addEventListener("change", updateColumns));
    window.addEventListener("resize", updateColumns);
    return () => {
      breakpoints.forEach((breakpoint) => breakpoint.removeEventListener("change", updateColumns));
      window.removeEventListener("resize", updateColumns);
    };
  }, [columns]);

  return effectiveColumns;
}

export function VirtualProductGrid<T>({
  items,
  columns,
  className = "",
  getKey,
  renderItem,
}: VirtualProductGridProps<T>) {
  const effectiveColumns = useEffectiveColumns(columns);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const rowCount = Math.ceil(items.length / effectiveColumns);
  useLayoutEffect(() => {
    const updateOffset = () => {
      if (containerRef.current) setScrollMargin(containerRef.current.getBoundingClientRect().top + window.scrollY);
    };
    updateOffset();
    window.addEventListener("resize", updateOffset);
    return () => window.removeEventListener("resize", updateOffset);
  }, [items.length, effectiveColumns]);
  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => 380,
    overscan: 3,
    gap: 14,
    scrollMargin,
    getItemKey: (rowIndex) => items
      .slice(rowIndex * effectiveColumns, (rowIndex + 1) * effectiveColumns)
      .map(getKey)
      .join(":"),
  });

  return (
    <div
      ref={containerRef}
      className={`virtual-product-grid ${className}`}
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          ref={virtualizer.measureElement}
          data-index={row.index}
          className="virtual-product-row"
          style={{
            gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))`,
            transform: `translateY(${row.start - scrollMargin}px)`,
          }}
        >
          {items.slice(row.index * effectiveColumns, (row.index + 1) * effectiveColumns)
            .map((item, columnIndex) => renderItem(item, row.index * effectiveColumns + columnIndex))}
        </div>
      ))}
    </div>
  );
}
