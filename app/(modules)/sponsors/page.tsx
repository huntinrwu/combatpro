import Link from "next/link";
import { ExternalLink, Handshake, Lock, Plus } from "lucide-react";

import { deleteSponsor } from "./actions";
import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ViewSwitcher } from "@/components/view-switcher";
import { KanbanBoard } from "@/components/views/kanban";
import { CardGrid, CompactList, TableShell, TileGrid } from "@/components/views/containers";
import { pickView } from "@/lib/view-mode";
import {
  fmtMoney,
  num,
  sponsorTierLabel,
  SPONSOR_TIERS,
  type EventSponsor,
  type Sponsor,
  type SponsorTier,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

const VIEWS = ["list", "card", "grid", "compact", "kanban"] as const;

type Search = { view?: string };

type Stats = {
  events: Set<string>;
  contracted: number;
  paid: number;
  amountsVisible: boolean;
  ownedEvents: number;
  topTier: SponsorTier | null;
  topTierLabel: string | null;
  topTierRank: number;
};

export default async function SponsorsListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { view: rawView } = await searchParams;
  const view = pickView(rawView, VIEWS);

  const supabase = db();
  const session = await getSessionUser();
  const viewerId = session?.id ?? null;
  const isStaff = session?.isStaff ?? false;

  const [{ data: sponsors, error }, { data: slots }, { data: events }] =
    await Promise.all([
      supabase.from("sponsors").select("*").order("name"),
      supabase
        .from("event_sponsors")
        .select("id, sponsor_id, tier, contract_value, paid_at, event_id"),
      supabase.from("events").select("id, created_by"),
    ]);

  const list = (sponsors ?? []) as Sponsor[];
  const slotList = (slots ?? []) as Pick<
    EventSponsor,
    "id" | "sponsor_id" | "tier" | "contract_value" | "paid_at" | "event_id"
  >[];

  // Which events the viewer owns — staff sees all $, non-staff only their own.
  const ownerMap = new Map<string, string | null>();
  for (const e of (events ?? []) as { id: string; created_by: string | null }[]) {
    ownerMap.set(e.id, e.created_by);
  }
  const canSeeAmount = (eventId: string): boolean => {
    if (isStaff) return true;
    if (!viewerId) return false;
    return ownerMap.get(eventId) === viewerId;
  };

  const summary = new Map<string, Stats>();
  const rank: Record<string, number> = {
    title: 0,
    presenting: 1,
    gold: 2,
    silver: 3,
    bronze: 4,
    associate: 5,
    media: 6,
    in_kind: 7,
  };
  for (const s of slotList) {
    const entry: Stats = summary.get(s.sponsor_id) ?? {
      events: new Set<string>(),
      contracted: 0,
      paid: 0,
      amountsVisible: false,
      ownedEvents: 0,
      topTier: null,
      topTierLabel: null,
      topTierRank: 99,
    };
    entry.events.add(s.event_id);
    if (canSeeAmount(s.event_id)) {
      const amount = num(s.contract_value);
      entry.contracted += amount;
      if (s.paid_at) entry.paid += amount;
      entry.amountsVisible = true;
      entry.ownedEvents += 1;
    }
    const r = rank[s.tier] ?? 99;
    if (r < entry.topTierRank) {
      entry.topTierRank = r;
      entry.topTier = s.tier;
      entry.topTierLabel = sponsorTierLabel(s.tier);
    }
    summary.set(s.sponsor_id, entry);
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Handshake className="h-3.5 w-3.5" />
            Sponsors
          </p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
            Sponsor registry
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable sponsor records. Assign to any event with a tier + contract value.
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/80">
            <Lock className="h-3 w-3" />
            Contracted &amp; paid totals only include events you promote.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewSwitcher views={[...VIEWS]} current={view} />
          <Button
            render={
              <Link href="/sponsors/new">
                <Plus className="h-4 w-4" />
                New sponsor
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

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No sponsors yet. Add one to start attaching them to events.
        </div>
      ) : (
        <>
          {view === "list" && <ListView sponsors={list} summary={summary} />}
          {view === "card" && <CardView sponsors={list} summary={summary} />}
          {view === "grid" && <GridView sponsors={list} summary={summary} />}
          {view === "compact" && <CompactView sponsors={list} summary={summary} />}
          {view === "kanban" && <KanbanView sponsors={list} summary={summary} />}
        </>
      )}
    </>
  );
}

