import Link from "next/link";
import { notFound } from "next/navigation";
import { Handshake, Trash2, Wallet } from "lucide-react";

import {
  removeEventSponsor,
  toggleEventSponsorPaid,
} from "@/app/(modules)/sponsors/actions";
import { SponsorDialog } from "../_components/sponsor-dialog";
import { SponsorTargetEditor } from "../_components/sponsor-target-editor";
import { SponsorableItemActionButton } from "../_components/sponsorable-item-delete-button";
import { SponsorableItemDialog } from "../_components/sponsorable-item-dialog";
import { loadEventDetail } from "../_lib/event-detail";
import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { fmtDateShort } from "@/lib/format-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SPONSORABLE_ITEMS,
  fmtMoney,
  isBuiltInSponsorItem,
  num,
  sponsorTierLabel,
  sponsorableItemLabel,
  sponsorshipTotals,
  type EventSponsor,
  type EventSponsorableItem,
  type SponsorItemKey,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

const fmtWhen = (iso: string | null) =>
  iso ? fmtDateShort(iso.slice(0, 10)) : "—";

function builtInHint(key: string): string | null {
  return SPONSORABLE_ITEMS.find((i) => i.value === key)?.hint ?? null;
}

// One-time backfill. New events are seeded on creation (Ring, Blue Corner,
// Red Corner). This runs only when the event has zero item rows at all —
// legacy events created before the seed pattern existed. Preserves any keys
// that already carry sponsor assignments so nothing orphans.
async function ensureBootstrap(
  eventId: string,
  overrides: EventSponsorableItem[],
  slots: EventSponsor[],
): Promise<EventSponsorableItem[]> {
  if (overrides.length > 0) return overrides;

  const wanted = new Set<string>(["ring", "blue_corner", "red_corner"]);
  for (const s of slots) wanted.add(s.item_type);

  const rows = Array.from(wanted).map((key, i) => ({
    event_id: eventId,
    key,
    label: isBuiltInSponsorItem(key) ? sponsorableItemLabel(key) : key,
    hint: null,
    sort_order: i,
  }));

  await db().from("event_sponsorable_items").insert(rows);

  const { data: fresh } = await db()
    .from("event_sponsorable_items")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (fresh as EventSponsorableItem[]) ?? [];
}

