"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function loginAction(_prev: LoginResult, fd: FormData): Promise<LoginResult> {
  const email = fd.get("email")?.toString().trim().toLowerCase();
  const password = fd.get("password")?.toString();
  const next = fd.get("next")?.toString() || "/";

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: error.message };
  }

  redirect(next);
}
