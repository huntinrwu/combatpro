import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "./_components/login-form";
import { safeNext } from "@/lib/auth/safe-next";
import { getSessionUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth-shell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  const next = safeNext((await searchParams).next);
  if (user) redirect(next);

  return (
    <AuthShell>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Welcome back.</p>
      </div>

      <LoginForm next={next} />

      <p className="mt-4 text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="underline hover:text-foreground">
          Sign up
        </Link>
        .
      </p>
    </AuthShell>
  );
}
