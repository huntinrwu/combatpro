import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, HeartPulse, IdCard, Landmark, Pencil, Scale, Trophy } from "lucide-react";

import { ClassPreferencesCard } from "../_components/class-preferences-card";
import { DeleteFighterDialog } from "../_components/delete-fighter-dialog";
import { FightRecordsCard } from "../_components/fight-records-card";
import { MedicalClearancesCard } from "./_components/medical-clearances-card";
import { WeightTrackingCard } from "../_components/weight-tracking-card";
import { assignFighterGym } from "../../gyms/actions";
import { updateFighterLicenses } from "../actions";
import { db } from "@/lib/db/client";
import { getSessionUser, requireModuleAccess } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/detail-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { PersonNoBadge } from "@/components/person-no-badge";
import { Textarea } from "@/components/ui/textarea";
import { COACH_ROLE_LABELS } from "@/lib/db/types";
import type {
  CoachRole,
  EventRosterEntry,
  Fighter,
  FighterClassPreference,
  FighterMedicalRecord,
  FighterWeightLogEntry,
  FightRecord,
  Gym,
  Promotion,
} from "@/lib/db/types";
import { fmtDateShort } from "@/lib/format-utils";
import { cmToFeetIn, cmToIn } from "@/lib/units";

// Shape of the bouts → event → promotion embed below (both to-one).
type FighterBoutRow = {
  event_id: string;
  event: {
    event_date: string;
    promotion: Pick<Promotion, "id" | "name" | "abbreviation"> | null;
  } | null;
};

type EventClassRow = Pick<
  EventRosterEntry,
  "id" | "weight_class" | "competing_as" | "target_weight_lbs" | "status"
> & { event: { id: string; name: string; event_date: string } | null };

