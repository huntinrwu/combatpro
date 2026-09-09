import * as React from "react";

// Shared kanban shell used by module list pages. Callers supply the columns
// (label + count + item list) and a per-item renderer. The wrapper handles
// horizontal snap-scroll, headers, and the "Empty" placeholder — every module
// page was reimplementing this by hand.

export type KanbanColumn<T> = {
  key: string;
  header: React.ReactNode;
  items: T[];
};

export function KanbanBoard<T>({
  columns,
  renderItem,
  emptyLabel = "Empty",
}: {
  columns: KanbanColumn<T>[];
  renderItem: (item: T) => React.ReactNode;
  emptyLabel?: string;
}) {
  return (
    <div className="flex snap-x gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div
          key={col.key}
          className="w-64 shrink-0 snap-start rounded-xl border border-border bg-muted/20 p-2"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            {col.header}
            <span className="rounded bg-background px-1.5 text-[10px] font-mono text-muted-foreground">
              {col.items.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {col.items.map((item) => renderItem(item))}
            {col.items.length === 0 && (
              <div className="px-2 py-6 text-center text-[10px] text-muted-foreground/60">
                {emptyLabel}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
