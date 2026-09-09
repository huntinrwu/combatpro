"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { orNull, toInt as toIntOrNull } from "@/lib/form-utils";
import {
  computeRecordDeltas,
  fighterColumnFor,
  type Bout,
  type BoutClass,
  type BoutMethod,
  type BoutOutcome,
  type FighterRecordDelta,
  type FightOutcome,
} from "@/lib/db/types";

// Map a bout outcome (red/blue/draw/no_contest) to two per-fighter fight
// outcomes for the fight_records table.
function outcomesForFighters(
  bout: BoutOutcome,
): { red: FightOutcome; blue: FightOutcome } {
  if (bout === "red") return { red: "win", blue: "loss" };
  if (bout === "blue") return { red: "loss", blue: "win" };
  if (bout === "draw") return { red: "draw", blue: "draw" };
  return { red: "no_contest", blue: "no_contest" };
}

async function syncFightRecordsForBout(bout_id: string) {
  const supabase = db();

  // Wipe any prior rows for this bout so re-declares stay in sync.
  await supabase.from("fight_records").delete().eq("bout_id", bout_id);

  const { data: bout } = await supabase
    .from("bouts")
    .select(
      "id, event_id, sport, weight_class, bout_class, result, method, round_finished, time_finished, red_corner_fighter_id, blue_corner_fighter_id",
    )
    .eq("id", bout_id)
    .maybeSingle<{
      id: string;
      event_id: string;
      sport: string;
      weight_class: string | null;
      bout_class: BoutClass;
      result: BoutOutcome | null;
      method: string | null;
      round_finished: number | null;
      time_finished: string | null;
      red_corner_fighter_id: string | null;
      blue_corner_fighter_id: string | null;
    }>();
  if (!bout || !bout.result) return;

  const { data: event } = await supabase
    .from("events")
    .select("event_date, name, city, state")
    .eq("id", bout.event_id)
    .maybeSingle<{ event_date: string; name: string; city: string | null; state: string | null }>();
  if (!event) return;

  const fighterIds = [bout.red_corner_fighter_id, bout.blue_corner_fighter_id].filter(
    (x): x is string => Boolean(x),
  );
  if (fighterIds.length === 0) return;

  const { data: fighters } = await supabase
    .from("fighters")
    .select("id, full_name")
    .in("id", fighterIds);
  const nameById = new Map<string, string>(
    ((fighters ?? []) as { id: string; full_name: string }[]).map((f) => [f.id, f.full_name]),
  );

  const outcomes = outcomesForFighters(bout.result);
  const location = [event.city, event.state].filter(Boolean).join(", ") || null;

  const rows: Array<{
    fighter_id: string;
    opponent_fighter_id: string | null;
    opponent_name: string;
    fight_date: string;
    result: FightOutcome;
    method: string | null;
    round_finished: number | null;
    time_finished: string | null;
    sport: string;
    weight_class: string | null;
    is_pro: boolean;
    confidence: "verified";
    source_label: string;
    bout_id: string;
    event_name: string;
    location: string | null;
  }> = [];

  if (bout.red_corner_fighter_id) {
    rows.push({
      fighter_id: bout.red_corner_fighter_id,
      opponent_fighter_id: bout.blue_corner_fighter_id,
      opponent_name: bout.blue_corner_fighter_id
        ? nameById.get(bout.blue_corner_fighter_id) ?? "TBD"
        : "TBD",
      fight_date: event.event_date,
      result: outcomes.red,
      method: bout.method,
      round_finished: bout.round_finished,
      time_finished: bout.time_finished,
      sport: bout.sport,
      weight_class: bout.weight_class,
      is_pro: bout.bout_class === "pro",
      confidence: "verified",
      source_label: "CombatPro event",
      bout_id: bout.id,
      event_name: event.name,
      location,
    });
  }
  if (bout.blue_corner_fighter_id) {
    rows.push({
      fighter_id: bout.blue_corner_fighter_id,
      opponent_fighter_id: bout.red_corner_fighter_id,
      opponent_name: bout.red_corner_fighter_id
        ? nameById.get(bout.red_corner_fighter_id) ?? "TBD"
        : "TBD",
      fight_date: event.event_date,
      result: outcomes.blue,
      method: bout.method,
      round_finished: bout.round_finished,
      time_finished: bout.time_finished,
      sport: bout.sport,
      weight_class: bout.weight_class,
      is_pro: bout.bout_class === "pro",
      confidence: "verified",
      source_label: "CombatPro event",
      bout_id: bout.id,
      event_name: event.name,
      location,
    });
  }

  if (rows.length) {
    await supabase.from("fight_records").insert(rows);
  }
}

