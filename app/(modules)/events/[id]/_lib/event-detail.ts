import { cache } from "react";

import { db } from "@/lib/db/client";
import { canViewEvent } from "@/lib/auth/event-scope";
import { getSessionUser } from "@/lib/auth/session";
import type {
  Bout,
  BoutFighterCheck,
  BoutPurse,
  Commission,
  EventRow,
  EventSponsor,
  EventSponsorableItem,
  EventSponsorTarget,
  Fighter,
  LedgerEntry,
  SanctioningBody,
  Sponsor,
} from "@/lib/db/types";

// Fighter fields the card views render. Gym name is embedded via
// fighters.gym_id → gyms.
export type EventFighter = Pick<Fighter, "id" | "full_name" | "gym" | "gym_id"> & {
  gym_ref: { name: string } | null;
};

// Everything the event layout + its child tabs share. Loaded once per request
// via React's cache() — the layout and any child page can call
// loadEventDetail(id) and share the same in-memory result. Cuts the "layout
// fetches X, child page re-fetches X" waste on every event detail page load.
export type EventCommission = Pick<
  Commission,
  "id" | "abbreviation" | "name" | "jurisdiction" | "website"
>;
export type EventSanctioningBody = Pick<
  SanctioningBody,
  "id" | "abbreviation" | "name" | "scope" | "website"
>;

export type EventDetail = {
  event: EventRow;
  commission: EventCommission | null;
  sanctioningBody: EventSanctioningBody | null;
  bouts: Bout[];
  fighterMap: Map<string, EventFighter>;
  checks: BoutFighterCheck[];
  checksByBout: Map<string, Partial<Record<"red" | "blue", BoutFighterCheck>>>;
  purses: BoutPurse[];
  ledger: LedgerEntry[];
  sponsorSlots: EventSponsor[];
};

// Distinct red/blue fighter ids across a card.
function fighterIdsOf(
  bouts: Pick<Bout, "red_corner_fighter_id" | "blue_corner_fighter_id">[],
): string[] {
  return Array.from(
    new Set(
      bouts
        .flatMap((b) => [b.red_corner_fighter_id, b.blue_corner_fighter_id])
        .filter((x): x is string => Boolean(x)),
    ),
  );
}

// "Name (Gym)" for print sheets; a registry gym wins over the free-text one.
export function fighterLabel(f: EventFighter | null | undefined): string {
  if (!f) return "TBD";
  const gym = f.gym_id ? f.gym_ref?.name : f.gym;
  return gym ? `${f.full_name} (${gym})` : f.full_name;
}

export const loadEventDetail = cache(async (id: string): Promise<EventDetail | null> => {
  const supabase = db();

  const [viewer, { data: eventRow }, { data: bouts }, { data: ledger }, { data: sponsorSlots }] =
    await Promise.all([
      getSessionUser(),
      // Commission + sanctioning body ride along via events.commission_id and
      // events.sanctioning_body_id (single FKs, so no embed hint needed).
      supabase
        .from("events")
        .select(
          "*, commission:commissions(id, abbreviation, name, jurisdiction, website), sanctioning_body:sanctioning_bodies(id, abbreviation, name, scope, website)",
        )
        .eq("id", id)
        .maybeSingle<
          EventRow & {
            commission: EventCommission | null;
            sanctioning_body: EventSanctioningBody | null;
          }
        >(),
      supabase
        .from("bouts")
        .select("*")
        .eq("event_id", id)
        .order("bout_order", { ascending: true, nullsFirst: false }),
      supabase.from("event_ledger").select("*").eq("event_id", id).order("created_at"),
      supabase.from("event_sponsors").select("*").eq("event_id", id),
    ]);
  if (!eventRow) return null;
  // Every event page loads through here, so this is where a promoter is
  // kept to their own events: someone else's simply doesn't exist for them.
  if (!viewer || !canViewEvent(eventRow, viewer)) return null;
  const { commission, sanctioning_body: sanctioningBody, ...event } = eventRow;

  const boutList = (bouts ?? []) as Bout[];
  const boutIds = boutList.map((b) => b.id);
  const fighterIds = fighterIdsOf(boutList);

  const [{ data: checks }, { data: purses }, { data: fighters }] = await Promise.all([
    boutIds.length
      ? supabase.from("bout_fighter_checks").select("*").in("bout_id", boutIds)
      : Promise.resolve({ data: [] }),
    boutIds.length
      ? supabase.from("bout_purses").select("*").in("bout_id", boutIds)
      : Promise.resolve({ data: [] }),
    fighterIds.length
      ? supabase
          .from("fighters")
          .select("id, full_name, gym, gym_id, gym_ref:gyms(name)")
          .in("id", fighterIds)
      : Promise.resolve({ data: [] }),
  ]);

  const fighterMap = new Map<string, EventFighter>();
  for (const f of (fighters ?? []) as unknown as EventFighter[]) {
    fighterMap.set(f.id, f);
  }

  const checkList = (checks ?? []) as BoutFighterCheck[];
  const checksByBout = new Map<
    string,
    Partial<Record<"red" | "blue", BoutFighterCheck>>
  >();
  for (const c of checkList) {
    const entry = checksByBout.get(c.bout_id) ?? {};
    entry[c.corner] = c;
    checksByBout.set(c.bout_id, entry);
  }

  return {
    event,
    commission,
    sanctioningBody,
    bouts: boutList,
    fighterMap,
    checks: checkList,
    checksByBout,
    purses: (purses ?? []) as BoutPurse[],
    ledger: (ledger ?? []) as LedgerEntry[],
    sponsorSlots: (sponsorSlots ?? []) as EventSponsor[],
  };
});

// Sponsors-tab-only data. Kept out of loadEventDetail so the layout (which
// renders on every tab) doesn't pull the whole sponsor registry each time.
export type EventSponsorExtras = {
  sponsorTargets: EventSponsorTarget[];
  sponsorableItems: EventSponsorableItem[];
  sponsorRegistry: Pick<Sponsor, "id" | "name">[];
};

export async function loadEventSponsorExtras(id: string): Promise<EventSponsorExtras> {
  const supabase = db();
  const [{ data: sponsorTargets }, { data: sponsorableItems }, { data: sponsorRegistry }] =
    await Promise.all([
      supabase.from("event_sponsor_targets").select("*").eq("event_id", id),
      supabase
        .from("event_sponsorable_items")
        .select("*")
        .eq("event_id", id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("sponsors").select("id, name").order("name"),
    ]);

  return {
    sponsorTargets: (sponsorTargets ?? []) as EventSponsorTarget[],
    sponsorableItems: (sponsorableItems ?? []) as EventSponsorableItem[],
    sponsorRegistry: (sponsorRegistry ?? []) as Pick<Sponsor, "id" | "name">[],
  };
}
