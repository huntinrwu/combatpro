import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, HeartPulse, Search } from "lucide-react";

import { db } from "@/lib/db/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CLEARANCE_STATUS_RANK,
  MEDICAL_RECORD_KINDS,
  daysUntil,
  fighterClearanceSummary,
  type ClearanceStatus,
  type Fighter,
  type FighterMedicalRecord,
  type MedicalRecordKind,
} from "@/lib/db/types";
import { fmtDateShort } from "@/lib/format-utils";
import { CLEARANCE_STATUS_META as STATUS_META } from "@/lib/ui-config";
import { requireModuleAccess } from "@/lib/auth/session";

type FighterRow = Pick<Fighter, "id" | "full_name" | "primary_sport">;

// Only the columns the clearance summary reads — the full row also carries
// physician / facility / notes text this dashboard never shows.
const RECORD_COLUMNS = "id, fighter_id, kind, issued_on, expires_on";

type RecordRow = Pick<
  FighterMedicalRecord,
  "id" | "fighter_id" | "kind" | "issued_on" | "expires_on"
>;

function statusIcon(status: ClearanceStatus) {
  if (status === "active") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "expiring") return <Clock className="h-3 w-3" />;
  return <AlertCircle className="h-3 w-3" />;
}

function soonestExpiry(records: RecordRow[]): RecordRow | null {
  let best: RecordRow | null = null;
  for (const r of records) {
    if (!r.expires_on) continue;
    if (!best || r.expires_on < best.expires_on!) best = r;
  }
  return best;
}

export default async function MedicalPage() {
  await requireModuleAccess("medical");
  const supabase = db();
  const [{ data: fighters }, { data: records }] = await Promise.all([
    supabase.from("fighters").select("id, full_name, primary_sport").order("full_name"),
    supabase.from("fighter_medical_records").select(RECORD_COLUMNS),
  ]);

  const recordsByFighter = new Map<string, RecordRow[]>();
  for (const r of (records ?? []) as RecordRow[]) {
    const arr = recordsByFighter.get(r.fighter_id) ?? [];
    arr.push(r);
    recordsByFighter.set(r.fighter_id, arr);
  }

  const rows = ((fighters ?? []) as FighterRow[]).map((f) => {
    const fRecords = recordsByFighter.get(f.id) ?? [];
    // The summary only reads kind / issued_on / expires_on, all selected above.
    const summary = fighterClearanceSummary(fRecords as FighterMedicalRecord[]);
    const soon = soonestExpiry(fRecords);
    return { fighter: f, summary, soonestExpiry: soon };
  });

  rows.sort((a, b) => {
    const rank =
      CLEARANCE_STATUS_RANK[b.summary.worstStatus] - CLEARANCE_STATUS_RANK[a.summary.worstStatus];
    if (rank !== 0) return rank;
    const aExp = a.soonestExpiry?.expires_on ?? "9999-12-31";
    const bExp = b.soonestExpiry?.expires_on ?? "9999-12-31";
    return aExp < bExp ? -1 : aExp > bExp ? 1 : 0;
  });

  const totals: Record<ClearanceStatus, number> = { active: 0, expiring: 0, expired: 0, missing: 0 };
  for (const r of rows) totals[r.summary.worstStatus]++;

  return (
    <>
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <HeartPulse className="h-6 w-6 text-muted-foreground" />
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Medical</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Clearance dashboard. Sorted by soonest-expiring first — expired and missing at the top.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className={STATUS_META.expired.className}>
            {totals.expired} expired
          </Badge>
          <Badge variant="outline" className={STATUS_META.missing.className}>
            {totals.missing} missing docs
          </Badge>
          <Badge variant="outline" className={STATUS_META.expiring.className}>
            {totals.expiring} expiring
          </Badge>
          <Badge variant="outline" className={STATUS_META.active.className}>
            {totals.active} all-clear
          </Badge>
        </div>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No fighters in the registry yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fighters ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {rows.map(({ fighter, summary, soonestExpiry: soon }) => (
                <FighterRow
                  key={fighter.id}
                  fighter={fighter}
                  summary={summary}
                  soonestExpiry={soon}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function FighterRow({
  fighter,
  summary,
  soonestExpiry,
}: {
  fighter: FighterRow;
  summary: ReturnType<typeof fighterClearanceSummary>;
  soonestExpiry: RecordRow | null;
}) {
  const days = soonestExpiry?.expires_on ? daysUntil(soonestExpiry.expires_on) : null;
  const soonKind = soonestExpiry
    ? MEDICAL_RECORD_KINDS.find((k) => k.value === soonestExpiry.kind)?.label
    : null;

  return (
    <Link
      href={`/fighters/${fighter.id}`}
      className="flex items-start gap-4 p-4 transition-colors hover:bg-muted/40"
    >
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{fighter.full_name}</span>
          <Badge variant="outline" className="capitalize text-xs">
            {fighter.primary_sport}
          </Badge>
          <Badge variant="outline" className={STATUS_META[summary.worstStatus].className}>
            {statusIcon(summary.worstStatus)}
            {STATUS_META[summary.worstStatus].label}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {summary.perKind.map((p) => (
            <KindPill key={p.kind} kind={p.kind} status={p.status} />
          ))}
        </div>
      </div>
      <div className="text-right text-xs text-muted-foreground">
        {soonestExpiry?.expires_on ? (
          <>
            <div className="font-medium text-foreground">
              {days != null && days < 0 ? `${-days}d overdue` : days != null ? `${days}d left` : "—"}
            </div>
            <div>
              {soonKind}
              <br />
              expires{" "}
              {fmtDateShort(soonestExpiry.expires_on)}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <Search className="h-3 w-3" />
            No records yet
          </div>
        )}
      </div>
    </Link>
  );
}

function KindPill({ kind, status }: { kind: MedicalRecordKind; status: ClearanceStatus }) {
  const label = MEDICAL_RECORD_KINDS.find((k) => k.value === kind)?.label ?? kind;
  const shortLabel = label.split(" ")[0];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
        status === "active"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : status === "expiring"
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : status === "expired"
              ? "bg-red-500/15 text-red-700 dark:text-red-300"
              : "bg-muted text-muted-foreground"
      }`}
      title={`${label}: ${status}`}
    >
      {shortLabel}
    </span>
  );
}
