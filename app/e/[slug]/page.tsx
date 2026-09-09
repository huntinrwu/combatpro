import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  CalendarDays,
  Clock,
  ExternalLink,
  Handshake,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import { RealtimeRefresher } from "./_components/realtime-refresher";
import { db } from "@/lib/db/client";
import { fmtDateLong } from "@/lib/format-utils";
import { Badge } from "@/components/ui/badge";
import {
  SPONSOR_TIERS,
  sponsorTierLabel,
  type Bout,
  type Corner,
  type EventRow,
  type EventSponsor,
  type Fighter,
  type SanctioningBody,
  type Sponsor,
  type SponsorTier,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

async function loadEvent(slug: string) {
  const supabase = db();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .in("status", ["scheduled", "complete"])
    .maybeSingle<EventRow>();
  return event;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) {
    return { title: "Event not found — CombatPro" };
  }
  const where = [event.venue, event.city, event.state]
    .filter(Boolean)
    .join(", ");
  return {
    title: `${event.name} — CombatPro`,
    description: `${new Date(`${event.event_date}T00:00:00`).toLocaleDateString(
      "en-US",
      { month: "long", day: "numeric", year: "numeric" },
    )}${where ? ` · ${where}` : ""}`,
  };
}


type BoutWithFighters = Bout & {
  red?: Pick<Fighter, "id" | "full_name"> | null;
  blue?: Pick<Fighter, "id" | "full_name"> | null;
};

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = db();

  const event = await loadEvent(slug);
  if (!event) notFound();

  const [{ data: rawBouts }, sbRes, { data: sponsorSlots }] = await Promise.all([
    supabase
      .from("bouts")
      .select("*")
      .eq("event_id", event.id)
      .order("bout_order", { ascending: true, nullsFirst: false }),
    event.sanctioning_body_id
      ? supabase
          .from("sanctioning_bodies")
          .select("id, name, abbreviation, website")
          .eq("id", event.sanctioning_body_id)
          .maybeSingle<Pick<SanctioningBody, "id" | "name" | "abbreviation" | "website">>()
      : Promise.resolve({ data: null }),
    supabase.from("event_sponsors").select("*").eq("event_id", event.id),
  ]);

  const bouts = (rawBouts ?? []) as Bout[];
  const fighterIds = Array.from(
    new Set(
      bouts
        .flatMap((b) => [b.red_corner_fighter_id, b.blue_corner_fighter_id])
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const fighterMap = new Map<string, Pick<Fighter, "id" | "full_name">>();
  if (fighterIds.length > 0) {
    const { data: fighters } = await supabase
      .from("fighters")
      .select("id, full_name")
      .in("id", fighterIds);
    for (const f of fighters ?? []) fighterMap.set(f.id, f);
  }

  const enriched: BoutWithFighters[] = bouts.map((b) => ({
    ...b,
    red: b.red_corner_fighter_id ? fighterMap.get(b.red_corner_fighter_id) ?? null : null,
    blue: b.blue_corner_fighter_id ? fighterMap.get(b.blue_corner_fighter_id) ?? null : null,
  }));

  const slotList = (sponsorSlots ?? []) as EventSponsor[];
  const sponsorNameMap = new Map<string, string>();
  if (slotList.length > 0) {
    const sponsorIds = Array.from(new Set(slotList.map((s) => s.sponsor_id)));
    const { data: sponsorRows } = await supabase
      .from("sponsors")
      .select("id, name")
      .in("id", sponsorIds);
    for (const s of (sponsorRows ?? []) as Pick<Sponsor, "id" | "name">[]) {
      sponsorNameMap.set(s.id, s.name);
    }
  }

  const sponsorsByTier = new Map<SponsorTier, string[]>();
  for (const s of slotList) {
    const list = sponsorsByTier.get(s.tier) ?? [];
    const name = sponsorNameMap.get(s.sponsor_id);
    if (name) list.push(name);
    sponsorsByTier.set(s.tier, list);
  }
  const orderedTiers = SPONSOR_TIERS
    .map((t) => t.value)
    .filter((t) => (sponsorsByTier.get(t) ?? []).length > 0);
  const topBillingSponsors: string[] = (() => {
    for (const tier of ["title", "presenting"] as SponsorTier[]) {
      const names = sponsorsByTier.get(tier) ?? [];
      if (names.length > 0) return names;
    }
    return [];
  })();

  const sb = sbRes.data;

  const declared = enriched.filter((b) => b.result).length;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/60 bg-neutral-950 text-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 font-heading text-sm tracking-wide">
            <Image
              src="/logo-mark.svg"
              alt=""
              width={22}
              height={22}
              className="text-white [&_rect]:fill-white [&_path]:stroke-neutral-950"
            />
            <span>CombatPro</span>
          </Link>
          <div className="flex items-center gap-3 text-white/50">
            <RealtimeRefresher eventId={event.id} />
            <span className="hidden text-[10px] uppercase tracking-widest sm:inline">
              Public event page
            </span>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border/60 bg-neutral-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 20% 30%, rgba(220,38,38,0.35), transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(30,64,175,0.4), transparent 55%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-5xl px-6 py-14">
          {topBillingSponsors.length > 0 && (
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-white/70">
              Presented by {topBillingSponsors.join(" · ")}
            </p>
          )}
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-6xl">
            {event.name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/80">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {fmtDateLong(event.event_date)}
            </span>
            {(event.venue || event.city || event.state) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {[event.venue, event.city, event.state].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/5 px-2.5 py-1 text-xs capitalize">
              {event.primary_sport}
            </span>
            {event.status === "complete" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs uppercase tracking-wider text-emerald-200">
                Results in
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/5 px-2.5 py-1 text-xs uppercase tracking-wider">
                Upcoming
              </span>
            )}
            {sb && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/5 px-2.5 py-1 text-xs">
                <ShieldCheck className="h-3 w-3" />
                {sb.abbreviation}
              </span>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <section className="mb-10">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Fight card
            </h2>
            <span className="text-xs text-muted-foreground">
              {enriched.length} bouts
              {declared > 0 && ` · ${declared} result${declared === 1 ? "" : "s"} in`}
            </span>
          </div>
          {enriched.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Card TBD — bouts will appear here as they&apos;re announced.
            </div>
          ) : (
            <ol className="space-y-3">
              {enriched.map((b, idx) => (
                <li key={b.id}>
                  <BoutCard bout={b} idx={idx} isLive={event.current_bout_id === b.id} />
                </li>
              ))}
            </ol>
          )}
        </section>

        {orderedTiers.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Presented by
              </h2>
              <Handshake className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-5">
              {orderedTiers.map((tier) => {
                const names = sponsorsByTier.get(tier) ?? [];
                if (names.length === 0) return null;
                return (
                  <div key={tier} className="flex items-baseline gap-4">
                    <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {sponsorTierLabel(tier)}
                    </span>
                    <span className="text-sm">{names.join(" · ")}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {(sb || event.promoter) && (
          <section className="mb-10">
            <h2 className="mb-4 font-heading text-lg font-semibold tracking-tight">
              Sanctioning
            </h2>
            <div className="grid gap-4 rounded-lg border border-border/60 bg-muted/20 p-5 sm:grid-cols-2 text-sm">
              {sb && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Sanctioning body
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {sb.abbreviation} — {sb.name}
                    {sb.website && (
                      <a
                        href={sb.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
              {event.promoter && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Promoter
                  </div>
                  <div className="mt-1">{event.promoter}</div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-muted-foreground">
          <span>Powered by CombatPro</span>
          <span>Event ID · {event.id.slice(0, 8)}</span>
        </div>
      </footer>
    </div>
  );
}

function BoutCard({
  bout,
  idx,
  isLive,
}: {
  bout: BoutWithFighters;
  idx: number;
  isLive: boolean;
}) {
  const winner: Corner | null =
    bout.result === "red" ? "red" : bout.result === "blue" ? "blue" : null;
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2 font-mono">
          Bout {bout.bout_order ?? idx + 1}
          {bout.scheduled_start_time && (
            <span className="flex items-center gap-1 font-sans">
              <Clock className="h-3 w-3" />
              {bout.scheduled_start_time}
            </span>
          )}
          {isLive && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/60 bg-red-500/10 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-600" />
              </span>
              Live
            </span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="capitalize">
            {bout.sport}
          </Badge>
          {bout.weight_class && <Badge variant="secondary">{bout.weight_class}</Badge>}
          {bout.rounds && (
            <Badge variant="outline">
              {bout.rounds} × {bout.round_length_minutes ?? 3}m
            </Badge>
          )}
          {bout.bout_class === "amateur" && (
            <Badge variant="outline" className="text-[10px]">
              Amateur
            </Badge>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
        <PublicCorner
          corner="red"
          name={bout.red?.full_name ?? "TBD"}
          winner={winner === "red"}
        />
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          vs
        </span>
        <PublicCorner
          corner="blue"
          name={bout.blue?.full_name ?? "TBD"}
          winner={winner === "blue"}
          align="right"
        />
      </div>
      {bout.result && (
        <p className="mt-3 border-t border-border/50 pt-2 text-xs text-muted-foreground">
          {bout.result === "red" && (
            <>
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {bout.red?.full_name ?? "Red"}
              </span>{" "}
              def. {bout.blue?.full_name ?? "Blue"}
            </>
          )}
          {bout.result === "blue" && (
            <>
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {bout.blue?.full_name ?? "Blue"}
              </span>{" "}
              def. {bout.red?.full_name ?? "Red"}
            </>
          )}
          {bout.result === "draw" && "Draw"}
          {bout.result === "no_contest" && "No contest"}
          {bout.method && ` · via ${bout.method.replace(/_/g, " ")}`}
          {bout.round_finished && ` · R${bout.round_finished}`}
          {bout.time_finished && ` (${bout.time_finished})`}
        </p>
      )}
    </div>
  );
}

function PublicCorner({
  corner,
  name,
  winner,
  align = "left",
}: {
  corner: Corner;
  name: string;
  winner: boolean;
  align?: "left" | "right";
}) {
  const dot = corner === "red" ? "bg-red-500" : "bg-blue-500";
  return (
    <div
      className={`flex items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      <span
        className={`font-medium ${
          winner ? "text-emerald-700 dark:text-emerald-400" : ""
        }`}
      >
        {name}
        {winner && <span className="ml-1 text-xs">✓</span>}
      </span>
    </div>
  );
}
