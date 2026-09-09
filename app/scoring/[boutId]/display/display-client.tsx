"use client";

import { useEffect, useMemo, useState } from "react";
import { Radio } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import type { BoutScorecard } from "@/lib/db/types";

import type { JudgeSummary } from "./page";

type Props = {
  boutId: string;
  totalRounds: number;
  redName: string;
  blueName: string;
  judges: JudgeSummary[];
  initialCards: BoutScorecard[];
};

export function DisplayClient({
  boutId,
  totalRounds,
  redName,
  blueName,
  judges,
  initialCards,
}: Props) {
  const [cards, setCards] = useState<BoutScorecard[]>(initialCards);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`scorecards:${boutId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bout_scorecards",
          filter: `bout_id=eq.${boutId}`,
        },
        (payload) => {
          setCards((prev) => {
            if (payload.eventType === "DELETE") {
              const oldId = (payload.old as BoutScorecard | null)?.id;
              return oldId ? prev.filter((c) => c.id !== oldId) : prev;
            }
            const row = payload.new as BoutScorecard;
            const existingIdx = prev.findIndex((c) => c.id === row.id);
            if (existingIdx >= 0) {
              const next = [...prev];
              next[existingIdx] = row;
              return next;
            }
            return [...prev, row];
          });
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boutId]);

  const byJudge = useMemo(() => {
    const m = new Map<string, BoutScorecard[]>();
    for (const c of cards) {
      const arr = m.get(c.judge_official_id) ?? [];
      arr.push(c);
      m.set(c.judge_official_id, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.round_number - b.round_number);
    return m;
  }, [cards]);

  const rounds = useMemo(
    () => Array.from({ length: totalRounds }, (_, i) => i + 1),
    [totalRounds],
  );

  const totalsByJudge = useMemo(() => {
    const totals = new Map<string, { red: number; blue: number }>();
    for (const [judgeId, arr] of byJudge) {
      totals.set(judgeId, {
        red: arr.reduce((s, c) => s + c.red_score, 0),
        blue: arr.reduce((s, c) => s + c.blue_score, 0),
      });
    }
    return totals;
  }, [byJudge]);

  const leadCounts = useMemo(() => {
    let red = 0;
    let blue = 0;
    let draw = 0;
    for (const t of totalsByJudge.values()) {
      if (t.red > t.blue) red++;
      else if (t.blue > t.red) blue++;
      else draw++;
    }
    return { red, blue, draw };
  }, [totalsByJudge]);

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Live scorecard · cage-side
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="text-red-600">{redName}</span>
            <span className="mx-3 text-muted-foreground">vs</span>
            <span className="text-blue-600">{blueName}</span>
          </h1>
        </div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
            connected
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-border text-muted-foreground"
          }`}
        >
          <Radio className={`h-3 w-3 ${connected ? "animate-pulse" : ""}`} />
          {connected ? "Live" : "Connecting…"}
        </div>
      </header>

      {judges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No judges assigned. Assign judges on the bout detail page.
        </div>
      ) : (
        <>
          {/* Big scoreboard */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
            {judges.map((j, idx) => {
              const totals = totalsByJudge.get(j.id) ?? { red: 0, blue: 0 };
              const scored = (byJudge.get(j.id) ?? []).length;
              return (
                <div
                  key={j.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Judge {idx + 1} · {j.full_name}
                  </div>
                  <div className="flex items-baseline justify-between font-mono text-4xl font-semibold tabular-nums">
                    <span className="text-red-600">{totals.red}</span>
                    <span className="text-sm text-muted-foreground">
                      {scored}/{totalRounds}
                    </span>
                    <span className="text-blue-600">{totals.blue}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Round-by-round grid */}
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Round</th>
                  {judges.map((j, idx) => (
                    <th key={j.id} className="px-3 py-2 font-medium">
                      J{idx + 1} <span className="text-muted-foreground/70">R-B</span>
                    </th>
                  ))}
                  <th className="px-3 py-2 font-medium">KDs (R/B)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rounds.map((r) => {
                  const rowCards = judges.map((j) =>
                    (byJudge.get(j.id) ?? []).find((c) => c.round_number === r),
                  );
                  // KDs are objective — every judge marks the same event.
                  // Show the max across judges rather than summing.
                  const kdRed = rowCards.reduce((m, c) => Math.max(m, c?.knockdowns_red ?? 0), 0);
                  const kdBlue = rowCards.reduce((m, c) => Math.max(m, c?.knockdowns_blue ?? 0), 0);
                  const anyScored = rowCards.some(Boolean);
                  return (
                    <tr
                      key={r}
                      className={anyScored ? "" : "text-muted-foreground/60"}
                    >
                      <td className="px-3 py-2 font-mono">{r}</td>
                      {rowCards.map((c, idx) => (
                        <td key={idx} className="px-3 py-2 font-mono">
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
                              <span className="mx-1 text-muted-foreground">–</span>
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
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {kdRed || kdBlue ? `${kdRed}/${kdBlue}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Standings summary */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Judges currently favoring
            </div>
            <div className="mt-1 flex items-baseline gap-4 font-mono">
              <span className="text-red-600">
                {redName}: <span className="text-xl font-semibold">{leadCounts.red}</span>
              </span>
              <span className="text-muted-foreground">
                Even: <span className="text-xl font-semibold">{leadCounts.draw}</span>
              </span>
              <span className="text-blue-600">
                {blueName}: <span className="text-xl font-semibold">{leadCounts.blue}</span>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
