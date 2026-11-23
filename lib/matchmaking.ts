import type { BoutClass } from "./db/types";

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
  // Display only; not used when pairing.
  age?: number | null;
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
