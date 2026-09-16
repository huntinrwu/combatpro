"use server";

import { revalidatePath } from "next/cache";

import { db, dbErr } from "@/lib/db/client";
import { toInt } from "@/lib/form-utils";
import { requireUser } from "@/lib/auth/session";

export async function submitScorecard(formData: FormData) {
  const user = await requireUser();
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

  // Only the judge (via their linked person) or staff can post scores.
  if (!user.isStaff) {
    if (!user.personId) throw new Error("Not authorized to score on behalf of this judge.");
    const { data: official } = await db()
      .from("officials")
      .select("id")
      .eq("id", judge_official_id)
      .eq("person_id", user.personId)
      .maybeSingle<{ id: string }>();
    if (!official) throw new Error("Not authorized to score on behalf of this judge.");
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

  if (error) dbErr(error);

  revalidatePath(`/scoring/${bout_id}`);
  revalidatePath(`/scoring/${bout_id}/display`);
}
