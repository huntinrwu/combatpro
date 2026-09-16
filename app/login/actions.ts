"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type LoginResult = { ok: true } | { ok: false; error: string };

// Same-origin path only: must start with a single "/", must not start with "//"
// or "/\" (protocol-relative), must not embed a scheme.
function safeNext(raw: string | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

export async function loginAction(_prev: LoginResult, fd: FormData): Promise<LoginResult> {
  const email = fd.get("email")?.toString().trim().toLowerCase();
  const password = fd.get("password")?.toString();
  const next = safeNext(fd.get("next")?.toString());

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("[login]", error.message);
    return { ok: false, error: "Invalid email or password." };
  }

  redirect(next);
}
