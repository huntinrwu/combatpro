"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { orNull as str } from "@/lib/form-utils";
import { requireStaff } from "@/lib/auth/session";

function splitList(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Public: anyone can propose a body — lands in `pending` for staff review.
export async function submitSanctioningBody(formData: FormData) {
  const name = str(formData.get("name"));
  const abbreviation = str(formData.get("abbreviation"));
  const scope = str(formData.get("scope"));
  const sports = splitList(formData.get("sports"));
  const headquarters = str(formData.get("headquarters"));
  const website = str(formData.get("website"));
  const contact_email = str(formData.get("contact_email"));
  const submitted_by_email = str(formData.get("submitted_by_email"));
  const notes = str(formData.get("notes"));

  if (!name || !abbreviation || !scope || sports.length === 0) {
    throw new Error("Name, abbreviation, scope, and at least one sport are required.");
  }

  const { error } = await db()
    .from("sanctioning_bodies")
    .insert({
      name,
      abbreviation,
      sports,
      scope,
      headquarters,
      website,
      contact_email,
      submitted_by_email,
      notes,
      status: "pending",
      submitted_at: new Date().toISOString(),
    });

  if (error) throw new Error(error.message);

  revalidatePath("/registry");
  redirect("/registry?submitted=1");
}

// ── Staff-only: commissions ────────────────────────────────────────────────

function commissionPayload(formData: FormData) {
  const name = str(formData.get("name"));
  const abbreviation = str(formData.get("abbreviation"));
  const jurisdiction = str(formData.get("jurisdiction"));
  if (!name || !abbreviation || !jurisdiction) {
    throw new Error("Name, abbreviation, and jurisdiction are required.");
  }
  return {
    name,
    abbreviation,
    jurisdiction,
    country: str(formData.get("country")) ?? "US",
    state: str(formData.get("state")),
    website: str(formData.get("website")),
    logo_url: str(formData.get("logo_url")),
    notes: str(formData.get("notes")),
  };
}

export async function createCommission(formData: FormData) {
  await requireStaff();
  const { data, error } = await db()
    .from("commissions")
    .insert(commissionPayload(formData))
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/registry");
  redirect(`/registry/commissions/${data.id}`);
}

export async function updateCommission(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing commission id.");
  const { error } = await db()
    .from("commissions")
    .update(commissionPayload(formData))
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/registry");
  revalidatePath(`/registry/commissions/${id}`);
  redirect(`/registry/commissions/${id}`);
}

// ── Staff-only: sanctioning bodies (edit + approve/reject) ─────────────────

function bodyPayload(formData: FormData) {
  const name = str(formData.get("name"));
  const abbreviation = str(formData.get("abbreviation"));
  const scope = str(formData.get("scope"));
  const sports = splitList(formData.get("sports"));
  if (!name || !abbreviation || !scope || sports.length === 0) {
    throw new Error("Name, abbreviation, scope, and at least one sport are required.");
  }
  return {
    name,
    abbreviation,
    scope,
    sports,
    headquarters: str(formData.get("headquarters")),
    website: str(formData.get("website")),
    contact_email: str(formData.get("contact_email")),
    logo_url: str(formData.get("logo_url")),
    notes: str(formData.get("notes")),
  };
}

export async function updateSanctioningBody(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing sanctioning body id.");
  const { error } = await db()
    .from("sanctioning_bodies")
    .update(bodyPayload(formData))
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/registry");
  revalidatePath(`/sb/${id}`);
  redirect(`/sb/${id}`);
}

export async function setSanctioningBodyStatus(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  const status = str(formData.get("status"));
  if (!id || !status || !["approved", "pending", "rejected"].includes(status)) {
    throw new Error("Bad payload.");
  }
  const { error } = await db()
    .from("sanctioning_bodies")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/registry");
  revalidatePath(`/sb/${id}`);
}
