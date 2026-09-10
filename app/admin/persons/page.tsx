import { GitMerge, UserCircle } from "lucide-react";

import { mergePersonsByNumber } from "./actions";
import { ToastedForm } from "@/components/forms/toasted-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createAdminClient } from "@/lib/supabase/server";
import { fmtPersonNo } from "@/lib/format-utils";
import type { Person } from "@/lib/db/types";

export const dynamic = "force-dynamic";

type PersonRow = Pick<
  Person,
  "id" | "person_no" | "full_name" | "email" | "auth_user_id"
>;

type Counts = {
  fighter: number;
  official: number;
  promotion: number;
  hasAccount: boolean;
};

export default async function PersonsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: qParam } = await searchParams;
  const q = (qParam ?? "").trim();
  const admin = createAdminClient();

  let query = admin
    .from("persons")
    .select("id, person_no, full_name, email, auth_user_id")
    .order("person_no", { ascending: true })
    .limit(200);

  if (q.length > 0) {
    // Match on full_name (case-insensitive), email, or person_no
    const asNumber = Number.parseInt(q.replace(/[^0-9]/g, ""), 10);
    const patterns = [`full_name.ilike.%${q}%`, `email.ilike.%${q}%`];
    if (!Number.isNaN(asNumber)) patterns.push(`person_no.eq.${asNumber}`);
    query = query.or(patterns.join(","));
  }

  const { data: persons } = await query;
  const rows = (persons ?? []) as PersonRow[];
  const personIds = rows.map((r) => r.id);

  const [{ data: fighters }, { data: officials }, { data: promotions }] =
    personIds.length
      ? await Promise.all([
          admin.from("fighters").select("person_id").in("person_id", personIds),
          admin
            .from("officials")
            .select("person_id")
            .in("person_id", personIds),
          admin
            .from("promotions")
            .select("contact_person_id")
            .in("contact_person_id", personIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const counts = new Map<string, Counts>();
  for (const r of rows) {
    counts.set(r.id, {
      fighter: 0,
      official: 0,
      promotion: 0,
      hasAccount: Boolean(r.auth_user_id),
    });
  }
  for (const f of (fighters ?? []) as { person_id: string }[]) {
    const c = counts.get(f.person_id);
    if (c) c.fighter++;
  }
  for (const o of (officials ?? []) as { person_id: string }[]) {
    const c = counts.get(o.person_id);
    if (c) c.official++;
  }
  for (const p of (promotions ?? []) as { contact_person_id: string }[]) {
    const c = counts.get(p.contact_person_id);
    if (c) c.promotion++;
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            People
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every human on the platform has one entry here. Person numbers start
            at CP-10000. Merge two rows when a fighter, official, and account
            turn out to be the same person.
          </p>
        </div>
      </div>

      <form className="mb-4" method="get">
        <Input
          type="search"
          name="q"
          placeholder="Search by name, email, or CP-number"
          defaultValue={q}
        />
      </form>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitMerge className="h-4 w-4" />
            Merge two persons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Enter the CP-number of both records. The <strong>source</strong> is
            deleted; the <strong>target</strong> keeps its number and inherits
            all fighter/official/promotion/account links from the source.
          </p>
          <ToastedForm
            action={mergePersonsByNumber}
            successMessage="Merged"
            resetOnSuccess
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex-1 min-w-[160px]">
              <label htmlFor="source_no" className="mb-1 block text-xs font-medium text-muted-foreground">
                Source (deleted)
              </label>
              <Input
                id="source_no"
                name="source_no"
                placeholder="CP-10042"
                required
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label htmlFor="target_no" className="mb-1 block text-xs font-medium text-muted-foreground">
                Target (kept)
              </label>
              <Input
                id="target_no"
                name="target_no"
                placeholder="CP-10007"
                required
              />
            </div>
            <Button type="submit" size="sm" variant="destructive">
              <GitMerge className="h-3.5 w-3.5" />
              Merge
            </Button>
          </ToastedForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {q ? `Results for "${q}"` : "All persons"}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {rows.length} shown
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">ID</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Roles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((p) => {
                    const c = counts.get(p.id);
                    return (
                      <tr key={p.id}>
                        <td className="py-2 pr-3">
                          <span className="font-mono text-xs">
                            {fmtPersonNo(p.person_no)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-medium">{p.full_name}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {p.email ?? "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {c?.hasAccount && (
                              <Badge variant="secondary" className="gap-1 text-[10px]">
                                <UserCircle className="h-3 w-3" />
                                Account
                              </Badge>
                            )}
                            {c && c.fighter > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                Fighter × {c.fighter}
                              </Badge>
                            )}
                            {c && c.official > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                Official × {c.official}
                              </Badge>
                            )}
                            {c && c.promotion > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                Promotion contact × {c.promotion}
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
