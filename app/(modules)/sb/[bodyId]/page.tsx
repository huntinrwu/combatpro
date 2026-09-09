import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  DollarSign,
  FileWarning,
  HeartPulse,
  Pencil,
  Plus,
  ShieldCheck,
  Star,
  Trophy,
  Users,
} from "lucide-react";

import { db } from "@/lib/db/client";
import { fmtDateShortWithDay as fmtEventDate } from "@/lib/format-utils";
import { getSessionUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fighterClearanceSummary,
  fmtMoney,
  num,
  type Bout,
  type BoutDocument,
  type BoutPurse,
  type EventRow,
  type Fighter,
  type FighterMedicalRecord,
  type Ruleset,
  type SanctioningBody,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function SbDashboardPage({
  params,
}: {
  params: Promise<{ bodyId: string }>;
}) {
  const { bodyId } = await params;
  const supabase = db();
  const session = await getSessionUser();

  const { data: body } = await supabase
    .from("sanctioning_bodies")
    .select("*")
    .eq("id", bodyId)
    .maybeSingle<SanctioningBody>();

  if (!body) notFound();

  const [{ data: rawEvents }, { data: rawRules }] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .eq("sanctioning_body_id", bodyId)
      .order("event_date", { ascending: false }),
    supabase
      .from("rulesets")
      .select("*")
      .eq("sanctioning_body_id", bodyId)
      .order("sport"),
  ]);
  const bodyRules = (rawRules ?? []) as Ruleset[];

  const events = (rawEvents ?? []) as EventRow[];
  const eventIds = events.map((e) => e.id);
  const today = new Date().toISOString().slice(0, 10);

  const upcomingEvents = events
    .filter(
      (e) =>
        e.event_date >= today && e.status !== "complete" && e.status !== "canceled",
    )
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const pastEvents = events.filter(
    (e) => e.event_date < today || e.status === "complete",
  );

  const [{ data: rawBouts }] = await Promise.all([
    eventIds.length
      ? supabase.from("bouts").select("*").in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
  ]);

  const bouts = (rawBouts ?? []) as Bout[];
  const boutIds = bouts.map((b) => b.id);

  const fighterIds = Array.from(
    new Set(
      bouts
        .flatMap((b) => [b.red_corner_fighter_id, b.blue_corner_fighter_id])
        .filter((x): x is string => Boolean(x)),
    ),
  );

  const [
    { data: rawDocs },
    { data: rawPurses },
    { data: rawFighters },
    { data: rawMedicals },
  ] = await Promise.all([
    boutIds.length
      ? supabase.from("bout_documents").select("*").in("bout_id", boutIds)
      : Promise.resolve({ data: [] }),
    boutIds.length
      ? supabase.from("bout_purses").select("*").in("bout_id", boutIds)
      : Promise.resolve({ data: [] }),
    fighterIds.length
      ? supabase
          .from("fighters")
          .select("id, full_name, primary_sport, pro_wins, pro_losses, pro_draws, am_wins, am_losses, am_draws")
          .in("id", fighterIds)
      : Promise.resolve({ data: [] }),
    fighterIds.length
      ? supabase
          .from("fighter_medical_records")
          .select("*")
          .in("fighter_id", fighterIds)
      : Promise.resolve({ data: [] }),
  ]);

  const docs = (rawDocs ?? []) as BoutDocument[];
  const purses = (rawPurses ?? []) as BoutPurse[];
  const fighters = (rawFighters ?? []) as Pick<
    Fighter,
    "id" | "full_name" | "primary_sport" | "pro_wins" | "pro_losses" | "pro_draws" | "am_wins" | "am_losses" | "am_draws"
  >[];
  const medicals = (rawMedicals ?? []) as FighterMedicalRecord[];

  const eventById = new Map(events.map((e) => [e.id, e]));
  const boutsByEvent = new Map<string, Bout[]>();
  for (const b of bouts) {
    const arr = boutsByEvent.get(b.event_id) ?? [];
    arr.push(b);
    boutsByEvent.set(b.event_id, arr);
  }
  const fighterById = new Map(fighters.map((f) => [f.id, f]));

  const docsByBout = new Map<string, { agreement?: BoutDocument; report?: BoutDocument }>();
  for (const d of docs) {
    const entry = docsByBout.get(d.bout_id) ?? {};
    if (d.kind === "bout_agreement") entry.agreement = d;
    else if (d.kind === "fight_report") entry.report = d;
    docsByBout.set(d.bout_id, entry);
  }

  const medsByFighter = new Map<string, FighterMedicalRecord[]>();
  for (const m of medicals) {
    const arr = medsByFighter.get(m.fighter_id) ?? [];
    arr.push(m);
    medsByFighter.set(m.fighter_id, arr);
  }

  // ── Summary metrics ────────────────────────────────────────────────────
  const totalBouts = bouts.length;
  const declaredBouts = bouts.filter((b) => b.result).length;

  // Docs pending: for upcoming (non-canceled) bouts we need an agreement;
  // for declared bouts we need a fight report.
  const upcomingEventIds = new Set(upcomingEvents.map((e) => e.id));
  const missingAgreements = bouts.filter(
    (b) => upcomingEventIds.has(b.event_id) && !docsByBout.get(b.id)?.agreement,
  );
  const missingReports = bouts.filter(
    (b) => b.result && !docsByBout.get(b.id)?.report,
  );
  const docsPending = missingAgreements.length + missingReports.length;

  let feesTotal = 0;
  let feesPaid = 0;
  for (const p of purses) {
    const fee = num(p.sanctioning_fee);
    feesTotal += fee;
    if (p.paid_at) feesPaid += fee;
  }

  // ── Fighter pool w/ medical roll-up ───────────────────────────────────
  const asOfEventDates = new Map<string, string>();
  // Pick the soonest upcoming event date per fighter (if any) so medical
  // is judged against the next fight; fall back to today.
  for (const b of bouts) {
    const evt = eventById.get(b.event_id);
    if (!evt) continue;
    if (evt.status === "complete" || evt.status === "canceled") continue;
    if (evt.event_date < today) continue;
    for (const fid of [b.red_corner_fighter_id, b.blue_corner_fighter_id]) {
      if (!fid) continue;
      const existing = asOfEventDates.get(fid);
      if (!existing || evt.event_date < existing) {
        asOfEventDates.set(fid, evt.event_date);
      }
    }
  }

  const fighterRows = fighters
    .map((f) => {
      const asOf = asOfEventDates.get(f.id) ?? today;
      const summary = fighterClearanceSummary(
        medsByFighter.get(f.id) ?? [],
        undefined,
        `${asOf}T23:59:59`,
      );
      const nextEventDate = asOfEventDates.get(f.id);
      return { fighter: f, summary, nextEventDate };
    })
    .sort((a, b) => {
      const rank: Record<string, number> = { expired: 3, missing: 2, expiring: 1, active: 0 };
      const d = rank[b.summary.worstStatus] - rank[a.summary.worstStatus];
      if (d !== 0) return d;
      // Then by nearest upcoming event date
      const ad = a.nextEventDate ?? "9999-12-31";
      const bd = b.nextEventDate ?? "9999-12-31";
      return ad.localeCompare(bd);
    });

  return (
    <>
      <div>
        <Link
          href="/sb"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All sanctioning bodies
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sanctioning body view
          </p>
          <h1 className="mt-1 flex items-baseline gap-3 font-heading text-3xl font-semibold tracking-tight">
            <span className="font-mono">{body.abbreviation}</span>
            <span className="text-xl font-normal text-muted-foreground">
              {body.name}
            </span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="capitalize">
              {body.scope}
            </Badge>
            {body.sports.map((s) => (
              <Badge key={s} variant="secondary" className="capitalize">
                {s}
              </Badge>
            ))}
            {body.headquarters && <span>· HQ {body.headquarters}</span>}
            {body.website && (
              <a
                href={body.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
              >
                site <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        {session?.isStaff && (
          <Button
            size="sm"
            variant="outline"
            render={
              <Link href={`/sb/${body.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            }
          />
        )}
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          Icon={CalendarDays}
          label="Upcoming events"
          value={String(upcomingEvents.length)}
          hint={`${pastEvents.length} past`}
        />
        <SummaryTile
          Icon={Trophy}
          label="Sanctioned bouts"
          value={String(totalBouts)}
          hint={`${declaredBouts} declared · ${totalBouts - declaredBouts} pending`}
        />
        <SummaryTile
          Icon={FileWarning}
          label="Docs pending"
          value={String(docsPending)}
          hint={`${missingAgreements.length} agreements · ${missingReports.length} reports`}
          tone={docsPending > 0 ? "warn" : "ok"}
        />
        <SummaryTile
          Icon={DollarSign}
          label="Sanctioning fees"
          value={fmtMoney(feesPaid)}
          hint={`of ${fmtMoney(feesTotal)} total`}
          tone={feesTotal > 0 && feesPaid < feesTotal ? "warn" : "ok"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" />
                Upcoming sanctioned events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No upcoming events on your calendar.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {upcomingEvents.map((e) => (
                    <EventRowLine
                      key={e.id}
                      event={e}
                      cardSize={(boutsByEvent.get(e.id) ?? []).length}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" />
                Documents queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              {missingAgreements.length === 0 && missingReports.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All documents up to date. 🎉
                </p>
              ) : (
                <div className="space-y-4">
                  {missingAgreements.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Missing bout agreements ({missingAgreements.length})
                      </div>
                      <ul className="divide-y divide-border/60">
                        {missingAgreements.map((b) => (
                          <DocRow
                            key={`agr-${b.id}`}
                            bout={b}
                            event={eventById.get(b.event_id)}
                            fighters={fighterById}
                            kind="agreement"
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                  {missingReports.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Missing fight reports ({missingReports.length})
                      </div>
                      <ul className="divide-y divide-border/60">
                        {missingReports.map((b) => (
                          <DocRow
                            key={`rpt-${b.id}`}
                            bout={b}
                            event={eventById.get(b.event_id)}
                            fighters={fighterById}
                            kind="report"
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {pastEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4" />
                  Recent events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border/60">
                  {pastEvents.slice(0, 8).map((e) => (
                    <EventRowLine
                      key={e.id}
                      event={e}
                      cardSize={(boutsByEvent.get(e.id) ?? []).length}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Fighter pool
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fighterRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No fighters on our cards yet.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {fighterRows.map(({ fighter, summary, nextEventDate }) => (
                    <li key={fighter.id} className="py-2">
                      <Link
                        href={`/fighters/${fighter.id}#medical`}
                        className="flex items-start justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {fighter.full_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {fighter.primary_sport} · {fighter.pro_wins}-
                            {fighter.pro_losses}-{fighter.pro_draws}
                            {nextEventDate && (
                              <>
                                {" · next "}
                                {fmtEventDate(nextEventDate)}
                              </>
                            )}
                          </div>
                        </div>
                        <MedicalPill status={summary.worstStatus} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpenText className="h-4 w-4" />
                Rulesets ({bodyRules.length})
              </CardTitle>
              {session?.isStaff && (
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link href={`/rules/new?sb=${body.id}`}>
                      <Plus className="h-3 w-3" />
                      New
                    </Link>
                  }
                />
              )}
            </CardHeader>
            <CardContent>
              {bodyRules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rulesets yet.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {bodyRules.map((r) => (
                    <li key={r.id} className="py-2">
                      <Link
                        href={`/rules/${r.id}`}
                        className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/40"
                      >
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {r.sport}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {r.name}
                          {r.is_default && (
                            <Star className="ml-1 inline h-3 w-3 fill-amber-400 text-amber-400" />
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {body.contact_email && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <a
                  href={`mailto:${body.contact_email}`}
                  className="text-primary hover:underline"
                >
                  {body.contact_email}
                </a>
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
  tone = "muted",
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "muted";
}) {
  const bg =
    tone === "warn"
      ? "border-amber-500/40 bg-amber-500/5"
      : tone === "ok"
        ? "border-emerald-500/30 bg-emerald-500/5"
        : "border-border bg-muted/20";
  return (
    <div className={`rounded-lg border p-3 ${bg}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function EventRowLine({
  event,
  cardSize,
}: {
  event: EventRow;
  cardSize: number;
}) {
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
            {event.city ? ` · ${event.city}` : ""}
            {event.state ? `, ${event.state}` : ""}
            {event.promoter ? ` · ${event.promoter}` : ""}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{cardSize} bouts</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </Link>
    </li>
  );
}

function DocRow({
  bout,
  event,
  fighters,
  kind,
}: {
  bout: Bout;
  event: EventRow | undefined;
  fighters: Map<string, Pick<Fighter, "id" | "full_name">>;
  kind: "agreement" | "report";
}) {
  const red = bout.red_corner_fighter_id
    ? fighters.get(bout.red_corner_fighter_id)?.full_name ?? "TBD"
    : "TBD";
  const blue = bout.blue_corner_fighter_id
    ? fighters.get(bout.blue_corner_fighter_id)?.full_name ?? "TBD"
    : "TBD";
  return (
    <li>
      <Link
        href={`/events/${bout.event_id}/bouts/${bout.id}`}
        className="flex items-center justify-between gap-3 rounded-md px-1.5 py-2 hover:bg-muted/40"
      >
        <div className="min-w-0">
          <div className="text-sm">
            <span className="font-mono text-xs text-muted-foreground">
              #{bout.bout_order ?? "?"}
            </span>{" "}
            <span className="font-medium">{red}</span>
            <span className="text-muted-foreground"> vs </span>
            <span className="font-medium">{blue}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {event?.name ?? "—"}
            {event ? ` · ${fmtEventDate(event.event_date)}` : ""}
          </div>
        </div>
        <Badge
          variant={kind === "agreement" ? "outline" : "destructive"}
          className="shrink-0 text-[10px]"
        >
          {kind === "agreement" ? "Draft & file" : "File report"}
        </Badge>
      </Link>
    </li>
  );
}

function MedicalPill({ status }: { status: string }) {
  const conf =
    status === "expired"
      ? { bg: "bg-red-500/10 text-red-700 dark:text-red-300", label: "expired" }
      : status === "missing"
        ? { bg: "bg-muted text-muted-foreground", label: "missing" }
        : status === "expiring"
          ? {
              bg: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
              label: "expiring",
            }
          : {
              bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              label: "active",
            };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${conf.bg}`}
    >
      {status === "active" ? (
        <HeartPulse className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}
      {conf.label}
    </span>
  );
}
