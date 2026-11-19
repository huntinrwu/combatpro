import { db } from "@/lib/db/client";
import type { Bout, Fighter, Official } from "@/lib/db/types";

export type ScoringJudge = Pick<Official, "id" | "full_name">;

type ScoringBoutRow = Pick<Bout, "event_id" | "rounds"> & {
  red: Pick<Fighter, "full_name"> | null;
  blue: Pick<Fighter, "full_name"> | null;
  event: { judges: { official: ScoringJudge | null }[] } | null;
};

// Shared by the judge scoring page and the cage-side display: the bout, both
// fighter names and the event's judge roster in one query. Judges come from
// the event roster (same pool for every bout on the card) and are ordered by
// when they were added, so "Judge 1/2/3" means the same seat on every screen.
export async function loadScoringBout(boutId: string) {
  const { data } = await db()
    .from("bouts")
    .select(
      "event_id, rounds, red:fighters!red_corner_fighter_id(full_name), blue:fighters!blue_corner_fighter_id(full_name), event:events!bouts_event_id_fkey(judges:event_officials(official:officials(id, full_name)))",
    )
    .eq("id", boutId)
    .eq("event.judges.event_role", "judge")
    .order("created_at", { referencedTable: "event.judges" })
    .maybeSingle();
  if (!data) return null;

  const row = data as unknown as ScoringBoutRow;
  return {
    eventId: row.event_id,
    rounds: row.rounds,
    redName: row.red?.full_name ?? null,
    blueName: row.blue?.full_name ?? null,
    judges: (row.event?.judges ?? [])
      .map((j) => j.official)
      .filter((o): o is ScoringJudge => Boolean(o)),
  };
}
