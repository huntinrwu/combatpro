import { AlertCircle, CheckCircle2, Clock, HeartPulse, Trash2 } from "lucide-react";

import { addMedicalRecord, deleteMedicalRecord } from "../medical-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import {
  MEDICAL_RECORD_KINDS,
  daysUntil,
  fighterClearanceSummary,
  type ClearanceStatus,
  type FighterMedicalRecord,
  type MedicalRecordKind,
} from "@/lib/db/types";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_META: Record<ClearanceStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  },
  expiring: {
    label: "Expiring",
    className: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  },
  expired: {
    label: "Expired",
    className: "border-red-500/50 text-red-700 dark:text-red-300",
  },
  missing: {
    label: "Missing",
    className: "border-muted-foreground/40 text-muted-foreground",
  },
};

export function MedicalClearancesCard({
  fighterId,
  records,
}: {
  fighterId: string;
  records: FighterMedicalRecord[];
}) {
  const summary = fighterClearanceSummary(records);
  const historyByKind = new Map<MedicalRecordKind, FighterMedicalRecord[]>();
  for (const r of records) {
    const arr = historyByKind.get(r.kind) ?? [];
    arr.push(r);
    historyByKind.set(r.kind, arr);
  }
  for (const arr of historyByKind.values()) {
    arr.sort((a, b) => (a.issued_on < b.issued_on ? 1 : -1));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs">
        <HeartPulse className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Clearance summary</span>
        <span className="text-muted-foreground">·</span>
        <Badge variant="outline" className={STATUS_META[summary.worstStatus].className}>
          {statusIcon(summary.worstStatus)}
          {STATUS_META[summary.worstStatus].label}
        </Badge>
        <span className="ml-auto text-muted-foreground">
          {summary.counts.active} active · {summary.counts.expiring} expiring · {summary.counts.expired} expired · {summary.counts.missing} missing
        </span>
      </div>

      {summary.perKind.map(({ kind, status, record }) => {
        const spec = MEDICAL_RECORD_KINDS.find((k) => k.value === kind)!;
        const history = historyByKind.get(kind) ?? [];
        const days = record?.expires_on ? daysUntil(record.expires_on) : null;

        return (
          <div key={kind} className="rounded-lg border border-border/70 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{spec.label}</span>
                  <Badge variant="outline" className={STATUS_META[status].className}>
                    {statusIcon(status)}
                    {STATUS_META[status].label}
                  </Badge>
                  {record?.expires_on && (
                    <span className="text-xs text-muted-foreground">
                      Expires {fmtDate(record.expires_on)}
                      {days != null && (
                        <> ({days >= 0 ? `${days} days left` : `${-days} days ago`})</>
                      )}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{spec.hint}</p>
                {record && (
                  <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    <div>Issued {fmtDate(record.issued_on)}</div>
                    {record.issuing_physician && <div>Physician: {record.issuing_physician}</div>}
                    {record.issuing_facility && <div>Facility: {record.issuing_facility}</div>}
                    {record.reference && <div>Ref: {record.reference}</div>}
                    {record.notes && (
                      <div className="italic">&ldquo;{record.notes}&rdquo;</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <form
              action={addMedicalRecord}
              className="mt-3 grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
            >
              <input type="hidden" name="fighter_id" value={fighterId} />
              <input type="hidden" name="kind" value={kind} />
              <FormField label="Issued" htmlFor={`${kind}_issued`}>
                <Input id={`${kind}_issued`} name="issued_on" type="date" required />
              </FormField>
              <FormField
                label="Expires"
                htmlFor={`${kind}_expires`}
                hint={`Default: +${spec.default_expiry_months}mo`}
              >
                <Input id={`${kind}_expires`} name="expires_on" type="date" />
              </FormField>
              <FormField label="Physician" htmlFor={`${kind}_phys`}>
                <Input id={`${kind}_phys`} name="issuing_physician" placeholder="Dr. Ruiz" />
              </FormField>
              <FormField label="Facility / Ref" htmlFor={`${kind}_ref`}>
                <Input id={`${kind}_ref`} name="reference" placeholder="Broward Med. Center" />
              </FormField>
              <div className="flex items-end">
                <Button type="submit" size="sm">
                  Add
                </Button>
              </div>
            </form>

            {history.length > 1 && (
              <details className="mt-3 border-t border-border/60 pt-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  History ({history.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2">
                      <span>
                        Issued {fmtDate(h.issued_on)}
                        {h.expires_on && <> · expires {fmtDate(h.expires_on)}</>}
                        {h.issuing_physician && <> · {h.issuing_physician}</>}
                      </span>
                      <form action={deleteMedicalRecord}>
                        <input type="hidden" name="id" value={h.id} />
                        <input type="hidden" name="fighter_id" value={fighterId} />
                        <Button type="submit" size="icon-sm" variant="ghost" aria-label="Delete">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

function statusIcon(status: ClearanceStatus) {
  if (status === "active") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "expiring") return <Clock className="h-3 w-3" />;
  return <AlertCircle className="h-3 w-3" />;
}
