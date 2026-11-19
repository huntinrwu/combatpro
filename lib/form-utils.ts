// Shared FormData coercers used by every server action. Kept here so we
// don't reinvent them in each file.

export function orNull(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

export function toInt(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function toNum(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

// Select inputs use "__none__" for the empty option; treat it like blank.
export function idOrNull(raw: FormDataEntryValue | null): string | null {
  const v = orNull(raw);
  return v === "__none__" ? null : v;
}

// "Boxing, MMA" → ["boxing", "mma"]
export function splitList(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function requireCorner(raw: FormDataEntryValue | null): "red" | "blue" {
  if (raw === "red" || raw === "blue") return raw;
  throw new Error("corner must be red or blue");
}
