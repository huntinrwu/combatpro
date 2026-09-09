"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";

function str(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length ? t : null;
}

export async function createGym(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) throw new Error("Gym name is required.");

  const payload = {
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

  const { data, error } = await db().from("gyms").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  revalidatePath("/gyms");
  redirect(`/gyms/${data.id}`);
}

export async function updateGym(formData: FormData) {
  await requireStaff();

  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing gym id.");

  const name = str(formData.get("name"));
  if (!name) throw new Error("Gym name is required.");

  const payload = {
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

  const { error } = await db().from("gyms").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

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

  if (error) throw new Error(error.message);

  revalidatePath(`/fighters/${fighter_id}`);
  revalidatePath("/fighters");
  revalidatePath("/gyms");
}
