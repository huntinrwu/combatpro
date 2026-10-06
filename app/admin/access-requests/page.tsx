import { Check, X } from "lucide-react";

import { approveRoleGrant, rejectRoleGrant } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { ROLE_LABELS, type PlatformRole } from "@/lib/auth/roles";
import { fmtDateShort } from "@/lib/format-utils";

export const dynamic = "force-dynamic";

type PendingGrant = {
  id: string;
  role: PlatformRole;
  status: string;
  requested_at: string;
  gym_id: string | null;
  user_id: string;
};

type Profile = { id: string; email: string; full_name: string | null };
type GymRef = { id: string; name: string; approval_status: string };

export default async function AccessRequestsPage() {
  await requireAdmin();
  const admin = createAdminClient();
  // Requester profile + gym are embedded (user_id hint: reviewed_by is also
  // an FK to profiles) so the page is a single query.
  const { data: grants } = await admin
    .from("user_role_grants")
    .select(
      "id, role, status, requested_at, gym_id, user_id, profile:profiles!user_id(id, email, full_name), gym:gyms(id, name, approval_status)",
    )
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

  const rows = (grants ?? []) as unknown as (PendingGrant & {
    profile: Profile | null;
    gym: GymRef | null;
  })[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Pending role requests
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {rows.length} awaiting
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to review right now.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => {
              const p = r.profile;
              const gym = r.gym_id ? r.gym : null;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {p?.full_name ?? p?.email ?? "Unknown user"}
                    </div>
                    <div className="text-xs text-muted-foreground">{p?.email}</div>
                    {gym && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Gym: <span className="font-medium">{gym.name}</span>
                        {gym.approval_status !== "approved" && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            gym {gym.approval_status}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary">{ROLE_LABELS[r.role]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {fmtDateShort(r.requested_at.slice(0, 10))}
                  </span>
                  <div className="flex items-center gap-1">
                    <form action={approveRoleGrant}>
                      <input type="hidden" name="id" value={r.id} />
                      <Button type="submit" size="sm" variant="default">
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                    </form>
                    <form action={rejectRoleGrant}>
                      <input type="hidden" name="id" value={r.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                        Reject
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
