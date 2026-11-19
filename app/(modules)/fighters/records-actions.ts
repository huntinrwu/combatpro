"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db, dbErr } from "@/lib/db/client";
import { idOrNull, orNull as str, toInt } from "@/lib/form-utils";
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

  const opponent_fighter_id = idOrNull(formData.get("opponent_fighter_id"));

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
  if (error) dbErr(error);

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

  const opponent_fighter_id = idOrNull(formData.get("opponent_fighter_id"));

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
  if (error) dbErr(error);

  // Re-reconcile in case opponent/date changed.
  await reconcileConfidence(fighter_id, opponent_name, fight_date);

  revalidatePath(`/fighters/${fighter_id}`);
  redirect(`/fighters/${fighter_id}`);
}

// One row of the inline fight-record editor on the fighter page.
export type FightRecordEdit = {
  id: string | null;
  fight_date: string;
  opponent_name: string;
  result: FightOutcome;
  method: string;
  round_finished: string;
  is_pro: boolean;
  event_name: string;
  confidence: FightConfidence;
};

// Staff-only: write every edit made in the inline editor in one go. Rows with
// an id are updated, rows without one are inserted, `deletes` are removed.
// Staff set the confidence themselves here, so no auto-reconciliation runs.
export async function saveFightRecords(input: {
  fighterId: string;
  upserts: FightRecordEdit[];
  deletes: string[];
}) {
  const staff = await requireStaff();
  const { fighterId, upserts, deletes } = input;
  if (!fighterId) throw new Error("Missing fighter.");
  if (upserts.length + deletes.length > 500) throw new Error("Too many changes at once.");

  const rows = upserts.map((r) => {
    const opponent_name = r.opponent_name?.trim();
    if (!opponent_name || !/^\d{4}-\d{2}-\d{2}$/.test(r.fight_date ?? "")) {
      throw new Error("Every fight needs a date and an opponent.");
    }
    if (!(FIGHT_OUTCOMES as readonly string[]).includes(r.result)) {
      throw new Error("Invalid result.");
    }
    if (!(FIGHT_CONFIDENCE as readonly string[]).includes(r.confidence)) {
      throw new Error("Invalid confidence.");
    }
    const round = r.round_finished ? Number.parseInt(r.round_finished, 10) : null;
    if (round != null && (!Number.isFinite(round) || round < 1 || round > 15)) {
      throw new Error("Round must be between 1 and 15.");
    }
    return {
      id: r.id,
      fields: {
        fight_date: r.fight_date,
        opponent_name,
        result: r.result,
        method: r.method?.trim() || null,
        round_finished: round,
        is_pro: Boolean(r.is_pro),
        event_name: r.event_name?.trim() || null,
        confidence: r.confidence,
        reviewed_by: staff.id,
        reviewed_at: new Date().toISOString(),
      },
    };
  });

  const supabase = db();
  const inserts = rows
    .filter((r) => !r.id)
    .map((r) => ({ ...r.fields, fighter_id: fighterId, submitted_by: staff.id }));

  const results = await Promise.all([
    ...rows
      .filter((r) => r.id)
      .map((r) =>
        supabase.from("fight_records").update(r.fields).eq("id", r.id!).eq("fighter_id", fighterId),
      ),
    ...(inserts.length ? [supabase.from("fight_records").insert(inserts)] : []),
    ...(deletes.length
      ? [supabase.from("fight_records").delete().in("id", deletes).eq("fighter_id", fighterId)]
      : []),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) dbErr(failed.error);

  revalidatePath(`/fighters/${fighterId}`);
}

// Staff-only: set the headline W-L-D numbers shown at the top of the profile.
export async function saveDeclaredRecord(formData: FormData) {
  await requireStaff();
  const fighter_id = str(formData.get("fighter_id"));
  if (!fighter_id) throw new Error("Missing fighter.");

  const fields = ["pro_wins", "pro_losses", "pro_draws", "am_wins", "am_losses", "am_draws"] as const;
  const payload: Record<string, number> = {};
  for (const f of fields) {
    const n = toInt(formData.get(f));
    if (n == null || n < 0 || n > 999) throw new Error("Record numbers must be 0 or more.");
    payload[f] = n;
  }

  const { error } = await db().from("fighters").update(payload).eq("id", fighter_id);
  if (error) dbErr(error);

  revalidatePath(`/fighters/${fighter_id}`);
  revalidatePath("/fighters");
}
