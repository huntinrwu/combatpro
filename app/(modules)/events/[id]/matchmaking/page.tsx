import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Settings2, Swords, Users } from "lucide-react";

import { saveMatchmakingSettings } from "../fighters/actions";
import { loadEventDetail } from "../_lib/event-detail";
import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";
import {
  experienceTier,
  parseMatchmaking,
  suggestMatchups,
  totalFights,
  totalWins,
  type Candidate,
  type Pairing,
} from "@/lib/matchmaking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { ToastedForm } from "@/components/forms/toasted-form";
import { Input } from "@/components/ui/input";
import { SummaryTile } from "@/components/summary-tile";
import { num, type EventRosterEntry, type Fighter, type Gym } from "@/lib/db/types";

type RosterFighter = Pick<
  Fighter,
  | "id"
  | "full_name"
  | "pro_wins"
  | "pro_losses"
  | "pro_draws"
  | "am_wins"
  | "am_losses"
  | "am_draws"
  | "gym"
  | "gym_id"
> & { gym_ref: Pick<Gym, "name"> | null };

type RosterRow = Pick<
  EventRosterEntry,
  "id" | "fighter_id" | "status" | "weight_class" | "competing_as" | "target_weight_lbs"
> & { fighter: RosterFighter | null };

const ROSTER_SELECT =
  "id, fighter_id, status, weight_class, competing_as, target_weight_lbs, fighter:fighters(id, full_name, pro_wins, pro_losses, pro_draws, am_wins, am_losses, am_draws, gym, gym_id, gym_ref:gyms(name))";

function recordLine(c: Candidate): string {
  return `${c.fights} fight${c.fights === 1 ? "" : "s"} · ${c.wins} win${c.wins === 1 ? "" : "s"}`;
}

// Link that opens the bout form with both corners and the terms prefilled.
function boutHref(eventId: string, p: Pairing): string {
  const q = new URLSearchParams({ red: p.a.fighterId, blue: p.b.fighterId });
  const weights = [p.a.targetWeightLbs, p.b.targetWeightLbs].filter((w): w is number => w != null);
  if (weights.length > 0) q.set("lbs", String(Math.max(...weights)));
  const wc = p.a.weightClass ?? p.b.weightClass;
  if (wc) q.set("wc", wc);
  if (p.a.competingAs === p.b.competingAs) q.set("cls", p.a.competingAs);
  return `/events/${eventId}/bouts/new?${q}`;
}

