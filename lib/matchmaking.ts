import type { BoutClass, Gender } from "./db/types";

// Per-event matchmaking rules. Stored as JSON on events.matchmaking; anything
// missing falls back to these defaults, so new rules can be added later
// without a schema change.
export type MatchmakingSettings = {
  // Largest allowed difference in target weight, in pounds.
  maxWeightGapLbs: number;
  // Largest allowed difference in total fights (pro + amateur).
  maxFightGap: number;
  // Let a pro and an amateur be matched (still subject to maxFightGap).
  allowProAm: boolean;
  // Let two fighters from the same gym be matched.
  allowSameGym: boolean;
};

const DEFAULT_MATCHMAKING: MatchmakingSettings = {
  maxWeightGapLbs: 5,
  maxFightGap: 5,
  allowProAm: false,
  allowSameGym: false,
};

export function parseMatchmaking(raw: unknown): MatchmakingSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
  return {
    maxWeightGapLbs: n(r.maxWeightGapLbs, DEFAULT_MATCHMAKING.maxWeightGapLbs),
    maxFightGap: n(r.maxFightGap, DEFAULT_MATCHMAKING.maxFightGap),
    allowProAm: r.allowProAm === true,
    allowSameGym: r.allowSameGym === true,
  };
}

// ── Experience ────────────────────────────────────────────────────────────

type RecordFields = {
  pro_wins: number;
  pro_losses: number;
  pro_draws: number;
  am_wins: number;
  am_losses: number;
  am_draws: number;
};

export function totalFights(f: RecordFields): number {
  return f.pro_wins + f.pro_losses + f.pro_draws + f.am_wins + f.am_losses + f.am_draws;
}

export function totalWins(f: RecordFields): number {
  return f.pro_wins + f.am_wins;
}

export const EXPERIENCE_TIERS = [
  { key: "debut", label: "Debut (0 fights)", min: 0, max: 0 },
  { key: "novice", label: "Novice (1–5)", min: 1, max: 5 },
  { key: "experienced", label: "Experienced (6–15)", min: 6, max: 15 },
  { key: "veteran", label: "Veteran (16+)", min: 16, max: Number.POSITIVE_INFINITY },
] as const;

export function experienceTier(fights: number): (typeof EXPERIENCE_TIERS)[number] {
  return EXPERIENCE_TIERS.find((t) => fights >= t.min && fights <= t.max) ?? EXPERIENCE_TIERS[0];
}

// Pro if they have ever fought pro; otherwise amateur. Only a starting guess
// for an event — the roster entry's own "competing as" always wins.
export function defaultCompetingAs(f: RecordFields): BoutClass {
  return f.pro_wins + f.pro_losses + f.pro_draws > 0 ? "pro" : "amateur";
}

// ── Pairing ───────────────────────────────────────────────────────────────

export type Candidate = {
  // Roster entry id.
  id: string;
  fighterId: string;
  name: string;
  gym: string | null;
  competingAs: BoutClass;
  weightClass: string | null;
  targetWeightLbs: number | null;
  fights: number;
  wins: number;
  age?: number | null;
  gender?: Gender | null;
  // Weight to sort by: the target weight, else the top of the weight class.
  sortLbs?: number | null;
};

export type Pairing = {
  a: Candidate;
  b: Candidate;
  weightGapLbs: number | null;
  fightGap: number;
  // Lower is a closer match.
  score: number;
  // Things a matchmaker should know even though the rules allow the pairing.
  notes: string[];
};

// Why two fighters can't be matched under these rules, or null if they can.
function blockedReason(a: Candidate, b: Candidate, s: MatchmakingSettings): string | null {
  // Without a target weight or a class there is nothing safe to match on.
  const hasWeight = (c: Candidate) => c.targetWeightLbs != null || Boolean(c.weightClass);
  if (!hasWeight(a) || !hasWeight(b)) return "weight not set";
  const never = neverAuto(a, b);
  if (never) return never;
  if (a.competingAs !== b.competingAs && !s.allowProAm) return "pro vs amateur";
  if (!s.allowSameGym && a.gym && b.gym && a.gym === b.gym) return "same gym";
  if (Math.abs(a.fights - b.fights) > s.maxFightGap) return "experience gap";
  if (a.targetWeightLbs != null && b.targetWeightLbs != null) {
    if (Math.abs(a.targetWeightLbs - b.targetWeightLbs) > s.maxWeightGapLbs) return "weight gap";
  } else if (a.weightClass && b.weightClass) {
    if (a.weightClass.toLowerCase() !== b.weightClass.toLowerCase()) return "different class";
  }
  return null;
}

