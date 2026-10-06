import { cache } from "react";

import { db } from "@/lib/db/client";
import type {
  Bout,
  BoutFighterCheck,
  BoutPurse,
  EventRow,
  EventSponsor,
  EventSponsorableItem,
  EventSponsorTarget,
  Fighter,
  LedgerEntry,
  Sponsor,
} from "@/lib/db/types";

// Everything the event layout + its child tabs share. Loaded once per request
// via React's cache() — the layout and any child page can call
// loadEventDetail(id) and share the same in-memory result. Cuts the "layout
// fetches X, child page re-fetches X" waste on every event detail page load.
export type EventDetail = {
  event: EventRow;
  bouts: Bout[];
  fighterMap: Map<string, Pick<Fighter, "id" | "full_name">>;
  checks: BoutFighterCheck[];
  checksByBout: Map<string, Partial<Record<"red" | "blue", BoutFighterCheck>>>;
  purses: BoutPurse[];
  ledger: LedgerEntry[];
  sponsorSlots: EventSponsor[];
};

// Distinct red/blue fighter ids across a card.
export function fighterIdsOf(
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

export const loadEventDetail = cache(async (id: string): Promise<EventDetail | null> => {
  const supabase = db();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle<EventRow>();
  if (!event) return null;

  const [{ data: bouts }, { data: ledger }, { data: sponsorSlots }] = await Promise.all([
    supabase
      .from("bouts")
      .select("*")
      .eq("event_id", id)
      .order("bout_order", { ascending: true, nullsFirst: false }),
    supabase.from("event_ledger").select("*").eq("event_id", id).order("created_at"),
    supabase.from("event_sponsors").select("*").eq("event_id", id),
  ]);

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
      ? supabase.from("fighters").select("id, full_name").in("id", fighterIds)
      : Promise.resolve({ data: [] }),
  ]);

  const fighterMap = new Map<string, Pick<Fighter, "id" | "full_name">>();
  for (const f of (fighters ?? []) as Pick<Fighter, "id" | "full_name">[]) {
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
