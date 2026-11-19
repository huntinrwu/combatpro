import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import {
  FighterPassportPdf,
  type PassportBoutNormalizedRow,
} from "@/lib/pdf/fighter-passport";
import type {
  Bout,
  BoutOutcome,
  EventRow,
  Fighter,
  FighterMedicalRecord,
  Gym,
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

  // Medical records and bouts only need the fighter id; the gym, each bout's
  // event and both corners' names are embedded, so this is one round trip.
  const [{ data: fighter }, { data: medicals }, { data: bouts }] = await Promise.all([
    supabase
      .from("fighters")
      .select("*, gym_ref:gyms(name)")
      .eq("id", id)
      .maybeSingle<Fighter & { gym_ref: Pick<Gym, "name"> | null }>(),
    supabase
      .from("fighter_medical_records")
      .select("*")
      .eq("fighter_id", id)
      .order("issued_on", { ascending: false }),
    supabase
      .from("bouts")
      .select(
        "red_corner_fighter_id, result, method, round_finished, time_finished, bout_class, event:events!bouts_event_id_fkey(name, event_date), red:fighters!red_corner_fighter_id(full_name), blue:fighters!blue_corner_fighter_id(full_name)",
      )
      .or(`red_corner_fighter_id.eq.${id},blue_corner_fighter_id.eq.${id}`),
  ]);
  if (!fighter) return new Response("Fighter not found", { status: 404 });
  const { gym_ref: gym, ...fighterRow } = fighter;

  type BoutSlim = Pick<
    Bout,
    | "red_corner_fighter_id"
    | "result"
    | "method"
    | "round_finished"
    | "time_finished"
    | "bout_class"
  > & {
    event: Pick<EventRow, "name" | "event_date"> | null;
    red: Pick<Fighter, "full_name"> | null;
    blue: Pick<Fighter, "full_name"> | null;
  };
  const boutList = (bouts ?? []) as unknown as BoutSlim[];

  const rows: PassportBoutNormalizedRow[] = boutList
    .map((b): PassportBoutNormalizedRow | null => {
      const evt = b.event;
      if (!evt) return null;
      const isRed = b.red_corner_fighter_id === id;
      const opponent = (isRed ? b.blue : b.red)?.full_name ?? null;
      const outcome = b.result as BoutOutcome | null;
      const normalized =
        outcome == null
          ? null
          : outcome === "no_contest"
            ? "no_contest"
            : outcome === "draw"
              ? "draw"
              : (isRed && outcome === "red") || (!isRed && outcome === "blue")
                ? "win"
                : "loss";
      return {
        event_name: evt.name,
        event_date: evt.event_date,
        opponent,
        method: b.method,
        round_finished: b.round_finished,
        time_finished: b.time_finished,
        bout_class: b.bout_class,
        normalizedResult: normalized,
      };
    })
    .filter((x): x is PassportBoutNormalizedRow => x != null)
    .sort((a, b) => b.event_date.localeCompare(a.event_date))
    .slice(0, 8);

  return pdfResponse(
    <FighterPassportPdf
      fighter={fighterRow}
      gym={gym}
      medicals={(medicals ?? []) as FighterMedicalRecord[]}
      recentBouts={rows}
    />,
    `passport-${fileSlug(fighter.full_name)}.pdf`,
  );
}
