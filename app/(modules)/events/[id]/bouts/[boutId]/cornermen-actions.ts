"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { CORNERMAN_ROLES, type CornermanRole } from "@/lib/db/types";

function str(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length ? t : null;
}

export async function addCornerman(formData: FormData) {
  const bout_id = str(formData.get("bout_id"));
  const event_id = str(formData.get("event_id"));
  const corner = str(formData.get("corner"));
  const name = str(formData.get("name"));
  const roleRaw = str(formData.get("role"));

  if (!bout_id || !event_id) throw new Error("Missing bout_id / event_id.");
  if (corner !== "red" && corner !== "blue") throw new Error("Invalid corner.");
  if (!name) throw new Error("Cornerman name is required.");

  const role: CornermanRole =
    (CORNERMAN_ROLES.find((r) => r.value === roleRaw)?.value as CornermanRole) ??
    "head_coach";

  const { error } = await db().from("bout_cornermen").insert({
    bout_id,
    corner,
    name,
    role,
    notes: str(formData.get("notes")),
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/events/${event_id}/bouts/${bout_id}`);
}

export async function deleteCornerman(formData: FormData) {
  const id = str(formData.get("id"));
  const bout_id = str(formData.get("bout_id"));
  const event_id = str(formData.get("event_id"));
  if (!id || !bout_id || !event_id) throw new Error("Missing fields.");

  const { error } = await db().from("bout_cornermen").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/events/${event_id}/bouts/${bout_id}`);
}
