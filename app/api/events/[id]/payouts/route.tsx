import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import {
  PayoutSheetPdf,
  type PayoutRow,
  type PayoutSponsorLine,
} from "@/lib/pdf/payout-sheet";
import { compareSponsorTier } from "@/lib/db/types";
import type {
  Bout,
  BoutPurse,
  Commission,
  EventRow,
  EventSponsor,
  Fighter,
  Gym,
  SanctioningBody,
  Sponsor,
} from "@/lib/db/types";
import { pdfResponse } from "@/app/api/_lib/pdf";
import { fileSlug } from "@/app/api/_lib/slug";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireStaff();
  const { id } = await params;
  const supabase = db();

  // Bouts, purses (joined through bouts) and sponsor slots only need the
  // event id, so they load alongside the event itself.
  const [{ data: event }, { data: bouts }, { data: purses }, { data: sponsorSlots }] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "name, event_date, venue, city, state, primary_sport, promoter, sanctioning_body:sanctioning_bodies(name), commission:commissions(name)",
        )
        .eq("id", id)
        .maybeSingle<
          Pick<
            EventRow,
            "name" | "event_date" | "venue" | "city" | "state" | "primary_sport" | "promoter"
          > & {
            sanctioning_body: Pick<SanctioningBody, "name"> | null;
            commission: Pick<Commission, "name"> | null;
          }
        >(),
      supabase
        .from("bouts")
        .select("id, bout_order, red_corner_fighter_id, blue_corner_fighter_id")
        .eq("event_id", id)
        .order("bout_order"),
      supabase
        .from("bout_purses")
        .select("*, bouts!inner(event_id)")
        .eq("bouts.event_id", id),
      supabase
        .from("event_sponsors")
        .select("tier, sponsor:sponsors(name)")
        .eq("event_id", id),
    ]);

  if (!event) return new Response("Event not found", { status: 404 });

  const boutList = (bouts ?? []) as Pick<Bout, "id" | "bout_order" | "red_corner_fighter_id" | "blue_corner_fighter_id">[];
  const fighterIds = boutList
    .flatMap((b) => [b.red_corner_fighter_id, b.blue_corner_fighter_id])
    .filter((x): x is string => Boolean(x));

  type FighterRow = Pick<Fighter, "id" | "full_name" | "gym" | "gym_id"> & {
    gym_ref: Pick<Gym, "name"> | null;
  };
  const { data: fighters } = fighterIds.length
    ? await supabase
        .from("fighters")
        .select("id, full_name, gym, gym_id, gym_ref:gyms(name)")
        .in("id", fighterIds)
    : { data: [] as FighterRow[] };

  const fighterMap = new Map<string, string>();
  const fighterGymMap = new Map<string, string | null>();
  for (const f of (fighters ?? []) as unknown as FighterRow[]) {
    fighterMap.set(f.id, f.full_name);
    fighterGymMap.set(
      f.id,
      (f.gym_id && f.gym_ref?.name) || f.gym || null,
    );
  }
  const purseByBoutCorner = new Map<string, BoutPurse>();
  for (const p of (purses ?? []) as BoutPurse[]) {
    purseByBoutCorner.set(`${p.bout_id}:${p.corner}`, p);
  }

  const slotRows = (sponsorSlots ?? []) as unknown as (Pick<EventSponsor, "tier"> & {
    sponsor: Pick<Sponsor, "name"> | null;
  })[];
  const sponsorLines: PayoutSponsorLine[] = slotRows
    .map((s) => ({ name: s.sponsor?.name ?? "Sponsor", tier: s.tier }))
    .sort((a, b) => compareSponsorTier(a.tier, b.tier));

  const rows: PayoutRow[] = [];
  for (const b of boutList) {
    for (const corner of ["red", "blue"] as const) {
      const fighterId = corner === "red" ? b.red_corner_fighter_id : b.blue_corner_fighter_id;
      rows.push({
        bout_order: b.bout_order,
        corner,
        fighter_name: fighterId ? fighterMap.get(fighterId) ?? "TBD" : "TBD",
        gym_name: fighterId ? fighterGymMap.get(fighterId) ?? null : null,
        purse: purseByBoutCorner.get(`${b.id}:${corner}`) ?? null,
      });
    }
  }

  return pdfResponse(
    <PayoutSheetPdf
      event={event}
      promoter={event.promoter}
      sanctioningBody={event.sanctioning_body?.name ?? null}
      commission={event.commission?.name ?? null}
      rows={rows}
      sponsors={sponsorLines}
    />,
    `payout-sheet-${fileSlug(event.name)}.pdf`,
  );
}
