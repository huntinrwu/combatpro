"use server";

import { revalidatePath } from "next/cache";

import { db, dbErr } from "@/lib/db/client";
import { idOrNull, orNull as str } from "@/lib/form-utils";
import { requireStaff } from "@/lib/auth/session";
import { COACH_ROLES } from "@/lib/db/types";

function refresh(gymId: string | null) {
  revalidatePath("/coaches");
  revalidatePath("/gyms");
  if (gymId) revalidatePath(`/gyms/${gymId}`);
}

// Staff-only: add a coach, optionally attached to a gym.
export async function addCoach(formData: FormData) {
  await requireStaff();
  const full_name = str(formData.get("full_name"));
  if (!full_name) throw new Error("Coach name is required.");
  const role = COACH_ROLES.find((r) => r.value === formData.get("role"))?.value ?? "head_coach";
  const gym_id = idOrNull(formData.get("gym_id"));

  const { error } = await db().from("coaches").insert({
    full_name,
    role,
    gym_id,
    contact_email: str(formData.get("contact_email")),
    contact_phone: str(formData.get("contact_phone")),
  });
  if (error) dbErr(error);
  refresh(gym_id);
}

// Staff-only: change a coach's role or gym.
export async function updateCoach(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing coach.");
  const role = COACH_ROLES.find((r) => r.value === formData.get("role"))?.value;
  if (!role) throw new Error("Pick a role.");
  const gym_id = idOrNull(formData.get("gym_id"));

  const { error } = await db().from("coaches").update({ role, gym_id }).eq("id", id);
  if (error) dbErr(error);
  refresh(gym_id);
  // The gym they left needs refreshing too.
  refresh(idOrNull(formData.get("previous_gym_id")));
}

// Staff-only, permanent.
export async function removeCoach(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing coach.");
  const { error } = await db().from("coaches").delete().eq("id", id);
  if (error) dbErr(error);
  refresh(idOrNull(formData.get("gym_id")));
}
