"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { orNull, toNum as toNumericOrNull } from "@/lib/form-utils";
import type { Corner } from "@/lib/db/types";

function requireCorner(raw: FormDataEntryValue | null): Corner {
  if (raw === "red" || raw === "blue") return raw;
  throw new Error("corner must be red or blue");
}

async function upsertCheck(bout_id: string, corner: Corner, patch: Record<string, unknown>) {
  const supabase = db();
  const { data: existing } = await supabase
    .from("bout_fighter_checks")
    .select("id")
    .eq("bout_id", bout_id)
    .eq("corner", corner)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("bout_fighter_checks")
      .update(patch)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("bout_fighter_checks")
      .insert({ bout_id, corner, ...patch });
    if (error) throw new Error(error.message);
  }
}

function revalidate(event_id: string, bout_id: string) {
  revalidatePath(`/events/${event_id}/bouts/${bout_id}`);
  revalidatePath(`/events/${event_id}`);
  revalidatePath(`/events/${event_id}/weigh-ins`);
}

export async function toggleCheckIn(formData: FormData) {
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

export async function recordWeighIn(formData: FormData) {
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const corner = requireCorner(formData.get("corner"));
  const weigh_in_lbs = toNumericOrNull(formData.get("weigh_in_lbs"));
  const weigh_in_notes = orNull(formData.get("weigh_in_notes"));

  if (!bout_id || !event_id) throw new Error("bout is required.");
  if (weigh_in_lbs == null) throw new Error("Weight is required.");
  if (weigh_in_lbs <= 0 || weigh_in_lbs > 600) throw new Error("Weight looks wrong.");

  await upsertCheck(bout_id, corner, {
    weigh_in_lbs,
    weigh_in_at: new Date().toISOString(),
    weigh_in_notes,
  });
  revalidate(event_id, bout_id);
}

export async function clearWeighIn(formData: FormData) {
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const corner = requireCorner(formData.get("corner"));

  if (!bout_id || !event_id) throw new Error("bout is required.");

  await upsertCheck(bout_id, corner, {
    weigh_in_lbs: null,
    weigh_in_at: null,
    weigh_in_notes: null,
  });
  revalidate(event_id, bout_id);
}

export async function toggleMedicalClearance(formData: FormData) {
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
