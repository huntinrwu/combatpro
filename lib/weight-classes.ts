// Canonical weight-class tables per sport. Values are the upper limit in
// pounds — a fighter at exactly `upper_lbs` fits the class; over it means
// they've moved to the next class.
//
// These are intentionally sport-canonical (the version most promoters use)
// rather than body-specific. Sanctioning bodies (WBC vs WBA vs IBF vs UFC vs
// K-1) tweak edges — those overrides live in the ruleset's notes for now.
// Move to a table keyed by (sport, sanctioning_body_id) if it becomes real
// friction.

export type WeightClass = {
  name: string;
  upper_lbs: number;
  upper_kg: number;
};

const BOXING: WeightClass[] = [
  { name: "Minimumweight", upper_lbs: 105, upper_kg: 47.6 },
  { name: "Light flyweight", upper_lbs: 108, upper_kg: 49.0 },
  { name: "Flyweight", upper_lbs: 112, upper_kg: 50.8 },
  { name: "Super flyweight", upper_lbs: 115, upper_kg: 52.2 },
  { name: "Bantamweight", upper_lbs: 118, upper_kg: 53.5 },
  { name: "Super bantamweight", upper_lbs: 122, upper_kg: 55.3 },
  { name: "Featherweight", upper_lbs: 126, upper_kg: 57.2 },
  { name: "Super featherweight", upper_lbs: 130, upper_kg: 59.0 },
  { name: "Lightweight", upper_lbs: 135, upper_kg: 61.2 },
  { name: "Super lightweight", upper_lbs: 140, upper_kg: 63.5 },
  { name: "Welterweight", upper_lbs: 147, upper_kg: 66.7 },
  { name: "Super welterweight", upper_lbs: 154, upper_kg: 69.9 },
  { name: "Middleweight", upper_lbs: 160, upper_kg: 72.6 },
  { name: "Super middleweight", upper_lbs: 168, upper_kg: 76.2 },
  { name: "Light heavyweight", upper_lbs: 175, upper_kg: 79.4 },
  { name: "Cruiserweight", upper_lbs: 200, upper_kg: 90.7 },
  { name: "Heavyweight", upper_lbs: Number.POSITIVE_INFINITY, upper_kg: Number.POSITIVE_INFINITY },
];

const MMA: WeightClass[] = [
  { name: "Strawweight", upper_lbs: 115, upper_kg: 52.2 },
  { name: "Flyweight", upper_lbs: 125, upper_kg: 56.7 },
  { name: "Bantamweight", upper_lbs: 135, upper_kg: 61.2 },
  { name: "Featherweight", upper_lbs: 145, upper_kg: 65.8 },
  { name: "Lightweight", upper_lbs: 155, upper_kg: 70.3 },
  { name: "Welterweight", upper_lbs: 170, upper_kg: 77.1 },
  { name: "Middleweight", upper_lbs: 185, upper_kg: 83.9 },
  { name: "Light heavyweight", upper_lbs: 205, upper_kg: 93.0 },
  { name: "Heavyweight", upper_lbs: 265, upper_kg: 120.2 },
  { name: "Super heavyweight", upper_lbs: Number.POSITIVE_INFINITY, upper_kg: Number.POSITIVE_INFINITY },
];

// Glory / K-1 style, gender-neutral. Muay Thai historically uses kg; we
// list lbs equivalents rounded to match promoter usage.
const KICKBOXING: WeightClass[] = [
  { name: "Flyweight", upper_lbs: 126, upper_kg: 57.15 },
  { name: "Bantamweight", upper_lbs: 135, upper_kg: 61.24 },
  { name: "Featherweight", upper_lbs: 145, upper_kg: 65.77 },
  { name: "Lightweight", upper_lbs: 155, upper_kg: 70.31 },
  { name: "Welterweight", upper_lbs: 170, upper_kg: 77.11 },
  { name: "Middleweight", upper_lbs: 187, upper_kg: 85.0 },
  { name: "Light heavyweight", upper_lbs: 209, upper_kg: 95.0 },
  { name: "Heavyweight", upper_lbs: Number.POSITIVE_INFINITY, upper_kg: Number.POSITIVE_INFINITY },
];

