import Link from "next/link";
import { MapPin, Plus, Search, Users, X } from "lucide-react";

import { db } from "@/lib/db/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ViewSwitcher } from "@/components/view-switcher";
import { KanbanBoard } from "@/components/views/kanban";
import { CardGrid, CompactList, TableShell, TileGrid } from "@/components/views/containers";
import { pickView } from "@/lib/view-mode";
import type { Fighter, Gym } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const VIEWS = ["list", "card", "grid", "compact", "kanban"] as const;

type Search = { q?: string; state?: string; view?: string };

export default async function GymsListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { q = "", state = "", view: rawView } = await searchParams;
  const view = pickView(rawView, VIEWS);

  const supabase = db();

  const [{ data: gyms, error }, { data: fighters }] = await Promise.all([
    supabase.from("gyms").select("*").order("name"),
    supabase.from("fighters").select("id, gym_id"),
  ]);

  const rosterCount = new Map<string, number>();
  for (const f of ((fighters ?? []) as Pick<Fighter, "id" | "gym_id">[])) {
    if (!f.gym_id) continue;
    rosterCount.set(f.gym_id, (rosterCount.get(f.gym_id) ?? 0) + 1);
  }

  const list = ((gyms ?? []) as Gym[]).filter((g) => {
    if (state && (g.state ?? "").toLowerCase() !== state.toLowerCase()) return false;
    if (q) {
      const needle = q.toLowerCase();
      if (
        !g.name.toLowerCase().includes(needle) &&
        !(g.head_coach ?? "").toLowerCase().includes(needle) &&
        !(g.city ?? "").toLowerCase().includes(needle) &&
        !(g.notes ?? "").toLowerCase().includes(needle)
      )
        return false;
    }
    return true;
  });

  const uniqueStates = Array.from(
    new Set(((gyms ?? []) as Gym[]).map((g) => g.state).filter((s): s is string => Boolean(s))),
  ).sort();

  const anyFilter = Boolean(q || state);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Gyms</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fighter camps, coaches, and cornermen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewSwitcher views={[...VIEWS]} current={view} />
          <Button
            render={
              <Link href="/gyms/new">
                <Plus className="h-4 w-4" />
                New gym
              </Link>
            }
          />
        </div>
      </header>

      <form
        method="get"
        className="mb-4 grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-[2fr_1fr_auto]"
      >
        {/* Preserve view when filtering */}
        {view !== VIEWS[0] && <input type="hidden" name="view" value={view} />}
        <label className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search name, coach, city, notes"
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
        <div className="flex items-center gap-1">
          <Button type="submit" size="sm">
            Filter
          </Button>
          {anyFilter && (
            <Button size="sm" variant="ghost" render={<Link href="/gyms">Reset</Link>}>
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

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {anyFilter ? "No gyms match those filters." : "No gyms yet."}
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs text-muted-foreground">
            Showing {list.length} of {gyms?.length ?? 0}
          </div>
          {view === "list" && <ListView gyms={list} rosterCount={rosterCount} />}
          {view === "card" && <CardView gyms={list} rosterCount={rosterCount} />}
          {view === "grid" && <GridView gyms={list} rosterCount={rosterCount} />}
          {view === "compact" && <CompactView gyms={list} rosterCount={rosterCount} />}
          {view === "kanban" && <KanbanView gyms={list} rosterCount={rosterCount} />}
        </>
      )}
    </>
  );
}

function locationOf(g: Gym): string {
  return [g.city, g.state].filter(Boolean).join(", ") || "—";
}

function ListView({ gyms, rosterCount }: { gyms: Gym[]; rosterCount: Map<string, number> }) {
  return (
    <TableShell
      head={
        <tr>
          <th className="px-3 py-2 font-medium">Gym</th>
          <th className="px-3 py-2 font-medium">Head coach</th>
          <th className="px-3 py-2 font-medium">Location</th>
          <th className="px-3 py-2 font-medium text-right">Roster</th>
        </tr>
      }
    >
      {gyms.map((g) => (
        <tr key={g.id} className="hover:bg-muted/40">
          <td className="px-3 py-2">
            <Link href={`/gyms/${g.id}`} className="font-medium hover:underline">
              {g.name}
            </Link>
          </td>
          <td className="px-3 py-2 text-muted-foreground">{g.head_coach || "—"}</td>
          <td className="px-3 py-2 text-muted-foreground">{locationOf(g)}</td>
          <td className="px-3 py-2 text-right font-mono text-xs">
            {rosterCount.get(g.id) ?? 0}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function CardView({ gyms, rosterCount }: { gyms: Gym[]; rosterCount: Map<string, number> }) {
  return (
    <CardGrid>
      {gyms.map((g) => (
        <Link
          key={g.id}
          href={`/gyms/${g.id}`}
          className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/30"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-heading font-medium">{g.name}</div>
              {g.head_coach && (
                <div className="truncate text-xs text-muted-foreground">
                  Coach: {g.head_coach}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
              <Users className="h-3 w-3" />
              <span className="font-mono">{rosterCount.get(g.id) ?? 0}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{locationOf(g)}</span>
          </div>
        </Link>
      ))}
    </CardGrid>
  );
}

function GridView({ gyms, rosterCount }: { gyms: Gym[]; rosterCount: Map<string, number> }) {
  return (
    <TileGrid>
      {gyms.map((g) => (
        <Link
          key={g.id}
          href={`/gyms/${g.id}`}
          className="group rounded-xl border border-border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:border-foreground/30"
        >
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-heading">
            {g.name.charAt(0).toUpperCase()}
          </div>
          <div className="truncate text-sm font-medium">{g.name}</div>
          <div className="truncate text-[10px] text-muted-foreground">{locationOf(g)}</div>
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Users className="h-2.5 w-2.5" />
            <span className="font-mono">{rosterCount.get(g.id) ?? 0}</span>
          </div>
        </Link>
      ))}
    </TileGrid>
  );
}

function CompactView({ gyms, rosterCount }: { gyms: Gym[]; rosterCount: Map<string, number> }) {
  return (
    <CompactList>
      {gyms.map((g) => (
        <Link
          key={g.id}
          href={`/gyms/${g.id}`}
          className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-muted/40"
        >
          <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
          <span className="hidden w-32 shrink-0 truncate text-xs text-muted-foreground sm:block">
            {g.head_coach ?? ""}
          </span>
          <span className="w-32 shrink-0 truncate text-right text-xs text-muted-foreground">
            {locationOf(g)}
          </span>
          <span className="w-10 shrink-0 text-right font-mono text-xs">
            {rosterCount.get(g.id) ?? 0}
          </span>
        </Link>
      ))}
    </CompactList>
  );
}

function KanbanView({ gyms, rosterCount }: { gyms: Gym[]; rosterCount: Map<string, number> }) {
  const buckets = new Map<string, Gym[]>();
  for (const g of gyms) {
    const key = g.state ?? "Unknown";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(g);
  }
  const columns = Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([state, items]) => ({
      key: state,
      header: <span className="text-xs font-medium">{state}</span>,
      items,
    }));

  return (
    <KanbanBoard
      columns={columns}
      renderItem={(g) => (
        <Link
          key={g.id}
          href={`/gyms/${g.id}`}
          className="block rounded-lg border border-border bg-background p-2 text-xs hover:border-foreground/30"
        >
          <div className="truncate font-medium">{g.name}</div>
          <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="truncate">{g.city ?? ""}</span>
            <span className="font-mono">{rosterCount.get(g.id) ?? 0}</span>
          </div>
        </Link>
      )}
    />
  );
}
