import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ClipboardCheck,
  DollarSign,
  FileText,
  Gavel,
  ShieldCheck,
  Users,
} from "lucide-react";

import { BoutActionBar } from "./_components/bout-action-bar";
import { BoutStatusAlerts } from "./_components/bout-status-alerts";
import { CheckinCorner } from "./_components/checkin-corner";
import { CornermenCard } from "./_components/cornermen-card";
import { DocumentsCard } from "./_components/documents-card";
import { PursesCard } from "./_components/purses-card";
import { ResultCard } from "./_components/result-card";
import { RulesetCard } from "./_components/ruleset-card";
import { ScorecardsSummary } from "./_components/scorecards-summary";
import { db } from "@/lib/db/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { weightClassFor, weightClassMatch } from "@/lib/weight-classes";
import {
  BOUT_METHODS,
  EVENT_ROLE_LABELS,
  fighterClearanceSummary,
  suggestResultFromScorecards,
  type Bout,
  type BoutCornerman,
  type BoutDocument,
  type BoutFighterCheck,
  type BoutPurse,
  type BoutScorecard,
  type ClearanceStatus,
  type Corner,
  type EventOfficial,
  type EventRole,
  type EventRow,
  type Fighter,
  type FighterMedicalRecord,
  type Official,
  type Ruleset,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function BoutDetailPage({
  params,
}: {
  params: Promise<{ id: string; boutId: string }>;
}) {
  const { id: eventId, boutId } = await params;
  const supabase = db();

  const [{ data: event }, { data: bout }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, event_date, primary_sport, sanctioning_body_id, current_bout_id")
      .eq("id", eventId)
      .maybeSingle<
        Pick<
          EventRow,
          | "id"
          | "name"
          | "event_date"
          | "primary_sport"
          | "sanctioning_body_id"
          | "current_bout_id"
        >
      >(),
    supabase.from("bouts").select("*").eq("id", boutId).maybeSingle<Bout>(),
  ]);

  if (!event || !bout || bout.event_id !== eventId) notFound();

  const [
    { data: eventRoster },
    { data: scorecards },
    { data: checks },
    { data: documents },
    { data: purses },
    { data: cornermen },
    { data: sanctioningBody },
    { data: allRulesets },
  ] = await Promise.all([
    supabase
      .from("event_officials")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at"),
    supabase.from("bout_scorecards").select("*").eq("bout_id", boutId).order("round_number"),
    supabase.from("bout_fighter_checks").select("*").eq("bout_id", boutId),
    supabase.from("bout_documents").select("*").eq("bout_id", boutId),
    supabase.from("bout_purses").select("*").eq("bout_id", boutId),
    supabase.from("bout_cornermen").select("*").eq("bout_id", boutId).order("created_at"),
    event.sanctioning_body_id
      ? supabase
          .from("sanctioning_bodies")
          .select("name, abbreviation")
          .eq("id", event.sanctioning_body_id)
          .maybeSingle<{ name: string; abbreviation: string }>()
      : Promise.resolve({ data: null as { name: string; abbreviation: string } | null }),
    supabase
      .from("rulesets")
      .select("id, name, sport, sanctioning_body_id, is_default")
      .order("name"),
  ]);

  const rosterRows = (eventRoster ?? []) as EventOfficial[];
  const officialIds = Array.from(new Set(rosterRows.map((r) => r.official_id)));
  const { data: officialRecords } = officialIds.length
    ? await supabase
        .from("officials")
        .select("id, full_name")
        .in("id", officialIds)
    : { data: [] as Pick<Official, "id" | "full_name">[] };
  const officialNameById = new Map<string, string>();
  for (const o of (officialRecords ?? []) as Pick<Official, "id" | "full_name">[]) {
    officialNameById.set(o.id, o.full_name);
  }
  const rosterByRole = new Map<EventRole, { id: string; official_id: string; full_name: string }[]>();
  for (const r of rosterRows) {
    const arr = rosterByRole.get(r.event_role) ?? [];
    arr.push({
      id: r.id,
      official_id: r.official_id,
      full_name: officialNameById.get(r.official_id) ?? "Official",
    });
    rosterByRole.set(r.event_role, arr);
  }
  const judges = rosterByRole.get("judge") ?? [];
  // Show these roles at the top of the bout page. Judges are covered by the
  // scorecards card, so omit them here to avoid duplication.
  const officialsCardOrder: EventRole[] = [
    "referee",
    "head_official",
    "jury",
    "doctor",
    "timekeeper",
    "inspector",
  ];

  const rulesetList = (allRulesets ?? []) as Pick<
    Ruleset,
    "id" | "name" | "sport" | "sanctioning_body_id" | "is_default"
  >[];
  const currentRuleset = bout.ruleset_id
    ? rulesetList.find((r) => r.id === bout.ruleset_id) ?? null
    : null;

  const weightClassOk = weightClassMatch(bout.sport, bout.contracted_weight_lbs, bout.weight_class);
  const expectedWeightClass =
    bout.contracted_weight_lbs != null
      ? weightClassFor(bout.sport, bout.contracted_weight_lbs)
      : null;

  const checkByCorner = new Map<Corner, BoutFighterCheck>();
  for (const c of (checks ?? []) as BoutFighterCheck[]) {
    checkByCorner.set(c.corner, c);
  }

  // Fighter names + medical for header alerts
  const fighterIds = [bout.red_corner_fighter_id, bout.blue_corner_fighter_id].filter(
    (x): x is string => Boolean(x),
  );
  const fighterMap = new Map<string, Pick<Fighter, "id" | "full_name">>();
  const medicalByFighter = new Map<string, FighterMedicalRecord[]>();
  if (fighterIds.length) {
    const [{ data: fs }, { data: med }] = await Promise.all([
      supabase.from("fighters").select("id, full_name").in("id", fighterIds),
      supabase.from("fighter_medical_records").select("*").in("fighter_id", fighterIds),
    ]);
    for (const f of fs ?? []) fighterMap.set(f.id, f);
    for (const m of (med ?? []) as FighterMedicalRecord[]) {
      const arr = medicalByFighter.get(m.fighter_id) ?? [];
      arr.push(m);
      medicalByFighter.set(m.fighter_id, arr);
    }
  }
  const red = bout.red_corner_fighter_id ? fighterMap.get(bout.red_corner_fighter_id) ?? null : null;
  const blue = bout.blue_corner_fighter_id ? fighterMap.get(bout.blue_corner_fighter_id) ?? null : null;
  // Compute clearance as of fight night, not today — a bloodwork panel that
  // expires two weeks before the bout is disqualifying even if it's valid now.
  const asOfEventDate = `${event.event_date}T23:59:59`;
  const redClearance = bout.red_corner_fighter_id
    ? fighterClearanceSummary(
        medicalByFighter.get(bout.red_corner_fighter_id) ?? [],
        undefined,
        asOfEventDate,
      )
    : null;
  const blueClearance = bout.blue_corner_fighter_id
    ? fighterClearanceSummary(
        medicalByFighter.get(bout.blue_corner_fighter_id) ?? [],
        undefined,
        asOfEventDate,
      )
    : null;

  const isLive = event.current_bout_id === bout.id;
  const isDone = Boolean(bout.result);

  const worstMedical: ClearanceStatus =
    redClearance?.worstStatus === "expired" || blueClearance?.worstStatus === "expired"
      ? "expired"
      : redClearance?.worstStatus === "missing" || blueClearance?.worstStatus === "missing"
        ? "missing"
        : redClearance?.worstStatus === "expiring" || blueClearance?.worstStatus === "expiring"
          ? "expiring"
          : "active";

  const cards = (scorecards ?? []) as BoutScorecard[];
  const suggestion = suggestResultFromScorecards(cards);
  const totalRounds = bout.rounds ?? 10;
  const isDeclared = Boolean(bout.result);
  const declaredMethodLabel =
    BOUT_METHODS.find((m) => m.value === bout.method)?.label ?? bout.method;
  const winnerName =
    bout.result === "red"
      ? red?.full_name ?? "Red corner"
      : bout.result === "blue"
        ? blue?.full_name ?? "Blue corner"
        : null;

  return (
    <>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          <Link href={`/events/${event.id}`} className="hover:text-foreground">
            {event.name}
          </Link>
          {" · "}
          Bout {bout.bout_order ?? "—"}
        </p>
        <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
          {red?.full_name ?? "TBD"}
          <span className="mx-2 text-muted-foreground">vs</span>
          {blue?.full_name ?? "TBD"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="capitalize">
            {bout.sport}
          </Badge>
          {bout.weight_class && <Badge variant="secondary">{bout.weight_class}</Badge>}
          {bout.rounds && (
            <Badge variant="outline">
              {bout.rounds} × {bout.round_length_minutes ?? 3}m
            </Badge>
          )}
          {bout.scoring_mode && (
            <Badge variant="outline">{bout.scoring_mode.replace(/_/g, " ")}</Badge>
          )}
          <Badge
            variant={bout.bout_class === "pro" ? "default" : "outline"}
            className="capitalize"
          >
            {bout.bout_class === "pro" ? "Pro" : "Amateur"}
          </Badge>
        </div>
      </header>

      <BoutStatusAlerts
        bout={bout}
        isLive={isLive}
        weightClassOk={weightClassOk}
        expectedWeightClass={expectedWeightClass}
        worstMedical={worstMedical}
        red={red}
        blue={blue}
        redClearance={redClearance}
        blueClearance={blueClearance}
      />

      <BoutActionBar
        bout={bout}
        eventId={event.id}
        isLive={isLive}
        isDone={isDone}
        judges={judges}
      />

      <RulesetCard
        boutId={bout.id}
        eventId={event.id}
        currentRulesetId={bout.ruleset_id}
        currentRuleset={currentRuleset}
        rulesetList={rulesetList}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Officials
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              from event roster
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rosterRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No officials on the event roster yet.{" "}
              <Link
                href={`/events/${event.id}/officials`}
                className="text-foreground underline"
              >
                Add officials on the Officials tab
              </Link>
              .
            </p>
          ) : (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {officialsCardOrder.map((role) => {
                const list = rosterByRole.get(role) ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={role}>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      {EVENT_ROLE_LABELS[role]}
                      {list.length > 1 && (
                        <span className="ml-1 text-muted-foreground/70">
                          ({list.length})
                        </span>
                      )}
                    </dt>
                    <dd className="mt-0.5 text-sm">
                      {list.map((o) => o.full_name).join(", ")}
                    </dd>
                  </div>
                );
              })}
              {judges.length > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {EVENT_ROLE_LABELS.judge}
                    <span className="ml-1 text-muted-foreground/70">
                      ({judges.length})
                    </span>
                  </dt>
                  <dd className="mt-0.5 text-sm">
                    {judges.map((j) => j.full_name).join(", ")}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" />
            Fighter check-in
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <CheckinCorner
            corner="red"
            fighter={red}
            check={checkByCorner.get("red") ?? null}
            contractedLbs={bout.contracted_weight_lbs}
            boutId={bout.id}
            eventId={event.id}
            clearance={redClearance}
          />
          <CheckinCorner
            corner="blue"
            fighter={blue}
            check={checkByCorner.get("blue") ?? null}
            contractedLbs={bout.contracted_weight_lbs}
            boutId={bout.id}
            eventId={event.id}
            clearance={blueClearance}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="h-4 w-4" />
            Judges&apos; scorecards
            {judges.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {judges.length} judge{judges.length === 1 ? "" : "s"}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {judges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No judges on the event roster.{" "}
              <Link
                href={`/events/${event.id}/officials`}
                className="text-foreground underline"
              >
                Add judges on the Officials tab
              </Link>{" "}
              to enable live scoring.
            </p>
          ) : (
            <ScorecardsSummary
              boutId={bout.id}
              totalRounds={totalRounds}
              judges={judges.map((j) => ({
                official_id: j.official_id,
                full_name: j.full_name,
              }))}
              cards={cards}
            />
          )}
        </CardContent>
      </Card>

      <ResultCard
        bout={bout}
        eventId={event.id}
        red={red}
        blue={blue}
        totalRounds={totalRounds}
        suggestion={suggestion}
        declaredMethodLabel={declaredMethodLabel ?? null}
        winnerName={winnerName}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Sanctioning documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentsCard
            boutId={bout.id}
            eventId={event.id}
            documents={(documents ?? []) as BoutDocument[]}
            sanctioningBodyName={sanctioningBody?.name ?? null}
            resultDeclared={isDeclared}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            Purses &amp; payouts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PursesCard
            boutId={bout.id}
            eventId={event.id}
            purses={(purses ?? []) as BoutPurse[]}
            red={red}
            blue={blue}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Cornermen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CornermenCard
            boutId={bout.id}
            eventId={event.id}
            cornermen={(cornermen ?? []) as BoutCornerman[]}
          />
        </CardContent>
      </Card>

    </>
  );
}
