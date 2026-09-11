import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CalendarDays, ClipboardList, History, Pencil, ShieldCheck, Trash2 } from "lucide-react";

import { AvailabilityCard } from "./_components/availability-card";
import { PriorEventsCard } from "./_components/prior-events-card";
import {
  linkOfficialToSanctioningBody,
  unlinkOfficialFromSanctioningBody,
} from "../actions";
import { db } from "@/lib/db/client";
import { fmtDateShort, fmtDateShortWithDay as fmtEventDate } from "@/lib/format-utils";
import { getSessionUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PersonNoBadge } from "@/components/person-no-badge";
import { ToastedForm } from "@/components/forms/toasted-form";
import type {
  EventOfficial,
  EventRow,
  Official,
  OfficialAvailability,
  OfficialPriorEvent,
  OfficialSanctioningBody,
  SanctioningBody,
} from "@/lib/db/types";
import { OFFICIAL_SB_STATUSES } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value ?? <em className="text-muted-foreground">—</em>}</span>
    </div>
  );
}

type EnrichedAssignment = EventOfficial & {
  event: Pick<EventRow, "id" | "name" | "event_date" | "venue" | "city" | "state"> | null;
};

export default async function OfficialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = db();
  const session = await getSessionUser();

  const [
    { data: official },
    { data: assignments },
    { data: availability },
    { data: priorEvents },
  ] = await Promise.all([
    supabase.from("officials").select("*").eq("id", id).maybeSingle<Official>(),
    supabase
      .from("event_officials")
      .select("*")
      .eq("official_id", id),
    supabase
      .from("official_availability")
      .select("*")
      .eq("official_id", id)
      .order("block_date"),
    supabase
      .from("official_prior_events")
      .select("*")
      .eq("official_id", id)
      .order("event_date", { ascending: false }),
  ]);

  if (!official) notFound();

  const { data: person } = official.person_id
    ? await supabase
        .from("persons")
        .select("person_no")
        .eq("id", official.person_id)
        .maybeSingle<{ person_no: number }>()
    : { data: null as { person_no: number } | null };

  const [{ data: sbLinks }, { data: allSbs }] = await Promise.all([
    supabase
      .from("official_sanctioning_bodies")
      .select("*")
      .eq("official_id", id),
    supabase
      .from("sanctioning_bodies")
      .select("id, name, abbreviation")
      .order("abbreviation", { ascending: true }),
  ]);
  const links = (sbLinks ?? []) as OfficialSanctioningBody[];
  const sbList = (allSbs ?? []) as Pick<SanctioningBody, "id" | "name" | "abbreviation">[];
  const sbMap = new Map(sbList.map((sb) => [sb.id, sb]));
  const linkedSbIds = new Set(links.map((l) => l.sanctioning_body_id));

  const assignRows = (assignments ?? []) as EventOfficial[];
  const eventIds = Array.from(new Set(assignRows.map((a) => a.event_id)));
  const eventMap = new Map<
    string,
    Pick<EventRow, "id" | "name" | "event_date" | "venue" | "city" | "state">
  >();
  if (eventIds.length) {
    const { data: events } = await supabase
      .from("events")
      .select("id, name, event_date, venue, city, state")
      .in("id", eventIds);
    for (const e of events ?? []) eventMap.set(e.id, e);
  }

  const enriched: EnrichedAssignment[] = assignRows.map((a) => ({
    ...a,
    event: eventMap.get(a.event_id) ?? null,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = enriched
    .filter((a) => a.event && a.event.event_date >= today)
    .sort((a, b) => a.event!.event_date.localeCompare(b.event!.event_date));
  const past = enriched
    .filter((a) => a.event && a.event.event_date < today)
    .sort((a, b) => b.event!.event_date.localeCompare(a.event!.event_date));

  return (
    <>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {official.full_name}
            </h1>
            {person?.person_no != null && <PersonNoBadge no={person.person_no} />}
            <div className="flex flex-wrap gap-1">
              {official.roles.map((r) => (
                <Badge key={r} variant="secondary" className="capitalize">
                  {r}
                </Badge>
              ))}
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${
                official.is_active
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  official.is_active ? "bg-emerald-500" : "bg-muted-foreground/40"
                }`}
              />
              {official.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{enriched.length} CombatPro assignments</span>
            <span>·</span>
            <span>{(priorEvents ?? []).length} prior events</span>
            <span>·</span>
            <span>{upcoming.length} upcoming</span>
            <span>·</span>
            <span>{(availability ?? []).length} availability block{(availability ?? []).length === 1 ? "" : "s"}</span>
          </div>
        </div>
        {session?.isStaff && (
          <Button
            size="sm"
            variant="outline"
            render={
              <Link href={`/officials/${official.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            }
          />
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Home state" value={official.home_state} />
            <DetailRow
              label="Active since"
              value={
                official.active_since
                  ? fmtEventDate(official.active_since)
                  : null
              }
            />
            <DetailRow
              label="Sports"
              value={
                official.sports.length ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    {official.sports.map((s) => (
                      <Badge key={s} variant="outline" className="capitalize">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : null
              }
            />
            <DetailRow
              label="Certifications"
              value={
                official.certifications.length ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    {official.certifications.map((c) => (
                      <Badge key={c} variant="secondary">
                        {c}
                      </Badge>
                    ))}
                  </div>
                ) : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact &amp; notes</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="Email"
              value={
                official.contact_email ? (
                  <a href={`mailto:${official.contact_email}`} className="hover:underline">
                    {official.contact_email}
                  </a>
                ) : null
              }
            />
            <DetailRow label="Phone" value={official.contact_phone} />
            <DetailRow
              label="Notes"
              value={
                official.notes ? (
                  <span className="whitespace-pre-wrap text-left">{official.notes}</span>
                ) : null
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Sanctioning bodies
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {links.length} linked
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not linked to any sanctioning body yet.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
              {links.map((link) => {
                const sb = sbMap.get(link.sanctioning_body_id);
                const statusTone =
                  link.status === "active"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : link.status === "suspended"
                      ? "bg-red-500/10 text-red-700 dark:text-red-300"
                      : "bg-muted text-muted-foreground";
                return (
                  <li key={link.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {sb ? (
                          <Link
                            href={`/sb/${sb.id}`}
                            className="font-medium hover:underline"
                          >
                            {sb.abbreviation} — {sb.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Unknown SB</span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusTone}`}
                        >
                          {link.status}
                        </span>
                        {link.level && (
                          <Badge variant="outline" className="text-[10px]">
                            {link.level}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {link.certified_since && (
                          <span>Certified {fmtDateShort(link.certified_since)}</span>
                        )}
                        {link.expires_on && (
                          <span>Expires {fmtDateShort(link.expires_on)}</span>
                        )}
                        {link.notes && (
                          <span className="italic">&ldquo;{link.notes}&rdquo;</span>
                        )}
                      </div>
                    </div>
                    {session?.isStaff && (
                      <ToastedForm
                        action={unlinkOfficialFromSanctioningBody}
                        successMessage="Removed"
                      >
                        <input type="hidden" name="id" value={link.id} />
                        <input type="hidden" name="official_id" value={official.id} />
                        <input
                          type="hidden"
                          name="sanctioning_body_id"
                          value={link.sanctioning_body_id}
                        />
                        <Button
                          type="submit"
                          size="xs"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          aria-label="Remove link"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </Button>
                      </ToastedForm>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {session?.isStaff && sbList.length > 0 && (
            <div className="mt-4 border-t border-border/60 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Add / update link
              </p>
              <ToastedForm
                action={linkOfficialToSanctioningBody}
                successMessage="Link saved"
                resetOnSuccess
                className="grid gap-3 sm:grid-cols-2"
              >
                <input type="hidden" name="official_id" value={official.id} />
                <FormField
                  label="Sanctioning body"
                  htmlFor="sbl_sb"
                  required
                  className="sm:col-span-2"
                >
                  <NativeSelect id="sbl_sb" name="sanctioning_body_id" required>
                    <option value="">—</option>
                    {sbList.map((sb) => (
                      <option
                        key={sb.id}
                        value={sb.id}
                        disabled={linkedSbIds.has(sb.id)}
                      >
                        {sb.abbreviation} — {sb.name}
                        {linkedSbIds.has(sb.id) ? " (linked)" : ""}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label="Status" htmlFor="sbl_status">
                  <NativeSelect id="sbl_status" name="status" defaultValue="active">
                    {OFFICIAL_SB_STATUSES.map((s) => (
                      <option key={s} value={s} className="capitalize">
                        {s}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label="Level" htmlFor="sbl_level">
                  <Input
                    id="sbl_level"
                    name="level"
                    placeholder="e.g. Senior, Level 2"
                  />
                </FormField>
                <FormField label="Certified since" htmlFor="sbl_since">
                  <Input id="sbl_since" name="certified_since" type="date" />
                </FormField>
                <FormField label="Expires on" htmlFor="sbl_exp">
                  <Input id="sbl_exp" name="expires_on" type="date" />
                </FormField>
                <FormField label="Notes" htmlFor="sbl_notes" className="sm:col-span-2">
                  <Input id="sbl_notes" name="notes" />
                </FormField>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" size="sm">
                    Save link
                  </Button>
                </div>
              </ToastedForm>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" />
            Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AvailabilityCard
            officialId={official.id}
            blocks={(availability ?? []) as OfficialAvailability[]}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Prior events (backfill)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PriorEventsCard
            officialId={official.id}
            events={(priorEvents ?? []) as OfficialPriorEvent[]}
            canEdit={Boolean(session?.isStaff)}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" />
            Assignment history
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                Upcoming ({upcoming.length})
              </div>
              <AssignmentList assignments={upcoming} />
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Past ({past.length})
              </div>
              <AssignmentList assignments={past} muted />
            </div>
          )}
          {enriched.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No assignments yet — add this official to an event&apos;s roster from the Officials tab.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function AssignmentList({
  assignments,
  muted = false,
}: {
  assignments: EnrichedAssignment[];
  muted?: boolean;
}) {
  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
      {assignments.map((a) => (
        <li
          key={a.id}
          className={`flex flex-wrap items-center gap-3 p-3 text-sm hover:bg-muted/40 ${
            muted ? "text-muted-foreground" : ""
          }`}
        >
          <Badge variant="secondary" className="capitalize">
            {a.event_role.replace(/_/g, " ")}
          </Badge>
          <Link
            href={`/events/${a.event!.id}/officials`}
            className="flex-1 hover:underline"
          >
            <div className="font-medium">{a.event!.name}</div>
            <div className="text-xs text-muted-foreground">
              {fmtEventDate(a.event!.event_date)}
              {a.event!.venue && <> · {a.event!.venue}</>}
              {a.event!.city && <>, {a.event!.city}</>}
              {a.event!.state && <>, {a.event!.state}</>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
