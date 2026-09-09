import Link from "next/link";
import { Radio } from "lucide-react";

import type { BoutScorecard, Official } from "@/lib/db/types";

type JudgeInfo = { official_id: string; full_name: string };

export function ScorecardsSummary({
  boutId,
  totalRounds,
  judges,
  cards,
}: {
  boutId: string;
  totalRounds: number;
  judges: JudgeInfo[];
  cards: BoutScorecard[];
}) {
  if (judges.length === 0) return null;

  const byJudge = new Map<string, BoutScorecard[]>();
  for (const c of cards) {
    const arr = byJudge.get(c.judge_official_id) ?? [];
    arr.push(c);
    byJudge.set(c.judge_official_id, arr);
  }
  for (const arr of byJudge.values()) arr.sort((a, b) => a.round_number - b.round_number);

  const totalsByJudge = new Map<string, { red: number; blue: number }>();
  for (const [id, arr] of byJudge) {
    totalsByJudge.set(id, {
      red: arr.reduce((s, c) => s + c.red_score, 0),
      blue: arr.reduce((s, c) => s + c.blue_score, 0),
    });
  }

  const anyCards = cards.length > 0;
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      {/* Per-judge tallies */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {judges.map((j, idx) => {
          const t = totalsByJudge.get(j.official_id) ?? { red: 0, blue: 0 };
          const scored = (byJudge.get(j.official_id) ?? []).length;
          const leaning =
            t.red > t.blue ? "red" : t.blue > t.red ? "blue" : scored > 0 ? "even" : null;
          return (
            <div
              key={j.official_id}
              className="rounded-md border border-border/70 bg-muted/20 p-2.5"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="uppercase tracking-wide">
                  Judge {idx + 1} · {j.full_name}
                </span>
                <span className="font-mono">
                  {scored}/{totalRounds}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between font-mono text-lg font-semibold tabular-nums">
                <span
                  className={leaning === "red" ? "text-red-600" : "text-muted-foreground"}
                >
                  {t.red}
                </span>
                <span className="text-xs text-muted-foreground">–</span>
                <span
                  className={leaning === "blue" ? "text-blue-600" : "text-muted-foreground"}
                >
                  {t.blue}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Round-by-round grid */}
      {anyCards && (
        <div className="overflow-hidden rounded-md border border-border/70">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">Rd</th>
                {judges.map((j, idx) => (
                  <th key={j.official_id} className="px-2 py-1.5 font-medium">
                    J{idx + 1}
                  </th>
                ))}
                <th className="px-2 py-1.5 font-medium">KD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rounds.map((r) => {
                const rowCards = judges.map((j) =>
                  (byJudge.get(j.official_id) ?? []).find((c) => c.round_number === r),
                );
                const kdRed = rowCards.reduce((m, c) => Math.max(m, c?.knockdowns_red ?? 0), 0);
                const kdBlue = rowCards.reduce((m, c) => Math.max(m, c?.knockdowns_blue ?? 0), 0);
                const anyScored = rowCards.some(Boolean);
                return (
                  <tr key={r} className={anyScored ? "" : "text-muted-foreground/50"}>
                    <td className="px-2 py-1.5 font-mono">{r}</td>
                    {rowCards.map((c, idx) => (
                      <td key={idx} className="px-2 py-1.5 font-mono">
                        {c ? (
                          <>
                            <span
                              className={
                                c.red_score > c.blue_score
                                  ? "font-semibold text-red-600"
                                  : ""
                              }
                            >
                              {c.red_score}
                            </span>
                            <span className="mx-0.5 text-muted-foreground">–</span>
                            <span
                              className={
                                c.blue_score > c.red_score
                                  ? "font-semibold text-blue-600"
                                  : ""
                              }
                            >
                              {c.blue_score}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">
                      {kdRed || kdBlue ? `${kdRed}/${kdBlue}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!anyCards && (
        <p className="text-xs text-muted-foreground">
          Judges haven&apos;t submitted any rounds yet.
          {" "}
          <Link
            href={`/scoring/${boutId}/display`}
            className="inline-flex items-center gap-1 text-foreground hover:underline"
          >
            <Radio className="h-3 w-3" /> Open display
          </Link>
        </p>
      )}
    </div>
  );
}

// Small helper — pull the {official_id, full_name} shape out of a bout-detail
// assignment row, so the page can pass a clean array to <ScorecardsSummary>.
export function toJudgeInfo(
  assignment: { official_id: string },
  official: Pick<Official, "id" | "full_name"> | null | undefined,
): JudgeInfo {
  return { official_id: assignment.official_id, full_name: official?.full_name ?? "Judge" };
}
