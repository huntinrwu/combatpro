import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

import { db } from "@/lib/db/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ViewSwitcher } from "@/components/view-switcher";
import { KanbanBoard } from "@/components/views/kanban";
import { CompactList, TableShell, TileGrid } from "@/components/views/containers";
import { pickView } from "@/lib/view-mode";
import type { EventRow, SanctioningBody } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const VIEWS = ["list", "card", "grid", "compact", "kanban"] as const;

type Search = { view?: string };
type Counts = { total: number; upcoming: number };

export default async function SbIndexPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { view: rawView } = await searchParams;
  const view = pickView(rawView, VIEWS);

  const supabase = db();

  const [{ data: bodies }, { data: events }] = await Promise.all([
    supabase
      .from("sanctioning_bodies")
      .select("*")
      .eq("status", "approved")
      .order("abbreviation"),
    supabase.from("events").select("id, sanctioning_body_id, event_date, status"),
  ]);

  const eventCounts = new Map<string, Counts>();
  const today = new Date().toISOString().slice(0, 10);
  for (const e of (events ?? []) as Pick<
    EventRow,
    "id" | "sanctioning_body_id" | "event_date" | "status"
  >[]) {
    if (!e.sanctioning_body_id) continue;
    const entry = eventCounts.get(e.sanctioning_body_id) ?? { total: 0, upcoming: 0 };
    entry.total++;
    if (e.event_date >= today && e.status !== "canceled" && e.status !== "complete") {
      entry.upcoming++;
    }
    eventCounts.set(e.sanctioning_body_id, entry);
  }

  const list = (bodies ?? []) as SanctioningBody[];

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sanctioning body view
          </p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
            Pick a sanctioning body
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            POC preview — anyone can look at any SB&apos;s dashboard. Once auth lands, this page
            will disappear and each SB rep will land straight on their own dashboard.
          </p>
        </div>
        <ViewSwitcher views={[...VIEWS]} current={view} />
      </header>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No approved sanctioning bodies yet. Add one in{" "}
          <Link href="/registry" className="underline hover:text-foreground">
            Registry
          </Link>
          .
        </p>
      ) : (
        <>
          {view === "card" && <CardView bodies={list} counts={eventCounts} />}
          {view === "list" && <ListView bodies={list} counts={eventCounts} />}
          {view === "grid" && <GridView bodies={list} counts={eventCounts} />}
          {view === "compact" && <CompactView bodies={list} counts={eventCounts} />}
          {view === "kanban" && <KanbanView bodies={list} counts={eventCounts} />}
        </>
      )}
    </>
  );
}

function CardView({
  bodies,
  counts,
}: {
  bodies: SanctioningBody[];
  counts: Map<string, Counts>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bodies.map((b) => {
        const c = counts.get(b.id) ?? { total: 0, upcoming: 0 };
        return (
          <Link
            key={b.id}
            href={`/sb/${b.id}`}
            className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-all group-hover:ring-foreground/20 group-hover:-translate-y-0.5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-mono">{b.abbreviation}</CardTitle>
                  <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground/50 transition group-hover:text-foreground" />
                </div>
                <CardDescription className="line-clamp-2">{b.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {b.scope}
                  </Badge>
                  {b.sports.slice(0, 3).map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px] capitalize">
                      {s}
                    </Badge>
                  ))}
                  {b.sports.length > 3 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{b.sports.length - 3}
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
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function ListView({
  bodies,
  counts,
}: {
  bodies: SanctioningBody[];
  counts: Map<string, Counts>;
}) {
  return (
    <TableShell
      head={
        <tr>
          <th className="px-3 py-2 font-medium">Body</th>
          <th className="px-3 py-2 font-medium">Name</th>
          <th className="px-3 py-2 font-medium">Scope</th>
          <th className="px-3 py-2 font-medium">Sports</th>
          <th className="px-3 py-2 font-medium text-right">Upcoming</th>
          <th className="px-3 py-2 font-medium text-right">Total</th>
        </tr>
      }
    >
      {bodies.map((b) => {
            const c = counts.get(b.id) ?? { total: 0, upcoming: 0 };
            return (
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
                  <div className="flex flex-wrap gap-1">
                    {b.sports.slice(0, 4).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] capitalize">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">{c.upcoming}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{c.total}</td>
              </tr>
            );
          })}
    </TableShell>
  );
}

function GridView({
  bodies,
  counts,
}: {
  bodies: SanctioningBody[];
  counts: Map<string, Counts>;
}) {
  return (
    <TileGrid dense>
      {bodies.map((b) => {
        const c = counts.get(b.id) ?? { total: 0, upcoming: 0 };
        return (
          <Link
            key={b.id}
            href={`/sb/${b.id}`}
            className="group flex flex-col items-center rounded-xl border border-border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:border-foreground/30"
          >
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-muted font-mono text-sm font-medium">
              {b.abbreviation}
            </div>
            <div className="w-full truncate text-[10px] text-muted-foreground">{b.name}</div>
            <div className="mt-1 text-[10px] capitalize">{b.scope}</div>
            <div className="mt-0.5 text-[10px] font-mono">
              {c.upcoming}↑ / {c.total}
            </div>
          </Link>
        );
      })}
    </TileGrid>
  );
}

function CompactView({
  bodies,
  counts,
}: {
  bodies: SanctioningBody[];
  counts: Map<string, Counts>;
}) {
  return (
    <CompactList>
      {bodies.map((b) => {
        const c = counts.get(b.id) ?? { total: 0, upcoming: 0 };
        return (
          <Link
            key={b.id}
            href={`/sb/${b.id}`}
            className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-muted/40"
          >
            <span className="w-16 shrink-0 font-mono text-xs">{b.abbreviation}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{b.name}</span>
            <span className="hidden w-20 shrink-0 text-right text-xs capitalize text-muted-foreground sm:block">
              {b.scope}
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-xs">{c.upcoming}</span>
            <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
              {c.total}
            </span>
          </Link>
        );
      })}
    </CompactList>
  );
}

function KanbanView({
  bodies,
  counts,
}: {
  bodies: SanctioningBody[];
  counts: Map<string, Counts>;
}) {
  const buckets = new Map<string, SanctioningBody[]>();
  for (const b of bodies) {
    if (!buckets.has(b.scope)) buckets.set(b.scope, []);
    buckets.get(b.scope)!.push(b);
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
      renderItem={(b) => {
        const c = counts.get(b.id) ?? { total: 0, upcoming: 0 };
        return (
          <Link
            key={b.id}
            href={`/sb/${b.id}`}
            className="block rounded-lg border border-border bg-background p-2 text-xs hover:border-foreground/30"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-medium">{b.abbreviation}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                {b.name}
              </span>
            </div>
            <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">
              {c.upcoming}/{c.total}
            </div>
          </Link>
        );
      }}
    />
  );
}
