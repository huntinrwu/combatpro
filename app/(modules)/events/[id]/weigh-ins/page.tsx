import { notFound } from "next/navigation";
import { AlertTriangle, Scale } from "lucide-react";

import { PrintButton } from "./_components/print-button";
import {
  clearWeighIn,
  recordWeighIn,
} from "../bouts/[boutId]/checkin-actions";
import { db } from "@/lib/db/client";
import { fmtDateLong as fmtEventDate } from "@/lib/format-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  weighInStatus,
  type Bout,
  type BoutFighterCheck,
  type Corner,
  type EventRow,
  type Fighter,
  type Gym,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

function fmtTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function WeighInsPage({
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

  const fighterIds = Array.from(
    new Set(
      bouts
        .flatMap((b) => [b.red_corner_fighter_id, b.blue_corner_fighter_id])
        .filter((x): x is string => Boolean(x)),
    ),
  );

  const [{ data: fighters }, { data: checks }, { data: gyms }] = await Promise.all([
    fighterIds.length
      ? supabase
          .from("fighters")
          .select("id, full_name, gym, gym_id")
          .in("id", fighterIds)
      : Promise.resolve({ data: [] }),
    boutIds.length
      ? supabase
          .from("bout_fighter_checks")
          .select("*")
          .in("bout_id", boutIds)
      : Promise.resolve({ data: [] }),
    supabase.from("gyms").select("id, name"),
  ]);

  const fighterMap = new Map<
    string,
    Pick<Fighter, "id" | "full_name" | "gym" | "gym_id">
  >();
  for (const f of (fighters ?? []) as Pick<
    Fighter,
    "id" | "full_name" | "gym" | "gym_id"
  >[]) {
    fighterMap.set(f.id, f);
  }

  const gymMap = new Map<string, Pick<Gym, "id" | "name">>();
  for (const g of (gyms ?? []) as Pick<Gym, "id" | "name">[]) {
    gymMap.set(g.id, g);
  }

  const checksByBout = new Map<string, Partial<Record<Corner, BoutFighterCheck>>>();
  for (const c of (checks ?? []) as BoutFighterCheck[]) {
    const entry = checksByBout.get(c.bout_id) ?? {};
    entry[c.corner as Corner] = c;
    checksByBout.set(c.bout_id, entry);
  }

  type Row = {
    key: string;
    bout: Bout;
    corner: Corner;
    fighter: Pick<Fighter, "id" | "full_name" | "gym" | "gym_id"> | null;
    check: BoutFighterCheck | null;
    contracted: number | null;
    actual: number | null;
    status: ReturnType<typeof weighInStatus>;
    overage: number | null;
  };

  const rows: Row[] = [];
  for (const bout of bouts) {
    for (const corner of ["red", "blue"] as const) {
      const fid =
        corner === "red" ? bout.red_corner_fighter_id : bout.blue_corner_fighter_id;
      const check = checksByBout.get(bout.id)?.[corner] ?? null;
      const fighter = fid ? fighterMap.get(fid) ?? null : null;
      const contracted = bout.contracted_weight_lbs;
      const actual = check?.weigh_in_lbs ?? null;
      const status = weighInStatus(contracted, actual);
      rows.push({
        key: `${bout.id}:${corner}`,
        bout,
        corner,
        fighter,
        check,
        contracted,
        actual,
        status,
        overage:
          contracted != null && actual != null ? actual - contracted : null,
      });
    }
  }

  const totalCorners = rows.length;
  const weighedCorners = rows.filter((r) => r.actual != null).length;
  const overRows = rows.filter((r) => r.status === "over");
  const underRows = rows.filter((r) => r.status === "under");
  const onRows = rows.filter((r) => r.status === "on");

  const fighterLabel = (row: Row): string => {
    if (!row.fighter) return "TBD";
    const gym = row.fighter.gym_id
      ? gymMap.get(row.fighter.gym_id)?.name
      : row.fighter.gym;
    return gym ? `${row.fighter.full_name} (${gym})` : row.fighter.full_name;
  };

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
          <SummaryTile label="Weighed" value={`${weighedCorners} / ${totalCorners}`} />
          <SummaryTile label="On contract" value={String(onRows.length)} tone="ok" />
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
            {overRows.length} fighter{overRows.length === 1 ? "" : "s"} over contract
          </div>
          <ul className="ml-6 list-disc space-y-0.5 text-xs text-red-800 dark:text-red-200">
            {overRows.map((r) => (
              <li key={r.key}>
                Bout {r.bout.bout_order ?? "?"} · {r.corner} · {fighterLabel(r)} —{" "}
                {r.actual} lbs vs {r.contracted} contracted{" "}
                {r.overage != null && (
                  <span className="font-mono">(+{r.overage.toFixed(1)})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {bouts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No bouts on this card yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Bout</th>
                <th className="px-3 py-2 font-medium">Corner</th>
                <th className="px-3 py-2 font-medium">Fighter</th>
                <th className="px-3 py-2 font-medium text-right">Contract</th>
                <th className="px-3 py-2 font-medium">Weigh-in</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium print:hidden">Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, idx) => {
                const isNewBout = idx === 0 || rows[idx - 1].bout.id !== r.bout.id;
                return (
                  <tr
                    key={r.key}
                    className={
                      r.status === "over"
                        ? "bg-red-500/5"
                        : isNewBout
                          ? "border-t-2 border-border"
                          : ""
                    }
                  >
                    <td className="px-3 py-2 align-top font-mono text-xs">
                      {isNewBout ? (
                        <div>
                          <div className="font-semibold">
                            #{r.bout.bout_order ?? "?"}
                          </div>
                          {r.bout.weight_class && (
                            <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                              {r.bout.weight_class}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">·</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex items-center gap-1.5 text-xs capitalize">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            r.corner === "red" ? "bg-red-500" : "bg-blue-500"
                          }`}
                        />
                        {r.corner}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">{fighterLabel(r)}</div>
                      {r.check?.weigh_in_notes && (
                        <div className="mt-0.5 text-[11px] italic text-muted-foreground">
                          {r.check.weigh_in_notes}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-right font-mono text-xs">
                      {r.contracted ?? "—"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <form
                        action={recordWeighIn}
                        className="flex flex-wrap items-center gap-1.5 print:hidden"
                      >
                        <input type="hidden" name="bout_id" value={r.bout.id} />
                        <input type="hidden" name="event_id" value={event.id} />
                        <input type="hidden" name="corner" value={r.corner} />
                        <Input
                          name="weigh_in_lbs"
                          type="number"
                          step="0.1"
                          min="1"
                          max="600"
                          defaultValue={r.actual ?? ""}
                          placeholder="lbs"
                          className="h-8 w-20 font-mono text-xs"
                          disabled={!r.fighter}
                          required
                        />
                        <Input
                          name="weigh_in_notes"
                          defaultValue={r.check?.weigh_in_notes ?? ""}
                          placeholder="notes (e.g. 2nd attempt)"
                          className="h-8 w-40 text-xs"
                          disabled={!r.fighter}
                        />
                        <Button
                          type="submit"
                          size="xs"
                          variant={r.actual != null ? "outline" : "default"}
                          disabled={!r.fighter}
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
                      {r.status === "on" && (
                        <Badge variant="default">On</Badge>
                      )}
                      {r.status === "under" && r.overage != null && (
                        <Badge variant="secondary" className="font-mono">
                          {r.overage.toFixed(1)}
                        </Badge>
                      )}
                      {r.status === "unknown" && (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-muted-foreground print:hidden">
                      {fmtTime(r.check?.weigh_in_at ?? null) ?? "—"}
                      {r.actual != null && (
                        <form action={clearWeighIn} className="mt-0.5">
                          <input type="hidden" name="bout_id" value={r.bout.id} />
                          <input type="hidden" name="event_id" value={event.id} />
                          <input type="hidden" name="corner" value={r.corner} />
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
                );
              })}
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
