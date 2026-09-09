import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Handshake, Lock } from "lucide-react";

import { updateSponsor } from "../actions";
import { db } from "@/lib/db/client";
import { fmtDateShort as fmtEventDate } from "@/lib/format-utils";
import { getSessionUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { MediaField } from "@/components/forms/media-field";
import { Textarea } from "@/components/ui/textarea";
import {
  compareSponsorTier,
  fmtMoney,
  num,
  sponsorTierLabel,
  sponsorableItemLabel,
  type EventRow,
  type EventSponsor,
  type Sponsor,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

function SponsorDetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value ?? <em className="text-muted-foreground">—</em>}</div>
    </div>
  );
}

export default async function SponsorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = db();
  const session = await getSessionUser();

  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("*")
    .eq("id", id)
    .maybeSingle<Sponsor>();
  if (!sponsor) notFound();

  const { data: slots } = await supabase
    .from("event_sponsors")
    .select("*")
    .eq("sponsor_id", id);

  const slotList = (slots ?? []) as EventSponsor[];

  const eventIds = Array.from(new Set(slotList.map((s) => s.event_id)));
  const eventMap = new Map<
    string,
    Pick<EventRow, "id" | "name" | "event_date" | "status" | "created_by">
  >();
  if (eventIds.length) {
    const { data: events } = await supabase
      .from("events")
      .select("id, name, event_date, status, created_by")
      .in("id", eventIds);
    for (const e of (events ?? []) as Pick<
      EventRow,
      "id" | "name" | "event_date" | "status" | "created_by"
    >[]) {
      eventMap.set(e.id, e);
    }
  }

  // Privacy: $ terms visible per-event only to the promoter that created that
  // event (or staff). Aggregated totals sum only rows the viewer can see.
  const isStaff = session?.isStaff ?? false;
  const viewerId = session?.id ?? null;
  const canSeeSlot = (slot: EventSponsor): boolean => {
    if (isStaff) return true;
    if (!viewerId) return false;
    return eventMap.get(slot.event_id)?.created_by === viewerId;
  };

  let visibleContracted = 0;
  let visiblePaid = 0;
  let visibleSlotCount = 0;
  const visibleEventSet = new Set<string>();
  for (const s of slotList) {
    if (!canSeeSlot(s)) continue;
    const v = num(s.contract_value);
    visibleContracted += v;
    if (s.paid_at) visiblePaid += v;
    visibleSlotCount++;
    visibleEventSet.add(s.event_id);
  }
  const totals = {
    contracted: Math.round(visibleContracted * 100) / 100,
    paid: Math.round(visiblePaid * 100) / 100,
    outstanding:
      Math.round((visibleContracted - visiblePaid) * 100) / 100,
    slotCount: visibleSlotCount,
  };
  const totalEvents = new Set(slotList.map((s) => s.event_id)).size;

  const sortedSlots = [...slotList].sort((a, b) => {
    const ea = eventMap.get(a.event_id);
    const eb = eventMap.get(b.event_id);
    if (ea && eb) return eb.event_date.localeCompare(ea.event_date);
    return compareSponsorTier(a.tier, b.tier);
  });

  return (
    <>
      <Link
        href="/sponsors"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        All sponsors
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Handshake className="h-3.5 w-3.5" />
            Sponsor
          </p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
            {sponsor.name}
          </h1>
          {sponsor.website && (
            <a
              href={sponsor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              {sponsor.website}
            </a>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {session?.isStaff ? (
            <form action={updateSponsor} className="space-y-6">
              <input type="hidden" name="id" value={sponsor.id} />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FormField label="Sponsor name" htmlFor="name" required>
                    <Input id="name" name="name" required defaultValue={sponsor.name} />
                  </FormField>
                  <FormField label="Website" htmlFor="website">
                    <Input id="website" name="website" type="url" defaultValue={sponsor.website ?? ""} />
                  </FormField>
                  <FormField label="Logo" htmlFor="logo_url" className="md:col-span-2">
                    <MediaField
                      id="logo_url"
                      name="logo_url"
                      kind="sponsor-logo"
                      defaultValue={sponsor.logo_url}
                    />
                  </FormField>
                  <FormField label="Contact name" htmlFor="contact_name">
                    <Input id="contact_name" name="contact_name" defaultValue={sponsor.contact_name ?? ""} />
                  </FormField>
                  <FormField label="Contact email" htmlFor="contact_email">
                    <Input id="contact_email" name="contact_email" type="email" defaultValue={sponsor.contact_email ?? ""} />
                  </FormField>
                  <FormField label="Contact phone" htmlFor="contact_phone">
                    <Input id="contact_phone" name="contact_phone" type="tel" defaultValue={sponsor.contact_phone ?? ""} />
                  </FormField>
                  <FormField label="Notes" htmlFor="notes" className="md:col-span-2">
                    <Textarea id="notes" name="notes" rows={3} defaultValue={sponsor.notes ?? ""} />
                  </FormField>
                </CardContent>
              </Card>
              <div>
                <Button type="submit">Save changes</Button>
              </div>
            </form>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <SponsorDetailRow label="Website" value={sponsor.website} />
                <SponsorDetailRow label="Contact name" value={sponsor.contact_name} />
                <SponsorDetailRow label="Contact email" value={sponsor.contact_email} />
                <SponsorDetailRow label="Contact phone" value={sponsor.contact_phone} />
                {sponsor.notes && (
                  <div className="md:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Notes</div>
                    <p className="mt-1 whitespace-pre-wrap">{sponsor.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event history</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not attached to any events yet. Add from{" "}
                  <span className="font-mono text-xs">Event → Sponsors</span>.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {sortedSlots.map((s) => {
                    const evt = eventMap.get(s.event_id);
                    const visible = canSeeSlot(s);
                    const itemLabel =
                      s.item_type === "custom" && s.slot_label
                        ? s.slot_label
                        : sponsorableItemLabel(s.item_type);
                    return (
                      <li
                        key={s.id}
                        className="flex items-center gap-3 py-2 text-sm"
                      >
                        <Badge variant="outline">{sponsorTierLabel(s.tier)}</Badge>
                        <div className="min-w-0 flex-1">
                          {evt ? (
                            <Link
                              href={`/events/${evt.id}/sponsors`}
                              className="font-medium hover:underline"
                            >
                              {evt.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Deleted event</span>
                          )}
                          {evt && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {fmtEventDate(evt.event_date)}
                            </span>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {itemLabel}
                          </div>
                        </div>
                        {visible ? (
                          <>
                            <span className="font-mono text-xs">
                              {fmtMoney(Number(s.contract_value))}
                            </span>
                            {s.paid_at ? (
                              <Badge className="text-[10px]">Paid</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                Due
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="h-3 w-3" />
                            Private
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="grid grid-cols-2 gap-y-1">
                <span className="text-muted-foreground">Events sponsored</span>
                <span className="text-right font-mono">{totalEvents}</span>
                <span className="text-muted-foreground">Assignments</span>
                <span className="text-right font-mono">{slotList.length}</span>
                <span className="col-span-2 my-1 border-t border-border/70" />
                <span className="text-muted-foreground">Contracted</span>
                <span className="text-right font-mono">
                  {fmtMoney(totals.contracted)}
                </span>
                <span className="text-muted-foreground">Paid</span>
                <span className="text-right font-mono text-emerald-700 dark:text-emerald-300">
                  {fmtMoney(totals.paid)}
                </span>
                <span className="text-muted-foreground">Outstanding</span>
                <span
                  className={`text-right font-mono ${
                    totals.outstanding > 0 ? "text-amber-700 dark:text-amber-300" : ""
                  }`}
                >
                  {fmtMoney(totals.outstanding)}
                </span>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" />
                {isStaff
                  ? "You see all events (staff)."
                  : `From ${totals.slotCount} of ${slotList.length} assignments on events you promote.`}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
