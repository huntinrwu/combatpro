"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { toInt, toNum } from "@/lib/form-utils";
import { getSessionUser, requireStaff } from "@/lib/auth/session";
import { feetInToCm, inToCm } from "@/lib/units";

// Seed placeholder bout rows from the aggregate W/L/D counters typed on the
// fighter form. Called only on CREATE — reflects the fighter's declared
// career total in the fight_records ledger so the profile card isn't empty
// while sourced bout details are still being backfilled. Each row uses a
// unique opponent stub ("Undisclosed opponent #N") so the reconciliation
// clustering can't merge them into "disputed" from mixed results.
async function seedDeclaredFightRecords(fighterId: string, formData: FormData) {
  const counts = {
    pro: {
      win: toInt(formData.get("pro_wins")) ?? 0,
      loss: toInt(formData.get("pro_losses")) ?? 0,
      draw: toInt(formData.get("pro_draws")) ?? 0,
    },
    am: {
      win: toInt(formData.get("am_wins")) ?? 0,
      loss: toInt(formData.get("am_losses")) ?? 0,
      draw: toInt(formData.get("am_draws")) ?? 0,
    },
  };
  const primary_sport = formData.get("primary_sport")?.toString().trim() || null;
  const today = new Date().toISOString().slice(0, 10);
  const user = await getSessionUser();

  const rows: Array<Record<string, unknown>> = [];
  let idx = 0;
  for (const tier of ["pro", "am"] as const) {
    for (const [result, count] of Object.entries(counts[tier]) as Array<
      ["win" | "loss" | "draw", number]
    >) {
      for (let i = 0; i < count; i++) {
        idx++;
        rows.push({
          fighter_id: fighterId,
          opponent_name: `Undisclosed opponent #${idx}`,
          fight_date: today,
          result,
          is_pro: tier === "pro",
          sport: primary_sport,
          confidence: "reported",
          source_label: "Declared on registration",
          submitted_by: user?.id ?? null,
          notes: "Placeholder from initial fighter registration — replace with sourced bout detail when known.",
        });
      }
    }
  }
  if (rows.length === 0) return;
  await db().from("fight_records").insert(rows);
}

// Walking weight is intentionally NOT stored directly on the fighter row via
// the form. It's a derived column maintained by the fighter_weight_log
// trigger. Route new readings through the log so history stays intact.
async function maybeLogWalkingWeight(fighterId: string, formData: FormData) {
  const raw = formData.get("walking_weight_lbs")?.toString().trim();
  if (!raw) return;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 60 || n > 500) return;
  const user = await getSessionUser();
  await db().from("fighter_weight_log").insert({
    fighter_id: fighterId,
    weight_lbs: n,
    source: "form",
    logged_by: user?.id ?? null,
  });
}

function fighterPayload(formData: FormData) {
  const full_name = formData.get("full_name")?.toString().trim();
  const primary_sport = formData.get("primary_sport")?.toString().trim();
  if (!full_name || !primary_sport) {
    throw new Error("Full name and primary sport are required.");
  }
  return {
    full_name,
    nickname: formData.get("nickname")?.toString().trim() || null,
    date_of_birth: formData.get("date_of_birth")?.toString() || null,
    nationality: formData.get("nationality")?.toString().trim() || null,
    gym: formData.get("gym")?.toString().trim() || null,
    gym_id: (() => {
      const v = formData.get("gym_id")?.toString().trim();
      return v && v !== "__none__" ? v : null;
    })(),
    hometown: formData.get("hometown")?.toString().trim() || null,
    stance: formData.get("stance")?.toString() || null,
    // Forms send US-primary units (feet+inches for height, inches for reach); DB stores cm.
    height_cm: (() => {
      const cm = feetInToCm(
        toNum(formData.get("height_ft")),
        toNum(formData.get("height_in")),
      );
      return cm == null ? null : Math.round(cm);
    })(),
    reach_cm: (() => {
      const cm = inToCm(toNum(formData.get("reach_in")));
      return cm == null ? null : Math.round(cm);
    })(),
    weight_class: formData.get("weight_class")?.toString().trim() || null,
    primary_sport,
    pro_wins: toInt(formData.get("pro_wins")) ?? 0,
    pro_losses: toInt(formData.get("pro_losses")) ?? 0,
    pro_draws: toInt(formData.get("pro_draws")) ?? 0,
    am_wins: toInt(formData.get("am_wins")) ?? 0,
    am_losses: toInt(formData.get("am_losses")) ?? 0,
    am_draws: toInt(formData.get("am_draws")) ?? 0,
    photo_url: formData.get("photo_url")?.toString().trim() || null,
    contact_email: formData.get("contact_email")?.toString().trim() || null,
    contact_phone: formData.get("contact_phone")?.toString().trim() || null,
    licenses: formData.get("licenses")?.toString().trim() || null,
    notes: formData.get("notes")?.toString().trim() || null,
  };
}

