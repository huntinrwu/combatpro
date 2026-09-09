import { renderToBuffer } from "@react-pdf/renderer";

import { db } from "@/lib/db/client";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = db();

  const { data: fighter } = await supabase
    .from("fighters")
    .select("*")
    .eq("id", id)
    .maybeSingle<Fighter>();
  if (!fighter) return new Response("Fighter not found", { status: 404 });

  const [{ data: medicals }, gymRes, { data: bouts }] = await Promise.all([
    supabase
      .from("fighter_medical_records")
      .select("*")
      .eq("fighter_id", id)
      .order("issued_on", { ascending: false }),
    fighter.gym_id
      ? supabase
          .from("gyms")
          .select("id, name")
          .eq("id", fighter.gym_id)
          .maybeSingle<Pick<Gym, "id" | "name">>()
      : Promise.resolve({ data: null as Pick<Gym, "id" | "name"> | null }),
    supabase
      .from("bouts")
      .select(
        "id, event_id, red_corner_fighter_id, blue_corner_fighter_id, result, method, round_finished, time_finished, bout_class",
      )
      .or(`red_corner_fighter_id.eq.${id},blue_corner_fighter_id.eq.${id}`),
  ]);

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
      fighter={fighter}
      gym={gymRes.data ?? null}
      medicals={(medicals ?? []) as FighterMedicalRecord[]}
      recentBouts={rows}
    />,
  );

  const slug = fighter.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-");
  const filename = `passport-${slug}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
