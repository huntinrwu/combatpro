import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock, Plus } from "lucide-react";

import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ViewSwitcher } from "@/components/view-switcher";
import { CompactList, TableShell, TileGrid } from "@/components/views/containers";
import { pickView } from "@/lib/view-mode";
import type { Commission, SanctioningBody } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const VIEWS = ["list", "card", "grid", "compact"] as const;

type Search = { submitted?: string; view?: string };

export default async function RegistryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { submitted, view: rawView } = await searchParams;
  const view = pickView(rawView, VIEWS);

  const supabase = db();
  const session = await getSessionUser();

  const [{ data: commissions }, { data: bodies }, { data: rulesets }] = await Promise.all([
    supabase.from("commissions").select("*").order("state", { ascending: true }),
    supabase.from("sanctioning_bodies").select("*").order("status").order("abbreviation"),
    supabase.from("rulesets").select("id, commission_id, sanctioning_body_id"),
  ]);

  const commissionList = (commissions ?? []) as Commission[];
  const allBodies = (bodies ?? []) as SanctioningBody[];
  const approved = allBodies.filter((b) => b.status === "approved");
  const pending = allBodies.filter((b) => b.status === "pending");

  const ruleCountByCommission = new Map<string, number>();
  const ruleCountByBody = new Map<string, number>();
  for (const r of (rulesets ?? []) as {
    commission_id: string | null;
    sanctioning_body_id: string | null;
  }[]) {
    if (r.commission_id)
      ruleCountByCommission.set(r.commission_id, (ruleCountByCommission.get(r.commission_id) ?? 0) + 1);
    if (r.sanctioning_body_id)
      ruleCountByBody.set(r.sanctioning_body_id, (ruleCountByBody.get(r.sanctioning_body_id) ?? 0) + 1);
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Commissions &amp; Sanctioning Bodies
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            State/regional regulators plus the sanctioning bodies that certify bouts. Missing an
            organization? Submit it below.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewSwitcher views={[...VIEWS]} current={view} />
          {session?.isStaff && (
            <Button
              variant="outline"
              render={
                <Link href="/registry/commissions/new">
                  <Plus className="h-3.5 w-3.5" />
                  New commission
                </Link>
              }
            />
          )}
          <Button render={<Link href="/registry/submit">Submit sanctioning body</Link>} />
        </div>
      </header>

      {submitted && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4" />
          <div>
            <div className="font-medium">Submission received.</div>
            <div className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
              It&apos;s marked <em>pending</em> until an admin reviews it.
            </div>
          </div>
        </div>
      )}

      {view === "card" && (
        <CardView
          commissions={commissionList}
          approved={approved}
          pending={pending}
          ruleByCommission={ruleCountByCommission}
          ruleByBody={ruleCountByBody}
        />
      )}
      {view === "list" && (
        <ListView
          commissions={commissionList}
          approved={approved}
          pending={pending}
          ruleByCommission={ruleCountByCommission}
          ruleByBody={ruleCountByBody}
        />
      )}
      {view === "grid" && (
        <GridView
          commissions={commissionList}
          approved={approved}
          pending={pending}
          ruleByCommission={ruleCountByCommission}
          ruleByBody={ruleCountByBody}
        />
      )}
      {view === "compact" && (
        <CompactView
          commissions={commissionList}
          approved={approved}
          pending={pending}
          ruleByCommission={ruleCountByCommission}
          ruleByBody={ruleCountByBody}
        />
      )}
    </>
  );
}

type ViewProps = {
  commissions: Commission[];
  approved: SanctioningBody[];
  pending: SanctioningBody[];
  ruleByCommission: Map<string, number>;
  ruleByBody: Map<string, number>;
};

