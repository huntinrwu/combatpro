import { renderToBuffer } from "@react-pdf/renderer";

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
import { fileSlug } from "@/app/api/_lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    rows.push({
      bout_order: b.bout_order,
      corner: "red",
      fighter_name: b.red_corner_fighter_id ? fighterMap.get(b.red_corner_fighter_id) ?? "TBD" : "TBD",
      gym_name: b.red_corner_fighter_id ? fighterGymMap.get(b.red_corner_fighter_id) ?? null : null,
      purse: purseByBoutCorner.get(`${b.id}:red`) ?? null,
    });
    rows.push({
      bout_order: b.bout_order,
      corner: "blue",
      fighter_name: b.blue_corner_fighter_id ? fighterMap.get(b.blue_corner_fighter_id) ?? "TBD" : "TBD",
      gym_name: b.blue_corner_fighter_id ? fighterGymMap.get(b.blue_corner_fighter_id) ?? null : null,
      purse: purseByBoutCorner.get(`${b.id}:blue`) ?? null,
    });
  }

  const buffer = await renderToBuffer(
    <PayoutSheetPdf
      event={{
        name: event.name,
        event_date: event.event_date,
        venue: event.venue,
        city: event.city,
        state: event.state,
        primary_sport: event.primary_sport,
      }}
      promoter={event.promoter}
      sanctioningBody={event.sanctioning_body?.name ?? null}
      commission={event.commission?.name ?? null}
      rows={rows}
      sponsors={sponsorLines}
    />,
  );

  const filename = `payout-sheet-${fileSlug(event.name)}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