function pair(a: Candidate, b: Candidate): Pairing {
  const weightGapLbs =
    a.targetWeightLbs != null && b.targetWeightLbs != null
      ? Math.abs(a.targetWeightLbs - b.targetWeightLbs)
      : null;
  const fightGap = Math.abs(a.fights - b.fights);
  const rate = (c: Candidate) => (c.fights > 0 ? c.wins / c.fights : 0.5);

  const notes: string[] = [];
  if (a.competingAs !== b.competingAs) notes.push("Pro vs amateur");
  if (a.gym && b.gym && a.gym === b.gym) notes.push("Same gym");
  if (weightGapLbs == null) {
    notes.push(
      a.weightClass && b.weightClass
        ? "Same class — target weights not set"
        : "Check weights — one has a class, the other only a target weight",
    );
  }

  // Weight matters most, then experience, then how the records compare. A
  // pairing with unknown weight sorts behind every pairing with known weight.
  const score =
    (weightGapLbs ?? 50) * 2 + fightGap + Math.abs(rate(a) - rate(b)) * 4 + notes.length * 3;
  return { a, b, weightGapLbs, fightGap, score, notes };
}

export type MatchmakingResult = {
  // Best non-overlapping set of pairings: each fighter appears at most once.
  suggested: Pairing[];
  // Every allowed pairing, closest first — the alternatives.
  all: Pairing[];
  // Fighters with no allowed opponent, with the most common reason why.
  unmatched: { candidate: Candidate; reason: string }[];
};

export function suggestMatchups(
  candidates: Candidate[],
  settings: MatchmakingSettings,
): MatchmakingResult {
  const all: Pairing[] = [];
  const blocked = new Map<string, Map<string, number>>();
  const note = (c: Candidate, reason: string) => {
    const m = blocked.get(c.id) ?? new Map<string, number>();
    m.set(reason, (m.get(reason) ?? 0) + 1);
    blocked.set(c.id, m);
  };

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const reason = blockedReason(a, b, settings);
      if (reason) {
        note(a, reason);
        note(b, reason);
      } else {
        all.push(pair(a, b));
      }
    }
  }
  all.sort((x, y) => x.score - y.score);

  // Greedy: take the closest pairing, remove both fighters, repeat.
  const used = new Set<string>();
  const suggested: Pairing[] = [];
  for (const p of all) {
    if (used.has(p.a.id) || used.has(p.b.id)) continue;
    used.add(p.a.id);
    used.add(p.b.id);
    suggested.push(p);
  }

  const unmatched = candidates
    .filter((c) => !used.has(c.id))
    .map((candidate) => {
      const reasons = blocked.get(candidate.id);
      const top = reasons ? [...reasons.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] : null;
      const hasOption = all.some((p) => p.a.id === candidate.id || p.b.id === candidate.id);
      return {
        candidate,
        reason: hasOption
          ? "closest opponents are already paired"
          : candidates.length < 2
            ? "no one else on the roster"
            : `no eligible opponent (${top ?? "no match"})`,
      };
    });

  return { suggested, all, unmatched };
}

// ── Matchmaking board ─────────────────────────────────────────────────────

// What the matchmaker can ask the board to line fighters up by. Picked in
// order: the first one matters most.
export const MATCH_KEYS = ["gender", "age", "experience", "weight"] as const;
export type MatchKey = (typeof MATCH_KEYS)[number];
export const MATCH_KEY_LABELS: Record<MatchKey, string> = {
  gender: "Gender",
  age: "Age",
  experience: "Experience",
  weight: "Weight class",
};

const ADULT_AGE = 18;

function compareBy(key: MatchKey, a: Candidate, b: Candidate): number {
  // Unknown values sort last so they don't split the fighters we can place.
  const n = (x: number | null | undefined, y: number | null | undefined) =>
    (x ?? Number.MAX_SAFE_INTEGER) - (y ?? Number.MAX_SAFE_INTEGER);
  switch (key) {
    case "gender": {
      const rank = (c: Candidate) => (c.gender === "female" ? 0 : c.gender === "male" ? 1 : 2);
      return rank(a) - rank(b);
    }
    case "age":
      return n(a.age, b.age);
    case "experience":
      return a.fights - b.fights || a.wins - b.wins;
    case "weight":
      return n(a.sortLbs, b.sortLbs);
  }
}

