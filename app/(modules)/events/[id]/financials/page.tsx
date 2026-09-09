import { BadgeCheck, DollarSign, Download, LineChart } from "lucide-react";

import { notFound } from "next/navigation";

import { FinancialsCard } from "../_components/financials-card";
import { FinancialsExportButton } from "../_components/financials-export-button";
import { loadEventDetail } from "../_lib/event-detail";
import { db } from "@/lib/db/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  computeEventPnL,
  fmtMoney,
  purseBreakdown,
  type Vendor,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function EventFinancialsTabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadEventDetail(id);
  if (!detail) notFound();
  const { bouts, purses: allPurseRows, ledger: entries } = detail;

  const { data: vendors } = await db()
    .from("vendors")
    .select("id, name")
    .order("name");

  let payoutGross = 0;
  let payoutNet = 0;
  let paidCorners = 0;
  for (const p of allPurseRows) {
    const b = purseBreakdown(p);
    payoutGross += b.gross;
    payoutNet += b.net;
    if (p.paid_at) paidCorners++;
  }
  const totalCorners = bouts.length * 2;

  const pnl = computeEventPnL(entries, payoutNet);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <LineChart className="h-4 w-4" />
            Revenue &amp; expenses
          </div>
          <FinancialsExportButton eventId={id} />
        </div>

        <FinancialsCard
          eventId={id}
          entries={entries}
          vendors={(vendors ?? []) as Pick<Vendor, "id" | "name">[]}
        />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-4 w-4" />
              Event P&amp;L
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="grid grid-cols-2 gap-y-1">
              <span className="text-muted-foreground">Revenue</span>
              <span className="text-right font-mono text-emerald-700 dark:text-emerald-300">
                +{fmtMoney(pnl.revenue)}
              </span>
              <span className="text-muted-foreground">Expenses</span>
              <span className="text-right font-mono text-red-700 dark:text-red-300">
                −{fmtMoney(pnl.expenses)}
              </span>
              <span className="text-muted-foreground">Fighter purses (net)</span>
              <span className="text-right font-mono text-red-700 dark:text-red-300">
                −{fmtMoney(pnl.purses)}
              </span>
              <span className="col-span-2 my-1 border-t border-border/70" />
              <span className="font-semibold">Net</span>
              <span
                className={`text-right font-mono text-lg font-semibold ${
                  pnl.net >= 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {pnl.net >= 0 ? "" : "−"}
                {fmtMoney(Math.abs(pnl.net))}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              Payouts
            </CardTitle>
            {allPurseRows.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                render={
                  <a
                    href={`/api/events/${id}/payouts`}
                    target="_blank"
                    rel="noopener"
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </a>
                }
              />
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-y-1">
              <span className="text-muted-foreground">Gross purses</span>
              <span className="text-right font-mono">{fmtMoney(payoutGross)}</span>
              <span className="text-muted-foreground">Net to fighters</span>
              <span className="text-right font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                {fmtMoney(payoutNet)}
              </span>
              <span className="text-muted-foreground">Paid</span>
              <span className="text-right font-mono">
                <BadgeCheck className="mr-1 inline h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                {paidCorners} / {totalCorners} corners
              </span>
            </div>
            {allPurseRows.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No purses entered yet — open a bout to set purses per corner.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
