import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  Trophy,
} from "lucide-react";

import { fileAllFightReports, setEventStatus } from "./actions";
import { declareBoutResult } from "../bouts/[boutId]/actions";
import { markDocumentFiled } from "../bouts/[boutId]/document-actions";
import { db } from "@/lib/db/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  BOUT_METHODS,
  BOUT_OUTCOMES,
  type Bout,
  type BoutDocument,
  type EventRow,
  type Fighter,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

type BoutRow = Bout & {
  red?: Pick<Fighter, "id" | "full_name"> | null;
  blue?: Pick<Fighter, "id" | "full_name"> | null;
  reportFiled: boolean;
};

export default async function EventFinalizePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = db();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle<EventRow>();
  if (!event) notFound();

  const { data: rawBouts } = await supabase
    .from("bouts")
    .select("*")
    .eq("event_id", id)
    .order("bout_order", { ascending: true, nullsFirst: false });

  const bouts = (rawBouts ?? []) as Bout[];
  const boutIds = bouts.map((b) => b.id);

  const [fightersRes, docsRes] = await Promise.all([
    (() => {
      const fighterIds = Array.from(
        new Set(
          bouts
            .flatMap((b) => [b.red_corner_fighter_id, b.blue_corner_fighter_id])
            .filter((x): x is string => Boolean(x)),
        ),
      );
      if (fighterIds.length === 0) return Promise.resolve({ data: [] });
      return supabase.from("fighters").select("id, full_name").in("id", fighterIds);
    })(),
    boutIds.length > 0
      ? supabase
          .from("bout_documents")
          .select("bout_id, kind")
          .eq("kind", "fight_report")
          .in("bout_id", boutIds)
      : Promise.resolve({ data: [] as Pick<BoutDocument, "bout_id" | "kind">[] }),
  ]);

  const fighterMap = new Map(
    ((fightersRes.data ?? []) as Pick<Fighter, "id" | "full_name">[]).map((f) => [
      f.id,
      f,
    ]),
  );
  const filedSet = new Set(
    ((docsRes.data ?? []) as { bout_id: string }[]).map((d) => d.bout_id),
  );

  const rows: BoutRow[] = bouts.map((b) => ({
    ...b,
    red: b.red_corner_fighter_id ? fighterMap.get(b.red_corner_fighter_id) ?? null : null,
    blue: b.blue_corner_fighter_id
      ? fighterMap.get(b.blue_corner_fighter_id) ?? null
      : null,
    reportFiled: filedSet.has(b.id),
  }));

  const declared = rows.filter((r) => r.result != null);
  const declaredCount = declared.length;
  const filedCount = declared.filter((r) => r.reportFiled).length;
  const missingReports = declared.length - filedCount;
  const allDeclared = rows.length > 0 && rows.length === declaredCount;
  const allFiled = rows.length > 0 && filedCount === rows.length;
  const eligibleForComplete =
    allDeclared && event.status !== "complete" && event.status !== "canceled";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" />
            Post-fight finalizer
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Finalize {event.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Declare per-bout results, file fight reports with the sanctioning body,
            and close the event.
          </p>
        </div>
        <Badge
          variant={event.status === "complete" ? "secondary" : "default"}
          className="capitalize"
        >
          {event.status}
        </Badge>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Results declared"
          value={`${declaredCount} / ${rows.length}`}
          done={allDeclared}
        />
        <Stat
          label="Reports filed"
          value={`${filedCount} / ${rows.length}`}
          done={allFiled}
        />
        <Stat
          label="Event status"
          value={event.status === "complete" ? "Complete" : "Open"}
          done={event.status === "complete"}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/30 p-3">
        <form action={fileAllFightReports}>
          <input type="hidden" name="event_id" value={event.id} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={missingReports === 0}
          >
            <FileText className="h-3.5 w-3.5" />
            File all fight reports
            {missingReports > 0 && (
              <span className="ml-1 text-muted-foreground">({missingReports})</span>
            )}
          </Button>
        </form>
        <form action={setEventStatus}>
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="status" value="complete" />
          <Button type="submit" size="sm" disabled={!eligibleForComplete}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Mark event complete
          </Button>
        </form>
        {!allDeclared && (
          <p className="text-xs text-muted-foreground">
            Declare every bout&apos;s result to unlock event completion.
          </p>
        )}
        {event.status === "complete" && (
          <form action={setEventStatus}>
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="status" value="scheduled" />
            <Button type="submit" size="sm" variant="ghost">
              Re-open
            </Button>
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No bouts on this card yet — nothing to finalize.
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3">
          {rows.map((b) => (
            <BoutFinalizeRow key={b.id} bout={b} eventId={event.id} />
          ))}
        </ol>
      )}
    </>
  );
}

