"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { orNull as str, toInt } from "@/lib/form-utils";
import { getSessionUser, requireStaff } from "@/lib/auth/session";
import {
  FIGHT_CONFIDENCE,
  FIGHT_OUTCOMES,
  type FightConfidence,
  type FightOutcome,
  type FightRecord,
} from "@/lib/db/types";

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function requireOutcome(raw: FormDataEntryValue | null): FightOutcome {
  const v = typeof raw === "string" ? raw : "";
  if (!(FIGHT_OUTCOMES as readonly string[]).includes(v)) {
    throw new Error("Invalid result.");
  }
  return v as FightOutcome;
}

// Corroboration/dispute rule (loose, per user's ask): match on
// same fighter + same fight_date + same normalized opponent name.
// - Same result → all non-verified rows become 'corroborated'.
// - Different result → all non-verified rows become 'disputed'.
// Verified rows never get demoted by later reports.
async function reconcileConfidence(fighterId: string, opponentName: string, fightDate: string) {
  const supabase = db();
  const normOpp = normalizeName(opponentName);

  const { data } = await supabase
    .from("fight_records")
    .select("id, result, confidence, opponent_name")
    .eq("fighter_id", fighterId)
    .eq("fight_date", fightDate);

  const cluster = ((data ?? []) as Pick<
    FightRecord,
    "id" | "result" | "confidence" | "opponent_name"
  >[]).filter((r) => normalizeName(r.opponent_name) === normOpp);

  if (cluster.length <= 1) return;

  const distinctResults = new Set(cluster.map((r) => r.result));
  const target: FightConfidence = distinctResults.size > 1 ? "disputed" : "corroborated";

  const toBump = cluster.filter((r) => r.confidence !== "verified" && r.confidence !== target);
  if (toBump.length === 0) return;

  await supabase
    .from("fight_records")
    .update({ confidence: target })
    .in(
      "id",
      toBump.map((r) => r.id),
    );
}

// Public: any signed-in user can submit a fight record. Always lands as
// 'reported'. Reconciliation then promotes/disputes as appropriate.
export async function submitFightRecord(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Sign in to submit fight records.");

  const fighter_id = str(formData.get("fighter_id"));
  const opponent_name = str(formData.get("opponent_name"));
  const fight_date = str(formData.get("fight_date"));
  const result = requireOutcome(formData.get("result"));
  if (!fighter_id || !opponent_name || !fight_date) {
    throw new Error("Fighter, opponent, and date are required.");
  }

  const opp_id_raw = str(formData.get("opponent_fighter_id"));
  const opponent_fighter_id = opp_id_raw && opp_id_raw !== "__none__" ? opp_id_raw : null;

  const payload = {
    fighter_id,
    opponent_fighter_id,
    opponent_name,
    fight_date,
    result,
    method: str(formData.get("method")),
    round_finished: toInt(formData.get("round_finished")),
    time_finished: str(formData.get("time_finished")),
    sport: str(formData.get("sport")),
    weight_class: str(formData.get("weight_class")),
    is_pro: formData.get("is_pro") === "on",
    confidence: "reported" as const,
    source_label: str(formData.get("source_label")),
    event_name: str(formData.get("event_name")),
    location: str(formData.get("location")),
    submitted_by: user.id,
    notes: str(formData.get("notes")),
  };

  const { error } = await db().from("fight_records").insert(payload);
  if (error) throw new Error(error.message);

  await reconcileConfidence(fighter_id, opponent_name, fight_date);

  revalidatePath(`/fighters/${fighter_id}`);
  redirect(`/fighters/${fighter_id}`);
}

// Staff-only: full edit of any record.
export async function updateFightRecord(formData: FormData) {
  const staff = await requireStaff();
  const id = str(formData.get("id"));
  const fighter_id = str(formData.get("fighter_id"));
  if (!id || !fighter_id) throw new Error("Missing id.");

  const opp_id_raw = str(formData.get("opponent_fighter_id"));
  const opponent_fighter_id = opp_id_raw && opp_id_raw !== "__none__" ? opp_id_raw : null;

  const opponent_name = str(formData.get("opponent_name"));
  const fight_date = str(formData.get("fight_date"));
  const result = requireOutcome(formData.get("result"));
  const confidenceRaw = str(formData.get("confidence"));
  const confidence: FightConfidence =
    confidenceRaw && (FIGHT_CONFIDENCE as readonly string[]).includes(confidenceRaw)
      ? (confidenceRaw as FightConfidence)
      : "reported";
  if (!opponent_name || !fight_date) throw new Error("Opponent + date required.");

  const payload = {
    opponent_fighter_id,
    opponent_name,
    fight_date,
    result,
    method: str(formData.get("method")),
    round_finished: toInt(formData.get("round_finished")),
    time_finished: str(formData.get("time_finished")),
    sport: str(formData.get("sport")),
    weight_class: str(formData.get("weight_class")),
    is_pro: formData.get("is_pro") === "on",
    confidence,
    source_label: str(formData.get("source_label")),
    event_name: str(formData.get("event_name")),
    location: str(formData.get("location")),
    reviewed_by: staff.id,
    reviewed_at: new Date().toISOString(),
    notes: str(formData.get("notes")),
  };

  const { error } = await db().from("fight_records").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  // Re-reconcile in case opponent/date changed.
  await reconcileConfidence(fighter_id, opponent_name, fight_date);

  revalidatePath(`/fighters/${fighter_id}`);
  redirect(`/fighters/${fighter_id}`);
}

// Staff-only: quick confidence flip inline on the fighter detail page.
export async function setFightRecordConfidence(formData: FormData) {
  const staff = await requireStaff();
  const id = str(formData.get("id"));
  const fighter_id = str(formData.get("fighter_id"));
  const confidenceRaw = str(formData.get("confidence"));
  if (!id || !fighter_id) throw new Error("Missing id.");
  if (!confidenceRaw || !(FIGHT_CONFIDENCE as readonly string[]).includes(confidenceRaw)) {
    throw new Error("Bad confidence.");
  }

  await db()
    .from("fight_records")
    .update({
      confidence: confidenceRaw as FightConfidence,
      reviewed_by: staff.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath(`/fighters/${fighter_id}`);
}

// Staff-only.
export async function deleteFightRecord(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  const fighter_id = str(formData.get("fighter_id"));
  if (!id || !fighter_id) throw new Error("Missing id.");

  await db().from("fight_records").delete().eq("id", id);
  revalidatePath(`/fighters/${fighter_id}`);
}
