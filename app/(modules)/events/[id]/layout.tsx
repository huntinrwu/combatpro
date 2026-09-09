import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  DollarSign,
  Gavel,
  Handshake,
  ListOrdered,
  Pencil,
  Radio,
  Scale,
  Share2,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import { EventTabs, type EventTab } from "./_components/event-tabs";
import { loadEventDetail } from "./_lib/event-detail";
import { fmtDateLong as formatDate } from "@/lib/format-utils";
import { getSessionUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";
import { EVENT_STATUS_VARIANT as STATUS_VARIANT } from "@/lib/ui-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  computeEventPnL,
  fmtMoney,
  purseBreakdown,
  sponsorshipTotals,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";


export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadEventDetail(id);
  if (!detail) notFound();
  const { event, bouts, checks, purses, ledger, sponsorSlots } = detail;
  const session = await getSessionUser();
  const canEdit = session ? canEditEvent(event, session) : false;

  const boutIds = bouts.map((b) => b.id);
  const totalWeighInSlots = boutIds.length * 2;
  let weighedCorners = 0;
  for (const c of checks) {
    if (c.weigh_in_lbs != null) weighedCorners++;
  }
  let payoutNet = 0;
  for (const p of purses) payoutNet += purseBreakdown(p).net;

  const pnl = computeEventPnL(ledger, payoutNet);
  const sponsorTotals = sponsorshipTotals(sponsorSlots);

  const basePath = `/events/${event.id}`;
  const iconClass = "h-3.5 w-3.5";
  const tabs: EventTab[] = [
    { slug: "bouts", label: "Bouts", icon: <CalendarDays className={iconClass} />, href: basePath },
    { slug: "officials", label: "Officials", icon: <Gavel className={iconClass} />, href: `${basePath}/officials` },
    { slug: "financials", label: "Financials", icon: <DollarSign className={iconClass} />, href: `${basePath}/financials` },
    { slug: "sponsors", label: "Sponsors", icon: <Handshake className={iconClass} />, href: `${basePath}/sponsors` },
    { slug: "weigh-ins", label: "Weigh-ins", icon: <Scale className={iconClass} />, href: `${basePath}/weigh-ins` },
    { slug: "regulatory", label: "Regulatory", icon: <BookOpen className={iconClass} />, href: `${basePath}/regulatory` },
  ];

  return (
    <>
      <header className="mb-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {event.name}
          </h1>
          <Badge variant={STATUS_VARIANT[event.status] ?? "outline"} className="capitalize">
            {event.status}
          </Badge>
          <Badge variant="secondary" className="capitalize">
            {event.primary_sport}
          </Badge>
          <div className="ml-auto flex items-center gap-2">
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
              variant="outline"
              render={
                <Link href={`${basePath}/run-of-show`}>
                  <ListOrdered className="h-3.5 w-3.5" />
                  Run of show
                </Link>
              }
            />
            <Button
              size="sm"
              render={
                <Link href={`/live/${event.id}`}>
                  <Radio className="h-3.5 w-3.5" />
                  Control room
                </Link>
              }
            />
            <Button
              size="sm"
              variant="outline"
              render={
                <Link href={`${basePath}/finalize`}>
                  <Trophy className="h-3.5 w-3.5" />
                  Finalize
                </Link>
              }
            />
            {event.sanctioning_body_id && (
              <Button
                size="sm"
                variant="outline"
                render={
                  <Link href={`/sb/${event.sanctioning_body_id}`}>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    SB view
                  </Link>
                }
              />
            )}
            {event.slug && (event.status === "scheduled" || event.status === "complete") && (
              <Button
                size="sm"
                variant="outline"
                render={
                  <a href={`/e/${event.slug}`} target="_blank" rel="noopener">
                    <Share2 className="h-3.5 w-3.5" />
                    Public page
                  </a>
                }
              />
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(event.event_date)}
          {event.venue ? ` · ${event.venue}` : ""}
          {event.city ? `, ${event.city}` : ""}
          {event.state ? `, ${event.state}` : ""}
        </p>
      </header>

      <MetricsStrip
        bouts={boutIds.length}
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
