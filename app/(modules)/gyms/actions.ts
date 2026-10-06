"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db, dbErr } from "@/lib/db/client";
import { orNull as str } from "@/lib/form-utils";
import { requireStaff } from "@/lib/auth/session";

// Shared by create + update. Name is the only required field.
function gymPayload(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) throw new Error("Gym name is required.");
  return {
    name,
    city: str(formData.get("city")),
    state: str(formData.get("state")),
    country: str(formData.get("country")),
    head_coach: str(formData.get("head_coach")),
    contact_email: str(formData.get("contact_email")),
    contact_phone: str(formData.get("contact_phone")),
    website: str(formData.get("website")),
    logo_url: str(formData.get("logo_url")),
    notes: str(formData.get("notes")),
  };
}

export async function createGym(formData: FormData) {
  const payload = gymPayload(formData);

  const { data, error } = await db().from("gyms").insert(payload).select("id").single();
  if (error) dbErr(error);

  revalidatePath("/gyms");
  redirect(`/gyms/${data.id}`);
}

export async function updateGym(formData: FormData) {
  await requireStaff();

  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing gym id.");

  const payload = gymPayload(formData);

  const { error } = await db().from("gyms").update(payload).eq("id", id);
  if (error) dbErr(error);

  revalidatePath(`/gyms/${id}`);
  revalidatePath("/gyms");
  redirect(`/gyms/${id}`);
}

export async function assignFighterGym(formData: FormData) {
  const fighter_id = str(formData.get("fighter_id"));
  if (!fighter_id) throw new Error("Missing fighter_id.");

  const gym_id_raw = str(formData.get("gym_id"));
  const gym_id = gym_id_raw && gym_id_raw !== "__none__" ? gym_id_raw : null;

  const { error } = await db()
    .from("fighters")
    .update({ gym_id })
    .eq("id", fighter_id);

  if (error) dbErr(error);

  revalidatePath(`/fighters/${fighter_id}`);
  revalidatePath("/fighters");
  revalidatePath("/gyms");
}
