"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { addEventFighters } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type FighterCandidate = {
  id: string;
  name: string;
  // "boxing · welterweight · Tampa Muay Thai"
  detail: string;
  sport: string;
};

// Searchable checklist of registry fighters not yet on this event. Several
// can be ticked and added in one go.
export function AddFightersPanel({
  eventId,
  eventSport,
  candidates,
}: {
  eventId: string;
  eventSport: string;
  candidates: FighterCandidate[];
}) {
  const [query, setQuery] = useState("");
  const [sameSportOnly, setSameSportOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter(
      (c) =>
        (!sameSportOnly || c.sport === eventSport) &&
        (q === "" || `${c.name} ${c.detail}`.toLowerCase().includes(q)),
    );
  }, [candidates, query, sameSportOnly, eventSport]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    const fd = new FormData();
    fd.set("event_id", eventId);
    fd.set("status", "confirmed");
    for (const id of selected) fd.append("fighter_id", id);
    const count = selected.size;
    startTransition(async () => {
      try {
        await addEventFighters(fd);
        setSelected(new Set());
        toast.success(count === 1 ? "Fighter added" : `${count} fighters added`);
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : "Something went wrong.");
      }
    });
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Every fighter in the registry is already on this event.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, gym, weight class…"
          className="pl-8"
          aria-label="Search fighters"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={sameSportOnly}
          onChange={(e) => setSameSportOnly(e.target.checked)}
        />
        <span className="capitalize">{eventSport} only</span>
      </label>

      <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border/70">
        {visible.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-muted-foreground">No matches.</li>
        )}
        {visible.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-muted/40">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block truncate text-xs capitalize text-muted-foreground">
                  {c.detail}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <Button type="button" size="sm" disabled={selected.size === 0 || pending} onClick={submit}>
        {pending
          ? "Adding…"
          : selected.size === 0
            ? "Add to event"
            : `Add ${selected.size} to event`}
      </Button>
    </div>
  );
}
