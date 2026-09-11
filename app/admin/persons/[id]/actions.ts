"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { toInt, toNum } from "@/lib/form-utils";
import { feetInToCm, inToCm } from "@/lib/units";

// Admin variants of the /me actions. Same shape, but the target row id is
// carried in the FormData rather than looked up from the caller's session,
// and staff is the auth gate.

export async function adminUpdatePerson(fd: FormData) {
  await requireStaff();
  const id = fd.get("person_id")?.toString();
  if (!id) throw new Error("person_id is required.");

  const full_name = fd.get("full_name")?.toString().trim();
  if (!full_name) throw new Error("Full name is required.");

  const admin = createAdminClient();
  const payload = {
    full_name,
    email: fd.get("email")?.toString().trim() || null,
    phone: fd.get("phone")?.toString().trim() || null,
    hometown: fd.get("hometown")?.toString().trim() || null,
    nationality: fd.get("nationality")?.toString().trim() || null,
    date_of_birth: fd.get("date_of_birth")?.toString() || null,
    avatar_url: fd.get("avatar_url")?.toString().trim() || null,
    notes: fd.get("notes")?.toString().trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("persons").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  // Mirror name onto the linked profile so header/sidebar stays in sync.
  const { data: person } = await admin
    .from("persons")
    .select("auth_user_id")
    .eq("id", id)
    .maybeSingle<{ auth_user_id: string | null }>();
  if (person?.auth_user_id) {
    await admin
      .from("profiles")
      .update({
        full_name: payload.full_name,
        avatar_url: payload.avatar_url,
      })
      .eq("id", person.auth_user_id);
  }

  revalidatePath(`/admin/persons/${id}`);
  revalidatePath("/admin/persons");
}

export async function adminUpdateFighter(fd: FormData) {
  await requireStaff();
  const person_id = fd.get("person_id")?.toString();
  const fighter_id = fd.get("fighter_id")?.toString();
  if (!person_id || !fighter_id) {
    throw new Error("person_id and fighter_id are required.");
  }

  const admin = createAdminClient();
  const full_name = fd.get("full_name")?.toString().trim();
  const primary_sport = fd.get("primary_sport")?.toString().trim();
  if (!full_name || !primary_sport) {
    throw new Error("Full name and primary sport are required.");
  }

  const payload: Record<string, unknown> = {
    full_name,
    primary_sport,
    nickname: fd.get("nickname")?.toString().trim() || null,
    stance: fd.get("stance")?.toString() || null,
    weight_class: fd.get("weight_class")?.toString().trim() || null,
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
    date_of_birth: fd.get("date_of_birth")?.toString() || null,
    hometown: fd.get("hometown")?.toString().trim() || null,
    nationality: fd.get("nationality")?.toString().trim() || null,
    contact_email: fd.get("contact_email")?.toString().trim() || null,
    contact_phone: fd.get("contact_phone")?.toString().trim() || null,
    photo_url: fd.get("photo_url")?.toString().trim() || null,
    pro_wins: toInt(fd.get("pro_wins")) ?? 0,
    pro_losses: toInt(fd.get("pro_losses")) ?? 0,
    pro_draws: toInt(fd.get("pro_draws")) ?? 0,
    am_wins: toInt(fd.get("am_wins")) ?? 0,
    am_losses: toInt(fd.get("am_losses")) ?? 0,
    am_draws: toInt(fd.get("am_draws")) ?? 0,
    notes: fd.get("notes")?.toString().trim() || null,
  };

  const { error } = await admin
    .from("fighters")
    .update(payload)
    .eq("id", fighter_id)
    .eq("person_id", person_id);
  if (error) throw new Error(error.message);

  const ww = toInt(fd.get("walking_weight_lbs"));
  if (ww != null && ww >= 60 && ww <= 500) {
    await admin.from("fighter_weight_log").insert({
      fighter_id,
      weight_lbs: ww,
      source: "admin",
    });
  }

  revalidatePath(`/admin/persons/${person_id}`);
  revalidatePath(`/fighters/${fighter_id}`);
}

export async function adminUpdateOfficial(fd: FormData) {
  await requireStaff();
  const person_id = fd.get("person_id")?.toString();
  const official_id = fd.get("official_id")?.toString();
  if (!person_id || !official_id) {
    throw new Error("person_id and official_id are required.");
  }

  const full_name = fd.get("full_name")?.toString().trim();
  if (!full_name) throw new Error("Full name is required.");

  const admin = createAdminClient();
  const rawSports = fd.get("sports")?.toString().trim() ?? "";
  const rawCerts = fd.get("certifications")?.toString().trim() ?? "";
  const rawRoles = fd.get("roles")?.toString().trim() ?? "";

  const payload = {
    full_name,
    is_active: fd.get("is_active") === "on",
    home_state: fd.get("home_state")?.toString().trim() || null,
    contact_email: fd.get("contact_email")?.toString().trim() || null,
    contact_phone: fd.get("contact_phone")?.toString().trim() || null,
    photo_url: fd.get("photo_url")?.toString().trim() || null,
    notes: fd.get("notes")?.toString().trim() || null,
    sports: rawSports
      ? rawSports.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : [],
    certifications: rawCerts
      ? rawCerts.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    roles: rawRoles
      ? rawRoles.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : [],
  };

  const { error } = await admin
    .from("officials")
    .update(payload)
    .eq("id", official_id)
    .eq("person_id", person_id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/persons/${person_id}`);
  revalidatePath(`/officials/${official_id}`);
}
