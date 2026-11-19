"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db, dbErr } from "@/lib/db/client";
import { idOrNull, toInt, toNum } from "@/lib/form-utils";
import { getSessionUser, requireStaff } from "@/lib/auth/session";
import { feetInToCm, inToCm } from "@/lib/units";

type DeclaredCounts = Record<"pro" | "am", Record<"win" | "loss" | "draw", number>>;

// Placeholder bout rows standing in for a fighter's declared W/L/D totals
// until sourced bout details are entered. Each row uses a unique opponent
// stub ("Undisclosed opponent #N", numbered from startIdx + 1) so the
// reconciliation clustering can't merge them into "disputed" from mixed
// results.
function placeholderFightRows(opts: {
  fighterId: string;
  sport: string | null;
  counts: DeclaredCounts;
  startIdx: number;
  userId: string | null;
  sourceLabel: string;
  notes: string;
}): Array<Record<string, unknown>> {
  const today = new Date().toISOString().slice(0, 10);
  const rows: Array<Record<string, unknown>> = [];
  let idx = opts.startIdx;
  for (const tier of ["pro", "am"] as const) {
    for (const result of ["win", "loss", "draw"] as const) {
      for (let i = 0; i < opts.counts[tier][result]; i++) {
        idx++;
        rows.push({
          fighter_id: opts.fighterId,
          opponent_name: `Undisclosed opponent #${idx}`,
          fight_date: today,
          result,
          is_pro: tier === "pro",
          sport: opts.sport,
          confidence: "reported",
          source_label: opts.sourceLabel,
          submitted_by: opts.userId,
          notes: opts.notes,
        });
      }
    }
  }
  return rows;
}

// Seed placeholder bout rows from the aggregate W/L/D counters typed on the
// fighter form. Called only on CREATE — reflects the fighter's declared
// career total in the fight_records ledger so the profile card isn't empty
// while sourced bout details are still being backfilled.
async function seedDeclaredFightRecords(
  fighterId: string,
  formData: FormData,
  userId: string | null,
) {
  const rows = placeholderFightRows({
    fighterId,
    sport: formData.get("primary_sport")?.toString().trim() || null,
    counts: {
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
    },
    startIdx: 0,
    userId,
    sourceLabel: "Declared on registration",
    notes: "Placeholder from initial fighter registration — replace with sourced bout detail when known.",
  });
  if (rows.length === 0) return;
  await db().from("fight_records").insert(rows);
}

// Walking weight is intentionally NOT stored directly on the fighter row via
// the form. It's a derived column maintained by the fighter_weight_log
// trigger. Route new readings through the log so history stays intact.
async function maybeLogWalkingWeight(
  fighterId: string,
  formData: FormData,
  userId: string | null,
) {
  const raw = formData.get("walking_weight_lbs")?.toString().trim();
  if (!raw) return;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 60 || n > 500) return;
  await db().from("fighter_weight_log").insert({
    fighter_id: fighterId,
    weight_lbs: n,
    source: "form",
    logged_by: userId,
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
    gym_id: idOrNull(formData.get("gym_id")),
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
  if (error) dbErr(error);
  const userId = (await getSessionUser())?.id ?? null;
  await Promise.all([
    maybeLogWalkingWeight(data.id, formData, userId),
    seedDeclaredFightRecords(data.id, formData, userId),
  ]);
  revalidatePath("/fighters");
  redirect(`/fighters/${data.id}`);
}

export async function updateFighter(formData: FormData) {
  const staff = await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing fighter id.");

  const { error } = await db()
    .from("fighters")
    .update(fighterPayload(formData))
    .eq("id", id);
  if (error) dbErr(error);
  await maybeLogWalkingWeight(id, formData, staff.id);

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
  const staff = await requireStaff();
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

  const existingRows = (existing ?? []) as Array<{
    result: "win" | "loss" | "draw" | "no_contest";
    is_pro: boolean;
  }>;
  const have: DeclaredCounts = {
    pro: { win: 0, loss: 0, draw: 0 },
    am: { win: 0, loss: 0, draw: 0 },
  };
  for (const r of existingRows) {
    if (r.result === "no_contest") continue;
    have[r.is_pro ? "pro" : "am"][r.result]++;
  }
  const missing = (declared: number, recorded: number) => Math.max(0, declared - recorded);

  const rows = placeholderFightRows({
    fighterId: fighter_id,
    sport: fighter.primary_sport,
    counts: {
      pro: {
        win: missing(fighter.pro_wins, have.pro.win),
        loss: missing(fighter.pro_losses, have.pro.loss),
        draw: missing(fighter.pro_draws, have.pro.draw),
      },
      am: {
        win: missing(fighter.am_wins, have.am.win),
        loss: missing(fighter.am_losses, have.am.loss),
        draw: missing(fighter.am_draws, have.am.draw),
      },
    },
    startIdx: existingRows.length, // continue numbering past existing rows
    userId: staff.id,
    sourceLabel: "Backfilled from declared record",
    notes: "Placeholder backfilled from declared W-L-D — replace with sourced bout detail when known.",
  });
  if (rows.length > 0) {
    const { error } = await supabase.from("fight_records").insert(rows);
    if (error) dbErr(error);
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

  if (error) dbErr(error);

  revalidatePath(`/fighters/${fighter_id}`);
}
