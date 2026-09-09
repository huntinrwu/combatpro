import Link from "next/link";
import { Check, ChevronRight, CircleAlert, Plus, Search, ShieldCheck, X } from "lucide-react";

import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { setPromotionStatus } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ViewSwitcher } from "@/components/view-switcher";
import { KanbanBoard } from "@/components/views/kanban";
import { CardGrid, CompactList, TableShell, TileGrid } from "@/components/views/containers";
import { pickView } from "@/lib/view-mode";
import { PROMOTION_SCOPES, type EventRow, type Promotion, type PromotionScope } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const VIEWS = ["list", "card", "grid", "compact", "kanban"] as const;

type Search = {
  q?: string;
  state?: string;
  scope?: string;
  submitted?: string;
  view?: string;
};

type Counts = { total: number; upcoming: number };

export default async function PromotionsListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const {
    q = "",
    state = "",
    scope = "",
    submitted,
    view: rawView,
  } = await searchParams;
  const view = pickView(rawView, VIEWS);

  const supabase = db();
  const session = await getSessionUser();

  const [{ data: rawPromos, error }, { data: rawEvents }] = await Promise.all([
    supabase.from("promotions").select("*").order("name"),
    supabase.from("events").select("id, promotion_id, event_date, status"),
  ]);

  const all = (rawPromos ?? []) as Promotion[];
  const events = (rawEvents ?? []) as Pick<
    EventRow,
    "id" | "promotion_id" | "event_date" | "status"
  >[];

  const today = new Date().toISOString().slice(0, 10);
  const eventCounts = new Map<string, Counts>();
  for (const e of events) {
    if (!e.promotion_id) continue;
    const entry = eventCounts.get(e.promotion_id) ?? { total: 0, upcoming: 0 };
    entry.total++;
    if (e.event_date >= today && e.status !== "canceled" && e.status !== "complete") {
      entry.upcoming++;
    }
    eventCounts.set(e.promotion_id, entry);
  }

  const approved = all.filter((p) => p.status === "approved");
  const pending = all.filter((p) => p.status === "pending");

  const list = approved.filter((p) => {
    if (state && (p.home_state ?? "").toLowerCase() !== state.toLowerCase()) return false;
    if (scope && p.scope !== scope) return false;
    if (q) {
      const needle = q.toLowerCase();
      if (
        !p.name.toLowerCase().includes(needle) &&
        !(p.abbreviation ?? "").toLowerCase().includes(needle) &&
        !(p.city ?? "").toLowerCase().includes(needle) &&
        !(p.notes ?? "").toLowerCase().includes(needle)
      )
        return false;
    }
    return true;
  });

  const uniqueStates = Array.from(
    new Set(approved.map((p) => p.home_state).filter((s): s is string => Boolean(s))),
  ).sort();
  const uniqueScopes = Array.from(new Set(approved.map((p) => p.scope))).sort();

  const anyFilter = Boolean(q || state || scope);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Promotions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registry of promoters and promotion brands. Events attach to a promotion so we can
            track roster, results, and history per house.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewSwitcher views={[...VIEWS]} current={view} />
          <Button
            variant="outline"
            render={
              <Link href="/promotions/submit">
                <Plus className="h-4 w-4" />
                Submit a promotion
              </Link>
            }
          />
          {session?.isStaff && (
            <Button
              render={
                <Link href="/promotions/new">
                  <Plus className="h-4 w-4" />
                  New (staff)
                </Link>
              }
            />
          )}
        </div>
      </header>

      {submitted && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          Thanks — your promotion has been submitted for review. Staff will approve or reject shortly.
        </div>
      )}

      <form
        method="get"
        className="mb-4 grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
      >
        {view !== VIEWS[0] && <input type="hidden" name="view" value={view} />}
        <label className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search name, abbreviation, city, notes"
            className="pl-7"
          />
        </label>
        <NativeSelect name="state" defaultValue={state}>
          <option value="">All states</option>
          {uniqueStates.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="scope" defaultValue={scope}>
          <option value="">All scopes</option>
          {uniqueScopes.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </NativeSelect>
        <div className="flex items-center gap-1">
          <Button type="submit" size="sm">
            Filter
          </Button>
          {anyFilter && (
            <Button size="sm" variant="ghost" render={<Link href="/promotions">Reset</Link>}>
              <X className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
      </form>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {session?.isStaff && pending.length > 0 && (
        <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Pending review ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/promotions/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    {p.abbreviation && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {p.abbreviation}
                      </span>
                    )}
                    <div className="text-[11px] text-muted-foreground">
                      Submitted by {p.submitted_by_email ?? "unknown"}
                      {p.submitted_at && ` · ${new Date(p.submitted_at).toLocaleDateString()}`}
                      {p.sports.length > 0 && ` · ${p.sports.join(", ")}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <form action={setPromotionStatus}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value="approved" />
                      <Button size="sm" variant="outline">
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                    </form>
                    <form action={setPromotionStatus}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <Button size="sm" variant="ghost">
                        <X className="h-3 w-3" />
                        Reject
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {anyFilter ? "No promotions match those filters." : "No approved promotions yet."}
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs text-muted-foreground">
            Showing {list.length} of {approved.length}
          </div>
          {view === "card" && <CardView promotions={list} counts={eventCounts} />}
          {view === "list" && <ListView promotions={list} counts={eventCounts} />}
          {view === "grid" && <GridView promotions={list} counts={eventCounts} />}
          {view === "compact" && <CompactView promotions={list} counts={eventCounts} />}
          {view === "kanban" && <KanbanView promotions={list} counts={eventCounts} />}
        </>
      )}
    </>
  );
}

function ListView({
  promotions,
  counts,
}: {
  promotions: Promotion[];
  counts: Map<string, Counts>;
}) {
  return (
    <TableShell
      head={
        <tr>
          <th className="px-3 py-2 font-medium">Promotion</th>
          <th className="px-3 py-2 font-medium">Scope</th>
          <th className="px-3 py-2 font-medium">Sports</th>
          <th className="px-3 py-2 font-medium">Location</th>
          <th className="px-3 py-2 font-medium text-right">Upcoming</th>
          <th className="px-3 py-2 font-medium text-right">Total</th>
        </tr>
      }
    >
      {promotions.map((p) => {
            const c = counts.get(p.id) ?? { total: 0, upcoming: 0 };
            return (
              <tr key={p.id} className="hover:bg-muted/40">
                <td className="px-3 py-2">
                  <Link href={`/promotions/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  {p.abbreviation && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {p.abbreviation}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="capitalize">
                    {p.scope}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {p.sports.slice(0, 3).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] capitalize">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {[p.city, p.home_state].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">{c.upcoming}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{c.total}</td>
              </tr>
            );
          })}
    </TableShell>
  );
}

function CardView({
  promotions,
  counts,
}: {
  promotions: Promotion[];
  counts: Map<string, Counts>;
}) {
  return (
    <CardGrid>
      {promotions.map((p) => {
        const c = counts.get(p.id) ?? { total: 0, upcoming: 0 };
        return (
          <Link
            key={p.id}
            href={`/promotions/${p.id}`}
            className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card
              collapsible={false}
              className="h-full transition-all group-hover:ring-foreground/20 group-hover:-translate-y-0.5"
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    {p.abbreviation ? <span className="font-mono">{p.abbreviation}</span> : p.name}
                  </CardTitle>
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/50 transition group-hover:text-foreground" />
                </div>
                {p.abbreviation && (
                  <div className="line-clamp-2 text-sm text-muted-foreground">{p.name}</div>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {p.scope}
                  </Badge>
                  {p.sports.slice(0, 3).map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px] capitalize">
                      {s}
                    </Badge>
                  ))}
                  {p.sports.length > 3 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{p.sports.length - 3}
                    </Badge>
                  )}
                  {p.tenant_org_id && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-[10px] text-emerald-700 dark:text-emerald-300"
                    >
                      <ShieldCheck className="h-2.5 w-2.5" />
                      On CombatPro
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    <span className="font-mono font-semibold text-foreground">{c.upcoming}</span>{" "}
                    upcoming
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span>
                    <span className="font-mono">{c.total}</span> total
                  </span>
                  {(p.city || p.home_state) && (
                    <>
                      <span className="text-muted-foreground/50">·</span>
                      <span>{[p.city, p.home_state].filter(Boolean).join(", ")}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </CardGrid>
  );
}

function GridView({
  promotions,
  counts,
}: {
  promotions: Promotion[];
  counts: Map<string, Counts>;
}) {
  return (
    <TileGrid dense className="lg:grid-cols-5">
      {promotions.map((p) => {
        const c = counts.get(p.id) ?? { total: 0, upcoming: 0 };
        return (
          <Link
            key={p.id}
            href={`/promotions/${p.id}`}
            className="group flex flex-col items-center rounded-xl border border-border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:border-foreground/30"
          >
            {p.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.logo_url}
                alt={p.name}
                className="mb-2 h-14 w-14 rounded-lg object-cover"
              />
            ) : (
              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-muted font-mono text-sm">
                {p.abbreviation ?? p.name.charAt(0)}
              </div>
            )}
            <div className="w-full truncate text-sm font-medium">{p.name}</div>
            <div className="w-full truncate text-[10px] capitalize text-muted-foreground">
              {p.scope}
            </div>
            <div className="mt-1 text-[10px] font-mono">
              {c.upcoming}↑ / {c.total}
            </div>
          </Link>
        );
      })}
    </TileGrid>
  );
}

function CompactView({
  promotions,
  counts,
}: {
  promotions: Promotion[];
  counts: Map<string, Counts>;
}) {
  return (
    <CompactList>
      {promotions.map((p) => {
        const c = counts.get(p.id) ?? { total: 0, upcoming: 0 };
        return (
          <Link
            key={p.id}
            href={`/promotions/${p.id}`}
            className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-muted/40"
          >
            <span className="w-14 shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
              {p.abbreviation ?? "—"}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
            <span className="hidden w-20 shrink-0 truncate text-right text-xs capitalize text-muted-foreground sm:block">
              {p.scope}
            </span>
            <span className="w-14 shrink-0 text-right font-mono text-xs">{c.upcoming}</span>
            <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
              {c.total}
            </span>
          </Link>
        );
      })}
    </CompactList>
  );
}

function KanbanView({
  promotions,
  counts,
}: {
  promotions: Promotion[];
  counts: Map<string, Counts>;
}) {
  const buckets = new Map<PromotionScope, Promotion[]>();
  for (const s of PROMOTION_SCOPES) buckets.set(s, []);
  for (const p of promotions) {
    if (!buckets.has(p.scope)) buckets.set(p.scope, []);
    buckets.get(p.scope)!.push(p);
  }
  const columns = Array.from(buckets.entries()).map(([scope, items]) => ({
    key: scope,
    header: (
      <Badge variant="outline" className="capitalize">
        {scope}
      </Badge>
    ),
    items,
  }));

  return (
    <KanbanBoard
      columns={columns}
      renderItem={(p) => {
        const c = counts.get(p.id) ?? { total: 0, upcoming: 0 };
        return (
          <Link
            key={p.id}
            href={`/promotions/${p.id}`}
            className="block rounded-lg border border-border bg-background p-2 text-xs hover:border-foreground/30"
          >
            <div className="truncate font-medium">{p.name}</div>
            <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="truncate">
                {[p.city, p.home_state].filter(Boolean).join(", ") || "—"}
              </span>
              <span className="font-mono">
                {c.upcoming}/{c.total}
              </span>
            </div>
          </Link>
        );
      }}
    />
  );
}
