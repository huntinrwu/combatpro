import Link from "next/link";
import { ArrowLeft, Flame, LineChart, Store, TrendingDown, TrendingUp } from "lucide-react";

import { CashFlowBarChart, HBarBreakdown } from "../_components/bar-chart";
import { db } from "@/lib/db/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EXPENSE_CATEGORIES,
  REVENUE_CATEGORIES,
  fmtMoney,
  num,
  paymentMethodLabel,
  type EventRow,
  type LedgerEntry,
  type PaymentMethod,
  type Vendor,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

const RANGE_DAYS: Record<string, number> = {
  "30d": 30,
  "90d": 90,
  "6mo": 183,
  "12mo": 365,
  all: 3650,
};

const RANGE_LABEL: Record<string, string> = {
  "30d": "30 days",
  "90d": "90 days",
  "6mo": "6 months",
  "12mo": "12 months",
  all: "All time",
};

type Search = { range?: string };

function categoryLabel(entryType: "revenue" | "expense", category: string): string {
  const list = entryType === "revenue" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find((c) => c.value === category)?.label ?? category;
}

// Bucket the ledger entries into 8 evenly-spaced buckets across the range.
function bucketize(entries: LedgerEntry[], sinceIso: string, todayIso: string) {
  const since = new Date(sinceIso + "T00:00:00Z").getTime();
  const today = new Date(todayIso + "T00:00:00Z").getTime();
  const span = Math.max(1, today - since);
  const BUCKETS = 8;
  const buckets: { label: string; revenue: number; expense: number; from: number }[] =
    Array.from({ length: BUCKETS }, (_, i) => {
      const from = since + (span * i) / BUCKETS;
      const label = new Date(from).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return { label, revenue: 0, expense: 0, from };
    });
  for (const e of entries) {
    if (!e.received_at) continue;
    const t = new Date(e.received_at).getTime();
    if (t < since || t > today) continue;
    const idx = Math.min(
      BUCKETS - 1,
      Math.floor(((t - since) / span) * BUCKETS),
    );
    const bucket = buckets[idx];
    const amount = num(e.amount);
    if (e.entry_type === "revenue") bucket.revenue += amount;
    else bucket.expense += amount;
  }
  return buckets;
}

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { range: rawRange } = await searchParams;
  const range = rawRange && RANGE_DAYS[rawRange] ? rawRange : "90d";
  const days = RANGE_DAYS[range];

  const today = new Date().toISOString().slice(0, 10);
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const sinceIso = sinceDate.toISOString().slice(0, 10);

  const supabase = db();
  const [{ data: ledger }, { data: vendors }, { data: events }] = await Promise.all([
    supabase.from("event_ledger").select("*"),
    supabase.from("vendors").select("id, name"),
    supabase.from("events").select("id, name, event_date"),
  ]);

  const vendorMap = new Map(
    ((vendors ?? []) as Pick<Vendor, "id" | "name">[]).map((v) => [v.id, v.name]),
  );
  const eventMap = new Map(
    ((events ?? []) as Pick<EventRow, "id" | "name" | "event_date">[]).map((e) => [e.id, e]),
  );

  const all = (ledger ?? []) as LedgerEntry[];
  // Filter to entries with a received_at inside range, PLUS keep null-dated
  // entries when range=all so they don't vanish from totals.
  const inRange = all.filter((e) => {
    if (!e.received_at) return range === "all";
    return e.received_at >= sinceIso && e.received_at <= today;
  });

  let revenue = 0;
  let expense = 0;
  const byExpenseCat = new Map<string, number>();
  const byRevenueCat = new Map<string, number>();
  const byVendor = new Map<string, number>();
  const byPaymentMethod = new Map<PaymentMethod, number>();
  const byEvent = new Map<string, { revenue: number; expense: number }>();

  for (const e of inRange) {
    const amount = num(e.amount);
    if (e.entry_type === "revenue") {
      revenue += amount;
      byRevenueCat.set(e.category, (byRevenueCat.get(e.category) ?? 0) + amount);
    } else {
      expense += amount;
      byExpenseCat.set(e.category, (byExpenseCat.get(e.category) ?? 0) + amount);
      if (e.vendor_id) {
        byVendor.set(e.vendor_id, (byVendor.get(e.vendor_id) ?? 0) + amount);
      }
      if (e.payment_method) {
        byPaymentMethod.set(
          e.payment_method,
          (byPaymentMethod.get(e.payment_method) ?? 0) + amount,
        );
      }
    }
    const bucket =
      byEvent.get(e.event_id) ?? { revenue: 0, expense: 0 };
    if (e.entry_type === "revenue") bucket.revenue += amount;
    else bucket.expense += amount;
    byEvent.set(e.event_id, bucket);
  }

  const buckets = bucketize(inRange, sinceIso, today);

  // Burn rate: avg spend per week in the range window.
  const weeks = Math.max(1, days / 7);
  const weeklyBurn = expense / weeks;
  const weeklyIn = revenue / weeks;
  const netPerWeek = weeklyIn - weeklyBurn;

  const expenseRows = [...byExpenseCat.entries()]
    .map(([cat, amt]) => ({ label: categoryLabel("expense", cat), amount: amt }))
    .sort((a, b) => b.amount - a.amount);
  const revenueRows = [...byRevenueCat.entries()]
    .map(([cat, amt]) => ({ label: categoryLabel("revenue", cat), amount: amt }))
    .sort((a, b) => b.amount - a.amount);
  const vendorRows = [...byVendor.entries()]
    .map(([vid, amt]) => ({
      vendorId: vid,
      label: vendorMap.get(vid) ?? "Unknown vendor",
      amount: amt,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  const paymentRows = [...byPaymentMethod.entries()]
    .map(([m, amt]) => ({
      label: paymentMethodLabel(m) ?? m,
      amount: amt,
    }))
    .sort((a, b) => b.amount - a.amount);

  const eventRows = [...byEvent.entries()]
    .map(([eid, v]) => ({
      event: eventMap.get(eid),
      revenue: v.revenue,
      expense: v.expense,
      net: v.revenue - v.expense,
    }))
    .filter((r) => r.event)
    .sort((a, b) => b.expense - a.expense)
    .slice(0, 5);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <LineChart className="h-6 w-6 text-muted-foreground" />
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              Cash flow
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Portfolio-wide flow. Where money moves, when, and how fast.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Range"
            className="inline-flex overflow-hidden rounded-lg border border-border/70 bg-background"
          >
            {Object.entries(RANGE_LABEL).map(([k, label], i, arr) => (
              <Link
                key={k}
                href={`/payments/cashflow?range=${k}`}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  range === k
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } ${i < arr.length - 1 ? "border-r border-border/70" : ""}`}
                aria-pressed={range === k}
              >
                {label}
              </Link>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href="/payments">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Link>
            }
          />
        </div>
      </header>

      {inRange.length === 0 && (
        <Card className="mb-6 border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <LineChart className="h-6 w-6 text-muted-foreground/60" />
            <div className="text-sm font-medium">
              No cash flow data in the last {RANGE_LABEL[range].toLowerCase()}.
            </div>
            <p className="max-w-md text-xs text-muted-foreground">
              Add revenue or expense entries on any event&apos;s Financials tab, or
              widen the range above. Vendor-tagged expenses power the vendor
              concentration view.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/payments">Pick an event</Link>}
              />
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/vendors">Manage vendors</Link>}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <SummaryTile
          label="In"
          value={fmtMoney(revenue)}
          valueClassName="text-emerald-700 dark:text-emerald-300"
          icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
        />
        <SummaryTile
          label="Out"
          value={fmtMoney(expense)}
          valueClassName="text-red-700 dark:text-red-300"
          icon={<TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
        />
        <SummaryTile
          label="Net"
          value={`${revenue - expense < 0 ? "−" : ""}${fmtMoney(Math.abs(revenue - expense))}`}
          valueClassName={
            revenue - expense >= 0
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-700 dark:text-red-300"
          }
        />
        <SummaryTile
          label="Weekly burn"
          value={fmtMoney(weeklyBurn)}
          valueClassName="text-orange-700 dark:text-orange-300"
          icon={<Flame className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />}
          hint={`Avg over ${RANGE_LABEL[range].toLowerCase()}`}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Money in vs out</CardTitle>
        </CardHeader>
        <CardContent>
          <CashFlowBarChart points={buckets} />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/70" />
              In · {fmtMoney(weeklyIn)}/wk avg
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm bg-red-500/70" />
              Out · {fmtMoney(weeklyBurn)}/wk avg
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width={14} height={6} viewBox="0 0 14 6" className="text-foreground">
                <line x1={0} y1={3} x2={14} y2={3} stroke="currentColor" strokeWidth={1.5} />
              </svg>
              Net line ·
              <span
                className={
                  netPerWeek >= 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-red-700 dark:text-red-300"
                }
              >
                {netPerWeek < 0 ? "−" : ""}
                {fmtMoney(Math.abs(netPerWeek))}/wk
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses by category</CardTitle>
          </CardHeader>
          <CardContent>
            <HBarBreakdown rows={expenseRows} color="expense" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by category</CardTitle>
          </CardHeader>
          <CardContent>
            <HBarBreakdown rows={revenueRows} color="revenue" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4" />
              Top vendors
            </CardTitle>
            <Link
              href="/vendors"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              All vendors →
            </Link>
          </CardHeader>
          <CardContent>
            {vendorRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No vendor-tagged expenses yet.{" "}
                <Link href="/vendors" className="underline hover:text-foreground">
                  Add vendors
                </Link>{" "}
                and tag them on event expenses.
              </p>
            ) : (
              <HBarBreakdown
                rows={vendorRows.map(({ label, amount }) => ({ label, amount }))}
                color="expense"
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses by payment method</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payment methods captured yet. Set method on new expenses.
              </p>
            ) : (
              <HBarBreakdown rows={paymentRows} color="expense" />
            )}
          </CardContent>
        </Card>
      </div>

      {eventRows.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Events driving spend</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {eventRows.map((r) => (
                <li
                  key={r.event!.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/40"
                >
                  <Link
                    href={`/events/${r.event!.id}/financials`}
                    className="min-w-0 flex-1"
                  >
                    <div className="font-medium">{r.event!.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.event!.event_date}
                    </div>
                  </Link>
                  <div className="text-right text-xs">
                    <div className="font-mono text-emerald-700 dark:text-emerald-300">
                      +{fmtMoney(r.revenue)}
                    </div>
                    <div className="font-mono text-red-700 dark:text-red-300">
                      −{fmtMoney(r.expense)}
                    </div>
                    <Badge
                      variant="outline"
                      className={`mt-0.5 font-mono ${
                        r.net >= 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {r.net < 0 ? "−" : ""}
                      {fmtMoney(Math.abs(r.net))}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function SummaryTile({
  label,
  value,
  valueClassName,
  icon,
  hint,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  icon?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold ${valueClassName ?? ""}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
