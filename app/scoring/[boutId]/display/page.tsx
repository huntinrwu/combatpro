import { notFound } from "next/navigation";

import { DisplayClient } from "./display-client";
import { db } from "@/lib/db/client";
import type {
  Bout,
  BoutScorecard,
  EventOfficial,
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

  const { data: bout } = await supabase
    .from("bouts")
    .select("*")
    .eq("id", boutId)
    .maybeSingle<Bout>();

  if (!bout) notFound();

  // Judges come from the event roster — same pool for every bout on the card.
  const { data: rosterJudges } = await supabase
    .from("event_officials")
    .select("*")
    .eq("event_id", bout.event_id)
    .eq("event_role", "judge")
    .order("created_at");

  const rosterRows = (rosterJudges ?? []) as EventOfficial[];
  const judgeIds = rosterRows.map((r) => r.official_id);
  const { data: judgesData } = judgeIds.length
    ? await supabase
        .from("officials")
        .select("id, full_name")
        .in("id", judgeIds)
    : { data: [] as JudgeSummary[] };

  // Preserve roster order so Judge 1/2/3 stays stable across the card.
  const rosterOrder = new Map<string, number>();
  rosterRows.forEach((r, idx) => rosterOrder.set(r.official_id, idx));
  const judges = [...((judgesData ?? []) as JudgeSummary[])].sort(
    (a, b) => (rosterOrder.get(a.id) ?? 999) - (rosterOrder.get(b.id) ?? 999),
  );

  // Fighter names
  const fighterIds = [bout.red_corner_fighter_id, bout.blue_corner_fighter_id].filter(
    (x): x is string => Boolean(x),
  );
  const fighterMap = new Map<string, Pick<Fighter, "id" | "full_name">>();
  if (fighterIds.length) {
    const { data: fs } = await supabase
      .from("fighters")
      .select("id, full_name")
      .in("id", fighterIds);
    for (const f of fs ?? []) fighterMap.set(f.id, f);
  }
  const redName = bout.red_corner_fighter_id
    ? fighterMap.get(bout.red_corner_fighter_id)?.full_name ?? "Red"
    : "Red";
  const blueName = bout.blue_corner_fighter_id
    ? fighterMap.get(bout.blue_corner_fighter_id)?.full_name ?? "Blue"
    : "Blue";

  // Initial scorecards
  const { data: cards } = await supabase
    .from("bout_scorecards")
    .select("*")
    .eq("bout_id", boutId)
    .order("round_number");

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
