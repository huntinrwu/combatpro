import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Plus, Swords, UserPlus, Users, X } from "lucide-react";

import {
  acceptRegistration,
  createAndAddFighter,
  dismissRegistration,
  removeEventFighter,
  setRegistrationOpen,
  updateEventFighter,
} from "./actions";
import { AddFightersPanel, type FighterCandidate } from "./_components/add-fighters-panel";
import { loadEventDetail } from "../_lib/event-detail";
import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";
import { CLEARANCE_STATUS_META } from "@/lib/ui-config";
import { fighterProRecord } from "@/lib/text-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { ToastedForm } from "@/components/forms/toasted-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SummaryTile } from "@/components/summary-tile";
import { WeightClassSelect } from "@/components/weight-class-select";
import {
  EVENT_FIGHTER_STATUSES,
  EVENT_FIGHTER_STATUS_LABELS,
  SPORTS,
  fighterClearanceSummary,
  num,
  type Bout,
  type EventFighterStatus,
  type EventRegistration,
  type EventRosterEntry,
  type Fighter,
  type FighterMedicalRecord,
  type Gym,
} from "@/lib/db/types";

type RosterFighter = Pick<
  Fighter,
  | "id"
  | "full_name"
  | "nickname"
  | "primary_sport"
  | "weight_class"
  | "walking_weight_lbs"
  | "pro_wins"
  | "pro_losses"
  | "pro_draws"
  | "am_wins"
  | "am_losses"
  | "am_draws"
  | "gym"
  | "gym_id"
> & {
  gym_ref: Pick<Gym, "name"> | null;
  medical: Pick<FighterMedicalRecord, "kind" | "issued_on" | "expires_on">[];
};

type RosterRow = Pick<
  EventRosterEntry,
  "id" | "fighter_id" | "status" | "weight_class" | "competing_as" | "target_weight_lbs" | "notes"
> & { fighter: RosterFighter | null };

type RegistryFighter = Pick<
  Fighter,
  "id" | "full_name" | "nickname" | "primary_sport" | "weight_class" | "gym" | "gym_id"
> & { gym_ref: Pick<Gym, "name"> | null };

const ROSTER_SELECT =
  "id, fighter_id, status, weight_class, competing_as, target_weight_lbs, notes, fighter:fighters(id, full_name, nickname, primary_sport, weight_class, walking_weight_lbs, pro_wins, pro_losses, pro_draws, am_wins, am_losses, am_draws, gym, gym_id, gym_ref:gyms(name), medical:fighter_medical_records(kind, issued_on, expires_on))";

const STATUS_ORDER: Record<EventFighterStatus, number> = {
  confirmed: 0,
  pending: 1,
  withdrawn: 2,
};

const STATUS_BADGE: Record<EventFighterStatus, "default" | "outline" | "destructive"> = {
  confirmed: "default",
  pending: "outline",
  withdrawn: "destructive",
};

function gymName(f: { gym: string | null; gym_id: string | null; gym_ref: { name: string } | null }) {
  return (f.gym_id ? f.gym_ref?.name : f.gym) ?? null;
}

