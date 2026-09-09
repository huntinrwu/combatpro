"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Loader2, Search, Users, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SearchHit } from "./search-types";

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error("search failed");
        const body = (await res.json()) as { hits: SearchHit[] };
        setHits(body.hits);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setHits([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [q]);

  function handleChange(next: string) {
    setQ(next);
    setOpen(true);
    const trimmed = next.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const showDropdown = open && q.trim().length >= 2;

  const fighters = hits.filter((h) => h.kind === "fighter");
  const events = hits.filter((h) => h.kind === "event");

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search fighters or events…"
          value={q}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          className="h-11 pl-9 pr-9 text-sm"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setHits([]);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-lg border border-border/70 bg-popover text-popover-foreground shadow-lg">
          {loading && hits.length === 0 && (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          )}
          {!loading && hits.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              No matches for &ldquo;{q.trim()}&rdquo;.
            </div>
          )}
          {fighters.length > 0 && (
            <HitGroup
              label="Fighters"
              icon={<Users className="h-3.5 w-3.5" />}
              hits={fighters}
              onSelect={() => setOpen(false)}
            />
          )}
          {events.length > 0 && (
            <HitGroup
              label="Events"
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              hits={events}
              onSelect={() => setOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function HitGroup({
  label,
  icon,
  hits,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  hits: SearchHit[];
  onSelect: () => void;
}) {
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <ul>
        {hits.map((h) => (
          <li key={`${h.kind}-${h.id}`}>
            <Link
              href={h.href}
              onClick={onSelect}
              className={cn(
                "block px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
              )}
            >
              <div className="font-medium text-foreground">{h.title}</div>
              {h.subtitle && (
                <div className="text-xs text-muted-foreground">{h.subtitle}</div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
