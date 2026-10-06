import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, Clock, ListOrdered } from "lucide-react";

import { PrintButton } from "../_components/print-button";
import { fighterIdsOf, loadEventDetail } from "../_lib/event-detail";
import { db } from "@/lib/db/client";
import { fmtDateLong as fmtEventDate } from "@/lib/format-utils";
import { OFFICIAL_ROLE_ORDER as OFFICIAL_ORDER } from "@/lib/ui-config";
import { Badge } from "@/components/ui/badge";
import { EVENT_ROLE_LABELS } from "@/lib/db/types";
import type {
  Commission,
  EventRole,
  Fighter,
  Official,
  Ruleset,
  SanctioningBody,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

type ShowFighter = Pick<Fighter, "id" | "full_name" | "gym" | "gym_id"> & {
  gym_ref: { name: string } | null;
};

type ShowAssignment = {
  event_role: EventRole;
  official: Pick<Official, "full_name"> | null;
};

export default async function RunOfShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = db();

  // Event + bouts come from the per-request cache the [id] layout populated.
  const detail = await loadEventDetail(id);
  if (!detail) notFound();
  const { event, bouts } = detail;

  const fighterIds = fighterIdsOf(bouts);
  const rulesetIds = Array.from(
    new Set(bouts.map((b) => b.ruleset_id).filter((x): x is string => Boolean(x))),
  );

  const [
    commissionRes,
    bodyRes,
    { data: rulesets },
    { data: fighters },
    { data: assignments },
  ] = await Promise.all([
    event.commission_id
      ? supabase
          .from("commissions")
          .select("id, abbreviation, name")
          .eq("id", event.commission_id)
          .maybeSingle<Pick<Commission, "id" | "abbreviation" | "name">>()
      : Promise.resolve({ data: null }),
    event.sanctioning_body_id
      ? supabase
          .from("sanctioning_bodies")
          .select("id, abbreviation, name")
          .eq("id", event.sanctioning_body_id)
          .maybeSingle<Pick<SanctioningBody, "id" | "abbreviation" | "name">>()
      : Promise.resolve({ data: null }),
    rulesetIds.length
      ? supabase.from("rulesets").select("id, name").in("id", rulesetIds)
      : Promise.resolve({ data: [] }),
    // Gym name is embedded via fighters.gym_id → gyms instead of pulling the
    // whole gyms table.
    fighterIds.length
      ? supabase
          .from("fighters")
          .select("id, full_name, gym, gym_id, gym_ref:gyms(name)")
          .in("id", fighterIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("event_officials")
      .select("event_role, official:officials(full_name)")
      .eq("event_id", id)
      .order("created_at"),
  ]);

  const fighterMap = new Map<string, ShowFighter>();
  for (const f of (fighters ?? []) as unknown as ShowFighter[]) {
    fighterMap.set(f.id, f);
  }

  const rulesetMap = new Map<string, Pick<Ruleset, "id" | "name">>();
  for (const r of (rulesets ?? []) as Pick<Ruleset, "id" | "name">[]) {
    rulesetMap.set(r.id, r);
  }

  const rosterByRole = new Map<EventRole, string[]>();
  for (const a of (assignments ?? []) as unknown as ShowAssignment[]) {
    const name = a.official?.full_name ?? "(unassigned)";
    const arr = rosterByRole.get(a.event_role) ?? [];
    arr.push(name);
    rosterByRole.set(a.event_role, arr);
  }
  const rosterRoles = [...rosterByRole.keys()].sort(
    (a, b) => (OFFICIAL_ORDER[a] ?? 99) - (OFFICIAL_ORDER[b] ?? 99),
  );

  function fighterLabel(id: string | null): string {
    if (!id) return "TBD";
    const f = fighterMap.get(id);
    if (!f) return "TBD";
    const gym = f.gym_id ? f.gym_ref?.name : f.gym;
    return gym ? `${f.full_name} (${gym})` : f.full_name;
  }

  const commissionRow = commissionRes.data;
  const bodyRow = bodyRes.data;

  return (
    <>
      <div className="print:hidden">
        <Link
          href={`/events/${event.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to event
        </Link>
      </div>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ListOrdered className="h-3.5 w-3.5" />
            Run of show
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
          {(bodyRow || commissionRow) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {bodyRow && (
                <>
                  Sanctioned by <span className="font-medium">{bodyRow.abbreviation}</span>
                </>
              )}
              {bodyRow && commissionRow && " · "}
              {commissionRow && (
                <>
                  Regulator{" "}
                  <span className="font-medium">{commissionRow.abbreviation}</span>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <PrintButton />
        </div>
      </header>

      {rosterRoles.length > 0 && (
        <section className="mb-4 rounded-lg border border-border bg-muted/20 px-4 py-3">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            Event officials
          </div>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {rosterRoles.map((role) => (
              <li key={role} className="flex gap-2">
                <span className="min-w-28 text-muted-foreground">
                  {EVENT_ROLE_LABELS[role]}:
                </span>
                <span>{rosterByRole.get(role)!.join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {bouts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No bouts on this card yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Matchup</th>
                <th className="px-3 py-2 font-medium">Class</th>
                <th className="px-3 py-2 font-medium">Rounds</th>
                <th className="px-3 py-2 font-medium">Ruleset</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bouts.map((b, idx) => {
                const isLive = event.current_bout_id === b.id;
                const isDone = Boolean(b.result);
                const ruleset = b.ruleset_id ? rulesetMap.get(b.ruleset_id) : null;
                return (
                  <tr
                    key={b.id}
                    className={
                      isLive
                        ? "bg-red-500/5"
                        : isDone
                          ? "text-muted-foreground"
                          : ""
                    }
                  >
                    <td className="px-3 py-2 align-top font-mono text-xs">
                      {b.bout_order ?? idx + 1}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      {b.scheduled_start_time ? (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          {b.scheduled_start_time}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        <span>{fighterLabel(b.red_corner_fighter_id)}</span>
                      </div>
                      <div className="ml-4 my-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        vs
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        <span>{fighterLabel(b.blue_corner_fighter_id)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {b.weight_class ?? <span className="text-muted-foreground/60">—</span>}
                      {b.contracted_weight_lbs != null && (
                        <div className="text-[11px] text-muted-foreground">
                          {b.contracted_weight_lbs} lbs
                        </div>
                      )}
                      <div className="mt-0.5">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {b.bout_class}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      {b.rounds ?? "—"} × {b.round_length_minutes ?? 3}m
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      {ruleset ? (
                        ruleset.name
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      {isLive && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/60 bg-red-500/10 px-2 py-0.5 font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
                          Live
                        </span>
                      )}
                      {isDone && (
                        <span>
                          {b.result === "red" && "Red wins"}
                          {b.result === "blue" && "Blue wins"}
                          {b.result === "draw" && "Draw"}
                          {b.result === "no_contest" && "NC"}
                          {b.method && (
                            <span className="ml-1 text-muted-foreground">
                              · {b.method.replace(/_/g, " ")}
                            </span>
                          )}
                        </span>
                      )}
                      {!isLive && !isDone && (
                        <span className="text-muted-foreground/60">Upcoming</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground print:hidden">
        <ArrowLeft className="mr-1 inline h-3 w-3" />
        Tip: use <span className="font-mono">Cmd/Ctrl+P</span> to print this as a
        ringside cheat-sheet, or the Print button above.
      </p>
    </>
  );
}
