import { notFound } from "next/navigation";
import { Settings2, Swords } from "lucide-react";

import { saveMatchmakingSettings } from "../fighters/actions";
import { loadEventDetail } from "../_lib/event-detail";
import { MatchBoard } from "./_components/match-board";
import { ShareLineupCard } from "../_components/share-lineup-card";
import { db } from "@/lib/db/client";
import { getSessionUser, requireModuleAccess } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";
import { parseBoard, parseMatchmaking, totalFights, totalWins, type Candidate } from "@/lib/matchmaking";
import { weightClassesForSport } from "@/lib/weight-classes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { ToastedForm } from "@/components/forms/toasted-form";
import { Input } from "@/components/ui/input";
import { ageFromDob } from "@/lib/format-utils";
import { num, type EventRosterEntry, type Fighter, type Gym } from "@/lib/db/types";

type RosterFighter = Pick<
  Fighter,
  | "id"
  | "full_name"
  | "date_of_birth"
  | "gender"
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
  "id, fighter_id, status, weight_class, competing_as, target_weight_lbs, fighter:fighters(id, full_name, date_of_birth, gender, pro_wins, pro_losses, pro_draws, am_wins, am_losses, am_draws, gym, gym_id, gym_ref:gyms(name))";

export default async function EventMatchmakingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("events");
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

  // Top of a weight class in pounds, so fighters with only a class still sort by weight.
  const classes = weightClassesForSport(event.primary_sport) ?? [];
  const classTop = (name: string | null): number | null => {
    const wc = name ? classes.find((c) => c.name.toLowerCase() === name.toLowerCase()) : null;
    return wc ? (Number.isFinite(wc.upper_lbs) ? wc.upper_lbs : 400) : null;
  };

  const active: Candidate[] = ((rosterRes.data ?? []) as unknown as RosterRow[])
    .filter((r) => r.status !== "withdrawn" && r.fighter)
    .map((r) => {
      const f = r.fighter!;
      const target = r.target_weight_lbs != null ? num(r.target_weight_lbs) : null;
      return {
        id: r.id,
        fighterId: r.fighter_id,
        name: f.full_name,
        gym: (f.gym_id ? f.gym_ref?.name : f.gym) ?? null,
        competingAs: r.competing_as ?? "amateur",
        weightClass: r.weight_class,
        targetWeightLbs: target,
        fights: totalFights(f),
        wins: totalWins(f),
        age: ageFromDob(f.date_of_birth),
        gender: f.gender,
        sortLbs: target ?? classTop(r.weight_class),
      };
    });

  const available = active.filter((c) => !onCard.has(c.fighterId));

  return (
    <div className="space-y-5">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card collapsible={false}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Swords className="h-4 w-4" />
                Matchups ({available.length} need an opponent)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MatchBoard
                eventId={event.id}
                candidates={available}
                settings={settings}
                canEdit={canEdit}
                savedBoard={parseBoard((event.matchmaking as { board?: unknown } | null)?.board)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
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
                Pairings outside these rules are flagged, not blocked. You decide.
              </p>
            </ToastedForm>
          </CardContent>
        </Card>
          {event.slug && (event.status === "scheduled" || event.status === "complete") && (
            <ShareLineupCard
              slug={event.slug}
              eventId={event.id}
              publicRoster={event.public_roster !== false}
              publicBouts={event.public_bouts !== false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