export default async function EventFightersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = db();

  const [detail, session, rosterRes, { data: registry }, { data: gyms }, signupRes] = await Promise.all([
    loadEventDetail(id),
    getSessionUser(),
    supabase.from("event_fighters").select(ROSTER_SELECT).eq("event_id", id).order("created_at"),
    supabase
      .from("fighters")
      .select("id, full_name, nickname, primary_sport, weight_class, gym, gym_id, gym_ref:gyms(name)")
      .order("full_name"),
    supabase.from("gyms").select("id, name").order("name"),
    supabase
      .from("event_registrations")
      .select("id, full_name, email, phone, gym_name, weight_class, wins, losses, draws, created_at")
      .eq("event_id", id)
      .eq("status", "pending")
      .order("created_at"),
  ]);
  if (!detail) notFound();
  const { event, bouts, fighterMap } = detail;
  const canEdit = session ? canEditEvent(event, session) : false;

  if (rosterRes.error) {
    console.error("[event_fighters]", rosterRes.error.code, rosterRes.error.message);
    return (
      <Card collapsible={false}>
        <CardContent className="text-sm text-muted-foreground">
          The fighter roster isn&apos;t available yet. The latest database migration{" "}
          (<code>0041_event_weight_class_matchmaking.sql</code>) needs to be applied.
        </CardContent>
      </Card>
    );
  }

  const roster = ((rosterRes.data ?? []) as unknown as RosterRow[]).sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.fighter?.full_name ?? "").localeCompare(b.fighter?.full_name ?? ""),
  );

  // fighter id → the bout they are on, with card position and opponent.
  const matchups = new Map<string, { bout: Bout; number: number; opponent: string }>();
  bouts.forEach((bout, idx) => {
    const number = bout.bout_order ?? idx + 1;
    const red = bout.red_corner_fighter_id;
    const blue = bout.blue_corner_fighter_id;
    const nameOf = (fid: string | null) => (fid ? fighterMap.get(fid)?.full_name : null) ?? "TBD";
    if (red && !matchups.has(red)) matchups.set(red, { bout, number, opponent: nameOf(blue) });
    if (blue && !matchups.has(blue)) matchups.set(blue, { bout, number, opponent: nameOf(red) });
  });

  const medicalsRequired = event.medicals_required !== false;
  const asOf = `${event.event_date}T23:59:59`;
  const rows = roster.map((entry) => {
    const clearance = medicalsRequired && entry.fighter
      ? fighterClearanceSummary(entry.fighter.medical as FighterMedicalRecord[], undefined, asOf)
      : null;
    return { entry, clearance, matchup: matchups.get(entry.fighter_id) ?? null };
  });

  const active = rows.filter((r) => r.entry.status !== "withdrawn");
  const confirmed = rows.filter((r) => r.entry.status === "confirmed").length;
  const matched = active.filter((r) => r.matchup).length;
  const medicalIssues = active.filter(
    (r) => r.clearance && r.clearance.worstStatus !== "active",
  ).length;

  const onRoster = new Set(roster.map((r) => r.fighter_id));
  // Public sign-ups waiting for a decision, each with any registry fighter of
  // the same name so staff can link instead of creating a duplicate.
  const registryList = (registry ?? []) as unknown as RegistryFighter[];
  const signups = signupRes.error
    ? null
    : (
        (signupRes.data ?? []) as Pick<
          EventRegistration,
          | "id"
          | "full_name"
          | "email"
          | "phone"
          | "gym_name"
          | "weight_class"
          | "wins"
          | "losses"
          | "draws"
          | "created_at"
        >[]
      ).map((s) => ({
        ...s,
        matches: registryList.filter(
          (f) => f.full_name.trim().toLowerCase() === s.full_name.toLowerCase(),
        ),
      }));
  const registrationOpen = event.registration_open !== false;
  const candidates: FighterCandidate[] = registryList
    .filter((f) => !onRoster.has(f.id))
    .map((f) => ({
      id: f.id,
      name: f.nickname ? `${f.full_name} "${f.nickname}"` : f.full_name,
      detail: [f.primary_sport, f.weight_class, gymName(f)].filter(Boolean).join(" · "),
      sport: f.primary_sport,
    }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="On roster" value={String(active.length)} hint={`${confirmed} confirmed`} />
        <SummaryTile label="Matched" value={`${matched}/${active.length}`} />
        <SummaryTile
          label="Need opponent"
          value={String(active.length - matched)}
          valueClassName={active.length - matched > 0 ? "text-amber-700 dark:text-amber-300" : ""}
        />
        <SummaryTile
          label="Medical issues"
          value={medicalsRequired ? String(medicalIssues) : "—"}
          valueClassName={medicalIssues > 0 ? "text-red-700 dark:text-red-300" : ""}
          hint={medicalsRequired ? "As of fight night" : "Not required for this event"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" collapsible={false}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Fighter roster ({roster.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {canEdit && rows.length > 0 && (
              <p className="mb-3 text-xs text-muted-foreground">
                Weight class is set per event. Enter a target weight and leave the class on
                &quot;none&quot; to have it worked out for you, or pick a class to override.
              </p>
            )}
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No fighters on this event yet.
                {canEdit ? " Add them from the registry, then build the card from this roster." : ""}
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border/70">
                {rows.map(({ entry, clearance, matchup }) => {
                  const f = entry.fighter;
                  const gym = f ? gymName(f) : null;
                  const meta = clearance ? CLEARANCE_STATUS_META[clearance.worstStatus] : null;
                  return (
                    <li key={entry.id} className="space-y-2 px-3 py-3">
                      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {f ? (
                              <Link
                                href={`/fighters/${f.id}`}
                                className="text-sm font-medium hover:underline"
                              >
                                {f.full_name}
                              </Link>
                            ) : (
                              <span className="text-sm font-medium">(missing fighter)</span>
                            )}
                            {f?.nickname && (
                              <span className="text-xs italic text-muted-foreground">
                                &quot;{f.nickname}&quot;
                              </span>
                            )}
                            <Badge variant={STATUS_BADGE[entry.status]}>
                              {EVENT_FIGHTER_STATUS_LABELS[entry.status]}
                            </Badge>
                            {meta && f && (
                              <Link href={`/fighters/${f.id}#medical`}>
                                <Badge variant="outline" className={meta.className}>
                                  Medical: {meta.label}
                                </Badge>
                              </Link>
                            )}
                          </div>
                          {f && (
                            <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                              {[
                                f.primary_sport,
                                gym,
                                `${fighterProRecord(f)} pro`,
                                f.am_wins + f.am_losses + f.am_draws > 0
                                  ? `${f.am_wins}-${f.am_losses}-${f.am_draws} am`
                                  : null,
                                f.walking_weight_lbs != null
                                  ? `walks ${num(f.walking_weight_lbs)} lbs`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                          <div className="mt-1 text-xs">
                            <span className="font-medium capitalize">
                              {entry.weight_class ?? "Weight class not set"}
                            </span>
                            <span className="text-muted-foreground">
                              {" · "}
                              {entry.competing_as === "pro" ? "Pro" : "Amateur"}
                              {entry.target_weight_lbs != null &&
                                ` · target ${num(entry.target_weight_lbs)} lbs`}
                              {!entry.weight_class && f?.weight_class && (
                                <span className="capitalize"> · last fought at {f.weight_class}</span>
                              )}
                            </span>
                          </div>
                          <div className="mt-1 text-xs">
                            {matchup ? (
                              <Link
                                href={`/events/${event.id}/bouts/${matchup.bout.id}`}
                                className="inline-flex items-center gap-1 hover:underline"
                              >
                                <Swords className="h-3 w-3" />
                                Bout {matchup.number} vs {matchup.opponent}
                                {entry.status === "withdrawn" && (
                                  <span className="font-medium text-red-700 dark:text-red-300">
                                    — withdrawn but still on the card
                                  </span>
                                )}
                              </Link>
                            ) : entry.status === "withdrawn" ? (
                              <span className="text-muted-foreground">Not on the card</span>
                            ) : (
                              <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300">
                                Needs an opponent
                                {canEdit && (
                                  <Link
                                    href={`/events/${event.id}/bouts/new?red=${entry.fighter_id}`}
                                    className="inline-flex items-center gap-0.5 text-foreground underline-offset-2 hover:underline"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Create bout
                                  </Link>
                                )}
                              </span>
                            )}
                          </div>
                          {!canEdit && entry.notes && (
                            <p className="mt-1 text-xs text-muted-foreground">{entry.notes}</p>
                          )}
                        </div>

                        {canEdit && (
                          <ToastedForm
                            action={removeEventFighter}
                            successMessage="Removed from event"
                          >
                            <input type="hidden" name="event_id" value={event.id} />
                            <input type="hidden" name="entry_id" value={entry.id} />
                            <Button
                              type="submit"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Remove from event"
                              title="Remove from event"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </ToastedForm>
                        )}
                      </div>

                      {canEdit && (
                        <ToastedForm
                          action={updateEventFighter}
                          successMessage="Saved"
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="event_id" value={event.id} />
                          <input type="hidden" name="entry_id" value={entry.id} />
                          <NativeSelect
                            name="status"
                            defaultValue={entry.status}
                            aria-label="Status"
                            className="h-7 w-32 text-xs"
                          >
                            {EVENT_FIGHTER_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {EVENT_FIGHTER_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </NativeSelect>
                          <Input
                            name="target_weight_lbs"
                            type="number"
                            step="0.5"
                            min={60}
                            max={500}
                            defaultValue={
                              entry.target_weight_lbs != null ? num(entry.target_weight_lbs) : ""
                            }
                            placeholder="Target lbs"
                            aria-label="Target weight in pounds"
                            className="h-7 w-28 text-xs"
                          />
                          <WeightClassSelect
                            name="weight_class"
                            id={`wc_${entry.id}`}
                            sport={event.primary_sport}
                            defaultValue={entry.weight_class}
                            className="h-7 w-44 text-xs"
                          />
                          <NativeSelect
                            name="competing_as"
                            defaultValue={entry.competing_as ?? "amateur"}
                            aria-label="Competing as"
                            className="h-7 w-28 text-xs"
                          >
                            <option value="amateur">Amateur</option>
                            <option value="pro">Pro</option>
                          </NativeSelect>
                          <Input
                            name="notes"
                            defaultValue={entry.notes ?? ""}
                            placeholder="Notes"
                            aria-label="Notes"
                            className="h-7 min-w-32 flex-1 text-xs"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Save
                          </Button>
                        </ToastedForm>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {canEdit && (
          <div className="space-y-6">
            {signups && (
              <Card collapsible={false}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardList className="h-4 w-4" />
                    Public sign-ups ({signups.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ToastedForm
                    action={setRegistrationOpen}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="open" value={registrationOpen ? "0" : "1"} />
                    <span className="text-muted-foreground">
                      {event.status !== "scheduled"
                        ? "The Register button only shows while the event is scheduled."
                        : registrationOpen
                          ? "The public page shows a Register button."
                          : "Registration is closed."}
                    </span>
                    <Button type="submit" size="sm" variant="outline">
                      {registrationOpen ? "Close" : "Open"}
                    </Button>
                  </ToastedForm>
                  {signups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No one waiting.</p>
                  ) : (
                    <ul className="divide-y divide-border rounded-md border border-border/70">
                      {signups.map((s) => (
                        <li key={s.id} className="space-y-2 px-3 py-2">
                          <div>
                            <div className="text-sm font-medium">{s.full_name}</div>
                            <div className="text-xs capitalize text-muted-foreground">
                              {[
                                s.weight_class,
                                s.gym_name,
                                s.wins != null ? `${s.wins}-${s.losses ?? 0}-${s.draws ?? 0}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "No details given"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {s.email ? (
                                <a href={`mailto:${s.email}`} className="hover:underline">
                                  {s.email}
                                </a>
                              ) : (
                                "No email"
                              )}
                              {s.phone && (
                                <>
                                  {" · "}
                                  <a href={`tel:${s.phone}`} className="hover:underline">
                                    {s.phone}
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {s.matches.map((f) => (
                              <ToastedForm
                                key={f.id}
                                action={acceptRegistration}
                                successMessage="Added to roster"
                              >
                                <input type="hidden" name="event_id" value={event.id} />
                                <input type="hidden" name="registration_id" value={s.id} />
                                <input type="hidden" name="fighter_id" value={f.id} />
                                <Button type="submit" size="sm">
                                  Add existing{gymName(f) ? ` (${gymName(f)})` : ""}
                                </Button>
                              </ToastedForm>
                            ))}
                            <ToastedForm
                              action={acceptRegistration}
                              successMessage="Fighter created and added"
                            >
                              <input type="hidden" name="event_id" value={event.id} />
                              <input type="hidden" name="registration_id" value={s.id} />
                              <Button
                                type="submit"
                                size="sm"
                                variant={s.matches.length > 0 ? "outline" : "default"}
                              >
                                Add as new fighter
                              </Button>
                            </ToastedForm>
                            <ToastedForm action={dismissRegistration} successMessage="Dismissed">
                              <input type="hidden" name="event_id" value={event.id} />
                              <input type="hidden" name="registration_id" value={s.id} />
                              <Button type="submit" size="sm" variant="ghost">
                                Dismiss
                              </Button>
                            </ToastedForm>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Accepted sign-ups join the roster as Pending so you can confirm them.
                  </p>
                </CardContent>
              </Card>
            )}
            <Card collapsible={false}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserPlus className="h-4 w-4" />
                  Add from registry
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AddFightersPanel
                  eventId={event.id}
                  eventSport={event.primary_sport}
                  candidates={candidates}
                />
              </CardContent>
            </Card>

            <Card defaultOpen={false}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-4 w-4" />
                  New fighter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ToastedForm
                  action={createAndAddFighter}
                  successMessage="Fighter created and added"
                  resetOnSuccess
                  className="space-y-3"
                >
                  <input type="hidden" name="event_id" value={event.id} />
                  <FormField label="Full name" htmlFor="nf_name" required>
                    <Input id="nf_name" name="full_name" required />
                  </FormField>
                  <FormField label="Sport" htmlFor="nf_sport" required>
                    <NativeSelect
                      id="nf_sport"
                      name="primary_sport"
                      required
                      defaultValue={event.primary_sport}
                      className="capitalize"
                    >
                      {SPORTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormField>
                  <FormField label="Weight class" htmlFor="nf_class">
                    <WeightClassSelect id="nf_class" name="weight_class" sport={event.primary_sport} />
                  </FormField>
                  <FormField label="Gym" htmlFor="nf_gym">
                    <NativeSelect id="nf_gym" name="gym_id" defaultValue="__none__">
                      <option value="__none__">— Unaffiliated —</option>
                      {((gyms ?? []) as Pick<Gym, "id" | "name">[]).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormField>
                  <FormField label="Target weight (lbs)" htmlFor="nf_target">
                    <Input
                      id="nf_target"
                      name="target_weight_lbs"
                      type="number"
                      step="0.5"
                      min={60}
                      max={500}
                    />
                  </FormField>
                  <p className="text-xs text-muted-foreground">
                    Creates the fighter in the registry and adds them to this event. Fill in
                    the record, medicals and contact details from their profile afterwards.
                  </p>
                  <Button type="submit" size="sm">
                    Create and add
                  </Button>
                </ToastedForm>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
