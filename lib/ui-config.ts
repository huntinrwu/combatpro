import type { Corner } from "@/lib/db/types";

// Badge variant lookups used across event/payment pages. Centralized so
// event-status colors stay consistent as we add new statuses.

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export const EVENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  draft: "outline",
  scheduled: "default",
  complete: "secondary",
  canceled: "destructive",
};

// Red/blue corner indicator dot color.
export const CORNER_DOT: Record<Corner, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
};

// Officials sort order — same list used by bout detail and run-of-show
// pages to render referee → judge → doctor → timekeeper → inspector.
// Widened to Record<string, number> because call sites often index with
// a plain string; unknown roles fall back to 99 via `?? 99`.
export const OFFICIAL_ROLE_ORDER: Record<string, number> = {
  head_official: 0,
  referee: 1,
  judge: 2,
  jury: 3,
  doctor: 4,
  timekeeper: 5,
  inspector: 6,
};
