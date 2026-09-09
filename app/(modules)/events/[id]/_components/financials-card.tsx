import { Store, Trash2, TrendingDown, TrendingUp } from "lucide-react";

import { deleteLedgerEntry } from "../ledger-actions";
import { LedgerDialog } from "./ledger-dialog";
import { ToastedForm } from "@/components/forms/toasted-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fmtMoney,
  ledgerCategoryLabel,
  num,
  paymentMethodLabel,
  type LedgerEntry,
  type LedgerEntryType,
  type Vendor,
} from "@/lib/db/types";
import { fmtDateShort } from "@/lib/format-utils";

const fmtDate = (iso: string | null) => (iso ? fmtDateShort(iso) : "—");

export function FinancialsCard({
  eventId,
  entries,
  vendors,
}: {
  eventId: string;
  entries: LedgerEntry[];
  vendors: Pick<Vendor, "id" | "name">[];
}) {
  const revenue = entries.filter((e) => e.entry_type === "revenue");
  const expenses = entries.filter((e) => e.entry_type === "expense");
  const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

  return (
    <div className="space-y-6">
      <LedgerSection
        eventId={eventId}
        type="revenue"
        entries={revenue}
        vendors={vendors}
        vendorMap={vendorMap}
      />
      <LedgerSection
        eventId={eventId}
        type="expense"
        entries={expenses}
        vendors={vendors}
        vendorMap={vendorMap}
      />
    </div>
  );
}

function LedgerSection({
  eventId,
  type,
  entries,
  vendors,
  vendorMap,
}: {
  eventId: string;
  type: LedgerEntryType;
  entries: LedgerEntry[];
  vendors: Pick<Vendor, "id" | "name">[];
  vendorMap: Map<string, string>;
}) {
  const total = entries.reduce((s, e) => s + num(e.amount), 0);
  const isRevenue = type === "revenue";
  const colorClass = isRevenue
    ? "text-emerald-700 dark:text-emerald-300"
    : "text-red-700 dark:text-red-300";
  const accentBar = isRevenue ? "bg-emerald-500/60" : "bg-red-500/60";

  return (
    <section className="rounded-lg border border-border/70 bg-card">
      <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
        <span className={`h-6 w-1 rounded-full ${accentBar}`} aria-hidden />
        {isRevenue ? (
          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
        )}
        <div className="text-sm font-medium">
          {isRevenue ? "Revenue" : "Expenses"}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className={`font-mono text-base font-semibold tabular-nums ${colorClass}`}>
            {fmtMoney(total)}
          </div>
          <LedgerDialog eventId={eventId} entryType={type} vendors={vendors} />
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No {isRevenue ? "revenue" : "expense"} entries yet.
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {entries.map((e) => {
            const vendorName = e.vendor_id ? vendorMap.get(e.vendor_id) ?? null : null;
            const pmLabel = paymentMethodLabel(e.payment_method);
            return (
              <li key={e.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{e.label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {ledgerCategoryLabel(e)}
                    </Badge>
                    {e.subcategory && (
                      <Badge variant="secondary" className="text-[10px]">
                        {e.subcategory}
                      </Badge>
                    )}
                    {pmLabel && (
                      <Badge variant="secondary" className="text-[10px]">
                        {pmLabel}
                      </Badge>
                    )}
                  </div>
                  {(vendorName || e.received_at || e.reference || e.notes) && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {vendorName && (
                        <span className="inline-flex items-center gap-1">
                          <Store className="h-3 w-3" /> {vendorName}
                        </span>
                      )}
                      {e.received_at && (
                        <span>
                          {isRevenue ? "Received" : "Paid"} {fmtDate(e.received_at)}
                        </span>
                      )}
                      {e.reference && <span>Ref {e.reference}</span>}
                      {e.notes && <span className="italic">&ldquo;{e.notes}&rdquo;</span>}
                    </div>
                  )}
                </div>
                <div
                  className={`shrink-0 text-right font-mono text-sm tabular-nums ${colorClass}`}
                >
                  {isRevenue ? "+" : "−"}
                  {fmtMoney(num(e.amount))}
                </div>
                <ToastedForm action={deleteLedgerEntry} successMessage="Entry deleted">
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="event_id" value={eventId} />
                  <Button
                    type="submit"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </ToastedForm>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
