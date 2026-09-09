"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { toInt } from "@/lib/form-utils";

export async function submitScorecard(formData: FormData) {
  const bout_id = formData.get("bout_id")?.toString();
  const judge_official_id = formData.get("judge_official_id")?.toString();
  const round_number = toInt(formData.get("round_number")) ?? 0;
  const red_score = toInt(formData.get("red_score")) ?? 10;
  const blue_score = toInt(formData.get("blue_score")) ?? 10;
  const knockdowns_red = toInt(formData.get("knockdowns_red")) ?? 0;
  const knockdowns_blue = toInt(formData.get("knockdowns_blue")) ?? 0;
  const notes = formData.get("notes")?.toString().trim() || null;

  if (!bout_id || !judge_official_id || round_number < 1) {
    throw new Error("bout, judge, and round_number are required.");
  }

  const { error } = await db()
    .from("bout_scorecards")
    .upsert(
      {
        bout_id,
        judge_official_id,
        round_number,
        red_score,
        blue_score,
        knockdowns_red,
        knockdowns_blue,
        notes,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "bout_id,judge_official_id,round_number" },
    );

  if (error) throw new Error(error.message);

  revalidatePath(`/scoring/${bout_id}`);
  revalidatePath(`/scoring/${bout_id}/display`);
}
