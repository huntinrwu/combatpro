"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { EVENT_ROLES, type EventRole } from "@/lib/db/types";

export async function assignEventOfficial(formData: FormData) {
  const event_id = formData.get("event_id")?.toString();
  const official_id = formData.get("official_id")?.toString();
  const roleRaw = formData.get("event_role")?.toString();

  if (!event_id || !official_id || !roleRaw) {
    throw new Error("event, official, and role are required.");
  }

  const event_role = EVENT_ROLES.find((r) => r === roleRaw) as EventRole | undefined;
  if (!event_role) throw new Error("Invalid event role.");

  const { error } = await db().from("event_officials").insert({
    event_id,
    official_id,
    event_role,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/events/${event_id}/officials`);
  revalidatePath(`/events/${event_id}`);
}

export async function unassignEventOfficial(formData: FormData) {
  const assignment_id = formData.get("assignment_id")?.toString();
  const event_id = formData.get("event_id")?.toString();

  if (!assignment_id || !event_id) throw new Error("Missing fields.");

  const { error } = await db()
    .from("event_officials")
    .delete()
    .eq("id", assignment_id);

  if (error) throw new Error(error.message);

  revalidatePath(`/events/${event_id}/officials`);
  revalidatePath(`/events/${event_id}`);
}