function BoutFinalizeRow({ bout, eventId }: { bout: BoutRow; eventId: string }) {
  const winnerName =
    bout.result === "red"
      ? bout.red?.full_name ?? "Red"
      : bout.result === "blue"
        ? bout.blue?.full_name ?? "Blue"
        : bout.result === "draw"
          ? "Draw"
          : bout.result === "no_contest"
            ? "No contest"
            : null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">Bout {bout.bout_order ?? "—"}</span>
            <Badge variant="outline" className="capitalize">
              {bout.sport}
            </Badge>
            {bout.weight_class && <Badge variant="secondary">{bout.weight_class}</Badge>}
            {bout.rounds && (
              <Badge variant="outline">
                {bout.rounds} × {bout.round_length_minutes ?? 3}m
              </Badge>
            )}
          </div>
          <CardTitle className="mt-1 text-base">
            <span className={bout.result === "red" ? "text-emerald-700 dark:text-emerald-400" : ""}>
              {bout.red?.full_name ?? "TBD"}
            </span>
            <span className="mx-2 text-xs text-muted-foreground">vs</span>
            <span className={bout.result === "blue" ? "text-emerald-700 dark:text-emerald-400" : ""}>
              {bout.blue?.full_name ?? "TBD"}
            </span>
          </CardTitle>
        </div>
        <Link
          href={`/events/${eventId}/bouts/${bout.id}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Bout detail
          <ExternalLink className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0 md:grid-cols-2">
        <ResultForm bout={bout} eventId={eventId} winnerName={winnerName} />
        <ReportPanel bout={bout} eventId={eventId} />
      </CardContent>
    </Card>
  );
}

function ResultForm({
  bout,
  eventId,
  winnerName,
}: {
  bout: BoutRow;
  eventId: string;
  winnerName: string | null;
}) {
  return (
    <form action={declareBoutResult} className="space-y-3 rounded-lg border border-border/70 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Result
        </p>
        {bout.result ? (
          <Badge className="text-[10px]">
            <BadgeCheck className="mr-1 h-3 w-3" />
            Declared
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            <Circle className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )}
      </div>
      {winnerName && (
        <p className="text-sm">
          <span className="text-muted-foreground">Current: </span>
          <span className="font-medium">{winnerName}</span>
          {bout.method && (
            <span className="ml-1 text-xs text-muted-foreground">
              via {bout.method.replace(/_/g, " ")}
              {bout.round_finished && ` · R${bout.round_finished}`}
              {bout.time_finished && ` (${bout.time_finished})`}
            </span>
          )}
        </p>
      )}
      <input type="hidden" name="bout_id" value={bout.id} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="bout_class" value={bout.bout_class} />
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Winner" htmlFor={`res_${bout.id}`}>
          <NativeSelect
            id={`res_${bout.id}`}
            name="result"
            defaultValue={bout.result ?? ""}
            required
          >
            <option value="" disabled>
              Pick…
            </option>
            {BOUT_OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value === "red" && bout.red?.full_name
                  ? bout.red.full_name
                  : o.value === "blue" && bout.blue?.full_name
                    ? bout.blue.full_name
                    : o.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Method" htmlFor={`m_${bout.id}`}>
          <NativeSelect
            id={`m_${bout.id}`}
            name="method"
            defaultValue={bout.method ?? ""}
            required
          >
            <option value="" disabled>
              Pick…
            </option>
            {BOUT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Round" htmlFor={`r_${bout.id}`}>
          <Input
            id={`r_${bout.id}`}
            name="round_finished"
            type="number"
            min="1"
            max={bout.rounds ?? undefined}
            defaultValue={bout.round_finished ?? ""}
            placeholder={bout.rounds ? String(bout.rounds) : "—"}
          />
        </FormField>
        <FormField label="Time" htmlFor={`t_${bout.id}`}>
          <Input
            id={`t_${bout.id}`}
            name="time_finished"
            type="text"
            placeholder="e.g. 2:45"
            defaultValue={bout.time_finished ?? ""}
          />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          {bout.result ? "Update result" : "Declare result"}
        </Button>
      </div>
    </form>
  );
}

function ReportPanel({ bout, eventId }: { bout: BoutRow; eventId: string }) {
  const filed = bout.reportFiled;
  return (
    <div className="space-y-3 rounded-lg border border-border/70 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Fight report
        </p>
        {filed ? (
          <Badge className="text-[10px]">
            <BadgeCheck className="mr-1 h-3 w-3" />
            Filed
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            <Circle className="mr-1 h-3 w-3" />
            Not filed
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {bout.result
          ? "Report generates live from bout state — filing marks it submitted for audit."
          : "Declare a result first, then the report becomes fileable."}
      </p>
      <div className="flex items-center gap-2">
        <a
          href={`/api/bouts/${bout.id}/documents/fight_report`}
          target="_blank"
          rel="noopener"
          className={`inline-flex items-center gap-1 text-xs ${
            bout.result
              ? "text-muted-foreground hover:text-foreground"
              : "pointer-events-none text-muted-foreground/40"
          }`}
        >
          <FileText className="h-3 w-3" />
          Preview PDF
        </a>
        <div className="ml-auto flex items-center gap-1">
          {!filed && bout.result && (
            <form action={markDocumentFiled}>
              <input type="hidden" name="bout_id" value={bout.id} />
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="kind" value="fight_report" />
              <Button type="submit" size="sm" variant="outline">
                Mark filed
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  done,
}: {
  label: string;
  value: string;
  done: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        done
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border/70 bg-card"
      }`}
    >
      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
        {done && (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        )}
      </div>
    </div>
  );
}
