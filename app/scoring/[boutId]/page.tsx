import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Tv } from "lucide-react";

import { submitScorecard } from "./actions";
import { db } from "@/lib/db/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type {
  Bout,
  BoutScorecard,
  EventOfficial,
  Fighter,
  Official,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

const SCORE_OPTIONS = [10, 9, 8, 7, 6];

function judgeTotalsFor(rows: BoutScorecard[]): { red: number; blue: number } {
  return rows.reduce(
    (acc, r) => ({ red: acc.red + r.red_score, blue: acc.blue + r.blue_score }),
    { red: 0, blue: 0 },
  );
}

export default async function JudgeScoringPage({
  params,
  searchParams,
}: {
  params: Promise<{ boutId: string }>;
  searchParams: Promise<{ judge?: string; round?: string }>;
}) {
  const { boutId } = await params;
  const { judge: judgeParam, round: roundParam } = await searchParams;
  const supabase = db();

  const { data: bout } = await supabase
    .from("bouts")
    .select("*")
    .eq("id", boutId)
    .maybeSingle<Bout>();

  if (!bout) notFound();

  // Load judges from the event roster — same pool for every bout on the card.
  const { data: rosterJudges } = await supabase
    .from("event_officials")
    .select("*")
    .eq("event_id", bout.event_id)
    .eq("event_role", "judge");

  const judgeIds = ((rosterJudges ?? []) as EventOfficial[]).map(
    (r) => r.official_id,
  );
  const { data: judges } = judgeIds.length
    ? await supabase
        .from("officials")
        .select("id, full_name")
        .in("id", judgeIds)
    : { data: [] as Pick<Official, "id" | "full_name">[] };

  // Judge picker if none selected
  const activeJudgeId = judgeParam && judgeIds.includes(judgeParam) ? judgeParam : null;

  if (!activeJudgeId) {
    return (
      <JudgePicker
        boutId={boutId}
        judges={(judges ?? []) as Pick<Official, "id" | "full_name">[]}
      />
    );
  }

  // Fighter names
  const fighterIds = [bout.red_corner_fighter_id, bout.blue_corner_fighter_id].filter(
    (x): x is string => Boolean(x),
  );
  const fighterMap = new Map<string, Pick<Fighter, "id" | "full_name">>();
  if (fighterIds.length) {
    const { data: fs } = await supabase
      .from("fighters")
      .select("id, full_name")
      .in("id", fighterIds);
    for (const f of fs ?? []) fighterMap.set(f.id, f);
  }
  const red = bout.red_corner_fighter_id ? fighterMap.get(bout.red_corner_fighter_id) : null;
  const blue = bout.blue_corner_fighter_id ? fighterMap.get(bout.blue_corner_fighter_id) : null;
  const judgeName =
    (judges ?? []).find((j) => j.id === activeJudgeId)?.full_name ?? "Judge";

  // This judge's cards
  const { data: myCards } = await supabase
    .from("bout_scorecards")
    .select("*")
    .eq("bout_id", boutId)
    .eq("judge_official_id", activeJudgeId)
    .order("round_number");

  const cards = (myCards ?? []) as BoutScorecard[];
  const totalRounds = bout.rounds ?? 10;
  const scoredRounds = new Set(cards.map((c) => c.round_number));
  const nextRound = (() => {
    for (let i = 1; i <= totalRounds; i++) {
      if (!scoredRounds.has(i)) return i;
    }
    return totalRounds; // all scored — allow re-scoring last
  })();
  const activeRound = roundParam ? Number.parseInt(roundParam, 10) || nextRound : nextRound;
  const existingCard = cards.find((c) => c.round_number === activeRound);
  const totals = judgeTotalsFor(cards);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <Link
          href={`/events/${bout.event_id}/bouts/${boutId}`}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Bout detail
        </Link>
        <Link
          href={`/scoring/${boutId}/display`}
          className="inline-flex items-center gap-1 hover:text-foreground"
          target="_blank"
        >
          <Tv className="h-3.5 w-3.5" />
          Open display
        </Link>
      </div>

      <header className="mb-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Scoring as {judgeName}
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          <span className="text-red-600">{red?.full_name ?? "Red"}</span>
          <span className="mx-2 text-muted-foreground">vs</span>
          <span className="text-blue-600">{blue?.full_name ?? "Blue"}</span>
        </h1>
        <div className="mt-1 text-sm text-muted-foreground">
          Round {activeRound} of {totalRounds}
          {" · "}Running: <span className="font-mono text-foreground">
            {totals.red}–{totals.blue}
          </span>
        </div>
      </header>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">
            Score round {activeRound}
            {existingCard && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (already submitted — will overwrite)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submitScorecard} className="space-y-4">
            <input type="hidden" name="bout_id" value={boutId} />
            <input type="hidden" name="judge_official_id" value={activeJudgeId} />
            <input type="hidden" name="round_number" value={activeRound} />

            <div className="grid gap-4 sm:grid-cols-2">
              <CornerBlock
                corner="red"
                fighterName={red?.full_name ?? "Red corner"}
                defaultScore={existingCard?.red_score ?? 10}
                defaultKds={existingCard?.knockdowns_red ?? 0}
                scoreName="red_score"
                kdName="knockdowns_red"
              />
              <CornerBlock
                corner="blue"
                fighterName={blue?.full_name ?? "Blue corner"}
                defaultScore={existingCard?.blue_score ?? 10}
                defaultKds={existingCard?.knockdowns_blue ?? 0}
                scoreName="blue_score"
                kdName="knockdowns_blue"
              />
            </div>

            <div>
              <label
                htmlFor="notes"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Notes (optional)
              </label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={existingCard?.notes ?? ""}
                placeholder='e.g. "Deducted 1 pt from red for low blow."'
              />
            </div>

            <Button type="submit" className="w-full" size="lg">
              Submit round {activeRound}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rounds scored yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5">Round</th>
                  <th className="py-1.5">Red</th>
                  <th className="py-1.5">Blue</th>
                  <th className="py-1.5">KD (R/B)</th>
                  <th className="py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cards.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1.5 font-mono">{c.round_number}</td>
                    <td className="py-1.5 font-mono text-red-600">{c.red_score}</td>
                    <td className="py-1.5 font-mono text-blue-600">{c.blue_score}</td>
                    <td className="py-1.5 font-mono text-muted-foreground">
                      {c.knockdowns_red}/{c.knockdowns_blue}
                    </td>
                    <td className="py-1.5 text-right">
                      <Link
                        href={`/scoring/${boutId}?judge=${activeJudgeId}&round=${c.round_number}`}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        edit
                      </Link>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-foreground/40">
                  <td className="py-1.5 text-xs uppercase tracking-wide">Totals</td>
                  <td className="py-1.5 font-mono font-semibold text-red-600">
                    {totals.red}
                  </td>
                  <td className="py-1.5 font-mono font-semibold text-blue-600">
                    {totals.blue}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CornerBlock({
  corner,
  fighterName,
  defaultScore,
  defaultKds,
  scoreName,
  kdName,
}: {
  corner: "red" | "blue";
  fighterName: string;
  defaultScore: number;
  defaultKds: number;
  scoreName: string;
  kdName: string;
}) {
  const isRed = corner === "red";
  return (
    <div
      className={`rounded-lg border p-4 ${
        isRed
          ? "border-red-500/30 bg-red-500/5"
          : "border-blue-500/30 bg-blue-500/5"
      }`}
    >
      <div
        className={`mb-2 text-xs font-medium uppercase tracking-wide ${
          isRed ? "text-red-700 dark:text-red-400" : "text-blue-700 dark:text-blue-400"
        }`}
      >
        {corner} corner
      </div>
      <div className="mb-3 font-heading text-lg font-medium">{fighterName}</div>

      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        Score
      </label>
      <NativeSelect name={scoreName} defaultValue={String(defaultScore)}>
        {SCORE_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </NativeSelect>

      <label className="mt-3 mb-1 block text-xs font-medium text-muted-foreground">
        Knockdowns
      </label>
      <NativeSelect name={kdName} defaultValue={String(defaultKds)}>
        {[0, 1, 2, 3].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function JudgePicker({
  boutId,
  judges,
}: {
  boutId: string;
  judges: Pick<Official, "id" | "full_name">[];
}) {
  if (judges.length === 0) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-semibold">No judges on roster</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add judges to the event roster on the Officials tab before scoring.
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Pick your judge seat
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tap your name to start scoring.
      </p>
      <ul className="mt-6 space-y-2">
        {judges.map((j, idx) => (
          <li key={j.id}>
            <Link
              href={`/scoring/${boutId}?judge=${j.id}`}
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-foreground/40 hover:bg-muted/40"
            >
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Judge {idx + 1}
                </div>
                <div className="font-medium">{j.full_name}</div>
              </div>
              <span className="text-muted-foreground">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
