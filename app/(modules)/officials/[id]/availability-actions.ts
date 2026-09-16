"use server";

import { revalidatePath } from "next/cache";

import { db, dbErr } from "@/lib/db/client";
import { orNull } from "@/lib/form-utils";
import { requireStaff } from "@/lib/auth/session";
import type { AvailabilityStatus } from "@/lib/db/types";

function requireStatus(raw: FormDataEntryValue | null): AvailabilityStatus {
  if (raw === "unavailable" || raw === "tentative") return raw;
  throw new Error("status must be 'unavailable' or 'tentative'");
}

export async function upsertBlock(formData: FormData) {
  await requireStaff();
  const official_id = formData.get("official_id")?.toString();
  const block_date = formData.get("block_date")?.toString();
  if (!official_id || !block_date) throw new Error("official + date are required.");

  const status = requireStatus(formData.get("status") ?? "unavailable");
  const notes = orNull(formData.get("notes"));

  const supabase = db();
  const { data: existing } = await supabase
    .from("official_availability")
    .select("id")
    .eq("official_id", official_id)
    .eq("block_date", block_date)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("official_availability")
      .update({ status, notes })
      .eq("id", existing.id);
    if (error) dbErr(error);
  } else {
    const { error } = await supabase.from("official_availability").insert({
      official_id,
      block_date,
      status,
      notes,
    });
    if (error) dbErr(error);
  }

  revalidatePath(`/officials/${official_id}`);
}

export async function deleteBlock(formData: FormData) {
  await requireStaff();
  const id = formData.get("id")?.toString();
  const official_id = formData.get("official_id")?.toString();
  if (!id || !official_id) throw new Error("block id + official are required.");

  // Scope by official so a rogue id can only delete a block on this official.
  const { error } = await db()
    .from("official_availability")
    .delete()
    .eq("id", id)
    .eq("official_id", official_id);
  if (error) dbErr(error);

  revalidatePath(`/officials/${official_id}`);
}
