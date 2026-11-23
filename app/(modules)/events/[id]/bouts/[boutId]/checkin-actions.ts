"use server";

import { revalidatePath } from "next/cache";

import { db, dbErr } from "@/lib/db/client";
import { orNull, requireCorner, toNum as toNumericOrNull } from "@/lib/form-utils";
import { requireStaff } from "@/lib/auth/session";
import type { Corner } from "@/lib/db/types";
import { setRosterWeighIn, type WeighInPatch } from "@/lib/db/roster-weigh-in";

// One row per (bout, corner) — unique constraint makes this a single upsert.
// Only the patched columns are written on conflict.
async function upsertCheck(bout_id: string, corner: Corner, patch: Record<string, unknown>) {
  const { error } = await db()
    .from("bout_fighter_checks")
    .upsert({ bout_id, corner, ...patch }, { onConflict: "bout_id,corner" });
  if (error) dbErr(error);
}

function revalidate(event_id: string, bout_id: string) {
  revalidatePath(`/events/${event_id}/bouts/${bout_id}`);
  revalidatePath(`/events/${event_id}`);
  revalidatePath(`/events/${event_id}/weigh-ins`);
}

export async function toggleCheckIn(formData: FormData) {
  await requireStaff();
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const corner = requireCorner(formData.get("corner"));
  const currentlyIn = formData.get("currently_checked_in")?.toString() === "1";

  if (!bout_id || !event_id) throw new Error("bout is required.");

  await upsertCheck(bout_id, corner, {
    checked_in_at: currentlyIn ? null : new Date().toISOString(),
  });
  revalidate(event_id, bout_id);
}

// A weigh-in entered on a bout belongs to the fighter for the whole event:
// it goes on their roster entry (which copies it to all their bouts). The
// bout's own row is still written for a fighter who isn't on the roster.
async function saveWeighIn(bout_id: string, corner: Corner, patch: WeighInPatch) {
  const { data: bout } = await db()
    .from("bouts")
    .select("event_id, red_corner_fighter_id, blue_corner_fighter_id")
    .eq("id", bout_id)
    .maybeSingle<{
      event_id: string;
      red_corner_fighter_id: string | null;
      blue_corner_fighter_id: string | null;
    }>();
  const fighterId =
    corner === "red" ? bout?.red_corner_fighter_id : bout?.blue_corner_fighter_id;
  const onRoster =
    bout && fighterId ? await setRosterWeighIn(bout.event_id, fighterId, patch) : false;
  if (!onRoster) await upsertCheck(bout_id, corner, patch);
}

export async function recordWeighIn(formData: FormData) {
  await requireStaff();
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const corner = requireCorner(formData.get("corner"));
  const weigh_in_lbs = toNumericOrNull(formData.get("weigh_in_lbs"));
  const weigh_in_notes = orNull(formData.get("weigh_in_notes"));

  if (!bout_id || !event_id) throw new Error("bout is required.");
  if (weigh_in_lbs == null) throw new Error("Weight is required.");
  if (weigh_in_lbs <= 0 || weigh_in_lbs > 600) throw new Error("Weight looks wrong.");

  await saveWeighIn(bout_id, corner, {
    weigh_in_lbs,
    weigh_in_at: new Date().toISOString(),
    weigh_in_notes,
  });
  revalidate(event_id, bout_id);
}

export async function clearWeighIn(formData: FormData) {
  await requireStaff();
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const corner = requireCorner(formData.get("corner"));

  if (!bout_id || !event_id) throw new Error("bout is required.");

  await saveWeighIn(bout_id, corner, {
    weigh_in_lbs: null,
    weigh_in_at: null,
    weigh_in_notes: null,
  });
  revalidate(event_id, bout_id);
}

export async function toggleMedicalClearance(formData: FormData) {
  await requireStaff();
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const corner = requireCorner(formData.get("corner"));
  const currentlyCleared = formData.get("currently_cleared")?.toString() === "1";
  const medical_notes = orNull(formData.get("medical_notes"));

  if (!bout_id || !event_id) throw new Error("bout is required.");

  await upsertCheck(bout_id, corner, {
    medical_cleared_at: currentlyCleared ? null : new Date().toISOString(),
    medical_notes: currentlyCleared ? null : medical_notes,
  });
  revalidate(event_id, bout_id);
}

export async function toggleClearedToFight(formData: FormData) {
  await requireStaff();
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const corner = requireCorner(formData.get("corner"));
  const currentlyCleared = formData.get("currently_cleared")?.toString() === "1";
  const override_reason = orNull(formData.get("override_reason"));

  if (!bout_id || !event_id) throw new Error("bout is required.");

  await upsertCheck(bout_id, corner, {
    cleared_to_fight: !currentlyCleared,
    cleared_to_fight_at: currentlyCleared ? null : new Date().toISOString(),
    override_reason: currentlyCleared ? null : override_reason,
  });
  revalidate(event_id, bout_id);
}
