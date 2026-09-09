import Link from "next/link";
import { MapPin, Plus } from "lucide-react";

import { db } from "@/lib/db/client";
import { fmtDateShort as formatDate } from "@/lib/format-utils";
import { EVENT_STATUS_VARIANT as STATUS_VARIANT } from "@/lib/ui-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { canCreateEvents } from "@/lib/auth/roles";
import { ViewSwitcher } from "@/components/view-switcher";
import { KanbanBoard } from "@/components/views/kanban";
import { CardGrid, CompactList, TableShell, TileGrid } from "@/components/views/containers";
import { pickView } from "@/lib/view-mode";
import { EVENT_STATUSES, type EventRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const VIEWS = [
  "list",
  "card",
  "grid",
  "compact",
  "kanban",
  "calendar",
  "timeline",
] as const;

type Search = { view?: string };

export default async function EventsListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { view: rawView } = await searchParams;
  const view = pickView(rawView, VIEWS);

  const [{ data: events, error }, session] = await Promise.all([
    db().from("events").select("*").order("event_date", { ascending: false }),
    getSessionUser(),
  ]);
  const canCreate = session ? canCreateEvents(session.approvedRoles, session.isStaff) : false;
  const list = (events ?? []) as EventRow[];

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cards, bouts, weigh-ins.</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewSwitcher views={[...VIEWS]} current={view} />
          {canCreate && (
            <Button
              render={
                <Link href="/events/new">
                  <Plus className="h-4 w-4" />
                  New event
                </Link>
              }
            />
          )}
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {list.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No events yet.
        </div>
      ) : (
        <>
          {view === "list" && <ListView events={list} />}
          {view === "card" && <CardView events={list} />}
          {view === "grid" && <GridView events={list} />}
          {view === "compact" && <CompactView events={list} />}
          {view === "kanban" && <KanbanView events={list} />}
          {view === "calendar" && <CalendarView events={list} />}
          {view === "timeline" && <TimelineView events={list} />}
        </>
      )}
    </>
  );
}

function locationOf(e: EventRow): string {
  return [e.venue, e.city, e.state].filter(Boolean).join(", ") || "—";
}

