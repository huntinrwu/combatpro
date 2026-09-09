import Link from "next/link";
import { HeartPulse } from "lucide-react";

import type {
  Bout,
  ClearanceStatus,
  Corner,
  FighterClearanceSummary,
} from "@/lib/db/types";

export function BoutStatusAlerts({
  bout,
  isLive,
  weightClassOk,
  expectedWeightClass,
  worstMedical,
  red,
  blue,
  redClearance,
  blueClearance,
}: {
  bout: Bout;
  isLive: boolean;
  weightClassOk: boolean | null;
  expectedWeightClass: string | null;
  worstMedical: ClearanceStatus;
  red: { full_name: string } | null;
  blue: { full_name: string } | null;
  redClearance: FighterClearanceSummary | null;
  blueClearance: FighterClearanceSummary | null;
}) {
  return (
    <>
      {isLive && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2">
          <span className="relative inline-flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
          </span>
          <span className="text-sm font-semibold uppercase tracking-wider text-red-800 dark:text-red-200">
            Live now
          </span>
          <span className="text-xs text-red-700/80 dark:text-red-300/80">
            This bout is the current run-of-show entry. Ringside can see this
            {bout.scheduled_start_time && (
              <>
                {" · scheduled "}
                <span className="font-mono">{bout.scheduled_start_time}</span>
              </>
            )}
            .
          </span>
        </div>
      )}

      {weightClassOk === false && expectedWeightClass && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <div className="font-medium text-amber-800 dark:text-amber-200">
            Weight-class / contracted-weight mismatch
          </div>
          <div className="mt-1 text-xs text-amber-700/90 dark:text-amber-300/90">
            Recorded class <span className="font-mono">{bout.weight_class}</span> doesn&apos;t match
            the <span className="capitalize">{bout.sport}</span> canonical class for{" "}
            <span className="font-mono">{bout.contracted_weight_lbs}</span> lbs (expected{" "}
            <span className="font-mono">{expectedWeightClass}</span>). Check the bout — appears on
            the bout agreement PDF.
          </div>
        </div>
      )}

      {worstMedical !== "active" && (
        <div
          className={`mb-4 rounded-md border p-3 text-sm ${
            worstMedical === "expired"
              ? "border-red-500/50 bg-red-500/5"
              : worstMedical === "expiring"
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-muted-foreground/30 bg-muted/40"
          }`}
        >
          <div
            className={`flex items-center gap-2 font-medium ${
              worstMedical === "expired"
                ? "text-red-800 dark:text-red-200"
                : worstMedical === "expiring"
                  ? "text-amber-800 dark:text-amber-200"
                  : "text-foreground"
            }`}
          >
            <HeartPulse className="h-4 w-4" />
            {worstMedical === "expired" && "Medical clearances expired by fight night"}
            {worstMedical === "expiring" && "Medical clearances expiring near fight night"}
            {worstMedical === "missing" && "Medical clearances missing"}
          </div>
          <div className="mt-1.5 space-y-0.5 text-xs">
            {red && redClearance && redClearance.worstStatus !== "active" && bout.red_corner_fighter_id && (
              <MedicalLine
                fighterId={bout.red_corner_fighter_id}
                name={red.full_name}
                corner="red"
                counts={redClearance.counts}
              />
            )}
            {blue &&
              blueClearance &&
              blueClearance.worstStatus !== "active" &&
              bout.blue_corner_fighter_id && (
                <MedicalLine
                  fighterId={bout.blue_corner_fighter_id}
                  name={blue.full_name}
                  corner="blue"
                  counts={blueClearance.counts}
                />
              )}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Computed as of the event date. Also flagged on the bout agreement PDF.
          </div>
        </div>
      )}
    </>
  );
}

function MedicalLine({
  fighterId,
  name,
  corner,
  counts,
}: {
  fighterId: string;
  name: string;
  corner: Corner;
  counts: Record<ClearanceStatus, number>;
}) {
  const parts: string[] = [];
  if (counts.expired > 0) parts.push(`${counts.expired} expired`);
  if (counts.missing > 0) parts.push(`${counts.missing} missing`);
  if (counts.expiring > 0) parts.push(`${counts.expiring} expiring`);
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-1.5 w-1.5 rounded-full ${corner === "red" ? "bg-red-500" : "bg-blue-500"}`}
        aria-hidden
      />
      <Link href={`/fighters/${fighterId}#medical`} className="font-medium hover:underline">
        {name}
      </Link>
      <span className="text-muted-foreground">— {parts.join(" · ")}</span>
    </div>
  );
}
