import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import { BoutAgreementPdf } from "@/lib/pdf/bout-agreement";
import { FightReportPdf } from "@/lib/pdf/fight-report";
import { fighterClearanceSummary } from "@/lib/db/types";
import { pdfResponse } from "@/app/api/_lib/pdf";
import { fileSlug } from "@/app/api/_lib/slug";
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

const KINDS: BoutDocumentKind[] = ["bout_agreement", "fight_report"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ boutId: string; kind: string }> },
) {
  await requireStaff();
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

  const fighterIds = [bout.red_corner_fighter_id, bout.blue_corner_fighter_id].filter(
    (x): x is string => Boolean(x),
  );

  // Everything below depends only on the bout, so it loads in one round trip.
  // Sanctioning body / commission names are embedded in the event lookup.
  // Scorecards + checks feed the fight report; medicals + ruleset feed the
  // bout agreement — each is only fetched for the document that prints it.
  const isAgreement = kind === "bout_agreement";
  const [
    { data: event },
    { data: assignments },
    { data: scorecards },
    { data: checks },
    { data: fs },
    { data: meds },
    { data: rulesetData },
  ] = await Promise.all([
    supabase
      .from("events")
      .select(
        "name, event_date, venue, city, state, sanctioning_body:sanctioning_bodies(name), commission:commissions(name)",
      )
      .eq("id", bout.event_id)
      .maybeSingle<
        Pick<EventRow, "name" | "event_date" | "venue" | "city" | "state"> & {
          sanctioning_body: Pick<SanctioningBody, "name"> | null;
          commission: Pick<Commission, "name"> | null;
        }
      >(),
    supabase
      .from("event_officials")
      .select("official_id, event_role, official:officials(full_name)")
      .eq("event_id", bout.event_id),
    isAgreement
      ? Promise.resolve({ data: [] as BoutScorecard[] })
      : supabase.from("bout_scorecards").select("*").eq("bout_id", boutId).order("round_number"),
    isAgreement
      ? Promise.resolve({ data: [] as BoutFighterCheck[] })
      : supabase.from("bout_fighter_checks").select("*").eq("bout_id", boutId),
    // Fighters + medical records (clearance is computed as of event date)
    fighterIds.length
      ? supabase.from("fighters").select("*").in("id", fighterIds)
      : Promise.resolve({ data: [] as Fighter[] }),
    isAgreement && fighterIds.length
      ? supabase.from("fighter_medical_records").select("*").in("fighter_id", fighterIds)
      : Promise.resolve({ data: [] as FighterMedicalRecord[] }),
    isAgreement && bout.ruleset_id
      ? supabase
          .from("rulesets")
          .select("*")
          .eq("id", bout.ruleset_id)
          .maybeSingle<Ruleset>()
      : Promise.resolve({ data: null as Ruleset | null }),
  ]);

  if (!event) return new Response("Event not found", { status: 404 });

  const fighterMap = new Map<string, Fighter>();
  const medicalByFighter = new Map<string, FighterMedicalRecord[]>();
  for (const f of (fs ?? []) as Fighter[]) fighterMap.set(f.id, f);
  for (const m of (meds ?? []) as FighterMedicalRecord[]) {
    const arr = medicalByFighter.get(m.fighter_id) ?? [];
    arr.push(m);
    medicalByFighter.set(m.fighter_id, arr);
  }
  const red = bout.red_corner_fighter_id ? fighterMap.get(bout.red_corner_fighter_id) ?? null : null;
  const blue = bout.blue_corner_fighter_id ? fighterMap.get(bout.blue_corner_fighter_id) ?? null : null;
  const asOfEventDate = `${event.event_date}T23:59:59`;
  const clearanceFor = (fighterId: string | null) =>
    isAgreement && fighterId
      ? fighterClearanceSummary(medicalByFighter.get(fighterId) ?? [], undefined, asOfEventDate)
      : null;

  // Officials — sourced from the event roster (same for every bout on the card).
  const rosterRows = (assignments ?? []) as unknown as (Pick<
    EventOfficial,
    "official_id" | "event_role"
  > & { official: Pick<Official, "full_name"> | null })[];
  const officials = rosterRows.map((a) => ({
    role: a.event_role,
    name: a.official?.full_name ?? "(missing)",
  }));
  const judges = rosterRows
    .filter((a) => a.event_role === "judge")
    .map((a) => ({
      official_id: a.official_id,
      name: a.official?.full_name ?? "Judge",
    }));

  // Checks by corner
  const checksByCorner: Partial<Record<Corner, BoutFighterCheck>> = {};
  for (const c of (checks ?? []) as BoutFighterCheck[]) {
    checksByCorner[c.corner] = c;
  }

  const shared = {
    event,
    bout,
    red,
    blue,
    officials,
    sanctioningBody: event.sanctioning_body?.name ?? null,
    commission: event.commission?.name ?? null,
  };

  const doc = isAgreement ? (
    <BoutAgreementPdf
      {...shared}
      ruleset={rulesetData}
      redClearance={clearanceFor(bout.red_corner_fighter_id)}
      blueClearance={clearanceFor(bout.blue_corner_fighter_id)}
    />
  ) : (
    <FightReportPdf
      {...shared}
      scorecards={(scorecards ?? []) as BoutScorecard[]}
      judges={judges}
      checks={checksByCorner}
    />
  );

  const filename = `${fileSlug(
    `${kind}-${red?.full_name ?? "red"}-vs-${blue?.full_name ?? "blue"}`,
  )}.pdf`;
  return pdfResponse(doc, filename);
}
