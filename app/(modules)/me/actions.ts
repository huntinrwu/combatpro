"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/server";
import { dbErr } from "@/lib/db/client";
import { requireUser } from "@/lib/auth/session";
import { idOrNull, orNull, splitList, toInt, toNum } from "@/lib/form-utils";
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
  const { userId, personId } = await requirePersonId();
  const admin = createAdminClient();

  const full_name = orNull(fd.get("full_name"));
  if (!full_name) throw new Error("Full name is required.");

  const payload = {
    full_name,
    email: orNull(fd.get("email")),
    phone: orNull(fd.get("phone")),
    hometown: orNull(fd.get("hometown")),
    nationality: orNull(fd.get("nationality")),
    date_of_birth: orNull(fd.get("date_of_birth")),
    avatar_url: orNull(fd.get("avatar_url")),
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("persons")
    .update(payload)
    .eq("id", personId);
  if (error) dbErr(error);

  // Mirror name/avatar onto the profile so header widgets stay in sync.
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

  const heightCm = feetInToCm(toNum(fd.get("height_ft")), toNum(fd.get("height_in")));
  const reachCm = inToCm(toNum(fd.get("reach_in")));
  const payload = {
    nickname: orNull(fd.get("nickname")),
    stance: orNull(fd.get("stance")),
    weight_class: orNull(fd.get("weight_class")),
    // undefined is dropped from the request, so an empty field leaves the
    // NOT NULL column untouched instead of clearing it.
    primary_sport: orNull(fd.get("primary_sport")) ?? undefined,
    gym_id: idOrNull(fd.get("gym_id")),
    height_cm: heightCm == null ? null : Math.round(heightCm),
    reach_cm: reachCm == null ? null : Math.round(reachCm),
    contact_email: orNull(fd.get("contact_email")),
    contact_phone: orNull(fd.get("contact_phone")),
    photo_url: orNull(fd.get("photo_url")),
    hometown: orNull(fd.get("hometown")),
    nationality: orNull(fd.get("nationality")),
  };

  const { error } = await admin
    .from("fighters")
    .update(payload)
    .eq("id", fighter.id);
  if (error) dbErr(error);

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

  const payload = {
    is_active: fd.get("is_active") === "on",
    home_state: orNull(fd.get("home_state")),
    contact_email: orNull(fd.get("contact_email")),
    contact_phone: orNull(fd.get("contact_phone")),
    photo_url: orNull(fd.get("photo_url")),
    sports: splitList(fd.get("sports")),
    // Not splitList: certification names keep their casing.
    certifications: (orNull(fd.get("certifications")) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };

  const { error } = await admin
    .from("officials")
    .update(payload)
    .eq("id", official.id);
  if (error) dbErr(error);

  revalidatePath("/me");
  revalidatePath(`/officials/${official.id}`);
}
