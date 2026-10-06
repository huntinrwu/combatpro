// Postgres numeric columns can come back as strings via PostgREST — coerce
// to a finite number (or null) before doing math / formatting.
export function toNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
