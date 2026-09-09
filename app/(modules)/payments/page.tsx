import Link from "next/link";
import { BadgeCheck, CalendarDays, DollarSign, Download, LineChart, Store } from "lucide-react";

import { db } from "@/lib/db/client";
import { fmtDateShort as fmtEventDate } from "@/lib/format-utils";
import { EVENT_STATUS_VARIANT as STATUS_VARIANT } from "@/lib/ui-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LedgerList, LedgerRow } from "@/components/ui/ledger-list";
import {
  computeEventPnL,
  fmtMoney,
  purseBreakdown,
  type BoutPurse,
  type EventRow,
  type LedgerEntry,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const supabase = db();
  const [{ data: events }, { data: bouts }, { data: purses }, { data: ledger }] =
    await Promise.all([
      supabase.from("events").select("*").order("event_date", { ascending: false }),
      supabase.from("bouts").select("id, event_id"),
      supabase.from("bout_purses").select("*"),
      supabase.from("event_ledger").select("*"),
    ]);

  // bout_id → event_id
  const boutToEvent = new Map<string, string>();
  for (const b of (bouts ?? []) as { id: string; event_id: string }[]) {
    boutToEvent.set(b.id, b.event_id);
  }
  // event_id → { boutIds: Set, purses: BoutPurse[] }
  const eventPurses = new Map<string, BoutPurse[]>();
  for (const p of (purses ?? []) as BoutPurse[]) {
    const eventId = boutToEvent.get(p.bout_id);
    if (!eventId) continue;
    const arr = eventPurses.get(eventId) ?? [];
    arr.push(p);
    eventPurses.set(eventId, arr);
  }
  // event_id → total corners (bouts × 2)
  const eventBoutCounts = new Map<string, number>();
  for (const b of (bouts ?? []) as { id: string; event_id: string }[]) {
    eventBoutCounts.set(b.event_id, (eventBoutCounts.get(b.event_id) ?? 0) + 1);
  }

  const ledgerByEvent = new Map<string, LedgerEntry[]>();
  for (const l of (ledger ?? []) as LedgerEntry[]) {
    const arr = ledgerByEvent.get(l.event_id) ?? [];
    arr.push(l);
    ledgerByEvent.set(l.event_id, arr);
  }

  const rows = ((events ?? []) as EventRow[]).map((e) => {
    const ps = eventPurses.get(e.id) ?? [];
    let gross = 0;
    let net = 0;
    let paid = 0;
    for (const p of ps) {
      const b = purseBreakdown(p);
      gross += b.gross;
      net += b.net;
      if (p.paid_at) paid++;
    }
    const totalCorners = (eventBoutCounts.get(e.id) ?? 0) * 2;
    const pnl = computeEventPnL(ledgerByEvent.get(e.id) ?? [], net);
    return {
      event: e,
      gross,
      net,
      paid,
      totalCorners,
      purseCount: ps.length,
      pnl,
    };
  });

  // Totals
  let sumGross = 0;
  let sumNet = 0;
  let sumPaid = 0;
  let sumCorners = 0;
  let sumRevenue = 0;
  let sumExpenses = 0;
  let sumPnL = 0;
  for (const r of rows) {
    sumGross += r.gross;
    sumNet += r.net;
    sumPaid += r.paid;
    sumCorners += r.totalCorners;
    sumRevenue += r.pnl.revenue;
    sumExpenses += r.pnl.expenses;
    sumPnL += r.pnl.net;
  }

  return (
    <>
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-muted-foreground" />
            <h1 className="font-heading text-3xl font-semibold tracking-tight">Payments</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              render={
                <Link href="/payments/cashflow">
                  <LineChart className="h-3.5 w-3.5" />
                  Cash flow
                </Link>
              }
            />
            <Button
              size="sm"
              variant="outline"
              render={
                <Link href="/vendors">
                  <Store className="h-3.5 w-3.5" />
                  Vendors
                </Link>
              }
            />
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-event payout ledger. Set purses on each bout, mark paid, download the payout PDF.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <SummaryTile label="Revenue" value={fmtMoney(sumRevenue)} valueClassName="text-emerald-700 dark:text-emerald-300" />
          <SummaryTile label="Expenses" value={fmtMoney(sumExpenses)} valueClassName="text-red-700 dark:text-red-300" />
          <SummaryTile
            label="Fighter payouts (net)"
            value={fmtMoney(sumNet)}
            valueClassName="text-red-700 dark:text-red-300"
          />
          <SummaryTile
            label="Net P&amp;L"
            value={`${sumPnL < 0 ? "−" : ""}${fmtMoney(Math.abs(sumPnL))}`}
            valueClassName={sumPnL >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}
          />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Gross purses: {fmtMoney(sumGross)} · Corners paid: {sumPaid} / {sumCorners}
        </div>
      </header>

      <LedgerList
        title="Events"
        count={rows.length}
        icon={CalendarDays}
        empty="No events yet."
      >
        {rows.map((r) => (
          <LedgerRow
            key={r.event.id}
            href={`/events/${r.event.id}`}
            title={r.event.name}
            badges={
              <Badge
                variant={STATUS_VARIANT[r.event.status] ?? "outline"}
                className="capitalize"
              >
                {r.event.status}
              </Badge>
            }
            meta={
              <>
                <span>{fmtEventDate(r.event.event_date)}</span>
                {r.event.venue && <span>{r.event.venue}</span>}
              </>
            }
            amount={{
              value: `${r.pnl.net < 0 ? "−" : ""}${fmtMoney(Math.abs(r.pnl.net))}`,
              tone: r.pnl.net >= 0 ? "revenue" : "expense",
              subtext: (
                <div className="flex flex-col items-end">
                  <span className="font-mono text-emerald-700 dark:text-emerald-300">
                    +{fmtMoney(r.pnl.revenue)}
                  </span>
                  <span className="font-mono text-red-700 dark:text-red-300">
                    −{fmtMoney(r.pnl.expenses + r.pnl.purses)}
                  </span>
                </div>
              ),
            }}
            status={
              <>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <BadgeCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  {r.paid} / {r.totalCorners}
                </span>
                <span className="text-muted-foreground/70">
                  {r.purseCount} purse{r.purseCount === 1 ? "" : "s"} set
                </span>
              </>
            }
            actions={
              r.purseCount > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <a
                      href={`/api/events/${r.event.id}/payouts`}
                      target="_blank"
                      rel="noopener"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </a>
                  }
                />
              ) : undefined
            }
          />
        ))}
      </LedgerList>
    </>
  );
}

function SummaryTile({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold ${valueClassName ?? ""}`}>{value}</div>
    </div>
  );
}