// Consolidate deltas per (fighter, column) and apply as +1 or -1 to the
// bout-class-specific fighter column. Reads current row, computes new,
// writes back — race-y under concurrent writes but fine for POC.
async function applyRecordDeltas(
  deltas: FighterRecordDelta[],
  bout_class: BoutClass,
  sign: 1 | -1,
) {
  if (deltas.length === 0) return;

  const supabase = db();
  const perFighter = new Map<string, Map<string, number>>();
  for (const d of deltas) {
    const col = fighterColumnFor(bout_class, d.column);
    const cols = perFighter.get(d.fighter_id) ?? new Map<string, number>();
    cols.set(col, (cols.get(col) ?? 0) + sign);
    perFighter.set(d.fighter_id, cols);
  }

  for (const [fighter_id, cols] of perFighter) {
    const colNames = Array.from(cols.keys());
    const { data: fighter, error: readErr } = await supabase
      .from("fighters")
      .select(`id, ${colNames.join(", ")}`)
      .eq("id", fighter_id)
      .maybeSingle();
    if (readErr || !fighter) continue;

    const update: Record<string, number> = {};
    for (const col of colNames) {
      const cur = Number(fighter[col as keyof typeof fighter] ?? 0);
      const delta = cols.get(col) ?? 0;
      update[col] = Math.max(0, cur + delta);
    }
    const { error: updErr } = await supabase
      .from("fighters")
      .update(update)
      .eq("id", fighter_id);
    if (updErr) throw new Error(updErr.message);
  }
}

export async function declareBoutResult(formData: FormData) {
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const result = formData.get("result")?.toString() as BoutOutcome | undefined;
  const method = formData.get("method")?.toString() as BoutMethod | undefined;
  const bout_class =
    (formData.get("bout_class")?.toString() as BoutClass | undefined) ?? "pro";

  if (!bout_id || !event_id || !result || !method) {
    throw new Error("bout, result, and method are required.");
  }

  const supabase = db();

  // Snapshot the current bout so we can reverse a previously-applied result.
  const { data: current, error: readErr } = await supabase
    .from("bouts")
    .select(
      "id, red_corner_fighter_id, blue_corner_fighter_id, result, bout_class, records_applied",
    )
    .eq("id", bout_id)
    .maybeSingle<
      Pick<
        Bout,
        | "id"
        | "red_corner_fighter_id"
        | "blue_corner_fighter_id"
        | "result"
        | "bout_class"
        | "records_applied"
      >
    >();
  if (readErr || !current) throw new Error(readErr?.message ?? "bout not found");

  if (current.records_applied && current.result) {
    const oldDeltas = computeRecordDeltas(
      current.result as BoutOutcome,
      current.red_corner_fighter_id,
      current.blue_corner_fighter_id,
    );
    await applyRecordDeltas(oldDeltas, current.bout_class, -1);
  }

  const { error: updErr } = await supabase
    .from("bouts")
    .update({
      result,
      method,
      bout_class,
      round_finished: toIntOrNull(formData.get("round_finished")),
      time_finished: orNull(formData.get("time_finished")),
      notes: orNull(formData.get("notes")) ?? null,
      records_applied: true,
    })
    .eq("id", bout_id);
  if (updErr) throw new Error(updErr.message);

  const newDeltas = computeRecordDeltas(
    result,
    current.red_corner_fighter_id,
    current.blue_corner_fighter_id,
  );
  await applyRecordDeltas(newDeltas, bout_class, 1);

  await syncFightRecordsForBout(bout_id);

  revalidatePath(`/events/${event_id}/bouts/${bout_id}`);
  revalidatePath(`/events/${event_id}`);
  if (current.red_corner_fighter_id) {
    revalidatePath(`/fighters/${current.red_corner_fighter_id}`);
  }
  if (current.blue_corner_fighter_id) {
    revalidatePath(`/fighters/${current.blue_corner_fighter_id}`);
  }
  revalidatePath("/fighters");
}

export async function clearBoutResult(formData: FormData) {
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();

  if (!bout_id || !event_id) throw new Error("bout is required.");

  const supabase = db();

  const { data: current, error: readErr } = await supabase
    .from("bouts")
    .select(
      "id, red_corner_fighter_id, blue_corner_fighter_id, result, bout_class, records_applied",
    )
    .eq("id", bout_id)
    .maybeSingle<
      Pick<
        Bout,
        | "id"
        | "red_corner_fighter_id"
        | "blue_corner_fighter_id"
        | "result"
        | "bout_class"
        | "records_applied"
      >
    >();
  if (readErr || !current) throw new Error(readErr?.message ?? "bout not found");

  if (current.records_applied && current.result) {
    const oldDeltas = computeRecordDeltas(
      current.result as BoutOutcome,
      current.red_corner_fighter_id,
      current.blue_corner_fighter_id,
    );
    await applyRecordDeltas(oldDeltas, current.bout_class, -1);
  }

  const { error: updErr } = await supabase
    .from("bouts")
    .update({
      result: null,
      method: null,
      round_finished: null,
      time_finished: null,
      records_applied: false,
    })
    .eq("id", bout_id);
  if (updErr) throw new Error(updErr.message);

  // Reverting a bout also revokes the verified fight_record rows it produced.
  await supabase.from("fight_records").delete().eq("bout_id", bout_id);

  revalidatePath(`/events/${event_id}/bouts/${bout_id}`);
  revalidatePath(`/events/${event_id}`);
  if (current.red_corner_fighter_id) {
    revalidatePath(`/fighters/${current.red_corner_fighter_id}`);
  }
  if (current.blue_corner_fighter_id) {
    revalidatePath(`/fighters/${current.blue_corner_fighter_id}`);
  }
  revalidatePath("/fighters");
}
