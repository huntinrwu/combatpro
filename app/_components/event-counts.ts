import type { EventRow } from "@/lib/db/types";

export type EventCounts = { total: number; upcoming: number };

export const ZERO_COUNTS: EventCounts = { total: 0, upcoming: 0 };

// Total + upcoming event counts per owner (promotion, sanctioning body, …).
export function countEventsBy<K extends "promotion_id" | "sanctioning_body_id">(
  events: Pick<EventRow, K | "event_date" | "status">[],
  key: K,
): Map<string, EventCounts> {
  const today = new Date().toISOString().slice(0, 10);
  const counts = new Map<string, EventCounts>();
  for (const e of events) {
    const owner = e[key];
    if (!owner) continue;
    const entry = counts.get(owner) ?? { total: 0, upcoming: 0 };
    entry.total++;
    if (e.event_date >= today && e.status !== "canceled" && e.status !== "complete") {
      entry.upcoming++;
    }
    counts.set(owner, entry);
  }
  return counts;
}
