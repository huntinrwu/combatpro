"use client";

import { Trash2 } from "lucide-react";

import {
  deleteFighterWeightLog,
  logFighterWeight,
} from "../weight-actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import type { FighterWeightLogEntry } from "@/lib/db/types";
import { lbsToKg } from "@/lib/units";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function WeightTrackingCard({
  fighterId,
  walkingWeightLbs,
  walkingWeightUpdatedAt,
  log,
  isStaff,
}: {
  fighterId: string;
  walkingWeightLbs: number | string | null;
  walkingWeightUpdatedAt: string | null;
  log: FighterWeightLogEntry[];
  isStaff: boolean;
}) {
  const current = toNum(walkingWeightLbs);
  const trend = trendDelta(log);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/70 p-4">
        <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Current walking weight
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {current != null ? `${current} lbs` : "—"}
          </span>
          {current != null && (
            <span className="text-xs text-muted-foreground">
              ({(lbsToKg(current) ?? 0).toFixed(1)} kg)
            </span>
          )}
          {trend != null && trend !== 0 && (
            <span
              className={`text-xs font-medium ${
                trend > 0
                  ? "text-red-700 dark:text-red-300"
                  : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {trend > 0 ? "+" : ""}
              {trend.toFixed(1)} vs previous
            </span>
          )}
        </div>
        {walkingWeightUpdatedAt && (
          <div className="mt-1 text-xs text-muted-foreground">
            Updated {fmt(walkingWeightUpdatedAt)}
          </div>
        )}
      </div>

      <form
        action={logFighterWeight}
        className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border/60 bg-muted/20 p-3"
      >
        <input type="hidden" name="fighter_id" value={fighterId} />
        <FormField label="Weight (lbs)" htmlFor="weight_lbs" className="w-32">
          <Input
            id="weight_lbs"
            name="weight_lbs"
            type="number"
            step="0.1"
            min={60}
            max={500}
            required
          />
        </FormField>
        <FormField label="Source" htmlFor="source" className="flex-1 min-w-[160px]">
          <Input id="source" name="source" placeholder="e.g. gym scale, official weigh-in" />
        </FormField>
        <FormField label="Notes" htmlFor="notes" className="flex-1 min-w-[160px]">
          <Input id="notes" name="notes" placeholder="optional" />
        </FormField>
        <Button type="submit">Log weight</Button>
      </form>

      {log.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Weight</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {log.map((entry) => {
                const w = toNum(entry.weight_lbs) ?? 0;
                return (
                <tr key={entry.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 text-xs">{fmt(entry.recorded_at)}</td>
                  <td className="px-3 py-2 font-mono">
                    {w} lbs
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({(lbsToKg(w) ?? 0).toFixed(1)} kg)
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {entry.source ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {entry.notes ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isStaff && (
                      <form action={deleteFighterWeightLog}>
                        <input type="hidden" name="id" value={entry.id} />
                        <input type="hidden" name="fighter_id" value={fighterId} />
                        <button
                          type="submit"
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                          aria-label="Delete entry"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
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

function trendDelta(log: FighterWeightLogEntry[]): number | null {
  if (log.length < 2) return null;
  const latest = toNum(log[0].weight_lbs);
  const prev = toNum(log[1].weight_lbs);
  if (latest == null || prev == null) return null;
  return latest - prev;
}