export default async function FighterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("fighters");
  const { id } = await params;
  const supabase = db();
  const [
    session,
    { data: fighter },
    { data: medicalRecords },
    { data: gyms },
    { data: fightRecords },
    { data: weightLog },
    { data: classPrefs },
    { data: rawBouts },
    { data: rawEventClasses },
  ] = await Promise.all([
    getSessionUser(),
    supabase
      .from("fighters")
      // The person's coach / owner roles ride along, so someone who both
      // fights and coaches shows as one person.
      .select("*, person:persons(person_no, coaches(id, role, is_owner, gym:gyms(id, name)))")
      .eq("id", id)
      .maybeSingle<
        Fighter & {
          person: {
            person_no: number;
            coaches: {
              id: string;
              role: CoachRole | null;
              is_owner: boolean;
              gym: { id: string; name: string } | null;
            }[];
          } | null;
        }
      >(),
    supabase
      .from("fighter_medical_records")
      .select("*")
      .eq("fighter_id", id)
      .order("issued_on", { ascending: false }),
    supabase.from("gyms").select("id, name").order("name"),
    supabase
      .from("fight_records")
      .select("*")
      .eq("fighter_id", id)
      .order("fight_date", { ascending: false }),
    supabase
      .from("fighter_weight_log")
      .select("*")
      .eq("fighter_id", id)
      .order("recorded_at", { ascending: false })
      .limit(20),
    supabase
      .from("fighter_class_preferences")
      .select("*")
      .eq("fighter_id", id),
    // Promotions this fighter has appeared on — derived from CombatPro-tracked
    // bouts. Doesn't include historical fights on other platforms; those live
    // in fight_records under event_name (free-text).
    // bouts and events are linked twice (bouts.event_id + events.current_bout_id),
    // so the embed has to name the FK.
    supabase
      .from("bouts")
      .select(
        "event_id, result, event:events!bouts_event_id_fkey(event_date, promotion:promotions(id, name, abbreviation))",
      )
      .or(`red_corner_fighter_id.eq.${id},blue_corner_fighter_id.eq.${id}`),
    // The class this fighter was entered at on each event.
    supabase
      .from("event_fighters")
      .select(
        "id, weight_class, competing_as, target_weight_lbs, status, event:events(id, name, event_date)",
      )
      .eq("fighter_id", id),
  ]);

  if (!fighter) notFound();

  // What the delete dialog warns about before a staff member confirms.
  const boutRows = (rawBouts ?? []) as unknown as { result: string | null }[];
  const deleteImpact = {
    events: (rawEventClasses ?? []).length,
    openBouts: boutRows.filter((b) => !b.result).length,
    decidedBouts: boutRows.filter((b) => b.result).length,
    fightRecords: (fightRecords ?? []).length,
  };

  const eventClasses = ((rawEventClasses ?? []) as unknown as EventClassRow[])
    .filter((r) => r.event)
    .sort((a, b) => b.event!.event_date.localeCompare(a.event!.event_date));

  const heightParts = cmToFeetIn(fighter.height_cm);
  const gymList = (gyms ?? []) as Pick<Gym, "id" | "name">[];
  const assignedGym = fighter.gym_id
    ? gymList.find((g) => g.id === fighter.gym_id) ?? null
    : null;

  const person = fighter.person;

  // One entry per promotion: how many of this fighter's bouts ran under it
  // and the latest event date.
  const promotionStats = new Map<
    string,
    { promotion: Pick<Promotion, "id" | "name" | "abbreviation">; count: number; lastDate: string }
  >();
  for (const b of (rawBouts ?? []) as unknown as FighterBoutRow[]) {
    const promotion = b.event?.promotion;
    if (!b.event || !promotion) continue;
    const entry = promotionStats.get(promotion.id) ?? { promotion, count: 0, lastDate: "" };
    entry.count += 1;
    if (b.event.event_date > entry.lastDate) entry.lastDate = b.event.event_date;
    promotionStats.set(promotion.id, entry);
  }

  const promotionsFought = Array.from(promotionStats.values())
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate));

  return (
    <>
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {fighter.full_name}
          </h1>
          {person?.person_no != null && <PersonNoBadge no={person.person_no} />}
          <Badge variant="secondary" className="capitalize">
            {fighter.primary_sport}
          </Badge>
          {(person?.coaches ?? []).map((c) => {
            const label = [c.role ? COACH_ROLE_LABELS[c.role] : null, c.is_owner ? "Owner" : null]
              .filter(Boolean)
              .join(" & ");
            const badge = (
              <Badge variant="outline">
                {label}
                {c.gym ? ` · ${c.gym.name}` : ""}
              </Badge>
            );
            return c.gym ? (
              <Link key={c.id} href={`/gyms/${c.gym.id}`}>
                {badge}
              </Link>
            ) : (
              <span key={c.id}>{badge}</span>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            {session?.isStaff && (
              <Button
                size="sm"
                variant="outline"
                render={
                  <Link href={`/fighters/${fighter.id}/edit`}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                }
              />
            )}
            {session?.isStaff && (
              <DeleteFighterDialog
                fighterId={fighter.id}
                fighterName={fighter.full_name}
                impact={deleteImpact}
              />
            )}
            <Button
              size="sm"
              variant="outline"
              render={
                <a
                  href={`/api/fighters/${fighter.id}/passport`}
                  target="_blank"
                  rel="noopener"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Passport PDF
                </a>
              }
            />
          </div>
        </div>
        {fighter.nickname && (
          <p className="mt-1 text-sm italic text-muted-foreground">
            &quot;{fighter.nickname}&quot;
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            Pro <span className="font-mono text-foreground">
              {fighter.pro_wins}-{fighter.pro_losses}-{fighter.pro_draws}
            </span>
          </span>
          <span>·</span>
          <span>
            Am <span className="font-mono">
              {fighter.am_wins}-{fighter.am_losses}-{fighter.am_draws}
            </span>
          </span>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="DOB" value={fighter.date_of_birth} />
            <DetailRow
              label="Gender"
              value={fighter.gender ? <span className="capitalize">{fighter.gender}</span> : null}
            />
            <DetailRow label="Nationality" value={fighter.nationality} />
            <DetailRow label="Hometown" value={fighter.hometown} />
            <DetailRow
              label="Gym"
              value={
                assignedGym ? (
                  <Link href={`/gyms/${assignedGym.id}`} className="hover:underline">
                    {assignedGym.name}
                  </Link>
                ) : (
                  fighter.gym
                )
              }
            />
            {session?.isStaff && (
            <div className="border-b border-border/50 py-1.5 last:border-b-0">
              <form action={assignFighterGym} className="flex items-center gap-2">
                <input type="hidden" name="fighter_id" value={fighter.id} />
                <NativeSelect name="gym_id" defaultValue={fighter.gym_id ?? "__none__"} className="flex-1">
                  <option value="__none__">— unaffiliated —</option>
                  {gymList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </NativeSelect>
                <Button type="submit" size="sm" variant="secondary">
                  Save
                </Button>
              </form>
            </div>
            )}
            <DetailRow label="Current weight class" value={fighter.weight_class} />
            <DetailRow
              label="Stance"
              value={fighter.stance ? <span className="capitalize">{fighter.stance}</span> : null}
            />
            <DetailRow
              label="Height"
              value={
                fighter.height_cm && heightParts
                  ? (
                      <span>
                        {`${heightParts.feet}'${heightParts.inches}"`}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({(fighter.height_cm / 100).toFixed(2)} m / {Math.round(fighter.height_cm)} cm)
                        </span>
                      </span>
                    )
                  : null
              }
            />
            <DetailRow
              label="Reach"
              value={
                fighter.reach_cm
                  ? (
                      <span>
                        {Math.round(cmToIn(fighter.reach_cm) ?? 0)} in
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({Math.round(fighter.reach_cm)} cm)
                        </span>
                      </span>
                    )
                  : null
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
                fighter.contact_email ? (
                  <a
                    href={`mailto:${fighter.contact_email}`}
                    className="hover:underline"
                  >
                    {fighter.contact_email}
                  </a>
                ) : null
              }
            />
            <DetailRow label="Phone" value={fighter.contact_phone} />
            <DetailRow
              label="Notes"
              value={
                fighter.notes ? (
                  <span className="whitespace-pre-wrap text-left">{fighter.notes}</span>
                ) : null
              }
            />
          </CardContent>
        </Card>
      </div>

      {eventClasses.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Weight class by event
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Weight class is recorded per event. The class on this profile follows the most
              recent one.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Event</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Weight class</th>
                    <th className="px-3 py-2 font-medium">Target</th>
                    <th className="px-3 py-2 font-medium">As</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {eventClasses.map((r) => (
                    <tr key={r.id} className={r.status === "withdrawn" ? "text-muted-foreground" : ""}>
                      <td className="px-3 py-2">
                        <Link href={`/events/${r.event!.id}/fighters`} className="hover:underline">
                          {r.event!.name}
                        </Link>
                        {r.status === "withdrawn" && <span className="ml-2 text-xs">(withdrawn)</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">{fmtDateShort(r.event!.event_date)}</td>
                      <td className="px-3 py-2 capitalize">{r.weight_class ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.target_weight_lbs != null ? `${Number(r.target_weight_lbs)} lbs` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.competing_as === "pro" ? "Pro" : r.competing_as === "amateur" ? "Amateur" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Fight record
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FightRecordsCard
            fighterId={fighter.id}
            records={(fightRecords ?? []) as FightRecord[]}
            declared={{
              pro: { w: fighter.pro_wins, l: fighter.pro_losses, d: fighter.pro_draws },
              am: { w: fighter.am_wins, l: fighter.am_losses, d: fighter.am_draws },
            }}
            isStaff={session?.isStaff ?? false}
          />
        </CardContent>
      </Card>

      <Card className="mt-6" defaultOpen={false}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4" />
            Promotions fought under ({promotionsFought.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {promotionsFought.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No CombatPro-tracked bouts under a registered promotion yet. As events with a
              promotion attach this fighter, they&apos;ll appear here.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {promotionsFought.map(({ promotion, count, lastDate }) => (
                <li key={promotion.id} className="py-2">
                  <Link
                    href={`/promotions/${promotion.id}`}
                    className="flex items-start justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {promotion.abbreviation ? (
                          <>
                            <span className="font-mono">{promotion.abbreviation}</span>
                            <span className="ml-2 text-muted-foreground">{promotion.name}</span>
                          </>
                        ) : (
                          promotion.name
                        )}
                      </div>
                      {lastDate && (
                        <div className="text-[11px] text-muted-foreground">
                          Last appeared {new Date(lastDate + "T00:00:00").toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {count} bout{count === 1 ? "" : "s"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Weight tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WeightTrackingCard
              fighterId={fighter.id}
              walkingWeightLbs={fighter.walking_weight_lbs}
              walkingWeightUpdatedAt={fighter.walking_weight_updated_at}
              log={(weightLog ?? []) as FighterWeightLogEntry[]}
              isStaff={session?.isStaff ?? false}
            />
          </CardContent>
        </Card>

        <Card defaultOpen={false}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Class preferences (per sport)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ClassPreferencesCard
              fighterId={fighter.id}
              preferences={(classPrefs ?? []) as FighterClassPreference[]}
              walkingWeightLbs={fighter.walking_weight_lbs}
              isStaff={session?.isStaff ?? false}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6" defaultOpen={false}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IdCard className="h-4 w-4" />
            Licenses &amp; sanctioning IDs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateFighterLicenses} className="space-y-2">
            <input type="hidden" name="fighter_id" value={fighter.id} />
            <Textarea
              name="licenses"
              rows={3}
              readOnly={!session?.isStaff}
              defaultValue={fighter.licenses ?? ""}
              placeholder="Free-form. e.g. WBC #12345 · FSBC lic. #6789 (exp 2027-03) · CSAC #4471"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Shown on the passport PDF for commission submissions.
              </p>
              {session?.isStaff && (
                <Button type="submit" size="sm" variant="secondary">
                  Save licenses
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulse className="h-4 w-4" />
            Medical clearances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MedicalClearancesCard
            fighterId={fighter.id}
            records={(medicalRecords ?? []) as FighterMedicalRecord[]}
          />
        </CardContent>
      </Card>
    </>
  );
}
