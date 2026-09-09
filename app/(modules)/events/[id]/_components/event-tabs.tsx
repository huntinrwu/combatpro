"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type EventTab = {
  slug: string;
  label: string;
  icon: ReactNode;
  href: string;
};

export function EventTabs({ tabs, basePath }: { tabs: EventTab[]; basePath: string }) {
  const pathname = usePathname() ?? basePath;

  return (
    <nav
      className="-mb-px flex flex-wrap gap-1 border-b border-border/60 text-sm print:hidden"
      aria-label="Event sections"
    >
      {tabs.map((t) => {
        const active =
          t.href === basePath ? pathname === basePath : pathname.startsWith(t.href);
        return (
          <Link
            key={t.slug}
            href={t.href}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
