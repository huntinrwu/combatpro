import Link from "next/link";
import { AlertCircle, Check, HeartPulse, RotateCcw, Scale, ShieldCheck, UserCheck, X } from "lucide-react";

import {
  clearWeighIn,
  recordWeighIn,
  toggleCheckIn,
  toggleClearedToFight,
  toggleMedicalClearance,
} from "../checkin-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import {
  checkinProgress,
  fighterClearanceSummary,
  weighInStatus,
  type BoutFighterCheck,
  type Corner,
  type Fighter,
} from "@/lib/db/types";

function formatTimestamp(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const CORNER_DOT: Record<Corner, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
};

const WEIGH_STATUS_VARIANT = {
  on: "default",
  under: "secondary",
  over: "destructive",
  unknown: "outline",
} as const;

const WEIGH_STATUS_LABEL = {
  on: "On contract",
  under: "Under contract",
  over: "OVER contract",
  unknown: "—",
} as const;

export function CheckinCorner({
  corner,
  fighter,
  check,
  contractedLbs,
  boutId,
  eventId,
  clearance,
}: {
  corner: Corner;
  fighter: Pick<Fighter, "id" | "full_name"> | null | undefined;
  check: BoutFighterCheck | null;
  contractedLbs: number | null;
  boutId: string;
  eventId: string;
  clearance: ReturnType<typeof fighterClearanceSummary> | null;
}) {
  const progress = checkinProgress(check);
  const status = weighInStatus(contractedLbs, check?.weigh_in_lbs ?? null);
  const overageLbs =
    contractedLbs != null && check?.weigh_in_lbs != null
      ? check.weigh_in_lbs - contractedLbs
      : null;

  return (
    <div className="space-y-4 rounded-lg border border-border/70 p-4">
      <header className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${CORNER_DOT[corner]}`} />
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {corner === "red" ? "Red corner" : "Blue corner"}
          </div>
          <div className="font-medium">{fighter?.full_name ?? "TBD"}</div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ProgressDot on={progress.checkedIn} label="Check-in" />
          <ProgressDot on={progress.weighedIn} label="Weigh-in" />
          <ProgressDot on={progress.medicalCleared} label="Medical" />
          <ProgressDot on={progress.clearedToFight} label="Cleared" strong />
        </div>
      </header>

      {fighter && clearance && (
        <ClearanceBanner fighterId={fighter.id} clearance={clearance} />
      )}

      {/* Check-in */}
      <form action={toggleCheckIn} className="flex items-center gap-3">
        <input type="hidden" name="bout_id" value={boutId} />
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="corner" value={corner} />
        <input type="hidden" name="currently_checked_in" value={progress.checkedIn ? "1" : "0"} />
        <UserCheck className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="text-sm font-medium">Check-in</div>
          <div className="text-xs text-muted-foreground">
            {progress.checkedIn
              ? `Checked in at ${formatTimestamp(check!.checked_in_at)}`
              : "Not yet checked in"}
          </div>
        </div>
        <Button
          type="submit"
          size="sm"
          variant={progress.checkedIn ? "ghost" : "default"}
          disabled={!fighter}
        >
          {progress.checkedIn ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          {progress.checkedIn ? "Undo" : "Check in"}
        </Button>
      </form>

      {/* Weigh-in */}
      <div className="space-y-2 rounded-md bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm font-medium">Weigh-in</div>
          {status !== "unknown" && (
            <Badge variant={WEIGH_STATUS_VARIANT[status]} className="ml-auto">
              {WEIGH_STATUS_LABEL[status]}
            </Badge>
          )}
        </div>
        {contractedLbs != null && (
          <div className="text-xs text-muted-foreground">
            Contracted: {contractedLbs} lbs
            {check?.weigh_in_lbs != null && overageLbs != null && (
              <>
                {" · "}
                Actual: {check.weigh_in_lbs} lbs
                {overageLbs !== 0 && (
                  <span className={overageLbs > 0.5 ? "text-destructive font-medium" : ""}>
                    {" "}({overageLbs > 0 ? "+" : ""}{overageLbs.toFixed(1)})
                  </span>
                )}
              </>
            )}
            {check?.weigh_in_at && (
              <>{" · at "}{formatTimestamp(check.weigh_in_at)}</>
            )}
          </div>
        )}
        {check?.weigh_in_notes && (
          <div className="text-xs italic text-muted-foreground">{check.weigh_in_notes}</div>
        )}
        <form action={recordWeighIn} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <input type="hidden" name="bout_id" value={boutId} />
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="corner" value={corner} />
          <FormField label="Actual (lbs)" htmlFor={`weigh_${corner}`}>
            <Input
              id={`weigh_${corner}`}
              name="weigh_in_lbs"
              type="number"
              step="0.1"
              min="1"
              max="600"
              defaultValue={check?.weigh_in_lbs ?? ""}
              placeholder="147.5"
              required
            />
          </FormField>
          <FormField label="Notes" htmlFor={`weigh_notes_${corner}`}>
            <Input
              id={`weigh_notes_${corner}`}
              name="weigh_in_notes"
              defaultValue={check?.weigh_in_notes ?? ""}
              placeholder="2nd attempt"
            />
          </FormField>
          <Button type="submit" size="sm">
            {progress.weighedIn ? "Update" : "Record"}
          </Button>
        </form>
        {progress.weighedIn && (
          <form action={clearWeighIn}>
            <input type="hidden" name="bout_id" value={boutId} />
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="corner" value={corner} />
            <Button type="submit" size="xs" variant="ghost">
              <X className="h-3 w-3" />
              Clear weigh-in
            </Button>
          </form>
        )}
      </div>

      {/* Medical */}
      <form action={toggleMedicalClearance} className="flex items-center gap-3">
        <input type="hidden" name="bout_id" value={boutId} />
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="corner" value={corner} />
        <input
          type="hidden"
          name="currently_cleared"
          value={progress.medicalCleared ? "1" : "0"}
        />
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="text-sm font-medium">Medical clearance</div>
          <div className="text-xs text-muted-foreground">
            {progress.medicalCleared
              ? `Cleared at ${formatTimestamp(check!.medical_cleared_at)}`
              : "Awaiting ringside doctor"}
          </div>
          {check?.medical_notes && (
            <div className="mt-0.5 text-xs italic text-muted-foreground">
              {check.medical_notes}
            </div>
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          variant={progress.medicalCleared ? "ghost" : "default"}
          disabled={!fighter}
        >
          {progress.medicalCleared ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          {progress.medicalCleared ? "Unclear" : "Clear"}
        </Button>
      </form>

      {/* Cleared to fight */}
      <form action={toggleClearedToFight} className="flex items-center gap-3 border-t border-border/60 pt-3">
        <input type="hidden" name="bout_id" value={boutId} />
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="corner" value={corner} />
        <input
          type="hidden"
          name="currently_cleared"
          value={progress.clearedToFight ? "1" : "0"}
        />
        <div className="flex-1">
          <div className="text-sm font-semibold">Cleared to fight</div>
          <div className="text-xs text-muted-foreground">
            {progress.clearedToFight
              ? `Signed off at ${formatTimestamp(check!.cleared_to_fight_at)}`
              : allGatesReady(progress, status)
                ? "All gates passed — ready to sign off"
                : "Gates pending"}
          </div>
          {check?.override_reason && (
            <div className="mt-0.5 text-xs italic text-amber-700 dark:text-amber-300">
              Override: {check.override_reason}
            </div>
          )}
        </div>
        {!progress.clearedToFight && !allGatesReady(progress, status) && (
          <Input
            name="override_reason"
            placeholder="Override reason (optional)"
            className="w-52"
          />
        )}
        <Button
          type="submit"
          size="sm"
          variant={progress.clearedToFight ? "outline" : "default"}
          disabled={!fighter}
        >
          {progress.clearedToFight ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          {progress.clearedToFight ? "Revoke" : "Sign off"}
        </Button>
      </form>
    </div>
  );
}

function allGatesReady(
  p: ReturnType<typeof checkinProgress>,
  status: ReturnType<typeof weighInStatus>,
): boolean {
  return p.checkedIn && p.weighedIn && p.medicalCleared && status !== "over";
}

function ClearanceBanner({
  fighterId,
  clearance,
}: {
  fighterId: string;
  clearance: ReturnType<typeof fighterClearanceSummary>;
}) {
  const { worstStatus, counts } = clearance;
  if (worstStatus === "active") {
    return (
      <Link
        href={`/fighters/${fighterId}#medical`}
        className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-xs hover:bg-emerald-500/10"
      >
        <HeartPulse className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="font-medium text-emerald-700 dark:text-emerald-300">
          All medical clearances active
        </span>
      </Link>
    );
  }

  const bgClass =
    worstStatus === "expired"
      ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/10"
      : worstStatus === "missing"
        ? "border-muted-foreground/30 bg-muted/40 hover:bg-muted/60"
        : "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10";

  const textClass =
    worstStatus === "expired"
      ? "text-red-700 dark:text-red-300"
      : worstStatus === "missing"
        ? "text-muted-foreground"
        : "text-amber-700 dark:text-amber-300";

  return (
    <Link
      href={`/fighters/${fighterId}#medical`}
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${bgClass}`}
    >
      <AlertCircle className={`h-3.5 w-3.5 ${textClass}`} />
      <span className={`font-medium ${textClass}`}>
        {counts.expired > 0 && <>{counts.expired} expired</>}
        {counts.expired > 0 && counts.missing > 0 && " · "}
        {counts.missing > 0 && <>{counts.missing} missing</>}
        {counts.expired === 0 && counts.missing === 0 && counts.expiring > 0 && (
          <>{counts.expiring} expiring soon</>
        )}
      </span>
      <span className="ml-auto text-muted-foreground">Fix in fighter profile →</span>
    </Link>
  );
}

function ProgressDot({ on, label, strong }: { on: boolean; label: string; strong?: boolean }) {
  return (
    <span
      title={label}
      className={`h-2 w-2 rounded-full ${
        on
          ? strong
            ? "bg-emerald-500"
            : "bg-emerald-500/70"
          : "bg-muted-foreground/20"
      }`}
    />
  );
}
