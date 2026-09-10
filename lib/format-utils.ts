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
