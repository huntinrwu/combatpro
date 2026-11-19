// US-first unit conventions.
//
// DB storage stays in metric where it already is (height_cm, reach_cm) so we
// don't have to migrate data — imperial is the presentation and input format.
// Weight is already stored in lbs everywhere, so no conversion needed at
// storage time; kg only shows up as a display annotation.

const CM_PER_IN = 2.54;
const LBS_PER_KG = 2.2046226218;

// ── Length ────────────────────────────────────────────────────────────────

export function cmToIn(cm: number | string | null | undefined): number | null {
  const n = toNum(cm);
  if (n == null) return null;
  return n / CM_PER_IN;
}

export function inToCm(inches: number | string | null | undefined): number | null {
  const n = toNum(inches);
  if (n == null) return null;
  return n * CM_PER_IN;
}

// Split cm into whole feet + inches (0-11). Inch part rounds to nearest.
export function cmToFeetIn(
  cm: number | string | null | undefined,
): { feet: number; inches: number } | null {
  const n = toNum(cm);
  if (n == null) return null;
  const totalIn = n / CM_PER_IN;
  const feet = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn - feet * 12);
  if (inches === 12) return { feet: feet + 1, inches: 0 };
  return { feet, inches };
}

export function feetInToCm(
  feet: number | string | null | undefined,
  inches: number | string | null | undefined,
): number | null {
  const f = toNum(feet);
  const i = toNum(inches);
  if (f == null && i == null) return null;
  const totalIn = (f ?? 0) * 12 + (i ?? 0);
  if (totalIn === 0) return null;
  return totalIn * CM_PER_IN;
}

// ── Weight ────────────────────────────────────────────────────────────────

export function lbsToKg(lbs: number | string | null | undefined): number | null {
  const n = toNum(lbs);
  if (n == null) return null;
  return n / LBS_PER_KG;
}

// Postgres numeric columns can come back as strings via PostgREST.
export function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
