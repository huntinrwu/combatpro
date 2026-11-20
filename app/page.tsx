import { redirect } from "next/navigation";

import {
  FighterWidget,
  type FighterNextBout,
  type FighterProfile,
} from "./_components/dashboard/fighter-widget";
import { GlobalSearch } from "./_components/dashboard/global-search";
import {
  GymWidget,
  type GymSummary,
  type RosterFighter,
} from "./_components/dashboard/gym-widget";
import { WelcomeHero } from "./_components/dashboard/welcome-hero";
import {
  OfficialWidget,
  type OfficialProfile,
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
import { eventOwnerScope } from "@/lib/auth/event-scope";
import { ROLE_LABELS, canCreateEvents } from "@/lib/auth/roles";
import type { Bout, EventOfficial, EventRow, Fighter } from "@/lib/db/types";

type EventRef = Pick<EventRow, "id" | "name" | "event_date" | "slug">;
// Fighter profile with its gym embedded (to-one: object or null).
type FighterProfileRow = FighterProfile & { gym: GymSummary | null };

// Column lists match exactly what each widget renders — keeps the
// every-login dashboard from pulling whole rows (notes, contact info, …).
const UPCOMING_EVENT_COLS = "id, name, event_date, status, slug, city, state";
const PROMOTER_EVENT_COLS = "id, name, event_date, status, slug";
const SANCTIONED_EVENT_COLS = "id, name, event_date, slug";
const RECENT_FIGHTER_COLS =
  "id, full_name, nickname, photo_url, weight_class, primary_sport, pro_wins, pro_losses, pro_draws";
const ROSTER_FIGHTER_COLS = "id, full_name, pro_wins, pro_losses, pro_draws";
const OFFICIAL_PROFILE_COLS = "id, full_name, roles";
const FIGHTER_PROFILE_COLS =
  "id, full_name, photo_url, weight_class, primary_sport, pro_wins, pro_losses, pro_draws, gym:gyms(id, name, city, state)";
const EVENT_REF_COLS = "id, name, event_date, slug";
const GYM_COLS = "id, name, city, state";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isStaff && user.approvedRoles.length === 0) redirect("/pending");

  const supabase = db();
  const today = new Date().toISOString().slice(0, 10);
  const roles = new Set(user.approvedRoles);
  const email = user.email.toLowerCase();
  // ilike is only wanted for case-insensitivity; % and _ are legal in email
  // addresses, so escape them or one account could match someone else's.
  const exactEmail = email.replace(/[%_\\]/g, "\\$&");

  // Universal: upcoming events + recent fighters
  const universalPromise = Promise.all([
    (() => {
      const q = supabase
        .from("events")
        .select(UPCOMING_EVENT_COLS)
        .gte("event_date", today)
        .in("status", ["draft", "scheduled"])
        .order("event_date", { ascending: true })
        .limit(5);
      // Promoters only see their own events.
      const scope = eventOwnerScope(user);
      return scope ? q.eq("created_by", scope) : q;
    })(),
    supabase
      .from("fighters")
      .select(RECENT_FIGHTER_COLS)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Headline numbers for the welcome panel (counts only, no rows).
  const statsPromise = Promise.all([
    (() => {
      const q = supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("event_date", today)
        .in("status", ["draft", "scheduled"]);
      const scope = eventOwnerScope(user);
      return scope ? q.eq("created_by", scope) : q;
    })(),
    supabase.from("fighters").select("id", { count: "exact", head: true }),
    user.isStaff
      ? supabase
          .from("event_registrations")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: null }),
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
            .select(OFFICIAL_PROFILE_COLS)
            .eq("person_id", user.personId)
            .limit(1)
            .maybeSingle<OfficialProfile>()
        : supabase
            .from("officials")
            .select(OFFICIAL_PROFILE_COLS)
            .ilike("contact_email", exactEmail)
            .limit(1)
            .maybeSingle<OfficialProfile>())
    : null;

  // Fighter widget — same person_id-first strategy.
  const isFighter = user.isStaff || roles.has("fighter");
  const fighterProfilePromise = isFighter
    ? (user.personId
        ? supabase
            .from("fighters")
            .select(FIGHTER_PROFILE_COLS)
            .eq("person_id", user.personId)
            .limit(1)
            .maybeSingle<FighterProfileRow>()
        : supabase
            .from("fighters")
            .select(FIGHTER_PROFILE_COLS)
            .ilike("contact_email", exactEmail)
            .limit(1)
            .maybeSingle<FighterProfileRow>())
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
        .select(GYM_COLS)
        .ilike("contact_email", exactEmail)
        .limit(1)
        .maybeSingle<GymSummary>()
    : null;

  const [
    [{ data: upcomingEvents }, { data: recentFighters }],
    promoterData,
    officialProfile,
    fighterProfile,
    regulatorData,
    gymRecord,
    [upcomingCount, fighterCount, signupCount],
  ] = await Promise.all([
    universalPromise,
    promoterPromise,
    officialProfilePromise,
    fighterProfilePromise,
    regulatorPromise,
    gymPromise,
    statsPromise,
  ]);

  // Follow-up queries that depend on the results above. The three chains
  // are independent of each other, so run them concurrently. Each is a single
  // round trip: the event is inner-joined so the date filter restricts the
  // parent rows, and the (small) result is ordered in JS.
  const loadOfficialUpcoming = async (): Promise<OfficialUpcoming[]> => {
    if (!officialProfile?.data) return [];
    const { data: assignments } = await supabase
      .from("event_officials")
      .select(`event_role, event:events!inner(${EVENT_REF_COLS})`)
      .eq("official_id", officialProfile.data.id)
      .gte("event.event_date", today);
    const rows = (assignments ?? []) as unknown as (Pick<EventOfficial, "event_role"> & {
      event: EventRef;
    })[];
    const out: OfficialUpcoming[] = rows.map((a) => ({
      eventId: a.event.id,
      eventName: a.event.name,
      eventDate: a.event.event_date,
      eventSlug: a.event.slug,
      role: a.event_role,
    }));
    out.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    return out.slice(0, 5);
  };

  const loadFighterNextBout = async (): Promise<FighterNextBout> => {
    if (!fighterProfile?.data) return null;
    const fid = fighterProfile.data.id;
    // bouts↔events and bouts↔fighters each have two FKs, hence the hints.
    const { data: bouts } = await supabase
      .from("bouts")
      .select(
        `red_corner_fighter_id, blue_corner_fighter_id, event:events!bouts_event_id_fkey!inner(${EVENT_REF_COLS}), red:fighters!red_corner_fighter_id(full_name), blue:fighters!blue_corner_fighter_id(full_name)`,
      )
      .or(`red_corner_fighter_id.eq.${fid},blue_corner_fighter_id.eq.${fid}`)
      .gte("event.event_date", today);
    const boutRows = (bouts ?? []) as unknown as (Pick<
      Bout,
      "red_corner_fighter_id" | "blue_corner_fighter_id"
    > & {
      event: EventRef;
      red: Pick<Fighter, "full_name"> | null;
      blue: Pick<Fighter, "full_name"> | null;
    })[];
    // Soonest upcoming event wins; ties keep the first row returned.
    let bout: (typeof boutRows)[number] | undefined;
    for (const b of boutRows) {
      if (!bout || b.event.event_date < bout.event.event_date) bout = b;
    }
    if (!bout) return null;
    const opponent = bout.red_corner_fighter_id === fid ? bout.blue : bout.red;
    return {
      eventId: bout.event.id,
      eventName: bout.event.name,
      eventDate: bout.event.event_date,
      eventSlug: bout.event.slug,
      opponentName: opponent?.full_name ?? null,
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

  const [officialUpcoming, fighterNextBout, gymRoster] = await Promise.all([
    loadOfficialUpcoming(),
    loadFighterNextBout(),
    loadGymRoster(),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <WelcomeHero
        name={user.fullName ?? user.email.split("@")[0]}
        roles={[...(user.isStaff ? ["Staff"] : []), ...user.approvedRoles.map((r) => ROLE_LABELS[r])]}
        stats={{
          upcomingEvents: upcomingCount.count ?? 0,
          fighters: fighterCount.count ?? 0,
          pendingSignups: user.isStaff ? (signupCount.count ?? 0) : null,
        }}
        canCreateEvent={canCreateEvents(user.approvedRoles, user.isStaff)}
        canAddFighter={user.isStaff}
      />

      <section className="mb-8">
        <GlobalSearch />
      </section>

      <div className="grid items-start gap-4 md:grid-cols-2">
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
                gym={fighterProfile?.data?.gym ?? null}
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
    </div>
  );
}
