"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { orNull } from "@/lib/form-utils";
import { requireStaff } from "@/lib/auth/session";
import { OFFICIAL_ROLES, type OfficialRole } from "@/lib/db/types";

function requireRole(raw: FormDataEntryValue | null): OfficialRole {
  const v = typeof raw === "string" ? raw.trim() : "";
  if ((OFFICIAL_ROLES as string[]).includes(v)) return v as OfficialRole;
  throw new Error("Role must be one of: " + OFFICIAL_ROLES.join(", "));
}

export async function addPriorEvent(formData: FormData) {
  await requireStaff();
  const official_id = formData.get("official_id")?.toString();
  const event_date = formData.get("event_date")?.toString();
  const event_name = formData.get("event_name")?.toString().trim();
  if (!official_id || !event_date || !event_name) {
    throw new Error("Official, date, and event name are required.");
  }

  const role = requireRole(formData.get("role"));

  const { error } = await db().from("official_prior_events").insert({
    official_id,
    event_date,
    event_name,
    role,
    sanctioning_body: orNull(formData.get("sanctioning_body")),
    venue: orNull(formData.get("venue")),
    city: orNull(formData.get("city")),
    state: orNull(formData.get("state")),
    notes: orNull(formData.get("notes")),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/officials/${official_id}`);
}

export async function deletePriorEvent(formData: FormData) {
  await requireStaff();
  const id = formData.get("id")?.toString();
  const official_id = formData.get("official_id")?.toString();
  if (!id || !official_id) throw new Error("id + official are required.");

  const { error } = await db().from("official_prior_events").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/officials/${official_id}`);
}
