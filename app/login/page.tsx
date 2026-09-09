import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "./_components/login-form";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  const { next } = await searchParams;
  if (user) redirect(next || "/");

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground">
        <Image src="/logo-mark.svg" alt="" width={20} height={20} priority />
        <span className="font-heading font-semibold tracking-wide text-foreground">CombatPro</span>
      </Link>

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Welcome back.</p>
      </div>

      <LoginForm next={next ?? "/"} />

      <p className="mt-4 text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="underline hover:text-foreground">
          Sign up
        </Link>
        .
      </p>
    </div>
  );
}
