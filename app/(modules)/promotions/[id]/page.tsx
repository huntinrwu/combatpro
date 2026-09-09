import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleAlert,
  Gavel,
  Pencil,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from "lucide-react";

import { db } from "@/lib/db/client";
import { fmtDateShortWithDay as fmtEventDate } from "@/lib/format-utils";
import { getSessionUser } from "@/lib/auth/session";
import { setPromotionStatus } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  Bout,
  EventOfficial,
  EventRow,
  Fighter,
  Official,
  Promotion,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function PromotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = db();
  const session = await getSessionUser();

  const { data: promo } = await supabase
    .from("promotions")
    .select("*")
    .eq("id", id)
    .maybeSingle<Promotion>();
  if (!promo) notFound();

  const { data: rawEvents } = await supabase
    .from("events")
    .select("*")
    .eq("promotion_id", id)
    .order("event_date", { ascending: false });
  const events = (rawEvents ?? []) as EventRow[];
  const eventIds = events.map((e) => e.id);

  const [{ data: rawBouts }] = await Promise.all([
    eventIds.length
      ? supabase.from("bouts").select("*").in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
  ]);
  const bouts = (rawBouts ?? []) as Bout[];

  const fighterIds = Array.from(
    new Set(
      bouts
        .flatMap((b) => [b.red_corner_fighter_id, b.blue_corner_fighter_id])
        .filter((x): x is string => Boolean(x)),
    ),
  );

  const [{ data: rawFighters }, { data: rawAssigns }] = await Promise.all([
    fighterIds.length
      ? supabase
          .from("fighters")
          .select("id, full_name, nickname, primary_sport, pro_wins, pro_losses, pro_draws, am_wins, am_losses, am_draws")
          .in("id", fighterIds)
      : Promise.resolve({ data: [] }),
    eventIds.length
      ? supabase.from("event_officials").select("*").in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
  ]);

  const fighters = (rawFighters ?? []) as Pick<
    Fighter,
    "id" | "full_name" | "nickname" | "primary_sport" | "pro_wins" | "pro_losses" | "pro_draws" | "am_wins" | "am_losses" | "am_draws"
  >[];
  const assigns = (rawAssigns ?? []) as EventOfficial[];

  const officialIds = Array.from(new Set(assigns.map((a) => a.official_id)));
  const { data: rawOfficials } = officialIds.length
    ? await supabase
        .from("officials")
        .select("id, full_name, roles")
        .in("id", officialIds)
    : { data: [] };
  const officials = (rawOfficials ?? []) as Pick<Official, "id" | "full_name" | "roles">[];

  // ── Rollups ────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter(
    (e) => e.event_date >= today && e.status !== "canceled" && e.status !== "complete",
  );
  const past = events.filter((e) => e.event_date < today || e.status === "complete");

  const totalBouts = bouts.length;
  const declaredBouts = bouts.filter((b) => b.result).length;
  const koCount = bouts.filter(
    (b) => b.method === "ko" || b.method === "tko",
  ).length;

  // Fighter appearance counts (deduped)
  const appearanceCount = new Map<string, number>();
  for (const b of bouts) {
    for (const fid of [b.red_corner_fighter_id, b.blue_corner_fighter_id]) {
      if (!fid) continue;
      appearanceCount.set(fid, (appearanceCount.get(fid) ?? 0) + 1);
    }
  }
  const fighterRoster = fighters
    .map((f) => ({ fighter: f, count: appearanceCount.get(f.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.fighter.full_name.localeCompare(b.fighter.full_name));

  // Official assignment counts (deduped)
  const officialCount = new Map<string, number>();
  for (const a of assigns) {
    officialCount.set(a.official_id, (officialCount.get(a.official_id) ?? 0) + 1);
  }
  const officialRoster = officials
    .map((o) => ({ official: o, count: officialCount.get(o.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.official.full_name.localeCompare(b.official.full_name));

  const isPending = promo.status === "pending";
  const isRejected = promo.status === "rejected";

  return (
    <>
      <div>
        <Link
          href="/promotions"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All promotions
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-baseline gap-3 font-heading text-3xl font-semibold tracking-tight">
            {promo.abbreviation && <span className="font-mono">{promo.abbreviation}</span>}
            <span className={promo.abbreviation ? "text-xl font-normal text-muted-foreground" : ""}>
              {promo.name}
            </span>
            {isPending && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-300">
                <CircleAlert className="h-3 w-3" />
                Pending review
              </Badge>
            )}
            {isRejected && (
              <Badge variant="outline" className="border-red-500/50 text-red-700 dark:text-red-300">
                Rejected
              </Badge>
            )}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="capitalize">
              {promo.scope}
            </Badge>
            {promo.sports.map((s) => (
              <Badge key={s} variant="secondary" className="capitalize">
                {s}
              </Badge>
            ))}
            {(promo.city || promo.home_state) && (
              <span>· {[promo.city, promo.home_state].filter(Boolean).join(", ")}</span>
            )}
            {promo.founded_year && <span>· est. {promo.founded_year}</span>}
            {promo.website && (
              <a
                href={promo.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
              >
                site <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
            {promo.tenant_org_id && (
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
              >
                <ShieldCheck className="h-3 w-3" />
                On CombatPro
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session?.isStaff && isPending && (
            <>
              <form action={setPromotionStatus}>
                <input type="hidden" name="id" value={promo.id} />
                <input type="hidden" name="status" value="approved" />
                <Button size="sm" variant="outline">
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </Button>
              </form>
              <form action={setPromotionStatus}>
                <input type="hidden" name="id" value={promo.id} />
                <input type="hidden" name="status" value="rejected" />
                <Button size="sm" variant="ghost">
                  <X className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </form>
            </>
          )}
          {session?.isStaff && (
            <Button
              size="sm"
              variant="outline"
              render={
                <Link href={`/promotions/${promo.id}/edit`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Link>
              }
            />
          )}
        </div>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          Icon={CalendarDays}
          label="Events hosted"
          value={String(events.length)}
          hint={`${upcoming.length} upcoming · ${past.length} past`}
        />
        <SummaryTile
          Icon={Trophy}
          label="Bouts booked"
          value={String(totalBouts)}
          hint={`${declaredBouts} declared · ${totalBouts - declaredBouts} pending`}
        />
        <SummaryTile
          Icon={Users}
          label="Fighters on cards"
          value={String(fighterRoster.length)}
          hint="Distinct fighters that have appeared"
        />
        <SummaryTile
          Icon={Gavel}
          label="Officials assigned"
          value={String(officialRoster.length)}
          hint={`${koCount} KO/TKO finishes`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4" />
                Upcoming events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No upcoming events on this promotion.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {upcoming.map((e) => (
                    <EventLine key={e.id} event={e} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {past.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4" />
                  Recent events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border/60">
                  {past.slice(0, 12).map((e) => (
                    <EventLine key={e.id} event={e} />
                  ))}
                </ul>
                {past.length > 12 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    +{past.length - 12} older events not shown
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Fighter roster ({fighterRoster.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fighterRoster.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No fighters have appeared on this promotion yet.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {fighterRoster.slice(0, 30).map(({ fighter, count }) => (
                    <li key={fighter.id} className="py-2">
                      <Link
                        href={`/fighters/${fighter.id}`}
                        className="flex items-start justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {fighter.full_name}
                            {fighter.nickname && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                &quot;{fighter.nickname}&quot;
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {fighter.primary_sport} · {fighter.pro_wins}-
                            {fighter.pro_losses}-{fighter.pro_draws}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {count} bout{count === 1 ? "" : "s"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {fighterRoster.length > 30 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  +{fighterRoster.length - 30} more not shown
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gavel className="h-4 w-4" />
                Officials ({officialRoster.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {officialRoster.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No officials have been added to any event roster here.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {officialRoster.slice(0, 20).map(({ official, count }) => (
                    <li key={official.id} className="py-2">
                      <Link
                        href={`/officials/${official.id}`}
                        className="flex items-start justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {official.full_name}
                          </div>
                          <div className="text-[11px] capitalize text-muted-foreground">
                            {official.roles.join(", ") || "—"}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {count} role{count === 1 ? "" : "s"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {(promo.contact_name || promo.contact_email || promo.contact_phone || promo.notes) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact &amp; notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {promo.contact_name && (
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Contact
                    </span>{" "}
                    {promo.contact_name}
                  </div>
                )}
                {promo.contact_email && (
                  <div>
                    <a
                      href={`mailto:${promo.contact_email}`}
                      className="text-primary hover:underline"
                    >
                      {promo.contact_email}
                    </a>
                  </div>
                )}
                {promo.contact_phone && <div>{promo.contact_phone}</div>}
                {promo.notes && (
                  <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                    {promo.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function SummaryTile({
  Icon,
  label,
  value,
  hint,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function EventLine({ event }: { event: EventRow }) {
  return (
    <li>
      <Link
        href={`/events/${event.id}`}
        className="flex items-center justify-between gap-3 rounded-md px-1.5 py-2 hover:bg-muted/40"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{event.name}</span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {event.status}
            </Badge>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {fmtEventDate(event.event_date)}
            {event.venue && ` · ${event.venue}`}
            {(event.city || event.state) && (
              <> · {[event.city, event.state].filter(Boolean).join(", ")}</>
            )}
          </div>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
