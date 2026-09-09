"use client";

import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  deleteFightRecord,
  setFightRecordConfidence,
} from "../records-actions";
import { backfillDeclaredFightRecords } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FIGHT_CONFIDENCE,
  FIGHT_CONFIDENCE_META,
  type FightConfidence,
  type FightOutcome,
  type FightRecord,
} from "@/lib/db/types";

const OUTCOME_TONE: Record<FightOutcome, string> = {
  win: "text-emerald-700 dark:text-emerald-300",
  loss: "text-red-700 dark:text-red-300",
  draw: "text-muted-foreground",
  no_contest: "text-muted-foreground",
};

function tallyByConfidence(records: FightRecord[]) {
  const out: Record<FightConfidence, number> = {
    verified: 0,
    corroborated: 0,
    reported: 0,
    disputed: 0,
  };
  for (const r of records) out[r.confidence]++;
  return out;
}

function record(records: FightRecord[]): { w: number; l: number; d: number; nc: number } {
  let w = 0,
    l = 0,
    d = 0,
    nc = 0;
  for (const r of records) {
    if (r.result === "win") w++;
    else if (r.result === "loss") l++;
    else if (r.result === "draw") d++;
    else nc++;
  }
  return { w, l, d, nc };
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function FightRecordsCard({
  fighterId,
  records,
  declared,
  isStaff,
}: {
  fighterId: string;
  records: FightRecord[];
  declared: {
    pro: { w: number; l: number; d: number };
    am: { w: number; l: number; d: number };
  };
  isStaff: boolean;
}) {
  const tally = tallyByConfidence(records);
  const rec = record(records);
  const proRec = record(records.filter((r) => r.is_pro));
  const amRec = record(records.filter((r) => !r.is_pro));
  const declaredTotal =
    declared.pro.w + declared.pro.l + declared.pro.d +
    declared.am.w + declared.am.l + declared.am.d;
  const gap =
    declaredTotal - (proRec.w + proRec.l + proRec.d + amRec.w + amRec.l + amRec.d);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/70 p-4">
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            CombatPro record
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
            {rec.w}–{rec.l}–{rec.d}
            {rec.nc > 0 && <span className="text-sm text-muted-foreground"> ({rec.nc} NC)</span>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Pro <span className="font-mono">{proRec.w}–{proRec.l}–{proRec.d}</span>
            {" · "}
            Am <span className="font-mono">{amRec.w}–{amRec.l}–{amRec.d}</span>
          </div>
        </div>
        <div className="rounded-lg border border-border/70 p-4">
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {records.length} recorded bout{records.length === 1 ? "" : "s"}
          </div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {FIGHT_CONFIDENCE.map((c) => {
              const meta = FIGHT_CONFIDENCE_META[c];
              return (
                <li key={c} className="flex items-center gap-2">
                  <span aria-hidden>{meta.icon}</span>
                  <span className="font-mono w-6 text-right">{tally[c]}</span>
                  <span className="text-muted-foreground">{meta.label.toLowerCase()}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Sourced from CombatPro events + community submissions.
        </div>
        <div className="flex items-center gap-2">
          {isStaff && gap > 0 && records.length > 0 && (
            <form action={backfillDeclaredFightRecords}>
              <input type="hidden" name="fighter_id" value={fighterId} />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                title={`Declared record has ${gap} more bout${gap === 1 ? "" : "s"} than the ledger. Adds placeholder rows for the difference.`}
              >
                <Plus className="h-3 w-3" />
                Backfill {gap} declared
              </Button>
            </form>
          )}
          <Button
            size="sm"
            variant="outline"
            render={
              <Link href={`/fighters/${fighterId}/records/new`}>
                <Plus className="h-3 w-3" />
                Submit a fight
              </Link>
            }
          />
        </div>
      </div>

      {records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <div className="text-sm text-muted-foreground">
            No bout-by-bout records yet.
          </div>
          {declaredTotal > 0 ? (
            <>
              <div className="mt-1 text-xs text-muted-foreground">
                Declared record on file: Pro{" "}
                <span className="font-mono">
                  {declared.pro.w}–{declared.pro.l}–{declared.pro.d}
                </span>{" "}
                · Am{" "}
                <span className="font-mono">
                  {declared.am.w}–{declared.am.l}–{declared.am.d}
                </span>
                . Backfill to seed placeholder rows you can fill in later.
              </div>
              {isStaff && (
                <form
                  action={backfillDeclaredFightRecords}
                  className="mt-3 inline-block"
                >
                  <input type="hidden" name="fighter_id" value={fighterId} />
                  <Button type="submit" size="sm" variant="secondary">
                    <Plus className="h-3 w-3" />
                    Backfill from declared record
                  </Button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="mt-1 text-xs text-muted-foreground">
                Add individual bouts to build a sourced history.
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                render={
                  <Link href={`/fighters/${fighterId}/records/new`}>
                    <Plus className="h-3 w-3" />
                    Add first bout
                  </Link>
                }
              />
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Opponent</th>
                <th className="px-3 py-2 font-medium">Result</th>
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((r) => {
                const meta = FIGHT_CONFIDENCE_META[r.confidence];
                return (
                  <tr key={r.id} className="align-top hover:bg-muted/40">
                    <td className="px-3 py-2 text-xs">
                      <div>{fmtDate(r.fight_date)}</div>
                      {r.event_name && (
                        <div className="text-muted-foreground">{r.event_name}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.opponent_fighter_id ? (
                        <Link
                          href={`/fighters/${r.opponent_fighter_id}`}
                          className="hover:underline"
                        >
                          {r.opponent_name}
                        </Link>
                      ) : (
                        r.opponent_name
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        {r.is_pro ? "Pro" : "Am"}
                        {r.weight_class && ` · ${r.weight_class}`}
                        {r.sport && ` · ${r.sport}`}
                      </div>
                    </td>
                    <td className={`px-3 py-2 font-medium capitalize ${OUTCOME_TONE[r.result]}`}>
                      {r.result.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.method ?? "—"}
                      {r.round_finished && ` · R${r.round_finished}`}
                      {r.time_finished && ` (${r.time_finished})`}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={meta.className}>
                        <span className="mr-1" aria-hidden>{meta.icon}</span>
                        {meta.label}
                      </Badge>
                      {r.source_label && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {r.source_label}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isStaff && (
                        <div className="flex justify-end gap-1">
                          <form action={setFightRecordConfidence}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="fighter_id" value={fighterId} />
                            <select
                              name="confidence"
                              defaultValue={r.confidence}
                              onChange={(e) => e.currentTarget.form?.requestSubmit()}
                              className="rounded-md border border-border/60 bg-transparent px-1 py-0.5 text-xs"
                              aria-label="Set confidence"
                            >
                              {FIGHT_CONFIDENCE.map((c) => (
                                <option key={c} value={c}>
                                  {FIGHT_CONFIDENCE_META[c].icon} {FIGHT_CONFIDENCE_META[c].label}
                                </option>
                              ))}
                            </select>
                          </form>
                          <Link
                            href={`/fighters/${fighterId}/records/${r.id}/edit`}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Edit record"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <form action={deleteFightRecord}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="fighter_id" value={fighterId} />
                            <button
                              type="submit"
                              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                              aria-label="Delete record"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
