import Link from "next/link";
import { UsersRound, Dumbbell, IdCard } from "lucide-react";

import { PageNav } from "@/components/page-nav";
import { requireStaff } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageNav />
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.isAdmin
            ? "Manage access requests, review submitted gyms, and edit people across roles."
            : "Edit people and their linked fighter / official records."}
        </p>
      </header>
      <nav className="mb-6 flex items-center gap-1 border-b border-border/60 pb-2 text-sm">
        {user.isAdmin && (
          <>
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
          </>
        )}
        <Link
          href="/admin/persons"
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <IdCard className="h-3.5 w-3.5" />
          People
        </Link>
      </nav>
      {children}
    </div>
  );
}
