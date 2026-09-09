import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, HeartPulse, IdCard, Landmark, Pencil, Scale, Trophy } from "lucide-react";

import { ClassPreferencesCard } from "../_components/class-preferences-card";
import { FightRecordsCard } from "../_components/fight-records-card";
import { MedicalClearancesCard } from "./_components/medical-clearances-card";
import { WeightTrackingCard } from "../_components/weight-tracking-card";
import { assignFighterGym } from "../../gyms/actions";
import { updateFighterLicenses } from "../actions";
import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type {
  Bout,
  EventRow,
  Fighter,
  FighterClassPreference,
  FighterMedicalRecord,
  FighterWeightLogEntry,
  FightRecord,
  Gym,
  Promotion,
} from "@/lib/db/types";
import { fmtHeight, fmtReach } from "@/lib/units";

export const dynamic = "force-dynamic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value ?? <em className="text-muted-foreground">—</em>}</span>
    </div>
  );
}

export default async function FighterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = db();
  const session = await getSessionUser();
  const [
    { data: fighter },
    { data: medicalRecords },
    { data: gyms },
    { data: fightRecords },
    { data: weightLog },
    { data: classPrefs },
  ] = await Promise.all([
    supabase.from("fighters").select("*").eq("id", id).maybeSingle<Fighter>(),
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
  ]);

  if (!fighter) notFound();

  const gymList = (gyms ?? []) as Pick<Gym, "id" | "name">[];
  const assignedGym = fighter.gym_id
    ? gymList.find((g) => g.id === fighter.gym_id) ?? null
    : null;

  // Promotions this fighter has appeared on — derived from CombatPro-tracked
  // bouts. Doesn't include historical fights on other platforms; those live
  // in fight_records under event_name (free-text).
  const { data: rawBouts } = await supabase
    .from("bouts")
    .select("id, event_id, red_corner_fighter_id, blue_corner_fighter_id")
    .or(`red_corner_fighter_id.eq.${id},blue_corner_fighter_id.eq.${id}`);
  const fighterBouts = (rawBouts ?? []) as Pick<
    Bout,
    "id" | "event_id" | "red_corner_fighter_id" | "blue_corner_fighter_id"
  >[];
  const boutEventIds = Array.from(new Set(fighterBouts.map((b) => b.event_id)));

  const { data: rawFighterEvents } = boutEventIds.length
    ? await supabase
        .from("events")
        .select("id, name, event_date, promotion_id")
        .in("id", boutEventIds)
    : { data: [] };
  const fighterEvents = (rawFighterEvents ?? []) as Pick<
    EventRow,
    "id" | "name" | "event_date" | "promotion_id"
  >[];

  const promotionEventIds = fighterEvents
    .map((e) => e.promotion_id)
    .filter((x): x is string => Boolean(x));
  const uniquePromotionIds = Array.from(new Set(promotionEventIds));

  const { data: rawFighterPromotions } = uniquePromotionIds.length
    ? await supabase
        .from("promotions")
        .select("id, name, abbreviation")
        .in("id", uniquePromotionIds)
    : { data: [] };
  const fighterPromotions = (rawFighterPromotions ?? []) as Pick<
    Promotion,
    "id" | "name" | "abbreviation"
  >[];

  const promotionCounts = new Map<string, { count: number; lastDate: string }>();
  const boutsByEvent = new Map<string, number>();
  for (const b of fighterBouts) boutsByEvent.set(b.event_id, (boutsByEvent.get(b.event_id) ?? 0) + 1);
  for (const e of fighterEvents) {
    if (!e.promotion_id) continue;
    const nBouts = boutsByEvent.get(e.id) ?? 0;
    const entry = promotionCounts.get(e.promotion_id) ?? { count: 0, lastDate: "" };
    entry.count += nBouts;
    if (e.event_date > entry.lastDate) entry.lastDate = e.event_date;
    promotionCounts.set(e.promotion_id, entry);
  }

  const promotionsFought = fighterPromotions
    .map((p) => ({ promotion: p, ...(promotionCounts.get(p.id) ?? { count: 0, lastDate: "" }) }))
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate));

  return (
    <>
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {fighter.full_name}
          </h1>
          <Badge variant="secondary" className="capitalize">
            {fighter.primary_sport}
          </Badge>
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
            <DetailRow label="Weight class" value={fighter.weight_class} />
            <DetailRow
              label="Stance"
              value={fighter.stance ? <span className="capitalize">{fighter.stance}</span> : null}
            />
            <DetailRow
              label="Height"
              value={
                fighter.height_cm
                  ? (
                      <span>
                        {fmtHeight(fighter.height_cm).split(" (")[0]}
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
                        {fmtReach(fighter.reach_cm).split(" (")[0]}
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

      <Card className="mt-6">
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

        <Card>
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

      <Card className="mt-6">
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
              defaultValue={fighter.licenses ?? ""}
              placeholder="Free-form. e.g. WBC #12345 · FSBC lic. #6789 (exp 2027-03) · CSAC #4471"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Shown on the passport PDF for commission submissions.
              </p>
              <Button type="submit" size="sm" variant="secondary">
                Save licenses
              </Button>
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
