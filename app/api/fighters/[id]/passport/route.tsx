import { renderToBuffer } from "@react-pdf/renderer";

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

  // Medical records and bouts only need the fighter id; gym is embedded.
  const [{ data: fighter }, { data: medicals }, { data: bouts }] = await Promise.all([
    supabase
      .from("fighters")
      .select("*, gym_ref:gyms(id, name)")
      .eq("id", id)
      .maybeSingle<Fighter & { gym_ref: Pick<Gym, "id" | "name"> | null }>(),
    supabase
      .from("fighter_medical_records")
      .select("*")
      .eq("fighter_id", id)
      .order("issued_on", { ascending: false }),
    supabase
      .from("bouts")
      .select(
        "id, event_id, red_corner_fighter_id, blue_corner_fighter_id, result, method, round_finished, time_finished, bout_class",
      )
      .or(`red_corner_fighter_id.eq.${id},blue_corner_fighter_id.eq.${id}`),
  ]);
  if (!fighter) return new Response("Fighter not found", { status: 404 });
  const { gym_ref: gym, ...fighterRow } = fighter;

  type BoutSlim = Pick<
    Bout,
    | "id"
    | "event_id"
    | "red_corner_fighter_id"
    | "blue_corner_fighter_id"
    | "result"
    | "method"
    | "round_finished"
    | "time_finished"
    | "bout_class"
  >;
  const boutList = (bouts ?? []) as BoutSlim[];

  const eventIds = Array.from(new Set(boutList.map((b) => b.event_id)));
  const opponentIds = Array.from(
    new Set(
      boutList
        .flatMap((b) =>
          b.red_corner_fighter_id === id
            ? [b.blue_corner_fighter_id]
            : [b.red_corner_fighter_id],
        )
        .filter((x): x is string => Boolean(x)),
    ),
  );

  const [eventsRes, opponentsRes] = await Promise.all([
    eventIds.length
      ? supabase
          .from("events")
          .select("id, name, event_date")
          .in("id", eventIds)
      : Promise.resolve({ data: [] as Pick<EventRow, "id" | "name" | "event_date">[] }),
    opponentIds.length
      ? supabase.from("fighters").select("id, full_name").in("id", opponentIds)
      : Promise.resolve({ data: [] as Pick<Fighter, "id" | "full_name">[] }),
  ]);

  const eventMap = new Map(
    ((eventsRes.data ?? []) as Pick<EventRow, "id" | "name" | "event_date">[]).map(
      (e) => [e.id, e],
    ),
  );
  const opponentMap = new Map(
    ((opponentsRes.data ?? []) as Pick<Fighter, "id" | "full_name">[]).map((f) => [
      f.id,
      f.full_name,
    ]),
  );

  const rows: PassportBoutNormalizedRow[] = boutList
    .map((b): PassportBoutNormalizedRow | null => {
      const evt = eventMap.get(b.event_id);
      if (!evt) return null;
      const oppId =
        b.red_corner_fighter_id === id
          ? b.blue_corner_fighter_id
          : b.red_corner_fighter_id;
      const opponent = oppId ? opponentMap.get(oppId) ?? null : null;
      const isRed = b.red_corner_fighter_id === id;
      const outcome = (b.result as BoutOutcome | null) ?? null;
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
        bout_class: (b.bout_class ?? "pro") as "pro" | "amateur",
        normalizedResult: normalized,
      };
    })
    .filter((x): x is PassportBoutNormalizedRow => x != null)
    .sort((a, b) => b.event_date.localeCompare(a.event_date))
    .slice(0, 8);

  const buffer = await renderToBuffer(
    <FighterPassportPdf
      fighter={fighterRow}
      gym={fighter.gym_id ? gym : null}
      medicals={(medicals ?? []) as FighterMedicalRecord[]}
      recentBouts={rows}
    />,
  );

  const filename = `passport-${fileSlug(fighter.full_name)}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
