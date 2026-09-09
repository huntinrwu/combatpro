import Link from "next/link";
import { Plus } from "lucide-react";

import { db } from "@/lib/db/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ViewSwitcher } from "@/components/view-switcher";
import { KanbanBoard } from "@/components/views/kanban";
import { CardGrid, CompactList, TableShell, TileGrid } from "@/components/views/containers";
import { pickView } from "@/lib/view-mode";
import { fighterProRecord, initials } from "@/lib/text-utils";
import type { Fighter, Gym } from "@/lib/db/types";
import { SPORTS } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const VIEWS = ["list", "card", "grid", "compact", "kanban", "gallery"] as const;

type Search = { view?: string };

function gymName(f: Fighter, gymMap: Map<string, string>): string | null {
  if (f.gym_id && gymMap.has(f.gym_id)) return gymMap.get(f.gym_id)!;
  return f.gym ?? null;
}

export default async function FightersListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { view: rawView } = await searchParams;
  const view = pickView(rawView, VIEWS);

  const supabase = db();
  const [{ data: fighters, error }, { data: gyms }] = await Promise.all([
    supabase.from("fighters").select("*").order("created_at", { ascending: false }),
    supabase.from("gyms").select("id, name"),
  ]);
  const gymMap = new Map<string, string>();
  for (const g of ((gyms ?? []) as Pick<Gym, "id" | "name">[])) gymMap.set(g.id, g.name);

  const list = (fighters ?? []) as Fighter[];

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Fighters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cross-org athlete registry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewSwitcher views={[...VIEWS]} current={view} />
          <Button
            render={
              <Link href="/fighters/new">
                <Plus className="h-4 w-4" />
                New fighter
              </Link>
            }
          />
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {list.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No fighters yet.
          <div className="mt-2">
            <Button
              size="sm"
              render={
                <Link href="/fighters/new">
                  <Plus className="h-4 w-4" />
                  Add the first fighter
                </Link>
              }
            />
          </div>
        </div>
      ) : (
        <>
          {view === "list" && <ListView fighters={list} gymMap={gymMap} />}
          {view === "card" && <CardView fighters={list} gymMap={gymMap} />}
          {view === "grid" && <GridView fighters={list} gymMap={gymMap} />}
          {view === "compact" && <CompactView fighters={list} gymMap={gymMap} />}
          {view === "kanban" && <KanbanView fighters={list} gymMap={gymMap} />}
          {view === "gallery" && <GalleryView fighters={list} />}
        </>
      )}
    </>
  );
}

