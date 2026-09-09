"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Columns3,
  GalleryVertical,
  LayoutGrid,
  LayoutList,
  Rows3,
  TableProperties,
  Timer,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ViewKind } from "@/lib/view-mode";

type ViewSpec = { value: ViewKind; label: string; Icon: LucideIcon };

const ALL: Record<ViewKind, ViewSpec> = {
  list:     { value: "list",     label: "List",     Icon: LayoutList },
  card:     { value: "card",     label: "Card",     Icon: TableProperties },
  grid:     { value: "grid",     label: "Grid",     Icon: LayoutGrid },
  compact:  { value: "compact",  label: "Compact",  Icon: Rows3 },
  kanban:   { value: "kanban",   label: "Kanban",   Icon: Columns3 },
  gallery:  { value: "gallery",  label: "Gallery",  Icon: GalleryVertical },
  calendar: { value: "calendar", label: "Calendar", Icon: CalendarIcon },
  timeline: { value: "timeline", label: "Timeline", Icon: Timer },
};

export function ViewSwitcher({
  views,
  current,
  className,
  paramName = "view",
}: {
  views: ViewKind[];
  current: ViewKind;
  className?: string;
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setView = (v: ViewKind) => {
    const next = new URLSearchParams(params.toString());
    if (v === views[0]) {
      next.delete(paramName);
    } else {
      next.set(paramName, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5",
        className,
      )}
    >
      {views.map((v) => {
        const spec = ALL[v];
        const active = v === current;
        return (
          <button
            key={v}
            role="radio"
            aria-checked={active}
            aria-label={spec.label}
            title={spec.label}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <spec.Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{spec.label}</span>
          </button>
        );
      })}
    </div>
  );
}

