"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { orNull as str, toNum } from "@/lib/form-utils";
import { getSessionUser, requireStaff } from "@/lib/auth/session";

// Anyone signed in can log a fighter's weight (in practice the fighter
// themselves once we ship the fighter-self login role). Staff can edit /
// delete any entry.
export async function logFighterWeight(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Sign in to log weight.");

  const fighter_id = str(formData.get("fighter_id"));
  const weight_lbs = toNum(formData.get("weight_lbs"));
  if (!fighter_id || weight_lbs == null || weight_lbs <= 0) {
    throw new Error("Fighter and weight are required.");
  }

  const { error } = await db().from("fighter_weight_log").insert({
    fighter_id,
    weight_lbs,
    source: str(formData.get("source")) ?? "self-reported",
    notes: str(formData.get("notes")),
    logged_by: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/fighters/${fighter_id}`);
}

export async function deleteFighterWeightLog(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  const fighter_id = str(formData.get("fighter_id"));
  if (!id || !fighter_id) throw new Error("Missing id.");

  const { error } = await db().from("fighter_weight_log").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/fighters/${fighter_id}`);
}

// Per-sport class preference. Staff-only (fighters may want to change
// their own class — we'll open this up once the fighter self-service flow
// exists). Upsert on (fighter_id, sport).
export async function setFighterClassPreference(formData: FormData) {
  await requireStaff();
  const fighter_id = str(formData.get("fighter_id"));
  const sport = str(formData.get("sport"));
  const class_name = str(formData.get("class_name"));
  if (!fighter_id || !sport) throw new Error("Fighter and sport are required.");

  const supabase = db();

  if (!class_name) {
    await supabase
      .from("fighter_class_preferences")
      .delete()
      .eq("fighter_id", fighter_id)
      .eq("sport", sport);
  } else {
    await supabase
      .from("fighter_class_preferences")
      .upsert(
        { fighter_id, sport, class_name, updated_at: new Date().toISOString() },
        { onConflict: "fighter_id,sport" },
      );
  }

  revalidatePath(`/fighters/${fighter_id}`);
}
