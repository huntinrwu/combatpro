import { redirect } from "next/navigation";

import { SignupForm } from "./_components/signup-form";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth-shell";

export default async function SignupPage() {
  const [user, { data: gyms }] = await Promise.all([
    getSessionUser(),
    createAdminClient()
      .from("gyms")
      .select("id, name, city, state")
      .eq("approval_status", "approved")
      .order("name"),
  ]);
  if (user) redirect("/");

  return (
    <AuthShell wide>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign up as a fighter, coach, official, or anything else in the combat sports world.
          Staff reviews every role request.
        </p>
      </div>

      <SignupForm gyms={(gyms ?? []) as { id: string; name: string; city: string | null; state: string | null }[]} />
    </AuthShell>
  );
}
