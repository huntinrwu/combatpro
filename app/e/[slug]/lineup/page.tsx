import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { ArrowLeft, TriangleAlert } from "lucide-react";

import { RealtimeRefresher } from "../_components/realtime-refresher";
import { db } from "@/lib/db/client";
import { fmtDateLong } from "@/lib/format-utils";
import { parseBoard } from "@/lib/matchmaking";
import { weightClassesForSport } from "@/lib/weight-classes";
import { Logo } from "@/components/logo";
import type { EventRow, EventRosterEntry, Fighter, Gym } from "@/lib/db/types";

type LineupEvent = Pick<
  EventRow,
  "id" | "name" | "event_date" | "venue" | "city" | "state" | "status" | "primary_sport" | "matchmaking"
>;

const loadEvent = cache(async (slug: string) => {
  const { data } = await db()
    .from("events")
    .select("id, name, event_date, venue, city, state, status, primary_sport, matchmaking")
    .eq("slug", slug)
    .in("status", ["scheduled", "complete"])
    .maybeSingle<LineupEvent>();
  return data;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  return { title: event ? `Fighters & matchups — ${event.name}` : "Event not found — CombatPro" };
}

// Only what is fine to show the public: name, gym, weight class. No ages,
// contact details or medical information.
type RosterRow = Pick<EventRosterEntry, "id" | "fighter_id" | "weight_class"> & {
  fighter:
    | (Pick<Fighter, "full_name" | "gym" | "gym_id"> & { gym_ref: Pick<Gym, "name"> | null })
    | null;
};

type BoutRow = {
  id: string;
  weight_class: string | null;
  red_corner_fighter_id: string | null;
  blue_corner_fighter_id: string | null;
  red: Pick<Fighter, "full_name"> | null;
  blue: Pick<Fighter, "full_name"> | null;
};

const DISCLAIMER =
  "Matchups and brackets on this page are tentative. They are temporary, can change at any time, and are not guaranteed on the day of the event.";

export default async function PublicLineupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) notFound();

  const supabase = db();
  const [rosterRes, boutsRes] = await Promise.all([
    supabase
      .from("event_fighters")
      .select(
        "id, fighter_id, weight_class, fighter:fighters(full_name, gym, gym_id, gym_ref:gyms(name))",
      )
      .eq("event_id", event.id)
      .neq("status", "withdrawn"),
    supabase
      .from("bouts")
      .select(
        "id, weight_class, red_corner_fighter_id, blue_corner_fighter_id, red:fighters!red_corner_fighter_id(full_name), blue:fighters!blue_corner_fighter_id(full_name)",
      )
      .eq("event_id", event.id)
      .order("bout_order", { ascending: true, nullsFirst: false }),
  ]);

  const roster = ((rosterRes.data ?? []) as unknown as RosterRow[])
    .filter((r) => r.fighter)
    .map((r) => ({
      id: r.id,
      fighterId: r.fighter_id,
      name: r.fighter!.full_name,
      gym: (r.fighter!.gym_id ? r.fighter!.gym_ref?.name : r.fighter!.gym) ?? null,
      weightClass: r.weight_class,
    }));
  const byEntry = new Map(roster.map((r) => [r.id, r]));
  const bouts = (boutsRes.data ?? []) as unknown as BoutRow[];

  const onCard = new Set<string>();
  for (const b of bouts) {
    if (b.red_corner_fighter_id) onCard.add(b.red_corner_fighter_id);
    if (b.blue_corner_fighter_id) onCard.add(b.blue_corner_fighter_id);
  }

  // Matchups: bouts already on the card, then the matchmaker's saved pairings
  // for fighters who aren't on a bout yet.
  const matchups: { key: string; red: string; blue: string; weightClass: string | null }[] =
    bouts.map((b) => ({
      key: b.id,
      red: b.red?.full_name ?? "TBD",
      blue: b.blue?.full_name ?? "TBD",
      weightClass: b.weight_class,
    }));
  const board = parseBoard((event.matchmaking as { board?: unknown } | null)?.board);
  const used = new Set<string>();
  for (const [x, y] of board?.pairs ?? []) {
    const a = x ? byEntry.get(x) : undefined;
    const b = y ? byEntry.get(y) : undefined;
    if (!a || !b || a.id === b.id || used.has(a.id) || used.has(b.id)) continue;
    if (onCard.has(a.fighterId) || onCard.has(b.fighterId)) continue;
    used.add(a.id);
    used.add(b.id);
    matchups.push({
      key: `${a.id}|${b.id}`,
      red: a.name,
      blue: b.name,
      weightClass:
        a.weightClass && a.weightClass === b.weightClass
          ? a.weightClass
          : ([a.weightClass, b.weightClass].filter(Boolean).join(" / ") || null),
    });
  }

  // Brackets: everyone registered, grouped by weight class, lightest first.
  const classes = weightClassesForSport(event.primary_sport) ?? [];
  const rank = (name: string) => {
    const i = classes.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
    return i < 0 ? classes.length : i;
  };
  const groups = new Map<string, typeof roster>();
  for (const r of roster) {
    const key = r.weightClass ?? "";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const brackets = [...groups.entries()]
    .map(([name, members]) => ({
      name,
      members: members.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort(
      (a, b) =>
        Number(a.name === "") - Number(b.name === "") ||
        rank(a.name) - rank(b.name) ||
        a.name.localeCompare(b.name),
    );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/60 bg-neutral-950 text-white">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 font-heading text-sm tracking-wide">
            <Logo size={24} />
            <span>CombatPro</span>
          </Link>
          <div className="text-white/50">
            <RealtimeRefresher eventId={event.id} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <Link
          href={`/e/${slug}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Event page
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {event.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fmtDateLong(event.event_date)}
          {[event.venue, event.city, event.state].filter(Boolean).length > 0 &&
            ` · ${[event.venue, event.city, event.state].filter(Boolean).join(", ")}`}
        </p>

        <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>{DISCLAIMER}</p>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 font-heading text-lg font-semibold tracking-tight">
            Tentative matchups{" "}
            <span className="text-sm font-normal text-muted-foreground">({matchups.length})</span>
          </h2>
          {matchups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No matchups yet. They will appear here as they are made.
            </div>
          ) : (
            <ol className="space-y-2">
              {matchups.map((m) => (
                <li key={m.key} className="rounded-lg border border-border/70 bg-card px-4 py-3">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      {m.red}
                    </span>
                    <span className="text-xs font-normal uppercase tracking-widest text-muted-foreground">
                      vs
                    </span>
                    <span className="flex flex-row-reverse items-center gap-2 text-right">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      {m.blue}
                    </span>
                  </div>
                  {m.weightClass && (
                    <div className="mt-1 text-center text-xs text-muted-foreground">
                      {m.weightClass}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 font-heading text-lg font-semibold tracking-tight">
            Registered fighters{" "}
            <span className="text-sm font-normal text-muted-foreground">({roster.length})</span>
          </h2>
          {roster.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No fighters registered yet.
            </div>
          ) : (
            <div className="space-y-5">
              {brackets.map((g) => (
                <div key={g.name}>
                  <div className="mb-1.5 flex items-baseline gap-2 text-sm font-medium">
                    {g.name || "Weight class to be decided"}
                    <span className="text-xs font-normal text-muted-foreground">
                      {g.members.length}
                    </span>
                  </div>
                  <ul className="divide-y divide-border rounded-lg border border-border/70 text-sm">
                    {g.members.map((f) => (
                      <li key={f.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                        <span>{f.name}</span>
                        {f.gym && <span className="text-xs text-muted-foreground">{f.gym}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="mt-10 text-xs text-muted-foreground">{DISCLAIMER}</p>
      </main>

      <footer className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto w-full max-w-3xl px-6 py-4 text-xs text-muted-foreground">
          Powered by CombatPro
        </div>
      </footer>
    </div>
  );
}