function ListView({ events }: { events: EventRow[] }) {
  return (
    <TableShell
      head={
        <tr>
          <th className="px-3 py-2 font-medium">Event</th>
          <th className="px-3 py-2 font-medium">Date</th>
          <th className="px-3 py-2 font-medium">Sport</th>
          <th className="px-3 py-2 font-medium">Location</th>
          <th className="px-3 py-2 font-medium">Status</th>
        </tr>
      }
    >
      {events.map((e) => (
            <tr key={e.id} className="hover:bg-muted/40">
              <td className="px-3 py-2">
                <Link href={`/events/${e.id}`} className="font-medium hover:underline">
                  {e.name}
                </Link>
                {e.promoter && (
                  <div className="text-xs text-muted-foreground">{e.promoter}</div>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(e.event_date)}</td>
              <td className="px-3 py-2">
                <Badge variant="secondary" className="capitalize">
                  {e.primary_sport}
                </Badge>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{locationOf(e)}</td>
              <td className="px-3 py-2">
                <Badge variant={STATUS_VARIANT[e.status] ?? "outline"} className="capitalize">
                  {e.status}
                </Badge>
              </td>
            </tr>
          ))}
    </TableShell>
  );
}

function CardView({ events }: { events: EventRow[] }) {
  return (
    <CardGrid>
      {events.map((e) => (
        <Link
          key={e.id}
          href={`/events/${e.id}`}
          className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/30"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-heading font-medium">{e.name}</div>
              {e.promoter && (
                <div className="truncate text-xs text-muted-foreground">{e.promoter}</div>
              )}
            </div>
            <Badge variant={STATUS_VARIANT[e.status] ?? "outline"} className="shrink-0 capitalize">
              {e.status}
            </Badge>
          </div>
          <div className="text-lg font-semibold">{formatDate(e.event_date)}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{locationOf(e)}</span>
          </div>
          <Badge variant="secondary" className="w-fit capitalize">
            {e.primary_sport}
          </Badge>
        </Link>
      ))}
    </CardGrid>
  );
}

function GridView({ events }: { events: EventRow[] }) {
  return (
    <TileGrid>
      {events.map((e) => (
        <Link
          key={e.id}
          href={`/events/${e.id}`}
          className="group flex flex-col rounded-xl border border-border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:border-foreground/30"
        >
          <div className="mb-2 rounded-lg bg-muted/40 px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {new Date(`${e.event_date}T00:00:00`).toLocaleDateString("en-US", { month: "short" })}
            </div>
            <div className="font-heading text-2xl leading-none">
              {new Date(`${e.event_date}T00:00:00`).getDate()}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {new Date(`${e.event_date}T00:00:00`).getFullYear()}
            </div>
          </div>
          <div className="truncate text-sm font-medium">{e.name}</div>
          <div className="mt-1 truncate text-[10px] capitalize text-muted-foreground">
            {e.primary_sport} · {e.status}
          </div>
        </Link>
      ))}
    </TileGrid>
  );
}

function CompactView({ events }: { events: EventRow[] }) {
  return (
    <CompactList>
      {events.map((e) => (
        <Link
          key={e.id}
          href={`/events/${e.id}`}
          className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-muted/40"
        >
          <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
            {formatDate(e.event_date)}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
          <span className="hidden w-40 shrink-0 truncate text-xs text-muted-foreground sm:block">
            {locationOf(e)}
          </span>
          <Badge
            variant={STATUS_VARIANT[e.status] ?? "outline"}
            className="w-20 justify-center capitalize"
          >
            {e.status}
          </Badge>
        </Link>
      ))}
    </CompactList>
  );
}

function KanbanView({ events }: { events: EventRow[] }) {
  const buckets = new Map<string, EventRow[]>();
  for (const s of EVENT_STATUSES) buckets.set(s, []);
  for (const e of events) {
    if (!buckets.has(e.status)) buckets.set(e.status, []);
    buckets.get(e.status)!.push(e);
  }
  const columns = Array.from(buckets.entries()).map(([status, items]) => ({
    key: status,
    header: (
      <Badge variant={STATUS_VARIANT[status] ?? "outline"} className="capitalize">
        {status}
      </Badge>
    ),
    items,
  }));

  return (
    <KanbanBoard
      columns={columns}
      renderItem={(e) => (
        <Link
          key={e.id}
          href={`/events/${e.id}`}
          className="block rounded-lg border border-border bg-background p-2 text-xs hover:border-foreground/30"
        >
          <div className="truncate font-medium">{e.name}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {formatDate(e.event_date)}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
            {locationOf(e)}
          </div>
        </Link>
      )}
    />
  );
}

function CalendarView({ events }: { events: EventRow[] }) {
  // Group events by YYYY-MM, then render a mini month grid per month.
  const months = new Map<string, EventRow[]>();
  for (const e of events) {
    const key = e.event_date.slice(0, 7); // YYYY-MM
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(e);
  }
  const ordered = Array.from(months.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {ordered.map(([ym, arr]) => {
        const [y, m] = ym.split("-").map(Number);
        const first = new Date(y, m - 1, 1);
        const daysInMonth = new Date(y, m, 0).getDate();
        const leadingBlanks = first.getDay();
        const cells: (EventRow[] | null)[] = Array(leadingBlanks).fill(null);
        for (let d = 1; d <= daysInMonth; d++) {
          const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          cells.push(arr.filter((e) => e.event_date === iso));
        }

        return (
          <div key={ym} className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-heading text-sm font-medium">
                {first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
              <span className="text-[10px] text-muted-foreground">{arr.length} events</span>
            </div>
            <div className="grid grid-cols-7 gap-px rounded border border-border bg-border text-[10px]">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i} className="bg-muted px-1 py-0.5 text-center font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
              {cells.map((c, i) => {
                if (c === null) return <div key={i} className="min-h-12 bg-background/40" />;
                const day = i - leadingBlanks + 1;
                return (
                  <div key={i} className="relative min-h-12 space-y-0.5 bg-background p-1">
                    <div className="text-right text-[9px] text-muted-foreground">{day}</div>
                    {c.map((e) => (
                      <Link
                        key={e.id}
                        href={`/events/${e.id}`}
                        title={e.name}
                        className={`block truncate rounded px-1 text-[9px] text-white ${
                          e.status === "canceled"
                            ? "bg-destructive/70"
                            : e.status === "complete"
                              ? "bg-muted-foreground"
                              : "bg-primary"
                        }`}
                      >
                        {e.name}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineView({ events }: { events: EventRow[] }) {
  const sorted = [...events].sort((a, b) => b.event_date.localeCompare(a.event_date));
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
      <div className="space-y-4">
        {sorted.map((e) => (
          <div key={e.id} className="relative">
            <div
              className={`absolute -left-[18px] top-2 h-3 w-3 rounded-full ring-2 ring-background ${
                e.status === "canceled"
                  ? "bg-destructive"
                  : e.status === "complete"
                    ? "bg-muted-foreground"
                    : "bg-primary"
              }`}
            />
            <Link
              href={`/events/${e.id}`}
              className="block rounded-lg border border-border bg-card p-3 hover:border-foreground/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-muted-foreground">
                    {formatDate(e.event_date)}
                  </div>
                  <div className="mt-0.5 truncate font-medium">{e.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{locationOf(e)}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={STATUS_VARIANT[e.status] ?? "outline"} className="capitalize">
                    {e.status}
                  </Badge>
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {e.primary_sport}
                  </Badge>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
