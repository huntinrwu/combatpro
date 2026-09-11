import { Check, X } from "lucide-react";

import { approveGym, rejectGym } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { fmtDateShort } from "@/lib/format-utils";

export const dynamic = "force-dynamic";

type PendingGym = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  submitted_by: string | null;
  created_at: string;
};

type Profile = { id: string; email: string; full_name: string | null };

export default async function GymApprovalsPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: gyms } = await admin
    .from("gyms")
    .select("id, name, city, state, submitted_by, created_at")
    .eq("approval_status", "pending")
    .order("created_at", { ascending: true });

  const rows = (gyms ?? []) as PendingGym[];
  const userIds = Array.from(
    new Set(rows.map((r) => r.submitted_by).filter((u): u is string => Boolean(u))),
  );
  const { data: profs } = userIds.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] };
  const profMap = new Map<string, Profile>();
  for (const p of (profs ?? []) as Profile[]) profMap.set(p.id, p);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Pending gyms
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {rows.length} awaiting
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No gym submissions to review.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((g) => {
              const submitter = g.submitted_by ? profMap.get(g.submitted_by) : null;
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.city ?? "—"}
                      {g.state ? `, ${g.state}` : ""}
                    </div>
                    {submitter && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Submitted by {submitter.full_name ?? submitter.email}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {fmtDateShort(g.created_at.slice(0, 10))}
                  </span>
                  <div className="flex items-center gap-1">
                    <form action={approveGym}>
                      <input type="hidden" name="id" value={g.id} />
                      <Button type="submit" size="sm" variant="default">
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                    </form>
                    <form action={rejectGym}>
                      <input type="hidden" name="id" value={g.id} />
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
