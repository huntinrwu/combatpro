import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Mail,
  MapPin,
  Phone,
  Store,
  Trash2,
} from "lucide-react";

import { deleteVendor, updateVendor } from "../actions";
import { HBarBreakdown } from "../../payments/_components/bar-chart";
import { ToastedForm } from "@/components/forms/toasted-form";
import { db } from "@/lib/db/client";
import { fmtDateShort } from "@/lib/format-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LedgerList, LedgerRow } from "@/components/ui/ledger-list";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPENSE_CATEGORIES,
  fmtMoney,
  num,
  paymentMethodLabel,
  type EventRow,
  type LedgerEntry,
  type PaymentMethod,
  type Vendor,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = db();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", id)
    .maybeSingle<Vendor>();
  if (!vendor) notFound();

  const { data: ledger } = await supabase
    .from("event_ledger")
    .select("*")
    .eq("vendor_id", id)
    .order("received_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  const entries = (ledger ?? []) as LedgerEntry[];

  const eventIds = Array.from(new Set(entries.map((e) => e.event_id)));
  const { data: events } = eventIds.length
    ? await supabase
        .from("events")
        .select("id, name, event_date, slug")
        .in("id", eventIds)
    : { data: [] as Pick<EventRow, "id" | "name" | "event_date" | "slug">[] };
  const eventMap = new Map(
    ((events ?? []) as Pick<EventRow, "id" | "name" | "event_date" | "slug">[]).map(
      (e) => [e.id, e],
    ),
  );

  const totalSpend = entries.reduce((s, e) => s + num(e.amount), 0);
  const lastPaid = entries.find((e) => e.received_at)?.received_at ?? null;
  const firstPaid = [...entries]
    .reverse()
    .find((e) => e.received_at)?.received_at ?? null;

  const byMethod = new Map<PaymentMethod, number>();
  const bySubcategory = new Map<string, number>();
  for (const e of entries) {
    const amt = num(e.amount);
    if (e.payment_method) {
      byMethod.set(e.payment_method, (byMethod.get(e.payment_method) ?? 0) + amt);
    }
    if (e.subcategory) {
      bySubcategory.set(e.subcategory, (bySubcategory.get(e.subcategory) ?? 0) + amt);
    }
  }

  const methodRows = [...byMethod.entries()]
    .map(([m, amt]) => ({ label: paymentMethodLabel(m) ?? m, amount: amt }))
    .sort((a, b) => b.amount - a.amount);
  const subRows = [...bySubcategory.entries()]
    .map(([sub, amt]) => ({ label: sub, amount: amt }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 text-muted-foreground" />
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {vendor.name}
            </h1>
            {vendor.default_category && (
              <Badge variant="outline" className="capitalize">
                {vendor.default_category}
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{entries.length} entries · {eventIds.length} events</span>
            {firstPaid && lastPaid && (
              <span>
                · {fmtDateShort(firstPaid)} → {fmtDateShort(lastPaid)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ToastedForm action={deleteVendor} successMessage="Vendor deleted">
            <input type="hidden" name="id" value={vendor.id} />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </ToastedForm>
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href="/vendors">
                <ArrowLeft className="h-3.5 w-3.5" />
                Vendors
              </Link>
            }
          />
        </div>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Total spend" value={fmtMoney(totalSpend)} />
        <SummaryTile
          label="Last paid"
          value={lastPaid ? fmtDateShort(lastPaid) : "—"}
        />
        <SummaryTile
          label="Avg per entry"
          value={entries.length ? fmtMoney(totalSpend / entries.length) : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <ToastedForm
                action={updateVendor}
                successMessage="Vendor updated"
                className="grid gap-3"
              >
                <input type="hidden" name="id" value={vendor.id} />
                <FormField label="Name" htmlFor="v_name" required>
                  <Input
                    id="v_name"
                    name="name"
                    required
                    defaultValue={vendor.name}
                  />
                </FormField>
                <FormField label="Default category" htmlFor="v_cat">
                  <NativeSelect
                    id="v_cat"
                    name="default_category"
                    defaultValue={vendor.default_category ?? ""}
                  >
                    <option value="">—</option>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Contact" htmlFor="v_contact">
                    <Input
                      id="v_contact"
                      name="contact_name"
                      defaultValue={vendor.contact_name ?? ""}
                    />
                  </FormField>
                  <FormField label="Phone" htmlFor="v_phone">
                    <Input
                      id="v_phone"
                      name="contact_phone"
                      type="tel"
                      defaultValue={vendor.contact_phone ?? ""}
                    />
                  </FormField>
                </div>
                <FormField label="Email" htmlFor="v_email">
                  <Input
                    id="v_email"
                    name="contact_email"
                    type="email"
                    defaultValue={vendor.contact_email ?? ""}
                  />
                </FormField>
                <FormField label="Website" htmlFor="v_web">
                  <Input
                    id="v_web"
                    name="website"
                    type="url"
                    defaultValue={vendor.website ?? ""}
                  />
                </FormField>
                <FormField label="Address" htmlFor="v_addr">
                  <Input
                    id="v_addr"
                    name="address"
                    defaultValue={vendor.address ?? ""}
                  />
                </FormField>
                <FormField label="Notes" htmlFor="v_notes">
                  <Textarea
                    id="v_notes"
                    name="notes"
                    rows={2}
                    defaultValue={vendor.notes ?? ""}
                  />
                </FormField>
                <div className="flex justify-end">
                  <Button type="submit" size="sm">
                    Save changes
                  </Button>
                </div>
              </ToastedForm>

              {(vendor.contact_email || vendor.contact_phone || vendor.address) && (
                <div className="mt-4 space-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  {vendor.contact_email && (
                    <a
                      href={`mailto:${vendor.contact_email}`}
                      className="flex items-center gap-1.5 hover:text-foreground"
                    >
                      <Mail className="h-3 w-3" /> {vendor.contact_email}
                    </a>
                  )}
                  {vendor.contact_phone && (
                    <a
                      href={`tel:${vendor.contact_phone}`}
                      className="flex items-center gap-1.5 hover:text-foreground"
                    >
                      <Phone className="h-3 w-3" /> {vendor.contact_phone}
                    </a>
                  )}
                  {vendor.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" /> {vendor.address}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {methodRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By payment method</CardTitle>
              </CardHeader>
              <CardContent>
                <HBarBreakdown rows={methodRows} color="expense" />
              </CardContent>
            </Card>
          )}

          {subRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By subcategory</CardTitle>
              </CardHeader>
              <CardContent>
                <HBarBreakdown rows={subRows} color="expense" />
              </CardContent>
            </Card>
          )}
        </div>

        <LedgerList
          title="Payment history"
          count={entries.length}
          icon={CalendarClock}
          empty="No expenses tagged to this vendor yet. On any event's Financials tab, pick this vendor when adding an expense."
        >
          {entries.map((e) => {
            const evt = eventMap.get(e.event_id);
            const pm = paymentMethodLabel(e.payment_method);
            return (
              <LedgerRow
                key={e.id}
                href={evt ? `/events/${evt.id}/financials` : undefined}
                title={e.label}
                badges={
                  <>
                    {e.subcategory && (
                      <Badge variant="outline" className="text-[10px]">
                        {e.subcategory}
                      </Badge>
                    )}
                    {pm && (
                      <Badge variant="secondary" className="text-[10px]">
                        {pm}
                      </Badge>
                    )}
                  </>
                }
                meta={
                  evt ? (
                    <span>
                      {evt.name} · {fmtDateShort(evt.event_date)}
                    </span>
                  ) : undefined
                }
                submeta={
                  e.received_at || e.reference || e.notes ? (
                    <>
                      {e.received_at && <>Paid {fmtDateShort(e.received_at)} · </>}
                      {e.reference && <>Ref {e.reference} · </>}
                      {e.notes && <span className="italic">&ldquo;{e.notes}&rdquo;</span>}
                    </>
                  ) : undefined
                }
                amount={{
                  value: fmtMoney(num(e.amount)),
                  tone: "expense",
                  showSign: true,
                }}
              />
            );
          })}
        </LedgerList>
      </div>
    </>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}