// Pairings the board never makes by itself. A matchmaker can still drag two
// such fighters together; the pairing is then flagged.
function neverAuto(a: Candidate, b: Candidate): string | null {
  if (a.gender && b.gender && a.gender !== b.gender) return "different gender";
  if (a.age != null && b.age != null && a.age < ADULT_AGE !== b.age < ADULT_AGE) {
    return "minor vs adult";
  }
  return null;
}

export type Arrangement = {
  // Roster entry ids, red corner then blue.
  pairs: [string, string][];
  unpaired: string[];
};

// Line the fighters up for the board. With no priorities this is the balanced
// suggestion under the event's rules; with priorities the fighters are sorted
// by them, in order, and neighbours are paired.
export function arrangeFighters(
  candidates: Candidate[],
  priorities: MatchKey[],
  settings: MatchmakingSettings,
): Arrangement {
  if (priorities.length === 0) {
    const { suggested, unmatched } = suggestMatchups(candidates, settings);
    return {
      pairs: suggested.map((p) => [p.a.id, p.b.id]),
      unpaired: unmatched.map((u) => u.candidate.id),
    };
  }

  const sorted = [...candidates].sort((a, b) => {
    for (const key of priorities) {
      const d = compareBy(key, a, b);
      if (d !== 0) return d;
    }
    return a.name.localeCompare(b.name);
  });

  const used = new Set<string>();
  const pairs: [string, string][] = [];
  const unpaired: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (used.has(a.id)) continue;
    used.add(a.id);
    const b = sorted.slice(i + 1).find((c) => !used.has(c.id) && !neverAuto(a, c));
    if (b) {
      used.add(b.id);
      pairs.push([a.id, b.id]);
    } else {
      unpaired.push(a.id);
    }
  }
  return { pairs, unpaired };
}

// Everything a matchmaker should look at before booking these two.
export function pairFlags(a: Candidate, b: Candidate, s: MatchmakingSettings): string[] {
  const flags: string[] = [];
  if (a.gender && b.gender && a.gender !== b.gender) flags.push("Different gender");
  if (a.age != null && b.age != null && a.age < ADULT_AGE !== b.age < ADULT_AGE) {
    flags.push("Minor vs adult");
  }
  if (a.targetWeightLbs != null && b.targetWeightLbs != null) {
    const gap = Math.abs(a.targetWeightLbs - b.targetWeightLbs);
    if (gap > s.maxWeightGapLbs) flags.push(`${gap} lbs apart`);
  } else if (a.weightClass && b.weightClass) {
    if (a.weightClass.toLowerCase() !== b.weightClass.toLowerCase()) flags.push("Different class");
  } else if (a.sortLbs == null || b.sortLbs == null) {
    flags.push("Weight not set");
  }
  const fightGap = Math.abs(a.fights - b.fights);
  if (fightGap > s.maxFightGap) flags.push(`${fightGap} fights apart`);
  if (a.competingAs !== b.competingAs) flags.push("Pro vs amateur");
  if (a.gym && b.gym && a.gym === b.gym) flags.push("Same gym");
  return flags;
}

// The matchmaker's board as saved on the event (events.matchmaking.board), so
// it is shared between devices and can be shown on the public lineup page.
export type SavedBoard = {
  priorities: MatchKey[];
  // Roster entry ids; a slot can be empty while a pairing is being built.
  pairs: [string | null, string | null][];
  bench: string[];
};

export function parseBoard(raw: unknown): SavedBoard | null {
  const r = raw as { priorities?: unknown; pairs?: unknown; bench?: unknown } | null;
  if (!r || typeof r !== "object" || !Array.isArray(r.pairs) || !Array.isArray(r.bench)) {
    return null;
  }
  const id = (v: unknown) => (typeof v === "string" && v.length <= 64 ? v : null);
  return {
    priorities: (Array.isArray(r.priorities) ? r.priorities : []).filter((k): k is MatchKey =>
      (MATCH_KEYS as readonly unknown[]).includes(k),
    ),
    pairs: r.pairs
      .filter((p): p is unknown[] => Array.isArray(p))
      .slice(0, 500)
      .map((p) => [id(p[0]), id(p[1])] as [string | null, string | null]),
    bench: r.bench.map(id).filter((v): v is string => v != null).slice(0, 1000),
  };
}