export default async function EventSponsorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadEventDetail(id);
  if (!detail) notFound();

  const {
    event,
    sponsorSlots: slotList,
    sponsorTargets: targetList,
    sponsorRegistry: sponsorList,
  } = detail;
  const overrides = await ensureBootstrap(
    id,
    detail.sponsorableItems,
    slotList,
  );

  const session = await getSessionUser();
  const canSeeAmounts =
    (session?.isStaff ?? false) || session?.id === event.created_by;

  const sponsorMap = new Map(sponsorList.map((s) => [s.id, s.name]));
  const totals = sponsorshipTotals(slotList);

  const byItem = new Map<SponsorItemKey, EventSponsor[]>();
  for (const s of slotList) {
    const list = byItem.get(s.item_type) ?? [];
    list.push(s);
    byItem.set(s.item_type, list);
  }

  const targetByItem = new Map<SponsorItemKey, number>();
  for (const t of targetList) {
    targetByItem.set(t.item_type, num(t.target_value));
  }

  const sections = overrides.map((o) => ({
    item: o.key as SponsorItemKey,
    label: o.label,
    hint: o.hint ?? builtInHint(o.key),
    override: o,
    slots: byItem.get(o.key as SponsorItemKey) ?? [],
  }));

  const goalTotal = sections.reduce(
    (acc, s) => acc + (targetByItem.get(s.item) ?? 0),
    0,
  );
  const goalRemaining = Math.round((goalTotal - totals.contracted) * 100) / 100;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Handshake className="h-4 w-4" />
            Sponsorable items
          </div>
          <div className="flex items-center gap-2">
            {canSeeAmounts && <SponsorableItemDialog eventId={event.id} />}
          </div>
        </div>

        {sections.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">
                No sponsorable items on this event yet.
              </p>
              <p className="text-xs">
                Every event decides what it will sell. Click{" "}
                <span className="font-medium">Add item</span> above to add
                the ring, corners, ring girls, broadcast, weigh-in backdrop,
                or anything else you want to line up sponsors for.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {sections.map((section) => {
            const { item, label, hint, slots, override } = section;
            const isCustom = !isBuiltInSponsorItem(String(item));
            const contracted = slots.reduce(
              (acc, s) => acc + num(s.contract_value),
              0,
            );
            const target = targetByItem.get(item) ?? 0;
            const delta = Math.round((contracted - target) * 100) / 100;
            const editablePayload = { key: String(item), label, hint };

            return (
              <Card key={String(item)}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <span>{label}</span>
                      {isCustom && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          Custom
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {slots.length === 0
                        ? "Unassigned"
                        : `${slots.length} sponsor${slots.length === 1 ? "" : "s"}`}
                      {hint && ` · ${hint}`}
                    </p>
                    {canSeeAmounts && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <SponsorTargetEditor
                          eventId={event.id}
                          itemType={item}
                          currentTarget={target}
                        />
                        {target > 0 && (
                          <span
                            className={`font-mono ${
                              delta >= 0
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {fmtMoney(contracted)} / {fmtMoney(target)}
                            {delta === 0
                              ? " · on target"
                              : delta > 0
                                ? ` · +${fmtMoney(delta)} over`
                                : ` · ${fmtMoney(-delta)} short`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {canSeeAmounts && (
                      <>
                        <SponsorableItemDialog
                          eventId={event.id}
                          existing={editablePayload}
                        />
                        <SponsorableItemActionButton
                          eventId={event.id}
                          itemId={override.id}
                          hasAssignments={slots.length > 0}
                        />
                      </>
                    )}
                    <SponsorDialog
                      eventId={event.id}
                      sponsors={sponsorList}
                      itemType={item}
                      itemLabel={label}
                      triggerLabel="Assign"
                    />
                  </div>
                </CardHeader>
                {slots.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            <th className="py-2 pr-3 font-medium">Tier</th>
                            <th className="py-2 pr-3 font-medium">Sponsor</th>
                            {canSeeAmounts && (
                              <th className="py-2 pr-3 text-right font-medium">
                                Amount
                              </th>
                            )}
                            {canSeeAmounts && (
                              <th className="py-2 pr-3 font-medium">Paid</th>
                            )}
                            <th className="py-2 pr-3 font-medium">Notes</th>
                            <th className="py-2 pl-3 text-right font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {slots.map((s) => (
                            <tr key={s.id} className="align-middle">
                              <td className="py-2 pr-3">
                                <Badge variant="outline" className="capitalize">
                                  {sponsorTierLabel(s.tier)}
                                </Badge>
                              </td>
                              <td className="py-2 pr-3">
                                <Link
                                  href={`/sponsors/${s.sponsor_id}`}
                                  className="font-medium hover:underline"
                                >
                                  {sponsorMap.get(s.sponsor_id) ?? "Unknown sponsor"}
                                </Link>
                              </td>
                              {canSeeAmounts && (
                                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                                  {fmtMoney(Number(s.contract_value))}
                                </td>
                              )}
                              {canSeeAmounts && (
                                <td className="py-2 pr-3 text-xs text-muted-foreground">
                                  {s.paid_at ? fmtWhen(s.paid_at) : "Unpaid"}
                                </td>
                              )}
                              <td className="py-2 pr-3 text-xs italic text-muted-foreground/80">
                                {s.notes ? `“${s.notes}”` : "—"}
                              </td>
                              <td className="py-2 pl-3">
                                {canSeeAmounts ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <SponsorDialog
                                      eventId={event.id}
                                      sponsors={sponsorList}
                                      existing={s}
                                    />
                                    <form action={toggleEventSponsorPaid}>
                                      <input type="hidden" name="id" value={s.id} />
                                      <input
                                        type="hidden"
                                        name="event_id"
                                        value={event.id}
                                      />
                                      <Button
                                        type="submit"
                                        size="icon-sm"
                                        variant="ghost"
                                        aria-label={
                                          s.paid_at ? "Mark unpaid" : "Mark paid"
                                        }
                                        className="text-muted-foreground hover:text-foreground"
                                      >
                                        <Wallet className="h-3 w-3" />
                                      </Button>
                                    </form>
                                    <form action={removeEventSponsor}>
                                      <input type="hidden" name="id" value={s.id} />
                                      <input
                                        type="hidden"
                                        name="event_id"
                                        value={event.id}
                                      />
                                      <Button
                                        type="submit"
                                        size="icon-sm"
                                        variant="ghost"
                                        aria-label="Remove"
                                        className="text-muted-foreground hover:text-destructive"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </form>
                                  </div>
                                ) : (
                                  <span className="block text-right text-xs text-muted-foreground">
                                    Terms private
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="grid grid-cols-2 gap-y-1">
              <span className="text-muted-foreground">Assignments</span>
              <span className="text-right font-mono">{totals.slotCount}</span>
              {canSeeAmounts ? (
                <>
                  <span className="text-muted-foreground">Fundraising goal</span>
                  <span className="text-right font-mono">
                    {fmtMoney(goalTotal)}
                  </span>
                  <span className="text-muted-foreground">Contracted</span>
                  <span className="text-right font-mono">
                    {fmtMoney(totals.contracted)}
                  </span>
                  {goalTotal > 0 && (
                    <>
                      <span className="text-muted-foreground">
                        {goalRemaining > 0 ? "To go" : "Over goal"}
                      </span>
                      <span
                        className={`text-right font-mono ${
                          goalRemaining > 0
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {fmtMoney(Math.abs(goalRemaining))}
                      </span>
                    </>
                  )}
                  <span className="col-span-2 my-1 border-t border-border/70" />
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
                </>
              ) : (
                <span className="col-span-2 text-xs text-muted-foreground">
                  $ terms visible to this event&apos;s promoter only.
                </span>
              )}
            </div>
            {canSeeAmounts && goalTotal === 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Set a target on each item to track fundraising progress.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {sponsorList.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No sponsors in the registry yet.{" "}
                <Link
                  href="/sponsors/new"
                  className="underline hover:text-foreground"
                >
                  Add one
                </Link>
                .
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Sponsors available to assign.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sponsorList.slice(0, 12).map((sp) => (
                    <Link
                      key={sp.id}
                      href={`/sponsors/${sp.id}`}
                      className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    >
                      {sp.name}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
