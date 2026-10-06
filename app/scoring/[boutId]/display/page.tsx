import { notFound } from "next/navigation";

import { DisplayClient } from "./display-client";
import { db } from "@/lib/db/client";
import type {
  Bout,
  BoutScorecard,
  Fighter,
  Official,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

export type JudgeSummary = Pick<Official, "id" | "full_name">;

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ boutId: string }>;
}) {
  const { boutId } = await params;
  const supabase = db();

  // Scorecards only depend on boutId, so fetch them alongside the bout.
  const [{ data: bout }, { data: cards }] = await Promise.all([
    supabase
      .from("bouts")
      .select("event_id, red_corner_fighter_id, blue_corner_fighter_id, rounds")
      .eq("id", boutId)
      .maybeSingle<
        Pick<Bout, "event_id" | "red_corner_fighter_id" | "blue_corner_fighter_id" | "rounds">
      >(),
    supabase
      .from("bout_scorecards")
      .select("*")
      .eq("bout_id", boutId)
      .order("round_number"),
  ]);

  if (!bout) notFound();

  const fighterIds = [bout.red_corner_fighter_id, bout.blue_corner_fighter_id].filter(
    (x): x is string => Boolean(x),
  );

  // Judges come from the event roster — same pool for every bout on the card.
  // Officials are embedded so roster order (Judge 1/2/3) stays stable.
  const [{ data: rosterJudges }, { data: fs }] = await Promise.all([
    supabase
      .from("event_officials")
      .select("official:officials(id, full_name)")
      .eq("event_id", bout.event_id)
      .eq("event_role", "judge")
      .order("created_at"),
    fighterIds.length
      ? supabase.from("fighters").select("id, full_name").in("id", fighterIds)
      : Promise.resolve({ data: [] as Pick<Fighter, "id" | "full_name">[] }),
  ]);

  const judges = ((rosterJudges ?? []) as unknown as { official: JudgeSummary | null }[])
    .map((r) => r.official)
    .filter((o): o is JudgeSummary => Boolean(o));

  // Fighter names
  const fighterMap = new Map<string, Pick<Fighter, "id" | "full_name">>();
  for (const f of fs ?? []) fighterMap.set(f.id, f);
  const redName = bout.red_corner_fighter_id
    ? fighterMap.get(bout.red_corner_fighter_id)?.full_name ?? "Red"
    : "Red";
  const blueName = bout.blue_corner_fighter_id
    ? fighterMap.get(bout.blue_corner_fighter_id)?.full_name ?? "Blue"
    : "Blue";

  return (
    <DisplayClient
      boutId={boutId}
      totalRounds={bout.rounds ?? 10}
      redName={redName}
      blueName={blueName}
      judges={judges}
      initialCards={(cards ?? []) as BoutScorecard[]}
    />
  );
}