function ListView({ sponsors, summary }: { sponsors: Sponsor[]; summary: Map<string, Stats> }) {
  return (
    <TableShell
      head={
        <tr>
          <th className="px-3 py-2 font-medium">Sponsor</th>
          <th className="px-3 py-2 font-medium">Contact</th>
          <th className="px-3 py-2 font-medium">Top tier</th>
          <th className="px-3 py-2 font-medium text-right">Events</th>
          <th className="px-3 py-2 font-medium text-right">Contracted</th>
          <th className="px-3 py-2 font-medium text-right">Paid</th>
          <th className="px-3 py-2" />
        </tr>
      }
    >
      {sponsors.map((s) => {
            const stats = summary.get(s.id);
            return (
              <tr key={s.id} className="hover:bg-muted/40">
                <td className="px-3 py-2">
                  <Link href={`/sponsors/${s.id}`} className="font-medium hover:underline">
                    {s.name}
                  </Link>
                  {s.website && (
                    <a
                      href={s.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {s.contact_name || s.contact_email || "—"}
                </td>
                <td className="px-3 py-2">
                  {stats?.topTierLabel ? (
                    <Badge variant="outline">{stats.topTierLabel}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {stats?.events.size ?? 0}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {stats?.amountsVisible ? fmtMoney(stats.contracted) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-emerald-700 dark:text-emerald-300">
                  {stats?.amountsVisible ? fmtMoney(stats.paid) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <form action={deleteSponsor}>
                    <input type="hidden" name="id" value={s.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </form>
                </td>
              </tr>
            );
          })}
    </TableShell>
  );
}

function CardView({ sponsors, summary }: { sponsors: Sponsor[]; summary: Map<string, Stats> }) {
  return (
    <CardGrid>
      {sponsors.map((s) => {
        const stats = summary.get(s.id);
        return (
          <Link
            key={s.id}
            href={`/sponsors/${s.id}`}
            className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/30"
          >
            <div className="flex items-start gap-3">
              {s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.logo_url}
                  alt={s.name}
                  className="h-12 w-12 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-lg font-heading">
                  {s.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-heading font-medium">{s.name}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {s.contact_name || s.contact_email || "—"}
                </div>
              </div>
              {stats?.topTierLabel && (
                <Badge variant="outline" className="shrink-0">
                  {stats.topTierLabel}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-2 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Events
                </div>
                <div className="font-mono">{stats?.events.size ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Contracted
                </div>
                <div className="font-mono">
                  {stats?.amountsVisible ? fmtMoney(stats.contracted) : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Paid
                </div>
                <div className="font-mono text-emerald-700 dark:text-emerald-300">
                  {stats?.amountsVisible ? fmtMoney(stats.paid) : "—"}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </CardGrid>
  );
}

function GridView({ sponsors, summary }: { sponsors: Sponsor[]; summary: Map<string, Stats> }) {
  return (
    <TileGrid dense>
      {sponsors.map((s) => {
        const stats = summary.get(s.id);
        return (
          <Link
            key={s.id}
            href={`/sponsors/${s.id}`}
            className="group flex flex-col items-center rounded-xl border border-border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:border-foreground/30"
          >
            {s.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.logo_url}
                alt={s.name}
                className="mb-2 h-14 w-14 rounded-lg object-cover"
              />
            ) : (
              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-xl font-heading">
                {s.name.charAt(0)}
              </div>
            )}
            <div className="w-full truncate text-sm font-medium">{s.name}</div>
            {stats?.topTierLabel && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">{stats.topTierLabel}</div>
            )}
            <div className="mt-1 text-[10px] font-mono">
              {stats?.amountsVisible ? fmtMoney(stats.contracted) : "—"}
            </div>
          </Link>
        );
      })}
    </TileGrid>
  );
}

function CompactView({
  sponsors,
  summary,
}: {
  sponsors: Sponsor[];
  summary: Map<string, Stats>;
}) {
  return (
    <CompactList>
      {sponsors.map((s) => {
        const stats = summary.get(s.id);
        return (
          <Link
            key={s.id}
            href={`/sponsors/${s.id}`}
            className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-muted/40"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
            <span className="hidden w-20 shrink-0 truncate text-right text-xs text-muted-foreground sm:block">
              {stats?.topTierLabel ?? ""}
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-xs">
              {stats?.events.size ?? 0}
            </span>
            <span className="w-20 shrink-0 text-right font-mono text-xs">
              {stats?.amountsVisible ? fmtMoney(stats.contracted) : "—"}
            </span>
            <span className="w-20 shrink-0 text-right font-mono text-xs text-emerald-700 dark:text-emerald-300">
              {stats?.amountsVisible ? fmtMoney(stats.paid) : "—"}
            </span>
          </Link>
        );
      })}
    </CompactList>
  );
}

function KanbanView({
  sponsors,
  summary,
}: {
  sponsors: Sponsor[];
  summary: Map<string, Stats>;
}) {
  const buckets = new Map<string, Sponsor[]>();
  for (const t of SPONSOR_TIERS) buckets.set(t.value, []);
  const unassigned: Sponsor[] = [];
  for (const s of sponsors) {
    const stats = summary.get(s.id);
    if (!stats?.topTier) {
      unassigned.push(s);
    } else {
      if (!buckets.has(stats.topTier)) buckets.set(stats.topTier, []);
      buckets.get(stats.topTier)!.push(s);
    }
  }
  if (unassigned.length > 0) buckets.set("unassigned", unassigned);
  const columns = Array.from(buckets.entries()).map(([tier, items]) => ({
    key: tier,
    header: (
      <Badge variant="outline" className="capitalize">
        {tier === "unassigned" ? "unassigned" : sponsorTierLabel(tier as SponsorTier)}
      </Badge>
    ),
    items,
  }));

  return (
    <KanbanBoard
      columns={columns}
      renderItem={(s) => {
        const stats = summary.get(s.id);
        return (
          <Link
            key={s.id}
            href={`/sponsors/${s.id}`}
            className="block rounded-lg border border-border bg-background p-2 text-xs hover:border-foreground/30"
          >
            <div className="truncate font-medium">{s.name}</div>
            <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{stats?.events.size ?? 0} events</span>
              <span className="font-mono">
                {stats?.amountsVisible ? fmtMoney(stats.contracted) : "—"}
              </span>
            </div>
          </Link>
        );
      }}
    />
  );
}
