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
  SanctioningBody,
  Sponsor,
} from "@/lib/db/types";

// Superset of everything the event layout + its child tabs need. Loaded once
// per request via React's cache() — the layout and any child page can call
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
  sponsorTargets: EventSponsorTarget[];
  sponsorableItems: EventSponsorableItem[];
  sponsorRegistry: Pick<Sponsor, "id" | "name">[];
  sanctioningBody: Pick<
    SanctioningBody,
    "id" | "name" | "abbreviation" | "website"
  > | null;
};

export const loadEventDetail = cache(async (id: string): Promise<EventDetail | null> => {
  const supabase = db();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle<EventRow>();
  if (!event) return null;

  const [
    { data: bouts },
    { data: ledger },
    { data: sponsorSlots },
    { data: sponsorTargets },
    { data: sponsorableItems },
    { data: sponsorRegistry },
    sanctioningRes,
  ] = await Promise.all([
    supabase
      .from("bouts")
      .select("*")
      .eq("event_id", id)
      .order("bout_order", { ascending: true, nullsFirst: false }),
    supabase.from("event_ledger").select("*").eq("event_id", id).order("created_at"),
    supabase.from("event_sponsors").select("*").eq("event_id", id),
    supabase.from("event_sponsor_targets").select("*").eq("event_id", id),
    supabase
      .from("event_sponsorable_items")
      .select("*")
      .eq("event_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("sponsors").select("id, name").order("name"),
    event.sanctioning_body_id
      ? supabase
          .from("sanctioning_bodies")
          .select("id, name, abbreviation, website")
          .eq("id", event.sanctioning_body_id)
          .maybeSingle<
            Pick<SanctioningBody, "id" | "name" | "abbreviation" | "website">
          >()
      : Promise.resolve({ data: null }),
  ]);

  const boutList = (bouts ?? []) as Bout[];
  const boutIds = boutList.map((b) => b.id);

  const [{ data: checks }, { data: purses }] = boutIds.length
    ? await Promise.all([
        supabase.from("bout_fighter_checks").select("*").in("bout_id", boutIds),
        supabase.from("bout_purses").select("*").in("bout_id", boutIds),
      ])
    : [{ data: [] }, { data: [] }];

  const fighterIds = Array.from(
    new Set(
      boutList
        .flatMap((b) => [b.red_corner_fighter_id, b.blue_corner_fighter_id])
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const fighterMap = new Map<string, Pick<Fighter, "id" | "full_name">>();
  if (fighterIds.length) {
    const { data: fighters } = await supabase
      .from("fighters")
      .select("id, full_name")
      .in("id", fighterIds);
    for (const f of (fighters ?? []) as Pick<Fighter, "id" | "full_name">[]) {
      fighterMap.set(f.id, f);
    }
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
    sponsorTargets: (sponsorTargets ?? []) as EventSponsorTarget[],
    sponsorableItems: (sponsorableItems ?? []) as EventSponsorableItem[],
    sponsorRegistry: (sponsorRegistry ?? []) as Pick<Sponsor, "id" | "name">[],
    sanctioningBody: sanctioningRes.data,
  };
});
