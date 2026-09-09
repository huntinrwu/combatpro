import { renderToBuffer } from "@react-pdf/renderer";

import { db } from "@/lib/db/client";
import { BoutAgreementPdf } from "@/lib/pdf/bout-agreement";
import { FightReportPdf } from "@/lib/pdf/fight-report";
import { fighterClearanceSummary } from "@/lib/db/types";
import type {
  Bout,
  BoutDocumentKind,
  BoutFighterCheck,
  BoutScorecard,
  Commission,
  Corner,
  EventOfficial,
  EventRow,
  Fighter,
  FighterMedicalRecord,
  Official,
  Ruleset,
  SanctioningBody,
} from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: BoutDocumentKind[] = ["bout_agreement", "fight_report"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ boutId: string; kind: string }> },
) {
  const { boutId, kind } = await params;

  if (!KINDS.includes(kind as BoutDocumentKind)) {
    return new Response("Unknown document kind", { status: 400 });
  }

  const supabase = db();

  const { data: bout } = await supabase
    .from("bouts")
    .select("*")
    .eq("id", boutId)
    .maybeSingle<Bout>();

  if (!bout) return new Response("Bout not found", { status: 404 });

  const [
    { data: event },
    { data: assignments },
    { data: scorecards },
    { data: checks },
    { data: sanctioningBody },
    { data: commission },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, event_date, venue, city, state, country, primary_sport, commission_id, sanctioning_body_id")
      .eq("id", bout.event_id)
      .maybeSingle<
        Pick<
          EventRow,
          | "id"
          | "name"
          | "event_date"
          | "venue"
          | "city"
          | "state"
          | "country"
          | "primary_sport"
          | "commission_id"
          | "sanctioning_body_id"
        >
      >(),
    supabase
      .from("event_officials")
      .select("*")
      .eq("event_id", bout.event_id),
    supabase.from("bout_scorecards").select("*").eq("bout_id", boutId).order("round_number"),
    supabase.from("bout_fighter_checks").select("*").eq("bout_id", boutId),
    (async () => {
      const { data: e } = await supabase
        .from("events")
        .select("sanctioning_body_id")
        .eq("id", bout.event_id)
        .maybeSingle();
      if (!e?.sanctioning_body_id) return { data: null as SanctioningBody | null };
      return await supabase
        .from("sanctioning_bodies")
        .select("id, name, abbreviation")
        .eq("id", e.sanctioning_body_id)
        .maybeSingle<Pick<SanctioningBody, "id" | "name" | "abbreviation">>();
    })(),
    (async () => {
      const { data: e } = await supabase
        .from("events")
        .select("commission_id")
        .eq("id", bout.event_id)
        .maybeSingle();
      if (!e?.commission_id) return { data: null as Commission | null };
      return await supabase
        .from("commissions")
        .select("id, name, abbreviation")
        .eq("id", e.commission_id)
        .maybeSingle<Pick<Commission, "id" | "name" | "abbreviation">>();
    })(),
  ]);

  if (!event) return new Response("Event not found", { status: 404 });

  // Fighters + medical records (clearance is computed as of event date)
  const fighterIds = [bout.red_corner_fighter_id, bout.blue_corner_fighter_id].filter(
    (x): x is string => Boolean(x),
  );
  const fighterMap = new Map<string, Fighter>();
  const medicalByFighter = new Map<string, FighterMedicalRecord[]>();
  if (fighterIds.length) {
    const [{ data: fs }, { data: meds }] = await Promise.all([
      supabase.from("fighters").select("*").in("id", fighterIds),
      supabase
        .from("fighter_medical_records")
        .select("*")
        .in("fighter_id", fighterIds),
    ]);
    for (const f of (fs ?? []) as Fighter[]) fighterMap.set(f.id, f);
    for (const m of (meds ?? []) as FighterMedicalRecord[]) {
      const arr = medicalByFighter.get(m.fighter_id) ?? [];
      arr.push(m);
      medicalByFighter.set(m.fighter_id, arr);
    }
  }
  const red = bout.red_corner_fighter_id ? fighterMap.get(bout.red_corner_fighter_id) ?? null : null;
  const blue = bout.blue_corner_fighter_id ? fighterMap.get(bout.blue_corner_fighter_id) ?? null : null;
  const asOfEventDate = `${event.event_date}T23:59:59`;
  const redClearance = bout.red_corner_fighter_id
    ? fighterClearanceSummary(
        medicalByFighter.get(bout.red_corner_fighter_id) ?? [],
        undefined,
        asOfEventDate,
      )
    : null;
  const blueClearance = bout.blue_corner_fighter_id
    ? fighterClearanceSummary(
        medicalByFighter.get(bout.blue_corner_fighter_id) ?? [],
        undefined,
        asOfEventDate,
      )
    : null;

  // Officials — sourced from the event roster (same for every bout on the card).
  const rosterRows = (assignments ?? []) as EventOfficial[];
  const officialIds = Array.from(new Set(rosterRows.map((a) => a.official_id)));
  const officialMap = new Map<string, Pick<Official, "id" | "full_name" | "home_state">>();
  if (officialIds.length) {
    const { data: os } = await supabase
      .from("officials")
      .select("id, full_name, home_state")
      .in("id", officialIds);
    for (const o of os ?? []) officialMap.set(o.id, o);
  }
  const officials = rosterRows.map((a) => {
    const o = officialMap.get(a.official_id);
    return {
      role: a.event_role,
      name: o?.full_name ?? "(missing)",
      state: o?.home_state ?? null,
    };
  });
  const judges = rosterRows
    .filter((a) => a.event_role === "judge")
    .map((a) => ({
      official_id: a.official_id,
      name: officialMap.get(a.official_id)?.full_name ?? "Judge",
    }));

  // Checks by corner
  const checksByCorner: Partial<Record<Corner, BoutFighterCheck>> = {};
  for (const c of (checks ?? []) as BoutFighterCheck[]) {
    checksByCorner[c.corner] = c;
  }

  const sanctioningBodyName =
    (sanctioningBody as { name?: string; abbreviation?: string } | null)?.name ?? null;
  const commissionName =
    (commission as { name?: string; abbreviation?: string } | null)?.name ?? null;

  let ruleset: Ruleset | null = null;
  if (bout.ruleset_id) {
    const { data } = await supabase
      .from("rulesets")
      .select("*")
      .eq("id", bout.ruleset_id)
      .maybeSingle<Ruleset>();
    ruleset = data ?? null;
  }

  const shared = {
    event: {
      name: event.name,
      event_date: event.event_date,
      venue: event.venue,
      city: event.city,
      state: event.state,
      primary_sport: event.primary_sport,
    },
    bout,
    red,
    blue,
    officials,
    sanctioningBody: sanctioningBodyName,
    commission: commissionName,
  };

  const doc =
    kind === "bout_agreement" ? (
      <BoutAgreementPdf
        {...shared}
        ruleset={ruleset}
        redClearance={redClearance}
        blueClearance={blueClearance}
      />
    ) : (
      <FightReportPdf
        {...shared}
        scorecards={(scorecards ?? []) as BoutScorecard[]}
        judges={judges}
        checks={checksByCorner}
      />
    );

  const buffer = await renderToBuffer(doc);
  const filename =
    kind === "bout_agreement"
      ? `bout-agreement-${red?.full_name ?? "red"}-vs-${blue?.full_name ?? "blue"}.pdf`
      : `fight-report-${red?.full_name ?? "red"}-vs-${blue?.full_name ?? "blue"}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${slugFilename(filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}

function slugFilename(name: string): string {
  return name.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").toLowerCase();
}
