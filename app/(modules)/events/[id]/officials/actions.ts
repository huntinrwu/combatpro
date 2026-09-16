"use server";

import { revalidatePath } from "next/cache";

import { db, dbErr } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import { EVENT_ROLES, type EventRole } from "@/lib/db/types";

export async function assignEventOfficial(formData: FormData) {
  await requireStaff();
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

  if (error) dbErr(error);

  revalidatePath(`/events/${event_id}/officials`);
  revalidatePath(`/events/${event_id}`);
}

export async function unassignEventOfficial(formData: FormData) {
  await requireStaff();
  const assignment_id = formData.get("assignment_id")?.toString();
  const event_id = formData.get("event_id")?.toString();

  if (!assignment_id || !event_id) throw new Error("Missing fields.");

  // Scope by event so a rogue assignment id can only unassign within this event.
  const { error } = await db()
    .from("event_officials")
    .delete()
    .eq("id", assignment_id)
    .eq("event_id", event_id);

  if (error) dbErr(error);

  revalidatePath(`/events/${event_id}/officials`);
  revalidatePath(`/events/${event_id}`);
}
