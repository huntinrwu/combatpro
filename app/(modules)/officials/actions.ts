"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db, dbErr } from "@/lib/db/client";
import { orNull } from "@/lib/form-utils";
import { requireStaff } from "@/lib/auth/session";
import { OFFICIAL_ROLES, type OfficialRole } from "@/lib/db/types";

function getAllStrings(fd: FormData, key: string): string[] {
  return fd
    .getAll(key)
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function officialPayload(formData: FormData) {
  const full_name = formData.get("full_name")?.toString().trim();
  const roles = getAllStrings(formData, "roles").filter((r): r is OfficialRole =>
    (OFFICIAL_ROLES as string[]).includes(r),
  );
  if (!full_name || roles.length === 0) {
    throw new Error("Name and at least one role are required.");
  }
  return {
    full_name,
    roles,
    sports: getAllStrings(formData, "sports").map((s) => s.toLowerCase()),
    home_state: orNull(formData.get("home_state")),
    active_since: orNull(formData.get("active_since")),
    is_active: formData.get("is_active")?.toString() !== "false",
    photo_url: orNull(formData.get("photo_url")),
    contact_email: orNull(formData.get("contact_email")),
    contact_phone: orNull(formData.get("contact_phone")),
    certifications: getAllStrings(formData, "certifications"),
    notes: orNull(formData.get("notes")),
  };
}

export async function createOfficial(formData: FormData) {
  await requireStaff();
  const { data, error } = await db()
    .from("officials")
    .insert(officialPayload(formData))
    .select("id")
    .single();
  if (error) dbErr(error);
  revalidatePath("/officials");
  redirect(`/officials/${data!.id}`);
}

export async function updateOfficial(formData: FormData) {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing official id.");

  const { error } = await db()
    .from("officials")
    .update(officialPayload(formData))
    .eq("id", id);
  if (error) dbErr(error);

  revalidatePath(`/officials/${id}`);
  revalidatePath("/officials");
  redirect(`/officials/${id}`);
}

// ── Sanctioning-body links ────────────────────────────────────────────────

const VALID_SB_STATUSES = new Set(["active", "inactive", "suspended"]);

export async function linkOfficialToSanctioningBody(formData: FormData) {
  await requireStaff();
  const official_id = formData.get("official_id")?.toString();
  const sanctioning_body_id = formData.get("sanctioning_body_id")?.toString();
  if (!official_id || !sanctioning_body_id) {
    throw new Error("Official and sanctioning body are required.");
  }

  const rawStatus = formData.get("status")?.toString() ?? "active";
  const status = VALID_SB_STATUSES.has(rawStatus) ? rawStatus : "active";

  const payload = {
    official_id,
    sanctioning_body_id,
    status,
    level: orNull(formData.get("level")),
    certified_since: orNull(formData.get("certified_since")),
    expires_on: orNull(formData.get("expires_on")),
    notes: orNull(formData.get("notes")),
    updated_at: new Date().toISOString(),
  };

  const { error } = await db()
    .from("official_sanctioning_bodies")
    .upsert(payload, { onConflict: "official_id,sanctioning_body_id" });
  if (error) dbErr(error);

  revalidatePath(`/officials/${official_id}`);
  revalidatePath(`/sb/${sanctioning_body_id}`);
}

export async function unlinkOfficialFromSanctioningBody(formData: FormData) {
  await requireStaff();
  const id = formData.get("id")?.toString();
  const official_id = formData.get("official_id")?.toString();
  const sanctioning_body_id = formData.get("sanctioning_body_id")?.toString();
  if (!id || !official_id || !sanctioning_body_id) {
    throw new Error("Missing link id, official, or sanctioning body.");
  }

  // Constrain by the pair so a rogue id can only delete the intended row.
  const { error } = await db()
    .from("official_sanctioning_bodies")
    .delete()
    .eq("id", id)
    .eq("official_id", official_id)
    .eq("sanctioning_body_id", sanctioning_body_id);
  if (error) dbErr(error);

  revalidatePath(`/officials/${official_id}`);
  revalidatePath(`/sb/${sanctioning_body_id}`);
}
