"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { toInt, toNum } from "@/lib/form-utils";
import { feetInToCm, inToCm } from "@/lib/units";

// All /me actions authorize via the caller's session personId. A user can
// only mutate person / fighter / official rows that share their person_id.
// We use the admin (service-role) client because RLS on persons is
// staff-only-manageable, but the caller-scoped where clauses keep users
// contained to their own rows.

async function requirePersonId(): Promise<{ userId: string; personId: string }> {
  const user = await requireUser();
  if (!user.personId) {
    throw new Error("Your account isn't linked to a person yet. Contact staff.");
  }
  return { userId: user.id, personId: user.personId };
}

export async function updateMyPerson(fd: FormData) {
  const { personId } = await requirePersonId();
  const admin = createAdminClient();

  const full_name = fd.get("full_name")?.toString().trim();
  if (!full_name) throw new Error("Full name is required.");

  const payload = {
    full_name,
    email: fd.get("email")?.toString().trim() || null,
    phone: fd.get("phone")?.toString().trim() || null,
    hometown: fd.get("hometown")?.toString().trim() || null,
    nationality: fd.get("nationality")?.toString().trim() || null,
    date_of_birth: fd.get("date_of_birth")?.toString() || null,
    avatar_url: fd.get("avatar_url")?.toString().trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("persons")
    .update(payload)
    .eq("id", personId);
  if (error) throw new Error(error.message);

  // Mirror name/avatar onto the profile so header widgets stay in sync.
  const { userId } = await requirePersonId();
  await admin
    .from("profiles")
    .update({
      full_name: payload.full_name,
      avatar_url: payload.avatar_url,
    })
    .eq("id", userId);

  revalidatePath("/me");
  revalidatePath("/");
}

export async function updateMyFighter(fd: FormData) {
  const { personId } = await requirePersonId();
  const admin = createAdminClient();

  const { data: fighter } = await admin
    .from("fighters")
    .select("id")
    .eq("person_id", personId)
    .maybeSingle<{ id: string }>();
  if (!fighter) throw new Error("No fighter record linked to your account.");

  const payload: Record<string, unknown> = {
    nickname: fd.get("nickname")?.toString().trim() || null,
    stance: fd.get("stance")?.toString() || null,
    weight_class: fd.get("weight_class")?.toString().trim() || null,
    primary_sport: fd.get("primary_sport")?.toString().trim() || undefined,
    gym_id: (() => {
      const v = fd.get("gym_id")?.toString().trim();
      return v && v !== "__none__" ? v : null;
    })(),
    height_cm: (() => {
      const cm = feetInToCm(toNum(fd.get("height_ft")), toNum(fd.get("height_in")));
      return cm == null ? null : Math.round(cm);
    })(),
    reach_cm: (() => {
      const cm = inToCm(toNum(fd.get("reach_in")));
      return cm == null ? null : Math.round(cm);
    })(),
    contact_email: fd.get("contact_email")?.toString().trim() || null,
    contact_phone: fd.get("contact_phone")?.toString().trim() || null,
    photo_url: fd.get("photo_url")?.toString().trim() || null,
    hometown: fd.get("hometown")?.toString().trim() || null,
    nationality: fd.get("nationality")?.toString().trim() || null,
  };
  // Drop primary_sport if the form field was empty — server would otherwise
  // clear a NOT NULL column.
  if (!payload.primary_sport) delete payload.primary_sport;

  const { error } = await admin
    .from("fighters")
    .update(payload)
    .eq("id", fighter.id);
  if (error) throw new Error(error.message);

  // Log walking weight as a fresh reading if provided.
  const ww = toInt(fd.get("walking_weight_lbs"));
  if (ww != null && ww >= 60 && ww <= 500) {
    await admin.from("fighter_weight_log").insert({
      fighter_id: fighter.id,
      weight_lbs: ww,
      source: "self",
    });
  }

  revalidatePath("/me");
  revalidatePath(`/fighters/${fighter.id}`);
}

export async function updateMyOfficial(fd: FormData) {
  const { personId } = await requirePersonId();
  const admin = createAdminClient();

  const { data: official } = await admin
    .from("officials")
    .select("id")
    .eq("person_id", personId)
    .maybeSingle<{ id: string }>();
  if (!official) throw new Error("No official record linked to your account.");

  const rawSports = fd.get("sports")?.toString().trim() ?? "";
  const rawCerts = fd.get("certifications")?.toString().trim() ?? "";

  const payload = {
    is_active: fd.get("is_active") === "on",
    home_state: fd.get("home_state")?.toString().trim() || null,
    contact_email: fd.get("contact_email")?.toString().trim() || null,
    contact_phone: fd.get("contact_phone")?.toString().trim() || null,
    photo_url: fd.get("photo_url")?.toString().trim() || null,
    sports: rawSports
      ? rawSports.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : [],
    certifications: rawCerts
      ? rawCerts.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
  };

  const { error } = await admin
    .from("officials")
    .update(payload)
    .eq("id", official.id);
  if (error) throw new Error(error.message);

  revalidatePath("/me");
  revalidatePath(`/officials/${official.id}`);
}