// Lumpini / Rajadamnern lineage, but pared to the most-used slots by US
// promoters. Full historical list is 18 classes — we roll a few together.
const MUAY_THAI: WeightClass[] = [
  { name: "Flyweight", upper_lbs: 112, upper_kg: 50.8 },
  { name: "Bantamweight", upper_lbs: 118, upper_kg: 53.5 },
  { name: "Featherweight", upper_lbs: 126, upper_kg: 57.2 },
  { name: "Lightweight", upper_lbs: 135, upper_kg: 61.2 },
  { name: "Super lightweight", upper_lbs: 140, upper_kg: 63.5 },
  { name: "Welterweight", upper_lbs: 147, upper_kg: 66.7 },
  { name: "Super welterweight", upper_lbs: 154, upper_kg: 69.9 },
  { name: "Middleweight", upper_lbs: 160, upper_kg: 72.6 },
  { name: "Light heavyweight", upper_lbs: 175, upper_kg: 79.4 },
  { name: "Cruiserweight", upper_lbs: 190, upper_kg: 86.2 },
  { name: "Heavyweight", upper_lbs: 209, upper_kg: 95.0 },
  { name: "Super heavyweight", upper_lbs: Number.POSITIVE_INFINITY, upper_kg: Number.POSITIVE_INFINITY },
];

// IBJJF adult male gi (approximate — women's are ~7-10 lbs lower per class).
const BJJ: WeightClass[] = [
  { name: "Rooster", upper_lbs: 127.5, upper_kg: 57.5 },
  { name: "Light feather", upper_lbs: 141, upper_kg: 64.0 },
  { name: "Feather", upper_lbs: 154, upper_kg: 70.0 },
  { name: "Light", upper_lbs: 167.5, upper_kg: 76.0 },
  { name: "Middle", upper_lbs: 181, upper_kg: 82.3 },
  { name: "Medium heavy", upper_lbs: 194.5, upper_kg: 88.3 },
  { name: "Heavy", upper_lbs: 207.5, upper_kg: 94.3 },
  { name: "Super heavy", upper_lbs: 221, upper_kg: 100.5 },
  { name: "Ultra heavy", upper_lbs: Number.POSITIVE_INFINITY, upper_kg: Number.POSITIVE_INFINITY },
];

// UWW freestyle Sr men. Named by the kg mark (US wrestlers use lbs for
// college; freestyle international uses kg).
const WRESTLING: WeightClass[] = [
  { name: "57 kg", upper_lbs: 125.5, upper_kg: 57 },
  { name: "61 kg", upper_lbs: 134.5, upper_kg: 61 },
  { name: "65 kg", upper_lbs: 143, upper_kg: 65 },
  { name: "70 kg", upper_lbs: 154, upper_kg: 70 },
  { name: "74 kg", upper_lbs: 163, upper_kg: 74 },
  { name: "79 kg", upper_lbs: 174, upper_kg: 79 },
  { name: "86 kg", upper_lbs: 189.5, upper_kg: 86 },
  { name: "92 kg", upper_lbs: 203, upper_kg: 92 },
  { name: "97 kg", upper_lbs: 213.5, upper_kg: 97 },
  { name: "125 kg", upper_lbs: 275.5, upper_kg: 125 },
];

// WKF standard senior kumite (men). Karate weight-classes are more granular
// than most; this is the shortlist.
const KARATE: WeightClass[] = [
  { name: "-60 kg", upper_lbs: 132.3, upper_kg: 60 },
  { name: "-67 kg", upper_lbs: 147.7, upper_kg: 67 },
  { name: "-75 kg", upper_lbs: 165.3, upper_kg: 75 },
  { name: "-84 kg", upper_lbs: 185.2, upper_kg: 84 },
  { name: "+84 kg", upper_lbs: Number.POSITIVE_INFINITY, upper_kg: Number.POSITIVE_INFINITY },
];

const TABLES: Record<string, WeightClass[]> = {
  boxing: BOXING,
  mma: MMA,
  kickboxing: KICKBOXING,
  "muay thai": MUAY_THAI,
  bjj: BJJ,
  wrestling: WRESTLING,
  karate: KARATE,
};

// Sports that have canonical tables. Others (grappling variants, prosport
// oddities) fall through to null.
export function weightClassesForSport(sport: string): WeightClass[] | null {
  return TABLES[sport.toLowerCase()] ?? null;
}

// Given a sport and a contracted weight in lbs, return the canonical class
// name. Returns null for sports without tables, or when weight is < 0.
export function weightClassFor(sport: string, lbs: number): string | null {
  const table = weightClassesForSport(sport);
  if (!table || lbs <= 0) return null;
  for (const wc of table) {
    if (lbs <= wc.upper_lbs) return wc.name;
  }
  return table[table.length - 1]?.name ?? null;
}

// Loose comparison — case-insensitive, ignores spacing + hyphens so
// "Super Welterweight" matches "super-welterweight" matches "super welter".
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s-]+/g, "").trim();
}

// Returns true only if the recorded weight_class agrees with the class the
// contracted weight would fall into. Returns null when we can't check
// (missing data or unknown sport).
export function weightClassMatch(
  sport: string,
  contractedLbs: number | null | undefined,
  weightClass: string | null | undefined,
): boolean | null {
  if (contractedLbs == null || !weightClass) return null;
  const expected = weightClassFor(sport, contractedLbs);
  if (!expected) return null;
  return normalize(expected) === normalize(weightClass);
}
