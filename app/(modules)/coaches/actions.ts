"use server";

import { revalidatePath } from "next/cache";

import { db, dbErr } from "@/lib/db/client";
import { personIdForFighter } from "@/lib/db/person-link";
import { idOrNull, orNull as str } from "@/lib/form-utils";
import { requireStaff } from "@/lib/auth/session";
import { COACH_ROLES, type CoachRole } from "@/lib/db/types";

function refresh(gymId: string | null) {
  revalidatePath("/coaches");
  revalidatePath("/gyms");
  revalidatePath("/fighters", "layout");
  if (gymId) {
    revalidatePath(`/gyms/${gymId}`);
    revalidatePath(`/gyms/${gymId}/edit`);
  }
}

// "none" (or anything unknown) means the person doesn't coach.
function parseRole(raw: FormDataEntryValue | null): CoachRole | null {
  return COACH_ROLES.find((r) => r.value === raw)?.value ?? null;
}

function requireSomeRole(role: CoachRole | null, isOwner: boolean) {
  if (!role && !isOwner) throw new Error("Pick a coaching role, tick Owner, or both.");
}

// The "also a fighter" picker: ties this coach/owner to the same person as
// that fighter. Returns undefined when the form has no picker (leave as is).
async function linkedPerson(formData: FormData): Promise<string | null | undefined> {
  if (!formData.has("fighter_id")) return undefined;
  const fighterId = idOrNull(formData.get("fighter_id"));
  return fighterId ? personIdForFighter(fighterId) : null;
}

// Staff-only: add a coach and/or owner, optionally attached to a gym.
export async function addCoach(formData: FormData) {
  await requireStaff();
  const full_name = str(formData.get("full_name"));
  if (!full_name) throw new Error("Name is required.");
  const role = parseRole(formData.get("role"));
  const is_owner = formData.get("is_owner") === "on";
  requireSomeRole(role, is_owner);
  const gym_id = idOrNull(formData.get("gym_id"));
  const person_id = await linkedPerson(formData);

  const { error } = await db().from("coaches").insert({
    full_name,
    role,
    is_owner,
    gym_id,
    person_id: person_id ?? null,
    contact_email: str(formData.get("contact_email")),
    contact_phone: str(formData.get("contact_phone")),
  });
  if (error) dbErr(error);
  refresh(gym_id);
}

// Staff-only: edit a person. The form always sends name, role, owner, email
// and phone; the gym and the fighter link only change when the form includes
// those pickers.
export async function updateCoach(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing person.");
  const full_name = str(formData.get("full_name"));
  if (!full_name) throw new Error("Name is required.");
  const role = parseRole(formData.get("role"));
  const is_owner = formData.get("is_owner") === "on";
  requireSomeRole(role, is_owner);

  const gym_id = idOrNull(formData.get("gym_id"));
  const person_id = await linkedPerson(formData);
  const { error } = await db()
    .from("coaches")
    .update({
      full_name,
      role,
      is_owner,
      contact_email: str(formData.get("contact_email")),
      contact_phone: str(formData.get("contact_phone")),
      ...(formData.has("gym_id") ? { gym_id } : {}),
      ...(person_id !== undefined ? { person_id } : {}),
    })
    .eq("id", id);
  if (error) dbErr(error);
  refresh(gym_id);
}

// Staff-only, permanent.
export async function removeCoach(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing person.");
  const { error } = await db().from("coaches").delete().eq("id", id);
  if (error) dbErr(error);
  refresh(idOrNull(formData.get("gym_id")));
}
