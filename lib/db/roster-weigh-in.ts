import { db, dbErr } from "@/lib/db/client";

export type WeighInPatch = {
  weigh_in_lbs: number | null;
  weigh_in_at: string | null;
  weigh_in_notes: string | null;
};

type BoutCorners = {
  id: string;
  red_corner_fighter_id: string | null;
  blue_corner_fighter_id: string | null;
};

// A weigh-in lives on the fighter's roster entry for the event. Bout screens
// and reports read it from the bout's check rows, so those are kept as a copy.
// Copies the roster weigh-in of each given fighter onto every bout corner they
// hold in the event. Best-effort: the roster is the record.
export async function copyWeighInsToBouts(eventId: string, fighterIds: string[]) {
  const ids = [...new Set(fighterIds)].filter(Boolean);
  if (ids.length === 0) return;
  const supabase = db();
  const [{ data: roster }, { data: bouts }] = await Promise.all([
    supabase
      .from("event_fighters")
      .select("fighter_id, weigh_in_lbs, weigh_in_at, weigh_in_notes")
      .eq("event_id", eventId)
      .in("fighter_id", ids),
    supabase
      .from("bouts")
      .select("id, red_corner_fighter_id, blue_corner_fighter_id")
      .eq("event_id", eventId),
  ]);
  const byFighter = new Map(
    ((roster ?? []) as ({ fighter_id: string } & WeighInPatch)[]).map((r) => [r.fighter_id, r]),
  );

  const rows: ({ bout_id: string; corner: "red" | "blue" } & WeighInPatch)[] = [];
  for (const b of (bouts ?? []) as BoutCorners[]) {
    for (const corner of ["red", "blue"] as const) {
      const fid = corner === "red" ? b.red_corner_fighter_id : b.blue_corner_fighter_id;
      const entry = fid ? byFighter.get(fid) : undefined;
      if (!entry) continue;
      rows.push({
        bout_id: b.id,
        corner,
        weigh_in_lbs: entry.weigh_in_lbs,
        weigh_in_at: entry.weigh_in_at,
        weigh_in_notes: entry.weigh_in_notes,
      });
    }
  }
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("bout_fighter_checks")
    .upsert(rows, { onConflict: "bout_id,corner" });
  if (error) console.error("[weigh-in copy]", error.code, error.message);
}

// Record (or clear, with nulls) a fighter's weigh-in for an event. Returns
// false when the fighter isn't on the event's roster.
export async function setRosterWeighIn(
  eventId: string,
  fighterId: string,
  patch: WeighInPatch,
): Promise<boolean> {
  const { data, error } = await db()
    .from("event_fighters")
    .update(patch)
    .eq("event_id", eventId)
    .eq("fighter_id", fighterId)
    .select("id");
  if (error) dbErr(error);
  if (!data || data.length === 0) return false;
  await copyWeighInsToBouts(eventId, [fighterId]);
  return true;
}
