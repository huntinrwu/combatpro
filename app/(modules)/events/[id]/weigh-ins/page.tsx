import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Scale } from "lucide-react";

import { PrintButton } from "../_components/print-button";
import { loadEventDetail } from "../_lib/event-detail";
import { clearRosterWeighIn, recordRosterWeighIn } from "../fighters/actions";
import { db } from "@/lib/db/client";
import { fmtDateLong as fmtEventDate, fmtTime } from "@/lib/format-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  num,
  weighInStatus,
  type EventRosterEntry,
  type Fighter,
  type Gym,
} from "@/lib/db/types";
import { requireModuleAccess } from "@/lib/auth/session";

type RosterRow = Pick<
  EventRosterEntry,
  | "id"
  | "fighter_id"
  | "status"
  | "target_weight_lbs"
  | "weigh_in_lbs"
  | "weigh_in_at"
  | "weigh_in_notes"
> & {
  fighter:
    | (Pick<Fighter, "full_name" | "gym" | "gym_id"> & { gym_ref: Pick<Gym, "name"> | null })
    | null;
};

export default async function WeighInsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("events");
  const { id } = await params;

  // The sheet is the event's roster: every fighter weighs in, whether or not
  // they have been matched on a bout yet.
  const [detail, rosterRes] = await Promise.all([
    loadEventDetail(id),
    db()
      .from("event_fighters")
      .select(
        "id, fighter_id, status, target_weight_lbs, weigh_in_lbs, weigh_in_at, weigh_in_notes, fighter:fighters(full_name, gym, gym_id, gym_ref:gyms(name))",
      )
      .eq("event_id", id),
  ]);
  if (!detail) notFound();
  const { event, bouts } = detail;

  if (rosterRes.error) {
    console.error("[weigh-ins]", rosterRes.error.code, rosterRes.error.message);
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Weigh-ins aren&apos;t available yet. The latest database migration (
        <code>0048_roster_weigh_ins.sql</code>) needs to be applied.
      </div>
    );
  }

  // Where each fighter sits on the card, if they are on it.
  const boutOf = new Map<string, { order: number | null; contracted: number | null }>();
  for (const b of bouts) {
    for (const fid of [b.red_corner_fighter_id, b.blue_corner_fighter_id]) {
      if (fid && !boutOf.has(fid)) {
        boutOf.set(fid, { order: b.bout_order, contracted: b.contracted_weight_lbs });
      }
    }
  }

  const rows = ((rosterRes.data ?? []) as unknown as RosterRow[])
    // Withdrawn fighters drop off the sheet unless they are still on a bout.
    .filter((r) => r.fighter && (r.status !== "withdrawn" || boutOf.has(r.fighter_id)))
    .map((r) => {
      const f = r.fighter!;
      const bout = boutOf.get(r.fighter_id) ?? null;
      // A booked bout's contracted weight is the limit; otherwise the
      // fighter's target weight for this event.
      const limit =
        bout?.contracted != null
          ? num(bout.contracted)
          : r.target_weight_lbs != null
            ? num(r.target_weight_lbs)
            : null;
      const actual = r.weigh_in_lbs != null ? num(r.weigh_in_lbs) : null;
      return {
        key: r.id,
        fighterId: r.fighter_id,
        name: f.full_name,
        gym: (f.gym_id ? f.gym_ref?.name : f.gym) ?? null,
        bout,
        limit,
        actual,
        notes: r.weigh_in_notes,
        at: r.weigh_in_at,
        status: weighInStatus(limit, actual),
        overage: limit != null && actual != null ? actual - limit : null,
      };
    })
    // Lightest first; fighters with no weight set go last.
    .sort((a, b) => (a.limit ?? 9999) - (b.limit ?? 9999) || a.name.localeCompare(b.name));

  const weighed = rows.filter((r) => r.actual != null).length;
  const overRows = rows.filter((r) => r.status === "over");
  const underRows = rows.filter((r) => r.status === "under");
  const onRows = rows.filter((r) => r.status === "on");

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2 text-sm">
          <Scale className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Official weigh-ins</span>
          <span className="text-muted-foreground">— rapid entry sheet</span>
        </div>
        <PrintButton />
      </div>

      <header className="mb-4 hidden border-b border-border pb-4 print:block">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Scale className="h-3.5 w-3.5" />
          Official weigh-ins
        </p>
        <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
          {event.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fmtEventDate(event.event_date)}
          {event.venue ? ` · ${event.venue}` : ""}
          {event.city ? `, ${event.city}` : ""}
          {event.state ? `, ${event.state}` : ""}
        </p>
      </header>

      {rows.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <SummaryTile label="Weighed" value={`${weighed} / ${rows.length}`} />
          <SummaryTile label="On weight" value={String(onRows.length)} tone="ok" />
          <SummaryTile label="Under" value={String(underRows.length)} tone="muted" />
          <SummaryTile
            label="Over weight"
            value={String(overRows.length)}
            tone={overRows.length > 0 ? "bad" : "muted"}
          />
        </div>
      )}

      {overRows.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 font-medium text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" />
            {overRows.length} fighter{overRows.length === 1 ? "" : "s"} over weight
          </div>
          <ul className="ml-6 list-disc space-y-0.5 text-xs text-red-800 dark:text-red-200">
            {overRows.map((r) => (
              <li key={r.key}>
                {r.name} — {r.actual} lbs vs {r.limit}{" "}
                {r.overage != null && <span className="font-mono">(+{r.overage.toFixed(1)})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No fighters on this event yet.{" "}
          <Link href={`/events/${event.id}/fighters`} className="underline print:hidden">
            Add fighters
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Fighter</th>
                <th className="px-3 py-2 text-right font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Weigh-in</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium print:hidden">Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.key} className={r.status === "over" ? "bg-red-500/5" : ""}>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">{r.name}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {[r.gym, r.bout ? `Bout ${r.bout.order ?? "?"}` : "Not matched yet"]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {r.notes && (
                      <div className="mt-0.5 text-[11px] italic text-muted-foreground">
                        {r.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right align-top font-mono text-xs">
                    {r.limit ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <form
                      action={recordRosterWeighIn}
                      className="flex flex-wrap items-center gap-1.5 print:hidden"
                    >
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="fighter_id" value={r.fighterId} />
                      <Input
                        name="weigh_in_lbs"
                        type="number"
                        step="0.1"
                        min="1"
                        max="600"
                        defaultValue={r.actual ?? ""}
                        placeholder="lbs"
                        aria-label={`Weigh-in for ${r.name}, in pounds`}
                        className="h-8 w-20 font-mono text-xs"
                        required
                      />
                      <Input
                        name="weigh_in_notes"
                        defaultValue={r.notes ?? ""}
                        placeholder="notes (e.g. 2nd attempt)"
                        aria-label="Notes"
                        className="h-8 w-40 text-xs"
                      />
                      <Button
                        type="submit"
                        size="xs"
                        variant={r.actual != null ? "outline" : "default"}
                      >
                        {r.actual != null ? "Update" : "Record"}
                      </Button>
                    </form>
                    <span className="hidden font-mono text-xs print:inline">
                      {r.actual != null ? `${r.actual} lbs` : "________"}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-xs">
                    {r.status === "over" && r.overage != null && (
                      <Badge variant="destructive" className="font-mono">
                        +{r.overage.toFixed(1)} OVER
                      </Badge>
                    )}
                    {r.status === "on" && <Badge variant="default">On</Badge>}
                    {r.status === "under" && r.overage != null && (
                      <Badge variant="secondary" className="font-mono">
                        {r.overage.toFixed(1)}
                      </Badge>
                    )}
                    {r.status === "unknown" && <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground print:hidden">
                    {r.at ? fmtTime(r.at) : "—"}
                    {r.actual != null && (
                      <form action={clearRosterWeighIn} className="mt-0.5">
                        <input type="hidden" name="event_id" value={event.id} />
                        <input type="hidden" name="fighter_id" value={r.fighterId} />
                        <Button
                          type="submit"
                          size="xs"
                          variant="ghost"
                          className="h-5 px-1 text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          clear
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 hidden print:block">
        <div className="grid grid-cols-2 gap-8 text-xs">
          <div>
            <div className="border-b border-black pb-8" />
            <div className="mt-1 text-muted-foreground">
              Weigh-in official (print name &amp; sign)
            </div>
          </div>
          <div>
            <div className="border-b border-black pb-8" />
            <div className="mt-1 text-muted-foreground">
              Commission representative
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground print:hidden">
        Tip: enter both weight and any notes, then hit Record/Update. Use{" "}
        <span className="font-mono">Cmd/Ctrl+P</span> to print the sheet for the
        commission.
      </p>
    </>
  );
}

function SummaryTile({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad" | "muted";
}) {
  const bg =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "bad"
        ? "border-red-500/40 bg-red-500/10"
        : "border-border bg-muted/30";
  const text =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "bad"
        ? "text-red-700 dark:text-red-300"
        : "";
  return (
    <div className={`rounded-lg border p-3 ${bg}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-lg font-semibold ${text}`}>
        {value}
      </div>
    </div>
  );
}
