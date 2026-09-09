"use server";

import { redirect } from "next/navigation";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PLATFORM_ROLES, ROLES_REQUIRING_GYM, type PlatformRole } from "@/lib/auth/roles";

type SignupResult =
  | { ok: true }
  | { ok: false; error: string };

function readRoles(fd: FormData): PlatformRole[] {
  const raw = fd.getAll("roles").map((r) => r.toString());
  const valid = new Set<PlatformRole>(PLATFORM_ROLES);
  return raw.filter((r): r is PlatformRole => valid.has(r as PlatformRole));
}

export async function signupAction(_prev: SignupResult, fd: FormData): Promise<SignupResult> {
  const email = fd.get("email")?.toString().trim().toLowerCase();
  const password = fd.get("password")?.toString();
  const fullName = fd.get("full_name")?.toString().trim();
  const roles = readRoles(fd);

  if (!email || !password || !fullName) {
    return { ok: false, error: "Name, email, and password are all required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (roles.length === 0) {
    return { ok: false, error: "Pick at least one role you want to sign up as." };
  }

  const needsGym = roles.some((r) => ROLES_REQUIRING_GYM.includes(r));
  let gymIdForGrants: string | null = null;

  const supabase = await createClient();
  const admin = createAdminClient();

  if (needsGym) {
    const gymChoice = fd.get("gym_choice")?.toString(); // existing id or "__new__"
    if (!gymChoice) {
      return { ok: false, error: "Coach and gym owner roles require a gym selection." };
    }
    if (gymChoice === "__new__") {
      const name = fd.get("new_gym_name")?.toString().trim();
      const city = fd.get("new_gym_city")?.toString().trim() || null;
      const state = fd.get("new_gym_state")?.toString().trim().toUpperCase() || null;
      if (!name) {
        return { ok: false, error: "New gym name is required." };
      }
      const { data: newGym, error: gymErr } = await admin
        .from("gyms")
        .insert({ name, city, state, approval_status: "pending" })
        .select("id")
        .single<{ id: string }>();
      if (gymErr || !newGym) {
        return { ok: false, error: gymErr?.message ?? "Failed to submit gym." };
      }
      gymIdForGrants = newGym.id;
    } else {
      gymIdForGrants = gymChoice;
    }
  }

  const { data: signupData, error: signupErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (signupErr) {
    return { ok: false, error: signupErr.message };
  }
  const userId = signupData.user?.id;
  if (!userId) {
    return { ok: false, error: "Signup succeeded but no user returned." };
  }

  // Attach submitted_by to the new gym if we created one — couldn't do it
  // before the auth user existed.
  if (gymIdForGrants) {
    const gymChoice = fd.get("gym_choice")?.toString();
    if (gymChoice === "__new__") {
      await admin.from("gyms").update({ submitted_by: userId }).eq("id", gymIdForGrants);
    }
  }

  const grantRows = roles.map((role) => ({
    user_id: userId,
    role,
    status: "pending" as const,
    gym_id: ROLES_REQUIRING_GYM.includes(role) ? gymIdForGrants : null,
  }));
  const { error: grantErr } = await admin
    .from("user_role_grants")
    .insert(grantRows);
  if (grantErr) {
    return { ok: false, error: grantErr.message };
  }

  redirect("/pending");
}
