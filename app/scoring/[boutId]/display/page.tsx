import { notFound } from "next/navigation";

import { DisplayClient } from "./display-client";
import { loadScoringBout, type ScoringJudge } from "../load-scoring-bout";
import { db } from "@/lib/db/client";
import type { BoutScorecard } from "@/lib/db/types";
import { requireApprovedUser } from "@/lib/auth/session";

export type JudgeSummary = ScoringJudge;

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ boutId: string }>;
}) {
  await requireApprovedUser();
  const { boutId } = await params;

  // Scorecards only depend on boutId, so fetch them alongside the bout.
  const [bout, { data: cards }] = await Promise.all([
    loadScoringBout(boutId),
    db().from("bout_scorecards").select("*").eq("bout_id", boutId).order("round_number"),
  ]);

  if (!bout) notFound();

  return (
    <DisplayClient
      boutId={boutId}
      totalRounds={bout.rounds ?? 10}
      redName={bout.redName ?? "Red"}
      blueName={bout.blueName ?? "Blue"}
      judges={bout.judges}
      initialCards={(cards ?? []) as BoutScorecard[]}
    />
  );
}
