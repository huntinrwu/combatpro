import { BadgeCheck, DollarSign, RotateCcw } from "lucide-react";

import { markPursePaid, unmarkPursePaid, upsertPurse } from "../purse-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import {
  fmtMoney,
  purseBreakdown,
  type BoutPurse,
  type Corner,
  type Fighter,
} from "@/lib/db/types";

const CORNER_DOT: Record<Corner, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PursesCard({
  boutId,
  eventId,
  purses,
  red,
  blue,
}: {
  boutId: string;
  eventId: string;
  purses: BoutPurse[];
  red: Pick<Fighter, "id" | "full_name"> | null | undefined;
  blue: Pick<Fighter, "id" | "full_name"> | null | undefined;
}) {
  const byCorner = new Map<Corner, BoutPurse>();
  for (const p of purses) byCorner.set(p.corner, p);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PurseColumn
        boutId={boutId}
        eventId={eventId}
        corner="red"
        fighter={red}
        purse={byCorner.get("red") ?? null}
      />
      <PurseColumn
        boutId={boutId}
        eventId={eventId}
        corner="blue"
        fighter={blue}
        purse={byCorner.get("blue") ?? null}
      />
    </div>
  );
}

function PurseColumn({
  boutId,
  eventId,
  corner,
  fighter,
  purse,
}: {
  boutId: string;
  eventId: string;
  corner: Corner;
  fighter: Pick<Fighter, "id" | "full_name"> | null | undefined;
  purse: BoutPurse | null;
}) {
  const b = purseBreakdown(purse);
  const isPaid = Boolean(purse?.paid_at);

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
        {isPaid && (
          <Badge
            variant="outline"
            className="ml-auto border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
          >
            <BadgeCheck className="h-3 w-3" />
            Paid
          </Badge>
        )}
      </header>

      <form
        action={upsertPurse}
        className="grid gap-2 grid-cols-2"
      >
        <input type="hidden" name="bout_id" value={boutId} />
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="corner" value={corner} />

        <FormField label="Gross purse ($)" htmlFor={`gross_${corner}`}>
          <Input
            id={`gross_${corner}`}
            name="gross_purse"
            type="number"
            step="0.01"
            min="0"
            defaultValue={purse?.gross_purse?.toString() ?? "0"}
            required
          />
        </FormField>
        <FormField label="Manager %" htmlFor={`mgr_${corner}`} hint="e.g. 20 for 20%">
          <Input
            id={`mgr_${corner}`}
            name="manager_pct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={purse?.manager_pct?.toString() ?? "0"}
          />
        </FormField>
        <FormField label="Sanctioning fee ($)" htmlFor={`sanc_${corner}`}>
          <Input
            id={`sanc_${corner}`}
            name="sanctioning_fee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={purse?.sanctioning_fee?.toString() ?? "0"}
          />
        </FormField>
        <FormField label="Tax withholding ($)" htmlFor={`tax_${corner}`}>
          <Input
            id={`tax_${corner}`}
            name="tax_withholding"
            type="number"
            step="0.01"
            min="0"
            defaultValue={purse?.tax_withholding?.toString() ?? "0"}
          />
        </FormField>
        <FormField label="Other deductions ($)" htmlFor={`other_${corner}`}>
          <Input
            id={`other_${corner}`}
            name="other_deductions"
            type="number"
            step="0.01"
            min="0"
            defaultValue={purse?.other_deductions?.toString() ?? "0"}
          />
        </FormField>
        <FormField label="Other — note" htmlFor={`othernote_${corner}`}>
          <Input
            id={`othernote_${corner}`}
            name="other_deductions_note"
            defaultValue={purse?.other_deductions_note ?? ""}
            placeholder="Show cut, insurance…"
          />
        </FormField>

        <div className="col-span-2">
          <FormField label="Notes" htmlFor={`notes_${corner}`}>
            <Input
              id={`notes_${corner}`}
              name="notes"
              defaultValue={purse?.notes ?? ""}
              placeholder="e.g. bonus for headliner"
            />
          </FormField>
        </div>

        <div className="col-span-2 flex justify-end">
          <Button type="submit" size="sm">
            <DollarSign className="h-3.5 w-3.5" />
            Save purse
          </Button>
        </div>
      </form>

      <div className="rounded-md bg-muted/40 p-3 text-sm">
        <div className="grid grid-cols-2 gap-y-0.5">
          <span className="text-muted-foreground">Gross</span>
          <span className="text-right font-mono">{fmtMoney(b.gross)}</span>
          <span className="text-muted-foreground">Manager ({b.managerPct}%)</span>
          <span className="text-right font-mono text-red-700 dark:text-red-300">
            −{fmtMoney(b.managerAmount)}
          </span>
          <span className="text-muted-foreground">Sanctioning fee</span>
          <span className="text-right font-mono text-red-700 dark:text-red-300">
            −{fmtMoney(b.sanctioningFee)}
          </span>
          <span className="text-muted-foreground">Tax withholding</span>
          <span className="text-right font-mono text-red-700 dark:text-red-300">
            −{fmtMoney(b.taxWithholding)}
          </span>
          <span className="text-muted-foreground">Other</span>
          <span className="text-right font-mono text-red-700 dark:text-red-300">
            −{fmtMoney(b.otherDeductions)}
          </span>
          <span className="col-span-2 my-1 border-t border-border/70" />
          <span className="font-semibold">Net to fighter</span>
          <span className="text-right font-mono text-lg font-semibold text-emerald-700 dark:text-emerald-300">
            {fmtMoney(b.net)}
          </span>
        </div>
      </div>

      {isPaid ? (
        <div className="space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
          <div className="font-medium text-emerald-700 dark:text-emerald-300">
            Paid {fmtWhen(purse!.paid_at!)}
          </div>
          {purse!.paid_by && (
            <div className="text-muted-foreground">By: {purse!.paid_by}</div>
          )}
          {purse!.payment_reference && (
            <div className="text-muted-foreground">Ref: {purse!.payment_reference}</div>
          )}
          <form action={unmarkPursePaid}>
            <input type="hidden" name="bout_id" value={boutId} />
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="corner" value={corner} />
            <Button type="submit" size="xs" variant="ghost">
              <RotateCcw className="h-3 w-3" />
              Unmark paid
            </Button>
          </form>
        </div>
      ) : (
        <form
          action={markPursePaid}
          className="grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input type="hidden" name="bout_id" value={boutId} />
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="corner" value={corner} />
          <Input name="paid_by" placeholder="Paid by (name)" />
          <Input name="payment_reference" placeholder="Check # / ref" />
          <Button type="submit" size="sm">
            <BadgeCheck className="h-3.5 w-3.5" />
            Mark paid
          </Button>
        </form>
      )}
    </div>
  );
}