function CardView({ commissions, approved, pending, ruleByCommission, ruleByBody }: ViewProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commissions</CardTitle>
          <CardDescription>
            State and regional regulators. Read-only reference registry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {commissions.length === 0 && (
            <p className="text-sm text-muted-foreground">No commissions loaded yet.</p>
          )}
          {commissions.map((c) => (
            <CommissionRow key={c.id} commission={c} ruleCount={ruleByCommission.get(c.id) ?? 0} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sanctioning bodies</CardTitle>
          <CardDescription>
            Approved bodies certify bouts. Pending submissions await review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {approved.length === 0 && (
              <p className="text-sm text-muted-foreground">No approved bodies yet.</p>
            )}
            {approved.map((b) => (
              <BodyRow key={b.id} body={b} ruleCount={ruleByBody.get(b.id) ?? 0} />
            ))}
          </div>

          {pending.length > 0 && (
            <div className="space-y-2 border-t border-border/60 pt-4">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Pending review ({pending.length})
              </div>
              {pending.map((b) => (
                <BodyRow key={b.id} body={b} ruleCount={ruleByBody.get(b.id) ?? 0} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ListView({ commissions, approved, pending, ruleByCommission, ruleByBody }: ViewProps) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-medium">Commissions ({commissions.length})</h2>
        <TableShell
          head={
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Abbrev</th>
              <th className="px-3 py-2 font-medium">Jurisdiction</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium text-right">Rules</th>
            </tr>
          }
        >
          {commissions.map((c) => (
            <tr key={c.id} className="hover:bg-muted/40">
              <td className="px-3 py-2">
                <Link
                  href={`/registry/commissions/${c.id}`}
                  className="font-medium hover:underline"
                >
                  {c.name}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{c.abbreviation}</td>
              <td className="px-3 py-2 text-muted-foreground">{c.jurisdiction}</td>
              <td className="px-3 py-2 text-muted-foreground">{c.state ?? "—"}</td>
              <td className="px-3 py-2 text-right font-mono text-xs">
                {ruleByCommission.get(c.id) ?? 0}
              </td>
            </tr>
          ))}
        </TableShell>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium">
          Sanctioning bodies ({approved.length} approved, {pending.length} pending)
        </h2>
        <TableShell
          head={
            <tr>
              <th className="px-3 py-2 font-medium">Abbrev</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Scope</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Sports</th>
              <th className="px-3 py-2 font-medium text-right">Rules</th>
            </tr>
          }
        >
          {[...approved, ...pending].map((b) => (
            <tr key={b.id} className="hover:bg-muted/40">
              <td className="px-3 py-2 font-mono text-xs">
                <Link href={`/sb/${b.id}`} className="font-medium hover:underline">
                  {b.abbreviation}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{b.name}</td>
              <td className="px-3 py-2">
                <Badge variant="outline" className="capitalize">
                  {b.scope}
                </Badge>
              </td>
              <td className="px-3 py-2">
                <Badge
                  variant={b.status === "approved" ? "default" : "outline"}
                  className="capitalize"
                >
                  {b.status}
                </Badge>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {b.sports.slice(0, 4).join(", ")}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs">
                {ruleByBody.get(b.id) ?? 0}
              </td>
            </tr>
          ))}
        </TableShell>
      </section>
    </div>
  );
}

function GridView({ commissions, approved, ruleByCommission, ruleByBody }: ViewProps) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-medium">Commissions</h2>
        <TileGrid dense>
          {commissions.map((c) => (
            <Link
              key={c.id}
              href={`/registry/commissions/${c.id}`}
              className="flex flex-col rounded-xl border border-border bg-card p-3 text-center hover:-translate-y-0.5 hover:border-foreground/30"
            >
              <div className="font-mono text-sm font-medium">{c.abbreviation}</div>
              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{c.name}</div>
              <div className="mt-1 text-[10px] font-mono text-muted-foreground/70">
                {ruleByCommission.get(c.id) ?? 0} rules
              </div>
            </Link>
          ))}
        </TileGrid>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium">Sanctioning bodies</h2>
        <TileGrid dense>
          {approved.map((b) => (
            <Link
              key={b.id}
              href={`/sb/${b.id}`}
              className="flex flex-col rounded-xl border border-border bg-card p-3 text-center hover:-translate-y-0.5 hover:border-foreground/30"
            >
              <div className="font-mono text-sm font-medium">{b.abbreviation}</div>
              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{b.name}</div>
              <div className="mt-1 text-[10px] capitalize text-muted-foreground/70">
                {b.scope} · {ruleByBody.get(b.id) ?? 0} rules
              </div>
            </Link>
          ))}
        </TileGrid>
      </section>
    </div>
  );
}

function CompactView({
  commissions,
  approved,
  pending,
  ruleByCommission,
  ruleByBody,
}: ViewProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="mb-2 text-sm font-medium">Commissions ({commissions.length})</h2>
        <CompactList>
          {commissions.map((c) => (
            <Link
              key={c.id}
              href={`/registry/commissions/${c.id}`}
              className="flex items-center gap-2 px-3 py-1 text-xs hover:bg-muted/40"
            >
              <span className="w-12 shrink-0 font-mono">{c.abbreviation}</span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="w-16 shrink-0 text-right text-muted-foreground">
                {c.state ?? "—"}
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-muted-foreground">
                {ruleByCommission.get(c.id) ?? 0}
              </span>
            </Link>
          ))}
        </CompactList>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium">
          Bodies ({approved.length}A / {pending.length}P)
        </h2>
        <CompactList>
          {[...approved, ...pending].map((b) => (
            <Link
              key={b.id}
              href={`/sb/${b.id}`}
              className="flex items-center gap-2 px-3 py-1 text-xs hover:bg-muted/40"
            >
              <span className="w-12 shrink-0 font-mono">{b.abbreviation}</span>
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              <span className="w-16 shrink-0 text-right capitalize text-muted-foreground">
                {b.scope}
              </span>
              <span className="w-14 shrink-0 text-right capitalize text-muted-foreground">
                {b.status}
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-muted-foreground">
                {ruleByBody.get(b.id) ?? 0}
              </span>
            </Link>
          ))}
        </CompactList>
      </section>
    </div>
  );
}

function CommissionRow({ commission, ruleCount }: { commission: Commission; ruleCount: number }) {
  return (
    <Link
      href={`/registry/commissions/${commission.id}`}
      className="flex items-start justify-between gap-3 rounded-md border border-transparent px-2 py-1.5 hover:border-border hover:bg-muted/40"
    >
      <div>
        <div className="text-sm font-medium">{commission.name}</div>
        <div className="text-xs text-muted-foreground">
          {commission.abbreviation} · {commission.jurisdiction}
          {commission.state ? ` (${commission.state})` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {ruleCount} rule{ruleCount === 1 ? "" : "s"}
        </span>
        <ArrowUpRight className="h-3 w-3" />
      </div>
    </Link>
  );
}

function BodyRow({ body, ruleCount }: { body: SanctioningBody; ruleCount: number }) {
  return (
    <Link
      href={`/sb/${body.id}`}
      className="flex items-start justify-between gap-3 rounded-md border border-transparent px-2 py-1.5 hover:border-border hover:bg-muted/40"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{body.abbreviation}</span>
          <span className="truncate text-xs text-muted-foreground">{body.name}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px] capitalize">
            {body.scope}
          </Badge>
          {body.sports.map((s) => (
            <Badge key={s} variant="secondary" className="text-[10px] capitalize">
              {s}
            </Badge>
          ))}
          {body.headquarters && <span className="text-[11px]">· {body.headquarters}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {ruleCount} rule{ruleCount === 1 ? "" : "s"}
        </span>
        <ArrowUpRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
