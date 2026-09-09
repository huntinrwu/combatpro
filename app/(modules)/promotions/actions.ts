"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { orNull as str, toInt } from "@/lib/form-utils";
import { requireStaff, requireUser } from "@/lib/auth/session";
import { PROMOTION_SCOPES, type PromotionScope, type PromotionStatus } from "@/lib/db/types";

function splitList(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function scopeOr(raw: FormDataEntryValue | null, fallback: PromotionScope): PromotionScope {
  if (typeof raw !== "string") return fallback;
  const v = raw.trim().toLowerCase();
  return (PROMOTION_SCOPES as readonly string[]).includes(v) ? (v as PromotionScope) : fallback;
}

function basePayload(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) throw new Error("Promotion name is required.");
  return {
    name,
    abbreviation: str(formData.get("abbreviation")),
    scope: scopeOr(formData.get("scope"), "local"),
    sports: splitList(formData.get("sports")),
    home_state: str(formData.get("home_state")),
    country: str(formData.get("country")) ?? "US",
    city: str(formData.get("city")),
    website: str(formData.get("website")),
    contact_name: str(formData.get("contact_name")),
    contact_email: str(formData.get("contact_email")),
    contact_phone: str(formData.get("contact_phone")),
    founded_year: toInt(formData.get("founded_year")),
    logo_url: str(formData.get("logo_url")),
    notes: str(formData.get("notes")),
  };
}

// Staff-only create — lands as 'approved' directly.
export async function createPromotion(formData: FormData) {
  await requireStaff();
  const { data, error } = await db()
    .from("promotions")
    .insert({ ...basePayload(formData), status: "approved" as PromotionStatus })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/promotions");
  redirect(`/promotions/${data.id}`);
}

// Any signed-in user can submit a new promotion — lands as 'pending' for
// staff review. Mirrors submitSanctioningBody.
export async function submitPromotion(formData: FormData) {
  const user = await requireUser();
  const payload = basePayload(formData);
  const { error } = await db()
    .from("promotions")
    .insert({
      ...payload,
      status: "pending" as PromotionStatus,
      submitted_by: user.id,
      submitted_by_email: user.email,
      submitted_at: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
  revalidatePath("/promotions");
  redirect("/promotions?submitted=1");
}

export async function updatePromotion(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing promotion id.");
  const { error } = await db()
    .from("promotions")
    .update(basePayload(formData))
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/promotions");
  revalidatePath(`/promotions/${id}`);
  redirect(`/promotions/${id}`);
}

export async function setPromotionStatus(formData: FormData) {
  const staff = await requireStaff();
  const id = str(formData.get("id"));
  const status = str(formData.get("status"));
  if (!id || !status || !["approved", "pending", "rejected"].includes(status)) {
    throw new Error("Bad payload.");
  }
  const { error } = await db()
    .from("promotions")
    .update({
      status,
      reviewed_by: staff.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/promotions");
  revalidatePath(`/promotions/${id}`);
}

