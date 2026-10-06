import { redirect } from "next/navigation";

import { FighterWidget, type FighterNextBout } from "./_components/dashboard/fighter-widget";
import { GlobalSearch } from "./_components/dashboard/global-search";
import { GymWidget, type RosterFighter } from "./_components/dashboard/gym-widget";
import { ModulesStrip } from "./_components/dashboard/modules-strip";
import {
  OfficialWidget,
  type OfficialUpcoming,
} from "./_components/dashboard/official-widget";
import {
  PromoterWidget,
  type PromoterEvent,
} from "./_components/dashboard/promoter-widget";
import {
  RecentFightersWidget,
  type RecentFighter,
} from "./_components/dashboard/recent-fighters-widget";
import {
  RegulatorWidget,
  type SanctionedEvent,
} from "./_components/dashboard/regulator-widget";
import {
  UpcomingEventsWidget,
  type UpcomingEvent,
} from "./_components/dashboard/upcoming-events-widget";
import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type {
  Bout,
  EventOfficial,
  EventRow,
  Fighter,
  Gym,
  Official,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

// Column lists match exactly what each widget renders — keeps the
// every-login dashboard from pulling whole rows (notes, contact info, …).
const UPCOMING_EVENT_COLS = "id, name, event_date, status, slug, city, state";
const PROMOTER_EVENT_COLS = "id, name, event_date, status, slug";
const SANCTIONED_EVENT_COLS = "id, name, event_date, slug";
const RECENT_FIGHTER_COLS =
  "id, full_name, nickname, photo_url, weight_class, primary_sport, pro_wins, pro_losses, pro_draws";
const ROSTER_FIGHTER_COLS = "id, full_name, pro_wins, pro_losses, pro_draws";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isStaff && user.approvedRoles.length === 0) redirect("/pending");

  const supabase = db();
  const today = new Date().toISOString().slice(0, 10);
  const roles = new Set(user.approvedRoles);
  const email = user.email.toLowerCase();

  // Universal: upcoming events + recent fighters
  const universalPromise = Promise.all([
    supabase
      .from("events")
      .select(UPCOMING_EVENT_COLS)
      .gte("event_date", today)
      .in("status", ["draft", "scheduled"])
      .order("event_date", { ascending: true })
      .limit(5),
    supabase
      .from("fighters")
      .select(RECENT_FIGHTER_COLS)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Promoter widget
  const isPromoter = user.isStaff || roles.has("promoter");
  const promoterPromise = isPromoter
    ? Promise.all([
        supabase
          .from("events")
          .select(PROMOTER_EVENT_COLS)
          .eq("created_by", user.id)
          .gte("event_date", today)
          .order("event_date", { ascending: true })
          .limit(5),
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("created_by", user.id),
      ])
    : null;

  // Official widget — prefer person_id (post-merge canonical link); fall back
  // to contact_email match for legacy rows that haven't been linked yet.
  const isOfficial = user.isStaff || roles.has("official");
  const officialProfilePromise = isOfficial
    ? (user.personId
        ? supabase
            .from("officials")
            .select("*")
            .eq("person_id", user.personId)
            .limit(1)
            .maybeSingle<Official>()
        : supabase
            .from("officials")
            .select("*")
            .ilike("contact_email", email)
            .limit(1)
            .maybeSingle<Official>())
    : null;

  // Fighter widget — same person_id-first strategy.
  const isFighter = user.isStaff || roles.has("fighter");
  const fighterProfilePromise = isFighter
    ? (user.personId
        ? supabase
            .from("fighters")
            .select("*")
            .eq("person_id", user.personId)
            .limit(1)
            .maybeSingle<Fighter>()
        : supabase
            .from("fighters")
            .select("*")
            .ilike("contact_email", email)
            .limit(1)
            .maybeSingle<Fighter>())
    : null;

  // Regulator widget (SB / commission)
  const isSb = user.isStaff || roles.has("sanctioning_body");
  const isCommission = user.isStaff || roles.has("commission");
  const regulatorPromise =
    isSb || isCommission
      ? Promise.all([
          supabase
            .from("sanctioning_bodies")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("promotions")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("events")
            .select(SANCTIONED_EVENT_COLS)
            .gte("event_date", today)
            .not("sanctioning_body_id", "is", null)
            .in("status", ["draft", "scheduled"])
            .order("event_date", { ascending: true })
            .limit(5),
        ])
      : null;

  // Gym widget — best-effort: coach/gym_owner email matches gym.contact_email
  const isGymPerson = user.isStaff || roles.has("gym_owner") || roles.has("coach");
  const gymPromise = isGymPerson
    ? supabase
        .from("gyms")
        .select("*")
        .ilike("contact_email", email)
        .limit(1)
        .maybeSingle<Gym>()
    : null;

  const [
    [{ data: upcomingEvents }, { data: recentFighters }],
    promoterData,
    officialProfile,
    fighterProfile,
    regulatorData,
    gymRecord,
  ] = await Promise.all([
    universalPromise,
    promoterPromise,
    officialProfilePromise,
    fighterProfilePromise,
    regulatorPromise,
    gymPromise,
  ]);

  // Follow-up queries that depend on the results above. The three chains
  // are independent of each other, so run them concurrently.
  const loadOfficialUpcoming = async (): Promise<OfficialUpcoming[]> => {
    if (!officialProfile?.data) return [];
    const { data: assignments } = await supabase
      .from("event_officials")
      .select("event_id, event_role")
      .eq("official_id", officialProfile.data.id);
    const rows = (assignments ?? []) as Pick<
      EventOfficial,
      "event_id" | "event_role"
    >[];
    if (!rows.length) return [];
    const eventIds = Array.from(new Set(rows.map((a) => a.event_id)));
    const { data: events } = await supabase
      .from("events")
      .select("id, name, event_date, slug")
      .in("id", eventIds)
      .gte("event_date", today)
      .order("event_date", { ascending: true });
    const eventMap = new Map(
      ((events ?? []) as Pick<EventRow, "id" | "name" | "event_date" | "slug">[]).map(
        (e) => [e.id, e],
      ),
    );
    const out: OfficialUpcoming[] = [];
    for (const a of rows) {
      const e = eventMap.get(a.event_id);
      if (!e) continue;
      out.push({
        eventId: e.id,
        eventName: e.name,
        eventDate: e.event_date,
        eventSlug: e.slug,
        role: a.event_role,
      });
    }
    out.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    return out.slice(0, 5);
  };

  const loadFighterGym = async (): Promise<Pick<
    Gym,
    "id" | "name" | "city" | "state"
  > | null> => {
    const gymId = fighterProfile?.data?.gym_id;
    if (!gymId) return null;
    const { data: g } = await supabase
      .from("gyms")
      .select("id, name, city, state")
      .eq("id", gymId)
      .maybeSingle<Pick<Gym, "id" | "name" | "city" | "state">>();
    return g ?? null;
  };

  const loadFighterNextBout = async (): Promise<FighterNextBout> => {
    if (!fighterProfile?.data) return null;
    const fid = fighterProfile.data.id;
    const { data: bouts } = await supabase
      .from("bouts")
      .select("id, event_id, red_corner_fighter_id, blue_corner_fighter_id")
      .or(`red_corner_fighter_id.eq.${fid},blue_corner_fighter_id.eq.${fid}`);
    const boutRows = (bouts ?? []) as Pick<
      Bout,
      "id" | "event_id" | "red_corner_fighter_id" | "blue_corner_fighter_id"
    >[];
    if (!boutRows.length) return null;
    const { data: events } = await supabase
      .from("events")
      .select("id, name, event_date, slug")
      .in(
        "id",
        boutRows.map((b) => b.event_id),
      )
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .limit(1);
    const nextEvent = (events ?? [])[0] as
      | Pick<EventRow, "id" | "name" | "event_date" | "slug">
      | undefined;
    if (!nextEvent) return null;
    const bout = boutRows.find((b) => b.event_id === nextEvent.id);
    if (!bout) return null;
    const opponentId =
      bout.red_corner_fighter_id === fid
        ? bout.blue_corner_fighter_id
        : bout.red_corner_fighter_id;
    const corner: "red" | "blue" =
      bout.red_corner_fighter_id === fid ? "red" : "blue";
    let opponentName: string | null = null;
    if (opponentId) {
      const { data: opp } = await supabase
        .from("fighters")
        .select("full_name")
        .eq("id", opponentId)
        .maybeSingle<Pick<Fighter, "full_name">>();
      opponentName = opp?.full_name ?? null;
    }
    return {
      boutId: bout.id,
      eventId: nextEvent.id,
      eventName: nextEvent.name,
      eventDate: nextEvent.event_date,
      eventSlug: nextEvent.slug,
      opponentName,
      corner,
    };
  };

  const loadGymRoster = async (): Promise<RosterFighter[]> => {
    if (!gymRecord?.data) return [];
    const { data: roster } = await supabase
      .from("fighters")
      .select(ROSTER_FIGHTER_COLS)
      .eq("gym_id", gymRecord.data.id)
      .order("full_name", { ascending: true })
      .limit(10);
    return (roster ?? []) as RosterFighter[];
  };

  const [officialUpcoming, fighterGym, fighterNextBout, gymRoster] =
    await Promise.all([
      loadOfficialUpcoming(),
      loadFighterGym(),
      loadFighterNextBout(),
      loadGymRoster(),
    ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <section className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Welcome, {user.fullName ?? user.email.split("@")[0]}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {user.isStaff && (
            <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
              Staff
            </span>
          )}
          {user.approvedRoles.map((r) => (
            <span
              key={r}
              className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            >
              {ROLE_LABELS[r]}
            </span>
          ))}
        </p>
      </section>

      <section className="mb-8">
        <GlobalSearch />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <UpcomingEventsWidget events={(upcomingEvents ?? []) as UpcomingEvent[]} />
        <RecentFightersWidget fighters={(recentFighters ?? []) as RecentFighter[]} />
      </div>

      {(isPromoter || isOfficial || isFighter || isSb || isCommission || isGymPerson) && (
        <section className="mt-8">
          <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            For you
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {isPromoter && promoterData && (
              <PromoterWidget
                events={(promoterData[0].data ?? []) as PromoterEvent[]}
                totalOwned={promoterData[1].count ?? 0}
              />
            )}
            {isOfficial && (
              <OfficialWidget
                profile={officialProfile?.data ?? null}
                upcoming={officialUpcoming}
              />
            )}
            {isFighter && (
              <FighterWidget
                profile={fighterProfile?.data ?? null}
                nextBout={fighterNextBout}
                gym={fighterGym}
              />
            )}
            {(isSb || isCommission) && regulatorData && (
              <RegulatorWidget
                role={isSb ? "sanctioning_body" : "commission"}
                pendingSbCount={regulatorData[0].count ?? 0}
                pendingPromotionsCount={regulatorData[1].count ?? 0}
                upcomingSanctioned={(regulatorData[2].data ?? []) as SanctionedEvent[]}
              />
            )}
            {isGymPerson && (
              <GymWidget gym={gymRecord?.data ?? null} roster={gymRoster} />
            )}
          </div>
        </section>
      )}

      <section className="mt-10 border-t border-border/60 pt-8">
        <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Modules
        </h2>
        <ModulesStrip approvedRoles={user.approvedRoles} isStaff={user.isStaff} />
      </section>
    </div>
  );
}