export async function createFighter(formData: FormData) {
  const { data, error } = await db()
    .from("fighters")
    .insert(fighterPayload(formData))
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await maybeLogWalkingWeight(data.id, formData);
  await seedDeclaredFightRecords(data.id, formData);
  revalidatePath("/fighters");
  redirect(`/fighters/${data.id}`);
}

export async function updateFighter(formData: FormData) {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing fighter id.");

  const { error } = await db()
    .from("fighters")
    .update(fighterPayload(formData))
    .eq("id", id);
  if (error) throw new Error(error.message);
  await maybeLogWalkingWeight(id, formData);

  revalidatePath(`/fighters/${id}`);
  revalidatePath("/fighters");
  redirect(`/fighters/${id}`);
}

// One-shot backfill for fighters that were entered before auto-seeding was
// wired up. Reads the current aggregate on the fighter row and generates
// placeholder bout rows for the delta between declared and already-recorded
// counts (per pro/am × win/loss/draw bucket). Safe to re-run: only creates
// what's missing.
export async function backfillDeclaredFightRecords(formData: FormData) {
  await requireStaff();
  const fighter_id = formData.get("fighter_id")?.toString();
  if (!fighter_id) throw new Error("fighter_id is required.");

  const supabase = db();
  const [{ data: fighter }, { data: existing }] = await Promise.all([
    supabase
      .from("fighters")
      .select(
        "primary_sport, pro_wins, pro_losses, pro_draws, am_wins, am_losses, am_draws",
      )
      .eq("id", fighter_id)
      .maybeSingle<{
        primary_sport: string | null;
        pro_wins: number;
        pro_losses: number;
        pro_draws: number;
        am_wins: number;
        am_losses: number;
        am_draws: number;
      }>(),
    supabase
      .from("fight_records")
      .select("result, is_pro")
      .eq("fighter_id", fighter_id),
  ]);
  if (!fighter) throw new Error("Fighter not found.");

  const declared = {
    pro: { win: fighter.pro_wins, loss: fighter.pro_losses, draw: fighter.pro_draws },
    am: { win: fighter.am_wins, loss: fighter.am_losses, draw: fighter.am_draws },
  };
  const have = {
    pro: { win: 0, loss: 0, draw: 0 },
    am: { win: 0, loss: 0, draw: 0 },
  };
  for (const r of (existing ?? []) as Array<{
    result: "win" | "loss" | "draw" | "no_contest";
    is_pro: boolean;
  }>) {
    if (r.result === "no_contest") continue;
    have[r.is_pro ? "pro" : "am"][r.result]++;
  }

  const today = new Date().toISOString().slice(0, 10);
  const user = await getSessionUser();
  const rows: Array<Record<string, unknown>> = [];
  let idx =
    ((existing ?? []) as unknown[]).length; // continue numbering past existing rows

  for (const tier of ["pro", "am"] as const) {
    for (const result of ["win", "loss", "draw"] as const) {
      const missing = Math.max(0, declared[tier][result] - have[tier][result]);
      for (let i = 0; i < missing; i++) {
        idx++;
        rows.push({
          fighter_id,
          opponent_name: `Undisclosed opponent #${idx}`,
          fight_date: today,
          result,
          is_pro: tier === "pro",
          sport: fighter.primary_sport,
          confidence: "reported",
          source_label: "Backfilled from declared record",
          submitted_by: user?.id ?? null,
          notes: "Placeholder backfilled from declared W-L-D — replace with sourced bout detail when known.",
        });
      }
    }
  }
  if (rows.length > 0) {
    const { error } = await db().from("fight_records").insert(rows);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/fighters/${fighter_id}`);
}

export async function updateFighterLicenses(formData: FormData) {
  const fighter_id = formData.get("fighter_id")?.toString();
  if (!fighter_id) throw new Error("fighter_id is required.");

  const raw = formData.get("licenses");
  const licenses =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;

  const { error } = await db()
    .from("fighters")
    .update({ licenses })
    .eq("id", fighter_id);

  if (error) throw new Error(error.message);

  revalidatePath(`/fighters/${fighter_id}`);
}