function ListView({ fighters, gymMap }: { fighters: Fighter[]; gymMap: Map<string, string> }) {
  return (
    <TableShell
      head={
        <tr>
          <th className="px-3 py-2 font-medium">Name</th>
          <th className="px-3 py-2 font-medium">Sport</th>
          <th className="px-3 py-2 font-medium">Weight</th>
          <th className="px-3 py-2 font-medium">Pro record</th>
          <th className="px-3 py-2 font-medium">Am record</th>
          <th className="px-3 py-2 font-medium">Gym</th>
        </tr>
      }
    >
      {fighters.map((f) => (
        <tr key={f.id} className="hover:bg-muted/40">
          <td className="px-3 py-2">
            <Link href={`/fighters/${f.id}`} className="font-medium hover:underline">
              {f.full_name}
            </Link>
            {f.nickname && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                &quot;{f.nickname}&quot;
              </span>
            )}
          </td>
          <td className="px-3 py-2">
            <Badge variant="secondary" className="capitalize">
              {f.primary_sport}
            </Badge>
          </td>
          <td className="px-3 py-2 text-muted-foreground">{f.weight_class || "—"}</td>
          <td className="px-3 py-2 font-mono text-xs">{fighterProRecord(f)}</td>
          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
            {f.am_wins}-{f.am_losses}-{f.am_draws}
          </td>
          <td className="px-3 py-2 text-muted-foreground">
            {f.gym_id && gymMap.has(f.gym_id) ? (
              <Link href={`/gyms/${f.gym_id}`} className="hover:underline">
                {gymMap.get(f.gym_id)}
              </Link>
            ) : (
              f.gym || "—"
            )}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function CardView({ fighters, gymMap }: { fighters: Fighter[]; gymMap: Map<string, string> }) {
  return (
    <CardGrid>
      {fighters.map((f) => (
        <Link
          key={f.id}
          href={`/fighters/${f.id}`}
          className="group rounded-xl border border-border bg-card p-4 outline-none transition-all hover:-translate-y-0.5 hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="flex items-start gap-3">
            <Avatar size="lg">
              {f.photo_url && <AvatarImage src={f.photo_url} alt={f.full_name} />}
              <AvatarFallback>{initials(f.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate font-heading font-medium">{f.full_name}</div>
              {f.nickname && (
                <div className="truncate text-xs text-muted-foreground">&quot;{f.nickname}&quot;</div>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="capitalize text-[10px]">
                  {f.primary_sport}
                </Badge>
                {f.weight_class && (
                  <Badge variant="outline" className="text-[10px]">
                    {f.weight_class}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pro</div>
              <div className="font-mono font-medium">{fighterProRecord(f)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Am</div>
              <div className="font-mono text-muted-foreground">
                {f.am_wins}-{f.am_losses}-{f.am_draws}
              </div>
            </div>
          </div>
          {gymName(f, gymMap) && (
            <div className="mt-2 truncate text-xs text-muted-foreground">
              {gymName(f, gymMap)}
            </div>
          )}
        </Link>
      ))}
    </CardGrid>
  );
}

function GridView({ fighters, gymMap }: { fighters: Fighter[]; gymMap: Map<string, string> }) {
  return (
    <TileGrid dense>
      {fighters.map((f) => (
        <Link
          key={f.id}
          href={`/fighters/${f.id}`}
          className="group flex flex-col items-center rounded-xl border border-border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:border-foreground/30"
        >
          <Avatar size="lg" className="mb-2 !size-16">
            {f.photo_url && <AvatarImage src={f.photo_url} alt={f.full_name} />}
            <AvatarFallback>{initials(f.full_name)}</AvatarFallback>
          </Avatar>
          <div className="w-full truncate text-sm font-medium">{f.full_name}</div>
          <div className="w-full truncate text-[10px] capitalize text-muted-foreground">
            {f.primary_sport}
            {f.weight_class ? ` · ${f.weight_class}` : ""}
          </div>
          <div className="mt-1 font-mono text-xs">{fighterProRecord(f)}</div>
          {gymName(f, gymMap) && (
            <div className="mt-0.5 w-full truncate text-[10px] text-muted-foreground/70">
              {gymName(f, gymMap)}
            </div>
          )}
        </Link>
      ))}
    </TileGrid>
  );
}

function CompactView({ fighters, gymMap }: { fighters: Fighter[]; gymMap: Map<string, string> }) {
  return (
    <CompactList>
      {fighters.map((f) => (
        <Link
          key={f.id}
          href={`/fighters/${f.id}`}
          className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-muted/40"
        >
          <span className="font-mono text-[10px] uppercase text-muted-foreground w-14 shrink-0">
            {f.primary_sport.slice(0, 5)}
          </span>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{f.full_name}</span>
            {f.nickname && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                &quot;{f.nickname}&quot;
              </span>
            )}
          </span>
          <span className="w-20 shrink-0 truncate text-right text-xs text-muted-foreground">
            {f.weight_class ?? ""}
          </span>
          <span className="w-16 shrink-0 text-right font-mono text-xs">{fighterProRecord(f)}</span>
          <span className="hidden w-40 shrink-0 truncate text-right text-xs text-muted-foreground sm:block">
            {gymName(f, gymMap) ?? ""}
          </span>
        </Link>
      ))}
    </CompactList>
  );
}

function KanbanView({ fighters, gymMap }: { fighters: Fighter[]; gymMap: Map<string, string> }) {
  const buckets = new Map<string, Fighter[]>();
  for (const s of SPORTS) buckets.set(s, []);
  for (const f of fighters) {
    const key = (SPORTS as readonly string[]).includes(f.primary_sport)
      ? f.primary_sport
      : "other";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(f);
  }
  const columns = Array.from(buckets.entries())
    .filter(([, arr]) => arr.length > 0)
    .map(([sport, items]) => ({
      key: sport,
      header: <span className="text-xs font-medium capitalize">{sport}</span>,
      items,
    }));

  return (
    <KanbanBoard
      columns={columns}
      renderItem={(f) => (
        <Link
          key={f.id}
          href={`/fighters/${f.id}`}
          className="block rounded-lg border border-border bg-background p-2 text-xs hover:border-foreground/30"
        >
          <div className="truncate font-medium">{f.full_name}</div>
          <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="truncate">{f.weight_class ?? "—"}</span>
            <span className="font-mono">{fighterProRecord(f)}</span>
          </div>
          {gymName(f, gymMap) && (
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
              {gymName(f, gymMap)}
            </div>
          )}
        </Link>
      )}
    />
  );
}

function GalleryView({ fighters }: { fighters: Fighter[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {fighters.map((f) => (
        <Link
          key={f.id}
          href={`/fighters/${f.id}`}
          className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted"
        >
          {f.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={f.photo_url}
              alt={f.full_name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50 text-3xl font-heading text-muted-foreground/50">
              {initials(f.full_name)}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white">
            <div className="truncate text-sm font-medium">{f.full_name}</div>
            <div className="flex items-center justify-between text-[10px] text-white/80">
              <span className="capitalize">{f.primary_sport}</span>
              <span className="font-mono">{fighterProRecord(f)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
