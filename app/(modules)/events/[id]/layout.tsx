import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  DollarSign,
  Gavel,
  Handshake,
  ListOrdered,
  Paperclip,
  Pencil,
  Radio,
  Scale,
  Share2,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

import { EventTabs, type EventTab } from "./_components/event-tabs";
import { loadEventDetail } from "./_lib/event-detail";
import { fmtDateLong as formatDate } from "@/lib/format-utils";
import { getSessionUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";
import { EVENT_STATUS_VARIANT as STATUS_VARIANT } from "@/lib/ui-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateTile } from "@/components/date-tile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { db } from "@/lib/db/client";
import { EVENT_FILES_BUCKET } from "@/lib/event-files";
import {
  EVENT_TYPE_LABELS,
  computeEventPnL,
  fmtMoney,
  purseBreakdown,
  sponsorshipTotals,
} from "@/lib/db/types";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, session, posterRes] = await Promise.all([
    loadEventDetail(id),
    getSessionUser(),
    // Latest poster, for the thumbnail beside the title.
    db()
      .from("event_files")
      .select("storage_path")
      .eq("event_id", id)
      .eq("category", "poster")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ storage_path: string }>(),
  ]);
  if (!detail) notFound();
  const posterUrl = posterRes.data
    ? ((
        await db()
          .storage.from(EVENT_FILES_BUCKET)
          .createSignedUrl(posterRes.data.storage_path, 60 * 60)
      ).data?.signedUrl ?? null)
    : null;
  const { event, bouts, checks, purses, ledger, sponsorSlots } = detail;
  const canEdit = session ? canEditEvent(event, session) : false;

  const totalWeighInSlots = bouts.length * 2;
  let weighedCorners = 0;
  for (const c of checks) {
    if (c.weigh_in_lbs != null) weighedCorners++;
  }
  let payoutNet = 0;
  for (const p of purses) payoutNet += purseBreakdown(p).net;

  const pnl = computeEventPnL(ledger, payoutNet);
  const sponsorTotals = sponsorshipTotals(sponsorSlots);

  const basePath = `/events/${event.id}`;
  const moreLinks = [
    { href: `${basePath}/run-of-show`, label: "Run of show", Icon: ListOrdered, external: false },
    { href: `${basePath}/finalize`, label: "Finalize results", Icon: Trophy, external: false },
    ...(event.sanctioning_body_id
      ? [
          {
            href: `/sb/${event.sanctioning_body_id}`,
            label: "Sanctioning body view",
            Icon: ShieldCheck,
            external: false,
          },
        ]
      : []),
    ...(event.slug && (event.status === "scheduled" || event.status === "complete")
      ? [{ href: `/e/${event.slug}`, label: "Public page", Icon: Share2, external: true }]
      : []),
  ];
  const iconClass = "h-3.5 w-3.5";
  const tabs: EventTab[] = [
    { slug: "bouts", label: "Bouts", icon: <CalendarDays className={iconClass} />, href: basePath },
    { slug: "fighters", label: "Fighters", icon: <Users className={iconClass} />, href: `${basePath}/fighters` },
    { slug: "matchmaking", label: "Matchmaking", icon: <Swords className={iconClass} />, href: `${basePath}/matchmaking` },
    { slug: "officials", label: "Officials", icon: <Gavel className={iconClass} />, href: `${basePath}/officials` },
    { slug: "financials", label: "Financials", icon: <DollarSign className={iconClass} />, href: `${basePath}/financials` },
    { slug: "sponsors", label: "Sponsors", icon: <Handshake className={iconClass} />, href: `${basePath}/sponsors` },
    { slug: "weigh-ins", label: "Weigh-ins", icon: <Scale className={iconClass} />, href: `${basePath}/weigh-ins` },
    { slug: "files", label: "Files", icon: <Paperclip className={iconClass} />, href: `${basePath}/files` },
    { slug: "regulatory", label: "Regulatory", icon: <BookOpen className={iconClass} />, href: `${basePath}/regulatory` },
  ];

  return (
    <>
      <header className="mb-4 print:hidden">
        <div className="flex flex-wrap items-start gap-4">
          {posterUrl ? (
            <Link href={`${basePath}/files`} title="Event poster" className="shrink-0">
              {/* Signed URL, so next/image caching doesn't apply. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={posterUrl}
                alt=""
                className="h-20 w-[3.75rem] rounded-md border border-border object-cover shadow-sm"
              />
            </Link>
          ) : (
            <DateTile iso={event.event_date} />
          )}

          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {event.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(event.event_date)}
              {event.venue ? ` · ${event.venue}` : ""}
              {event.city ? `, ${event.city}` : ""}
              {event.state ? `, ${event.state}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant={STATUS_VARIANT[event.status] ?? "outline"} className="capitalize">
                {event.status}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {event.primary_sport}
              </Badge>
              {event.event_type && (
                <Badge variant="outline">{EVENT_TYPE_LABELS[event.event_type]}</Badge>
              )}
              {event.medicals_required === false && (
                <Badge variant="outline">No medicals required</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                render={
                  <Link href={`${basePath}/edit`}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                }
              />
            )}
            <Button
              size="sm"
              render={
                <Link href={`/live/${event.id}`}>
                  <Radio className="h-3.5 w-3.5" />
                  Control room
                </Link>
              }
            />
            {/* Less-used destinations live in one menu so the header stays calm. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                aria-label="More event pages"
              >
                More
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px] p-1">
                {moreLinks.map(({ href, label, Icon, external }) =>
                  external ? (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener"
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {label}
                    </a>
                  ) : (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {label}
                    </Link>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <MetricsStrip
        bouts={bouts.length}
        weighed={weighedCorners}
        weighTotal={totalWeighInSlots}
        purseNet={payoutNet}
        sponsorsContracted={sponsorTotals.contracted}
        pnlNet={pnl.net}
      />

      <div className="mt-4 print:hidden">
        <EventTabs tabs={tabs} basePath={basePath} />
      </div>

      <div className="pt-5">{children}</div>
    </>
  );
}

function MetricsStrip({
  bouts,
  weighed,
  weighTotal,
  purseNet,
  sponsorsContracted,
  pnlNet,
}: {
  bouts: number;
  weighed: number;
  weighTotal: number;
  purseNet: number;
  sponsorsContracted: number;
  pnlNet: number;
}) {
  const pnlTone =
    pnlNet > 0
      ? "text-emerald-700 dark:text-emerald-300"
      : pnlNet < 0
        ? "text-red-700 dark:text-red-300"
        : "";

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 print:hidden">
      <Stat label="Bouts" value={String(bouts)} />
      <Stat
        label="Weighed"
        value={
          weighTotal > 0 ? (
            <>
              {weighed}
              <span className="text-muted-foreground/70"> / {weighTotal}</span>
            </>
          ) : (
            "—"
          )
        }
      />
      <Stat label="Net purse" value={fmtMoney(purseNet)} />
      <Stat label="Sponsors" value={fmtMoney(sponsorsContracted)} />
      <Stat
        label="Event P&L"
        value={`${pnlNet < 0 ? "−" : ""}${fmtMoney(Math.abs(pnlNet))}`}
        tone={pnlTone}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${tone ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
