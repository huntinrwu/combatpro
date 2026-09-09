import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignupForm } from "./_components/signup-form";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  const admin = createAdminClient();
  const { data: gyms } = await admin
    .from("gyms")
    .select("id, name, city, state")
    .eq("approval_status", "approved")
    .order("name");

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-xl flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground">
        <Image src="/logo-mark.svg" alt="" width={20} height={20} priority />
        <span className="font-heading font-semibold tracking-wide text-foreground">CombatPro</span>
      </Link>

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign up as a fighter, coach, official, or anything else in the combat sports world.
          Staff reviews every role request.
        </p>
      </div>

      <SignupForm gyms={(gyms ?? []) as { id: string; name: string; city: string | null; state: string | null }[]} />
    </div>
  );
}
