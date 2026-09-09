import { renderToBuffer } from "@react-pdf/renderer";

import { db } from "@/lib/db/client";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = db();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle<EventRow>();

  if (!event) return new Response("Event not found", { status: 404 });

  const [{ data: bouts }, { data: sanctioningBody }, { data: commission }] = await Promise.all([
    supabase
      .from("bouts")
      .select("id, bout_order, red_corner_fighter_id, blue_corner_fighter_id")
      .eq("event_id", id)
      .order("bout_order"),
    event.sanctioning_body_id
      ? supabase
          .from("sanctioning_bodies")
          .select("name")
          .eq("id", event.sanctioning_body_id)
          .maybeSingle<Pick<SanctioningBody, "name">>()
      : Promise.resolve({ data: null as { name: string } | null }),
    event.commission_id
      ? supabase
          .from("commissions")
          .select("name")
          .eq("id", event.commission_id)
          .maybeSingle<Pick<Commission, "name">>()
      : Promise.resolve({ data: null as { name: string } | null }),
  ]);

  const boutList = (bouts ?? []) as Pick<Bout, "id" | "bout_order" | "red_corner_fighter_id" | "blue_corner_fighter_id">[];
  const boutIds = boutList.map((b) => b.id);
  const fighterIds = boutList
    .flatMap((b) => [b.red_corner_fighter_id, b.blue_corner_fighter_id])
    .filter((x): x is string => Boolean(x));

  const [{ data: purses }, { data: fighters }] = await Promise.all([
    boutIds.length
      ? supabase.from("bout_purses").select("*").in("bout_id", boutIds)
      : Promise.resolve({ data: [] as BoutPurse[] }),
    fighterIds.length
      ? supabase
          .from("fighters")
          .select("id, full_name, gym, gym_id")
          .in("id", fighterIds)
      : Promise.resolve({ data: [] as Pick<Fighter, "id" | "full_name" | "gym" | "gym_id">[] }),
  ]);

  const fighterRows = (fighters ?? []) as Pick<Fighter, "id" | "full_name" | "gym" | "gym_id">[];
  const gymIds = Array.from(
    new Set(fighterRows.map((f) => f.gym_id).filter((x): x is string => Boolean(x))),
  );
  const gymNameMap = new Map<string, string>();
  if (gymIds.length) {
    const { data: gyms } = await supabase
      .from("gyms")
      .select("id, name")
      .in("id", gymIds);
    for (const g of ((gyms ?? []) as Pick<Gym, "id" | "name">[])) {
      gymNameMap.set(g.id, g.name);
    }
  }

  const fighterMap = new Map<string, string>();
  const fighterGymMap = new Map<string, string | null>();
  for (const f of fighterRows) {
    fighterMap.set(f.id, f.full_name);
    fighterGymMap.set(
      f.id,
      (f.gym_id && gymNameMap.get(f.gym_id)) || f.gym || null,
    );
  }
  const purseByBoutCorner = new Map<string, BoutPurse>();
  for (const p of (purses ?? []) as BoutPurse[]) {
    purseByBoutCorner.set(`${p.bout_id}:${p.corner}`, p);
  }

  const { data: sponsorSlots } = await supabase
    .from("event_sponsors")
    .select("sponsor_id, tier")
    .eq("event_id", id);
  const slotRows = (sponsorSlots ?? []) as Pick<EventSponsor, "sponsor_id" | "tier">[];
  let sponsorLines: PayoutSponsorLine[] = [];
  if (slotRows.length) {
    const sponsorIds = Array.from(new Set(slotRows.map((s) => s.sponsor_id)));
    const { data: sponsorRows } = await supabase
      .from("sponsors")
      .select("id, name")
      .in("id", sponsorIds);
    const nameMap = new Map(
      ((sponsorRows ?? []) as Pick<Sponsor, "id" | "name">[]).map((s) => [s.id, s.name]),
    );
    sponsorLines = slotRows
      .map((s) => ({ name: nameMap.get(s.sponsor_id) ?? "Sponsor", tier: s.tier }))
      .sort((a, b) => compareSponsorTier(a.tier, b.tier));
  }

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
      sanctioningBody={(sanctioningBody as { name?: string } | null)?.name ?? null}
      commission={(commission as { name?: string } | null)?.name ?? null}
      rows={rows}
      sponsors={sponsorLines}
    />,
  );

  const slug = event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-");
  const filename = `payout-sheet-${slug}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
