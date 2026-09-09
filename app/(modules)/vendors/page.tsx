import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Mail,
  Phone,
  Store,
  Trash2,
} from "lucide-react";

import { deleteVendor } from "./actions";
import { VendorDialog } from "./_components/vendor-dialog";
import { ToastedForm } from "@/components/forms/toasted-form";
import { db } from "@/lib/db/client";
import { fmtDateShort } from "@/lib/format-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LedgerList, LedgerRow } from "@/components/ui/ledger-list";
import {
  fmtMoney,
  num,
  paymentMethodLabel,
  type LedgerEntry,
  type PaymentMethod,
  type Vendor,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const supabase = db();
  const [{ data: vendors }, { data: ledger }] = await Promise.all([
    supabase.from("vendors").select("*").order("name"),
    supabase
      .from("event_ledger")
      .select("vendor_id, amount, event_id, received_at, payment_method")
      .not("vendor_id", "is", null),
  ]);

  const list = (vendors ?? []) as Vendor[];
  type Bucket = {
    total: number;
    events: Set<string>;
    entries: number;
    lastPaid: string | null;
    methods: Map<PaymentMethod, number>;
  };
  const spendMap = new Map<string, Bucket>();
  for (const l of (ledger ?? []) as Pick<
    LedgerEntry,
    "vendor_id" | "amount" | "event_id" | "received_at" | "payment_method"
  >[]) {
    if (!l.vendor_id) continue;
    const bucket: Bucket =
      spendMap.get(l.vendor_id) ??
      {
        total: 0,
        events: new Set<string>(),
        entries: 0,
        lastPaid: null,
        methods: new Map<PaymentMethod, number>(),
      };
    const amt = num(l.amount);
    bucket.total += amt;
    bucket.events.add(l.event_id);
    bucket.entries += 1;
    if (l.received_at && (!bucket.lastPaid || l.received_at > bucket.lastPaid)) {
      bucket.lastPaid = l.received_at;
    }
    if (l.payment_method) {
      bucket.methods.set(
        l.payment_method,
        (bucket.methods.get(l.payment_method) ?? 0) + amt,
      );
    }
    spendMap.set(l.vendor_id, bucket);
  }

  const enriched = list
    .map((v) => {
      const b = spendMap.get(v.id);
      const methods = b?.methods ?? new Map<PaymentMethod, number>();
      const dominantMethod = [...methods.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        vendor: v,
        total: b?.total ?? 0,
        eventCount: b?.events.size ?? 0,
        entryCount: b?.entries ?? 0,
        lastPaid: b?.lastPaid ?? null,
        dominantMethod: dominantMethod
          ? { method: dominantMethod[0], amount: dominantMethod[1] }
          : null,
        methodMix: [...methods.entries()].sort((a, b) => b[1] - a[1]),
      };
    })
    .sort((a, b) => b.total - a.total);

  const totalSpend = enriched.reduce((s, e) => s + e.total, 0);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 text-muted-foreground" />
            <h1 className="font-heading text-3xl font-semibold tracking-tight">Vendors</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cross-event registry — who you pay, how much, how often.
          </p>
        </div>
      </header>

      <LedgerList
        title="Vendors"
        count={list.length}
        icon={Store}
        action={<VendorDialog />}
        headerMeta={<>Total spend: {fmtMoney(totalSpend)}</>}
        empty="No vendors yet. Add one to start tagging expenses."
      >
        {enriched.map(
          ({
            vendor: v,
            total,
            eventCount,
            entryCount,
            lastPaid,
            dominantMethod,
            methodMix,
          }) => (
            <LedgerRow
              key={v.id}
              href={`/vendors/${v.id}`}
              title={v.name}
              badges={
                <>
                  {v.default_category && (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {v.default_category}
                    </Badge>
                  )}
                  {dominantMethod && (
                    <Badge variant="secondary" className="text-[10px]">
                      {paymentMethodLabel(dominantMethod.method)}
                    </Badge>
                  )}
                </>
              }
              meta={
                <>
                  {v.contact_name && <span>{v.contact_name}</span>}
                  {v.contact_email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {v.contact_email}
                    </span>
                  )}
                  {v.contact_phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {v.contact_phone}
                    </span>
                  )}
                  {lastPaid && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {fmtDateShort(lastPaid)}
                    </span>
                  )}
                </>
              }
              submeta={
                methodMix.length > 1 ? (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {methodMix.map(([m, amt]) => {
                      const pct =
                        total > 0 ? Math.round((amt / total) * 100) : 0;
                      return (
                        <span key={m}>
                          {paymentMethodLabel(m)}: {pct}%
                        </span>
                      );
                    })}
                  </span>
                ) : undefined
              }
              amount={{
                value: fmtMoney(total),
                tone: "expense",
                showSign: true,
                subtext: (
                  <>
                    {entryCount} entr{entryCount === 1 ? "y" : "ies"} ·{" "}
                    {eventCount} event{eventCount === 1 ? "" : "s"}
                  </>
                ),
              }}
              actions={
                <>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    render={
                      <Link
                        href={`/vendors/${v.id}`}
                        aria-label="Open vendor"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    }
                  />
                  <ToastedForm
                    action={deleteVendor}
                    successMessage="Vendor deleted"
                  >
                    <input type="hidden" name="id" value={v.id} />
                    <Button
                      type="submit"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Delete vendor"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </ToastedForm>
                </>
              }
            />
          ),
        )}
      </LedgerList>
    </>
  );
}