export default async function EventMatchmakingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, session, rosterRes] = await Promise.all([
    loadEventDetail(id),
    getSessionUser(),
    db().from("event_fighters").select(ROSTER_SELECT).eq("event_id", id),
  ]);
  if (!detail) notFound();
  const { event, bouts } = detail;
  const canEdit = session ? canEditEvent(event, session) : false;

  if (rosterRes.error) {
    console.error("[matchmaking]", rosterRes.error.code, rosterRes.error.message);
    return (
      <Card collapsible={false}>
        <CardContent className="text-sm text-muted-foreground">
          Matchmaking isn&apos;t available yet. The latest database migration (
          <code>0041_event_weight_class_matchmaking.sql</code>) needs to be applied.
        </CardContent>
      </Card>
    );
  }

  const settings = parseMatchmaking(event.matchmaking);

  const onCard = new Set<string>();
  for (const b of bouts) {
    if (b.red_corner_fighter_id) onCard.add(b.red_corner_fighter_id);
    if (b.blue_corner_fighter_id) onCard.add(b.blue_corner_fighter_id);
  }

  const active: Candidate[] = ((rosterRes.data ?? []) as unknown as RosterRow[])
    .filter((r) => r.status !== "withdrawn" && r.fighter)
    .map((r) => {
      const f = r.fighter!;
      return {
        id: r.id,
        fighterId: r.fighter_id,
        name: f.full_name,
        gym: (f.gym_id ? f.gym_ref?.name : f.gym) ?? null,
        competingAs: r.competing_as ?? "amateur",
        weightClass: r.weight_class,
        targetWeightLbs: r.target_weight_lbs != null ? num(r.target_weight_lbs) : null,
        fights: totalFights(f),
        wins: totalWins(f),
      };
    });

  const available = active.filter((c) => !onCard.has(c.fighterId));
  const { suggested, all, unmatched } = suggestMatchups(available, settings);
  const suggestedKeys = new Set(suggested.map((p) => `${p.a.id}|${p.b.id}`));
  const alternatives = all.filter((p) => !suggestedKeys.has(`${p.a.id}|${p.b.id}`));

  // Everyone on the roster, bucketed by pro/amateur then weight class.
  const groups = new Map<string, Candidate[]>();
  for (const c of active) {
    const key = `${c.competingAs === "pro" ? "Pro" : "Amateur"} · ${c.weightClass ?? "No weight class set"}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const groupList = [...groups.entries()]
    .map(([title, members]) => ({
      title,
      members: members.sort(
        (a, b) => (a.targetWeightLbs ?? 999) - (b.targetWeightLbs ?? 999) || a.fights - b.fights,
      ),
      // Lightest group first; groups with no weights sink to the bottom.
      sortKey: Math.min(...members.map((m) => m.targetWeightLbs ?? 9999)),
    }))
    .sort((a, b) => a.sortKey - b.sortKey || a.title.localeCompare(b.title));

  const missingWeight = available.filter((c) => c.targetWeightLbs == null && !c.weightClass).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Need opponent" value={String(available.length)} />
        <SummaryTile label="Suggested bouts" value={String(suggested.length)} />
        <SummaryTile
          label="No match found"
          value={String(unmatched.length)}
          valueClassName={unmatched.length > 0 ? "text-amber-700 dark:text-amber-300" : ""}
        />
        <SummaryTile
          label="Weight not set"
          value={String(missingWeight)}
          valueClassName={missingWeight > 0 ? "text-amber-700 dark:text-amber-300" : ""}
          hint="Set on the Fighters tab"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card collapsible={false}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Swords className="h-4 w-4" />
                Suggested matchups ({suggested.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {available.length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  {active.length === 0 ? (
                    <>
                      No fighters on this event yet.{" "}
                      <Link href={`/events/${event.id}/fighters`} className="underline">
                        Add fighters
                      </Link>{" "}
                      first.
                    </>
                  ) : (
                    "Everyone on the roster is already on a bout, or only one fighter is left."
                  )}
                </p>
              ) : suggested.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pairings fit the current rules. Loosen the rules on the right, or set target
                  weights on the Fighters tab.
                </p>
              ) : (
                <PairingList eventId={event.id} pairings={suggested} canEdit={canEdit} />
              )}

              {unmatched.length > 0 && available.length >= 2 && (
                <div className="mt-4">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Left without an opponent
                  </div>
                  <ul className="divide-y divide-border rounded-md border border-border/70 text-sm">
                    {unmatched.map(({ candidate, reason }) => (
                      <li key={candidate.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                        <span>
                          <Link href={`/fighters/${candidate.fighterId}`} className="font-medium hover:underline">
                            {candidate.name}
                          </Link>
                          <span className="ml-2 text-xs capitalize text-muted-foreground">
                            {candidate.weightClass ?? "no class"} · {recordLine(candidate)}
                          </span>
                        </span>
                        <span className="text-xs text-amber-700 dark:text-amber-300">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {alternatives.length > 0 && (
            <Card defaultOpen={false}>
              <CardHeader>
                <CardTitle className="text-base">
                  Other eligible pairings ({alternatives.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PairingList eventId={event.id} pairings={alternatives} canEdit={canEdit} />
              </CardContent>
            </Card>
          )}

          <Card collapsible={false}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Roster by class ({active.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupList.length === 0 && (
                <p className="text-sm text-muted-foreground">No fighters on this event yet.</p>
              )}
              {groupList.map((g) => (
                <div key={g.title}>
                  <div className="mb-1 flex items-baseline gap-2 text-sm font-medium capitalize">
                    {g.title}
                    <span className="text-xs font-normal text-muted-foreground">
                      {g.members.length}
                    </span>
                  </div>
                  <ul className="divide-y divide-border rounded-md border border-border/70 text-sm">
                    {g.members.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                        <span>
                          <Link href={`/fighters/${c.fighterId}`} className="hover:underline">
                            {c.name}
                          </Link>
                          {c.gym && <span className="ml-2 text-xs text-muted-foreground">{c.gym}</span>}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          {c.targetWeightLbs != null && <span>{c.targetWeightLbs} lbs</span>}
                          <span>{recordLine(c)}</span>
                          <Badge variant="outline">{experienceTier(c.fights).label}</Badge>
                          {onCard.has(c.fighterId) && <Badge variant="secondary">On card</Badge>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card collapsible={false} className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4" />
              Rules for this event
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ToastedForm
              action={saveMatchmakingSettings}
              successMessage="Rules saved"
              className="space-y-3"
            >
              <input type="hidden" name="event_id" value={event.id} />
              <FormField
                label="Max weight difference (lbs)"
                htmlFor="mm_weight"
                hint="Between the two fighters' target weights."
              >
                <Input
                  id="mm_weight"
                  name="maxWeightGapLbs"
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  required
                  disabled={!canEdit}
                  defaultValue={settings.maxWeightGapLbs}
                />
              </FormField>
              <FormField
                label="Max experience difference (fights)"
                htmlFor="mm_fights"
                hint="Total fights, pro and amateur combined."
              >
                <Input
                  id="mm_fights"
                  name="maxFightGap"
                  type="number"
                  min={0}
                  max={200}
                  step="1"
                  required
                  disabled={!canEdit}
                  defaultValue={settings.maxFightGap}
                />
              </FormField>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="allowProAm"
                  className="mt-1"
                  disabled={!canEdit}
                  defaultChecked={settings.allowProAm}
                />
                <span>
                  Allow pro vs amateur
                  <span className="block text-xs text-muted-foreground">
                    Only when they are within the experience limit above.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="allowSameGym"
                  className="mt-1"
                  disabled={!canEdit}
                  defaultChecked={settings.allowSameGym}
                />
                <span>Allow teammates from the same gym</span>
              </label>
              {canEdit && (
                <Button type="submit" size="sm">
                  Save rules
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Suggestions are a starting point. You can always build any bout by hand from the
                Bouts tab.
              </p>
            </ToastedForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PairingList({
  eventId,
  pairings,
  canEdit,
}: {
  eventId: string;
  pairings: Pairing[];
  canEdit: boolean;
}) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border/70">
      {pairings.map((p) => (
        <li key={`${p.a.id}|${p.b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">
              {p.a.name} <span className="font-normal text-muted-foreground">vs</span> {p.b.name}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs capitalize text-muted-foreground">
              <span>{p.a.weightClass ?? p.b.weightClass ?? "no class"}</span>
              <span className="normal-case">
                {p.weightGapLbs != null
                  ? p.weightGapLbs === 0
                    ? "same weight"
                    : `${p.weightGapLbs} lbs apart`
                  : "weight gap unknown"}
              </span>
              <span className="normal-case">
                {p.a.fights} vs {p.b.fights} fights
              </span>
              {p.notes.map((n) => (
                <Badge key={n} variant="outline" className="border-amber-500/40 normal-case text-amber-700 dark:text-amber-300">
                  {n}
                </Badge>
              ))}
            </div>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              render={
                <Link href={boutHref(eventId, p)}>
                  <Plus className="h-3 w-3" />
                  Create bout
                </Link>
              }
            />
          )}
        </li>
      ))}
    </ul>
  );
}
