import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.approvedRoles.length > 0 || user.isStaff) redirect("/");

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Waiting for approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Thanks for signing up, <span className="font-medium">{user.fullName ?? user.email}</span>.
            Staff is reviewing your role request. You&apos;ll be able to access the app once at
            least one role is approved.
          </p>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Requested roles
            </p>
            <ul className="space-y-1.5">
              {user.pendingRoles.length === 0 ? (
                <li className="text-muted-foreground">No pending role requests.</li>
              ) : (
                user.pendingRoles.map((r) => (
                  <li key={r} className="flex items-center gap-2">
                    <Badge variant="outline">{ROLE_LABELS[r]}</Badge>
                    <span className="text-xs text-muted-foreground">Pending review</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <form action="/logout" method="post">
            <button type="submit" className="text-xs text-muted-foreground underline hover:text-foreground">
              Sign out
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
