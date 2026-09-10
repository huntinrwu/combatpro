import Link from "next/link";
import { UsersRound, Dumbbell } from "lucide-react";

import { PageNav } from "@/components/page-nav";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageNav />
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage user role requests and review self-submitted gyms.
        </p>
      </header>
      <nav className="mb-6 flex items-center gap-1 border-b border-border/60 pb-2 text-sm">
        <Link
          href="/admin/access-requests"
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <UsersRound className="h-3.5 w-3.5" />
          Access requests
        </Link>
        <Link
          href="/admin/gyms"
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <Dumbbell className="h-3.5 w-3.5" />
          Gym submissions
        </Link>
      </nav>
      {children}
    </div>
  );
}
