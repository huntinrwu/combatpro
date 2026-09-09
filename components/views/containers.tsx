import * as React from "react";

import { cn } from "@/lib/utils";

// Wrappers reused across module list pages. Each of the 9 pages was inlining
// the same rounded-border table shell, divider-row list, and responsive card
// grids — hoisted here so the page files can focus on cell rendering.

export function TableShell({
  head,
  children,
  className,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border", className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          {head}
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function CompactList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-border rounded-xl border border-border", className)}>
      {children}
    </div>
  );
}

// Card grid — 1/2/3 columns, 3-per-row on lg.
export function CardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>{children}</div>
  );
}

// Grid view — smaller tiles, up to 6 per row.
export function TileGrid({
  children,
  className,
  dense,
}: {
  children: React.ReactNode;
  className?: string;
  // Denser breakpoints (up to 6-wide on lg) for the fighter/official/sb style
  // rosters. Default is 2/3/4-wide for event-card style content.
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        dense
          ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
          : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
