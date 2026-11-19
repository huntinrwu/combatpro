// Shared date formatters for event dates (ISO date strings, no time).
// The `T00:00:00` prefix keeps us in local time so "2026-09-12" doesn't
// slip to the day before in UTC-negative locales.

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

// "Sep 12, 2026"
export function fmtDateShort(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// "Sat, Sep 12, 2026"
export function fmtDateShortWithDay(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// "Saturday, September 12, 2026"
export function fmtDateLong(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// "CP-10000" — public human-readable identifier for a person.
export function fmtPersonNo(no: number | null | undefined): string {
  if (no == null) return "—";
  return `CP-${no}`;
}

// "CP-10000" / "10000" → 10000. Null when there are no digits.
export function parsePersonNo(input: string | undefined | null): number | null {
  if (!input) return null;
  const n = Number.parseInt(input.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

// "7:30 PM" from a full timestamp.
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// "Sep 12, 2026, 7:30 PM" from a full timestamp.
export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
