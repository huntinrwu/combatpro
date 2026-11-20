import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Plus, Swords } from "lucide-react";

import { loadEventDetail } from "./_lib/event-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  checkinProgress,
  type Bout,
  type BoutFighterCheck,
  type Corner,
  type Fighter,
} from "@/lib/db/types";
import { requireModuleAccess } from "@/lib/auth/session";

type BoutWithFighters = Bout & {
  red?: Pick<Fighter, "id" | "full_name"> | null;
  blue?: Pick<Fighter, "id" | "full_name"> | null;
  checks?: Partial<Record<Corner, BoutFighterCheck>>;
};

export default async function EventBoutsTabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("events");
  const { id } = await params;
  const detail = await loadEventDetail(id);
  if (!detail) notFound();
  const { event, bouts: rawBouts, fighterMap, checksByBout } = detail;
  const showMedical = event.medicals_required !== false;

  const bouts: BoutWithFighters[] = rawBouts.map((b) => ({
    ...b,
    red: b.red_corner_fighter_id ? fighterMap.get(b.red_corner_fighter_id) ?? null : null,
    blue: b.blue_corner_fighter_id ? fighterMap.get(b.blue_corner_fighter_id) ?? null : null,
    checks: checksByBout.get(b.id) ?? {},
  }));

  return (
    <Card collapsible={false}>
      <CardHeader>
        <CardTitle className="text-base">Fight card ({bouts.length})</CardTitle>
        <CardAction>
          <Button
            size="sm"
            render={
              <Link href={`/events/${id}/bouts/new`}>
                <Plus className="h-3.5 w-3.5" />
                Add bout
              </Link>
            }
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {bouts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
            <Swords className="h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm font-medium">No bouts yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Add fighters on the Fighters tab, then let Matchmaking suggest pairings or add a
              bout by hand.
            </p>
            <div className="mt-1 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/events/${id}/fighters`}>Add fighters</Link>}
              />
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/events/${id}/matchmaking`}>Matchmaking</Link>}
              />
            </div>
          </div>
        ) : (
          <ol className="space-y-3">
            {bouts.map((b, idx) => (
              <li key={b.id}>
                <Link
                  href={`/events/${id}/bouts/${b.id}`}
                  className="block rounded-lg border border-border p-3 transition-colors hover:border-foreground/30 hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-2 font-mono">
                      Bout {b.bout_order ?? idx + 1}
                      {b.scheduled_start_time && (
                        <span className="flex items-center gap-1 font-sans text-muted-foreground/80">
                          <Clock className="h-3 w-3" />
                          {b.scheduled_start_time}
                        </span>
                      )}
                      {event.current_bout_id === b.id && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/60 bg-red-500/10 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
                          <span className="relative inline-flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-600" />
                          </span>
                          Live
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="capitalize">
                        {b.sport}
                      </Badge>
                      {b.weight_class && <Badge variant="secondary">{b.weight_class}</Badge>}
                      {b.rounds && (
                        <Badge variant="outline">
                          {b.rounds} × {b.round_length_minutes ?? 3}m
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
                    <FighterSide
                      corner="red"
                      fighter={b.red}
                      check={b.checks?.red}
                      winner={b.result === "red"}
                      showMedical={showMedical}
                    />
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      vs
                    </span>
                    <FighterSide
                      corner="blue"
                      fighter={b.blue}
                      check={b.checks?.blue}
                      align="right"
                      winner={b.result === "blue"}
                      showMedical={showMedical}
                    />
                  </div>
                  {b.result && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      <Badge variant="secondary">
                        {b.result === "red" &&
                          `${b.red?.full_name ?? "Red"} def. ${b.blue?.full_name ?? "Blue"}`}
                        {b.result === "blue" &&
                          `${b.blue?.full_name ?? "Blue"} def. ${b.red?.full_name ?? "Red"}`}
                        {b.result === "draw" && "Draw"}
                        {b.result === "no_contest" && "No contest"}
                      </Badge>
                      <span className="text-muted-foreground">
                        via {b.method?.replace(/_/g, " ")}
                        {b.round_finished && ` · R${b.round_finished}`}
                        {b.time_finished && ` (${b.time_finished})`}
                      </span>
                    </div>
                  )}
                  {b.notes && (
                    <p className="mt-2 text-xs text-muted-foreground">{b.notes}</p>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function FighterSide({
  corner,
  fighter,
  check,
  align = "left",
  winner = false,
  showMedical,
}: {
  corner: "red" | "blue";
  fighter?: Pick<Fighter, "id" | "full_name"> | null;
  check?: BoutFighterCheck | null;
  showMedical: boolean;
  align?: "left" | "right";
  winner?: boolean;
}) {
  const dot = corner === "red" ? "bg-red-500" : "bg-blue-500";
  const progress = checkinProgress(check);
  return (
    <div
      className={`flex items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      {fighter ? (
        <span
          className={`font-medium ${
            winner ? "text-emerald-700 dark:text-emerald-400" : ""
          }`}
        >
          {fighter.full_name}
          {winner && <span className="ml-1 text-xs">✓</span>}
        </span>
      ) : (
        <span className="text-muted-foreground">TBD</span>
      )}
      <span
        className={`flex items-center gap-0.5 ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
        title={showMedical ? "Check-in · Weigh-in · Medical · Cleared" : "Check-in · Weigh-in · Cleared"}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${progress.checkedIn ? "bg-emerald-500/70" : "bg-muted-foreground/20"}`} />
        <span className={`h-1.5 w-1.5 rounded-full ${progress.weighedIn ? "bg-emerald-500/70" : "bg-muted-foreground/20"}`} />
        {showMedical && (
          <span className={`h-1.5 w-1.5 rounded-full ${progress.medicalCleared ? "bg-emerald-500/70" : "bg-muted-foreground/20"}`} />
        )}
        <span className={`h-1.5 w-1.5 rounded-full ${progress.clearedToFight ? "bg-emerald-500" : "bg-muted-foreground/20"}`} />
      </span>
    </div>
  );
}
