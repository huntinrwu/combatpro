import Link from "next/link";
import { Plus, Search, X } from "lucide-react";

import { db } from "@/lib/db/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ViewSwitcher } from "@/components/view-switcher";
import { KanbanBoard } from "@/components/views/kanban";
import { CardGrid, CompactList, TableShell, TileGrid } from "@/components/views/containers";
import { pickView } from "@/lib/view-mode";
import {
  OFFICIAL_ROLES,
  SPORTS,
  type Official,
  type OfficialRole,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

const VIEWS = ["list", "card", "grid", "compact", "kanban"] as const;

type Search = {
  q?: string;
  role?: string;
  sport?: string;
  state?: string;
  status?: string;
  view?: string;
};

// "2019-04-11" → "6 yr" (relative to today, floored). Empty string when null.
function activeFor(activeSince: string | null): string {
  if (!activeSince) return "";
  const start = new Date(activeSince);
  if (Number.isNaN(start.getTime())) return "";
  const years = (Date.now() - start.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 1) return "<1 yr";
  return `${Math.floor(years)} yr`;
}

export default async function OfficialsListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const {
    q = "",
    role = "",
    sport = "",
    state = "",
    status = "",
    view: rawView,
  } = await searchParams;
  const view = pickView(rawView, VIEWS);

  const { data: officials, error } = await db()
    .from("officials")
    .select("*")
    .order("full_name");

  const filtered = ((officials ?? []) as Official[]).filter((o) => {
    if (role && !o.roles.includes(role as OfficialRole)) return false;
    if (sport && !o.sports.includes(sport)) return false;
    if (state && (o.home_state ?? "").toLowerCase() !== state.toLowerCase()) return false;
    if (status === "active" && !o.is_active) return false;
    if (status === "inactive" && o.is_active) return false;
    if (q) {
      const needle = q.toLowerCase();
      if (
        !o.full_name.toLowerCase().includes(needle) &&
        !(o.notes ?? "").toLowerCase().includes(needle) &&
        !(o.certifications ?? []).some((c) => c.toLowerCase().includes(needle))
      )
        return false;
    }
    return true;
  });

  const uniqueStates = Array.from(
    new Set(
      ((officials ?? []) as Official[])
        .map((o) => o.home_state)
        .filter((s): s is string => Boolean(s)),
    ),
  ).sort();

  const anyFilter = Boolean(q || role || sport || state || status);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Officials</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Judges, referees, doctors, timekeepers, inspectors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewSwitcher views={[...VIEWS]} current={view} />
          <Button
            render={
              <Link href="/officials/new">
                <Plus className="h-4 w-4" />
                New official
              </Link>
            }
          />
        </div>
      </header>

      <form
        method="get"
        className="mb-4 grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
      >
        {view !== VIEWS[0] && <input type="hidden" name="view" value={view} />}
        <label className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search name, cert, notes"
            className="pl-7"
          />
        </label>
        <NativeSelect name="role" defaultValue={role}>
          <option value="">All roles</option>
          {OFFICIAL_ROLES.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="sport" defaultValue={sport}>
          <option value="">All sports</option>
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="state" defaultValue={state}>
          <option value="">All states</option>
          {uniqueStates.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </NativeSelect>
        <div className="flex items-center gap-1">
          <Button type="submit" size="sm">
            Filter
          </Button>
          {anyFilter && (
            <Button size="sm" variant="ghost" render={<Link href="/officials">Reset</Link>}>
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

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {anyFilter ? "No officials match those filters." : "No officials yet."}
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs text-muted-foreground">
            Showing {filtered.length} of {officials?.length ?? 0}
          </div>
          {view === "list" && <ListView officials={filtered} />}
          {view === "card" && <CardView officials={filtered} />}
          {view === "grid" && <GridView officials={filtered} />}
          {view === "compact" && <CompactView officials={filtered} />}
          {view === "kanban" && <KanbanView officials={filtered} />}
        </>
      )}
    </>
  );
}

function RolesChips({ roles }: { roles: OfficialRole[] }) {
  if (roles.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Badge key={r} variant="secondary" className="capitalize">
          {r}
        </Badge>
      ))}
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        active ? "bg-emerald-500" : "bg-muted-foreground/40"
      }`}
      aria-label={active ? "Active" : "Inactive"}
    />
  );
}

function ListView({ officials }: { officials: Official[] }) {
  return (
    <TableShell
      head={
        <tr>
          <th className="px-3 py-2 font-medium">Name</th>
          <th className="px-3 py-2 font-medium">Roles</th>
          <th className="px-3 py-2 font-medium">Sports</th>
          <th className="px-3 py-2 font-medium">State</th>
          <th className="px-3 py-2 font-medium">Active since</th>
          <th className="px-3 py-2 font-medium">Status</th>
        </tr>
      }
    >
      {officials.map((o) => (
        <tr key={o.id} className="hover:bg-muted/40">
          <td className="px-3 py-2">
            <Link href={`/officials/${o.id}`} className="font-medium hover:underline">
              {o.full_name}
            </Link>
          </td>
          <td className="px-3 py-2">
            <RolesChips roles={o.roles} />
          </td>
          <td className="px-3 py-2">
            <div className="flex flex-wrap gap-1">
              {o.sports.map((s) => (
                <Badge key={s} variant="outline" className="capitalize">
                  {s}
                </Badge>
              ))}
              {o.sports.length === 0 && (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </td>
          <td className="px-3 py-2 text-muted-foreground">{o.home_state || "—"}</td>
          <td className="px-3 py-2 text-muted-foreground">
            {o.active_since ? (
              <>
                <span className="font-mono text-xs">{o.active_since}</span>
                <span className="ml-1 text-[10px]">({activeFor(o.active_since)})</span>
              </>
            ) : (
              "—"
            )}
          </td>
          <td className="px-3 py-2">
            <span className="inline-flex items-center gap-1.5 text-xs">
              <StatusDot active={o.is_active} />
              {o.is_active ? "Active" : "Inactive"}
            </span>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function CardView({ officials }: { officials: Official[] }) {
  return (
    <CardGrid>
      {officials.map((o) => (
        <Link
          key={o.id}
          href={`/officials/${o.id}`}
          className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/30"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <StatusDot active={o.is_active} />
                <div className="truncate font-heading font-medium">{o.full_name}</div>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {o.home_state ?? "—"}
                {o.active_since && ` · ${activeFor(o.active_since)}`}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              {o.roles.slice(0, 2).map((r) => (
                <Badge key={r} variant="secondary" className="capitalize">
                  {r}
                </Badge>
              ))}
              {o.roles.length > 2 && (
                <Badge variant="secondary">+{o.roles.length - 2}</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {o.sports.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px] capitalize">
                {s}
              </Badge>
            ))}
          </div>
          {o.certifications && o.certifications.length > 0 && (
            <div className="text-[10px] text-muted-foreground">
              Certs: {o.certifications.slice(0, 3).join(", ")}
              {o.certifications.length > 3 && ` +${o.certifications.length - 3}`}
            </div>
          )}
        </Link>
      ))}
    </CardGrid>
  );
}

function GridView({ officials }: { officials: Official[] }) {
  return (
    <TileGrid dense>
      {officials.map((o) => (
        <Link
          key={o.id}
          href={`/officials/${o.id}`}
          className="group flex flex-col items-center rounded-xl border border-border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:border-foreground/30"
        >
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-heading">
            {o.full_name
              .split(/\s+/)
              .slice(0, 2)
              .map((n) => n[0]?.toUpperCase() ?? "")
              .join("")}
          </div>
          <div className="w-full truncate text-sm font-medium">{o.full_name}</div>
          <div className="w-full truncate text-[10px] capitalize text-muted-foreground">
            {o.roles.join(" · ") || "—"}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <StatusDot active={o.is_active} />
            {o.home_state ?? "—"}
          </div>
        </Link>
      ))}
    </TileGrid>
  );
}

function CompactView({ officials }: { officials: Official[] }) {
  return (
    <CompactList>
      {officials.map((o) => (
        <Link
          key={o.id}
          href={`/officials/${o.id}`}
          className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-muted/40"
        >
          <StatusDot active={o.is_active} />
          <span className="w-32 shrink-0 truncate text-xs capitalize text-muted-foreground">
            {o.roles.join(", ") || "—"}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{o.full_name}</span>
          <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
            {o.home_state ?? "—"}
          </span>
          <span className="w-16 shrink-0 text-right font-mono text-xs">
            {activeFor(o.active_since) || "—"}
          </span>
        </Link>
      ))}
    </CompactList>
  );
}

// Kanban: officials appear in every column they hold a role in. Copies is
// intentional — the point is to answer "who can I pull as a judge?" at a glance.
function KanbanView({ officials }: { officials: Official[] }) {
  const buckets = new Map<OfficialRole, Official[]>();
  for (const r of OFFICIAL_ROLES) buckets.set(r, []);
  for (const o of officials) {
    for (const r of o.roles) {
      if (!buckets.has(r)) buckets.set(r, []);
      buckets.get(r)!.push(o);
    }
  }
  const columns = Array.from(buckets.entries()).map(([role, items]) => ({
    key: role,
    header: (
      <Badge variant="secondary" className="capitalize">
        {role}
      </Badge>
    ),
    items,
  }));

  return (
    <KanbanBoard
      columns={columns}
      renderItem={(o) => (
        <Link
          key={o.id}
          href={`/officials/${o.id}`}
          className="block rounded-lg border border-border bg-background p-2 text-xs hover:border-foreground/30"
        >
          <div className="flex items-center gap-1.5">
            <StatusDot active={o.is_active} />
            <span className="truncate font-medium">{o.full_name}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{o.home_state ?? "—"}</span>
            <span className="font-mono">{activeFor(o.active_since)}</span>
          </div>
        </Link>
      )}
    />
  );
}
