"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { orNull } from "@/lib/form-utils";
import type { AvailabilityStatus } from "@/lib/db/types";

function requireStatus(raw: FormDataEntryValue | null): AvailabilityStatus {
  if (raw === "unavailable" || raw === "tentative") return raw;
  throw new Error("status must be 'unavailable' or 'tentative'");
}

export async function upsertBlock(formData: FormData) {
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
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("official_availability").insert({
      official_id,
      block_date,
      status,
      notes,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/officials/${official_id}`);
}

export async function deleteBlock(formData: FormData) {
  const id = formData.get("id")?.toString();
  const official_id = formData.get("official_id")?.toString();
  if (!id || !official_id) throw new Error("block id + official are required.");

  const { error } = await db().from("official_availability").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/officials/${official_id}`);
}
