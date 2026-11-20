import Link from "next/link";
import { MapPin, Plus } from "lucide-react";

import { db } from "@/lib/db/client";
import { closePastEvents } from "@/lib/db/close-past-events";
import { fmtDateShort as formatDate } from "@/lib/format-utils";
import { EVENT_STATUS_VARIANT as STATUS_VARIANT } from "@/lib/ui-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionUser, requireModuleAccess } from "@/lib/auth/session";
import { eventOwnerScope } from "@/lib/auth/event-scope";
import { canCreateEvents } from "@/lib/auth/roles";
import { ViewSwitcher } from "@/components/view-switcher";
import { KanbanBoard } from "@/components/views/kanban";
import { CardGrid, CompactList, TableShell, TileGrid } from "@/components/views/containers";
import { pickView } from "@/lib/view-mode";
import { EVENT_STATUSES, EVENT_TYPE_LABELS, type EventRow } from "@/lib/db/types";

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

// Only the columns the list views render.
type EventListRow = Pick<
  EventRow,
  | "id"
  | "name"
  | "promoter"
  | "event_date"
  | "primary_sport"
  | "event_type"
  | "venue"
  | "city"
  | "state"
  | "status"
>;

export default async function EventsListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const viewer = await requireModuleAccess("events");
  const ownerScope = eventOwnerScope(viewer);
  const { view: rawView } = await searchParams;
  const view = pickView(rawView, VIEWS);

  // Scheduled events whose date has passed are closed before the list is read,
  // so what is shown here is always current (a daily cron covers other pages).
  await closePastEvents();

  const eventsQuery = db()
    .from("events")
    .select("id, name, promoter, event_date, primary_sport, event_type, venue, city, state, status")
    .order("event_date", { ascending: false });
  const [{ data: events, error }, session] = await Promise.all([
    // Promoters only get the events they created.
    ownerScope ? eventsQuery.eq("created_by", ownerScope) : eventsQuery,
    getSessionUser(),
  ]);
  const canCreate = session ? canCreateEvents(session.approvedRoles, session.isStaff) : false;
  const list = (events ?? []) as EventListRow[];

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
          {(view === "list" || view === "card" || view === "grid" || view === "compact") && (
            <div className="space-y-8">
              {sectionsOf(list).map((section) => (
                <section key={section.title}>
                  <h2 className="mb-3 flex items-baseline gap-2 font-heading text-lg font-semibold">
                    {section.title}
                    <span className="text-sm font-normal text-muted-foreground">
                      {section.events.length}
                    </span>
                  </h2>
                  {view === "list" && <ListView events={section.events} />}
                  {view === "card" && <CardView events={section.events} />}
                  {view === "grid" && <GridView events={section.events} />}
                  {view === "compact" && <CompactView events={section.events} />}
                </section>
              ))}
            </div>
          )}
          {view === "kanban" && <KanbanView events={list} />}
          {view === "calendar" && <CalendarView events={list} />}
          {view === "timeline" && <TimelineView events={list} />}
        </>
      )}
    </>
  );
}

// Split the list so what's coming up is never buried under what's done.
// Events arrive newest-first; upcoming ones are flipped to soonest-first.
function sectionsOf(events: EventListRow[]): { title: string; events: EventListRow[] }[] {
  const by = (status: EventListRow["status"]) => events.filter((e) => e.status === status);
  return [
    { title: "Upcoming", events: by("scheduled").reverse() },
    { title: "Drafts", events: by("draft").reverse() },
    { title: "Past", events: by("complete") },
    { title: "Canceled", events: by("canceled") },
  ].filter((s) => s.events.length > 0);
}

function locationOf(e: EventListRow): string {
  return [e.venue, e.city, e.state].filter(Boolean).join(", ") || "—";
}

function ListView({ events }: { events: EventListRow[] }) {
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
                {e.event_type && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {EVENT_TYPE_LABELS[e.event_type]}
                  </div>
                )}
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

function CardView({ events }: { events: EventListRow[] }) {
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
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="secondary" className="w-fit capitalize">
              {e.primary_sport}
            </Badge>
            {e.event_type && (
              <Badge variant="outline" className="w-fit">
                {EVENT_TYPE_LABELS[e.event_type]}
              </Badge>
            )}
          </div>
        </Link>
      ))}
    </CardGrid>
  );
}

function GridView({ events }: { events: EventListRow[] }) {
  return (
    <TileGrid>
      {events.map((e) => {
        const date = new Date(`${e.event_date}T00:00:00`);
        return (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="group flex flex-col rounded-xl border border-border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:border-foreground/30"
          >
            <div className="mb-2 rounded-lg bg-muted/40 px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {date.toLocaleDateString("en-US", { month: "short" })}
              </div>
              <div className="font-heading text-2xl leading-none">{date.getDate()}</div>
              <div className="text-[10px] text-muted-foreground">{date.getFullYear()}</div>
            </div>
            <div className="truncate text-sm font-medium">{e.name}</div>
            <div className="mt-1 truncate text-[10px] capitalize text-muted-foreground">
              {e.primary_sport} · {e.status}
            </div>
          </Link>
        );
      })}
    </TileGrid>
  );
}

function CompactView({ events }: { events: EventListRow[] }) {
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

function KanbanView({ events }: { events: EventListRow[] }) {
  const buckets = new Map<string, EventListRow[]>();
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

function CalendarView({ events }: { events: EventListRow[] }) {
  // Group events by YYYY-MM, then render a mini month grid per month.
  const months = new Map<string, EventListRow[]>();
  for (const e of events) {
    const key = e.event_date.slice(0, 7); // YYYY-MM
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(e);
  }
  // Events arrive newest-first, so months are already in display order.
  const ordered = Array.from(months.entries());

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {ordered.map(([ym, arr]) => {
        const [y, m] = ym.split("-").map(Number);
        const first = new Date(y, m - 1, 1);
        const daysInMonth = new Date(y, m, 0).getDate();
        const leadingBlanks = first.getDay();
        const byDate = new Map<string, EventListRow[]>();
        for (const e of arr) {
          const list = byDate.get(e.event_date) ?? [];
          list.push(e);
          byDate.set(e.event_date, list);
        }
        const cells: (EventListRow[] | null)[] = Array(leadingBlanks).fill(null);
        for (let d = 1; d <= daysInMonth; d++) {
          const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          cells.push(byDate.get(iso) ?? []);
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

function TimelineView({ events }: { events: EventListRow[] }) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
      <div className="space-y-4">
        {events.map((e) => (
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
