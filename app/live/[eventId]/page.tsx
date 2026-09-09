import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Radio } from "lucide-react";

import { ControlRoom } from "./_components/control-room";
import { db } from "@/lib/db/client";
import type {
  Bout,
  BoutScorecard,
  EventOfficial,
  EventRow,
  Fighter,
  Gym,
  Official,
  SanctioningBody,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

export type ControlRoomFighter = {
  id: string;
  full_name: string;
  nickname: string | null;
  gymLabel: string | null;
  hometown: string | null;
  record: { wins: number; losses: number; draws: number } | null;
};

export type ControlRoomBout = {
  id: string;
  bout_order: number | null;
  weight_class: string | null;
  contracted_weight_lbs: number | null;
  rounds: number;
  round_length_minutes: number;
  bout_class: "pro" | "amateur";
  sport: string;
  scheduled_start_time: string | null;
  result: string | null;
  red: ControlRoomFighter | null;
  blue: ControlRoomFighter | null;
};

export type ControlRoomJudge = {
  official_id: string;
  full_name: string;
  totalRed: number;
  totalBlue: number;
  roundsScored: number;
};

function fighterFromRow(
  f: Pick<Fighter, "id" | "full_name" | "nickname" | "gym" | "gym_id" | "hometown" | "pro_wins" | "pro_losses" | "pro_draws" | "am_wins" | "am_losses" | "am_draws"> | undefined,
  boutClass: "pro" | "amateur",
  gymMap: Map<string, Pick<Gym, "id" | "name">>,
): ControlRoomFighter | null {
  if (!f) return null;
  const gymLabel = f.gym_id ? gymMap.get(f.gym_id)?.name ?? f.gym : f.gym;
  const record =
    boutClass === "pro"
      ? { wins: f.pro_wins, losses: f.pro_losses, draws: f.pro_draws }
      : { wins: f.am_wins, losses: f.am_losses, draws: f.am_draws };
  return {
    id: f.id,
    full_name: f.full_name,
    nickname: f.nickname,
    gymLabel: gymLabel ?? null,
    hometown: f.hometown,
    record,
  };
}

export default async function ControlRoomPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = db();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (!event) notFound();

  const [{ data: rawBouts }, sanctioningRes] = await Promise.all([
    supabase
      .from("bouts")
      .select("*")
      .eq("event_id", eventId)
      .order("bout_order", { ascending: true, nullsFirst: false }),
    event.sanctioning_body_id
      ? supabase
          .from("sanctioning_bodies")
          .select("abbreviation, name")
          .eq("id", event.sanctioning_body_id)
          .maybeSingle<Pick<SanctioningBody, "abbreviation" | "name">>()
      : Promise.resolve({ data: null }),
  ]);

  const bouts = (rawBouts ?? []) as Bout[];

  // Determine current + next.
  const currentBout =
    (event.current_bout_id && bouts.find((b) => b.id === event.current_bout_id)) ||
    bouts.find((b) => !b.result) ||
    null;

  const nextBout = currentBout
    ? bouts
        .slice(bouts.findIndex((b) => b.id === currentBout.id) + 1)
        .find((b) => !b.result) ?? null
    : bouts.find((b) => !b.result) ?? null;

  const fighterIds = Array.from(
    new Set(
      [currentBout, nextBout]
        .filter((b): b is Bout => Boolean(b))
        .flatMap((b) => [b.red_corner_fighter_id, b.blue_corner_fighter_id])
        .filter((x): x is string => Boolean(x)),
    ),
  );

  const [{ data: fighters }, { data: gyms }, judgesRes, scorecardsRes] = await Promise.all([
    fighterIds.length
      ? supabase
          .from("fighters")
          .select(
            "id, full_name, nickname, gym, gym_id, hometown, pro_wins, pro_losses, pro_draws, am_wins, am_losses, am_draws",
          )
          .in("id", fighterIds)
      : Promise.resolve({ data: [] }),
    supabase.from("gyms").select("id, name"),
    supabase
      .from("event_officials")
      .select("*")
      .eq("event_id", event.id)
      .eq("event_role", "judge"),
    currentBout
      ? supabase
          .from("bout_scorecards")
          .select("*")
          .eq("bout_id", currentBout.id)
      : Promise.resolve({ data: [] }),
  ]);

  const fighterMap = new Map<
    string,
    Pick<
      Fighter,
      | "id"
      | "full_name"
      | "nickname"
      | "gym"
      | "gym_id"
      | "hometown"
      | "pro_wins"
      | "pro_losses"
      | "pro_draws"
      | "am_wins"
      | "am_losses"
      | "am_draws"
    >
  >();
  for (const f of (fighters ?? []) as Parameters<typeof fighterFromRow>[0][]) {
    if (f) fighterMap.set(f.id, f);
  }

  const gymMap = new Map<string, Pick<Gym, "id" | "name">>();
  for (const g of (gyms ?? []) as Pick<Gym, "id" | "name">[]) {
    gymMap.set(g.id, g);
  }

  function toRoom(b: Bout | null): ControlRoomBout | null {
    if (!b) return null;
    return {
      id: b.id,
      bout_order: b.bout_order,
      weight_class: b.weight_class,
      contracted_weight_lbs: b.contracted_weight_lbs,
      rounds: b.rounds ?? 3,
      round_length_minutes: b.round_length_minutes ?? 3,
      bout_class: b.bout_class,
      sport: b.sport,
      scheduled_start_time: b.scheduled_start_time,
      result: b.result,
      red: fighterFromRow(
        b.red_corner_fighter_id ? fighterMap.get(b.red_corner_fighter_id) : undefined,
        b.bout_class,
        gymMap,
      ),
      blue: fighterFromRow(
        b.blue_corner_fighter_id ? fighterMap.get(b.blue_corner_fighter_id) : undefined,
        b.bout_class,
        gymMap,
      ),
    };
  }

  // Judge totals for the current bout — judges come from the event roster.
  const judgeRows = (judgesRes.data ?? []) as EventOfficial[];
  const cards = (scorecardsRes.data ?? []) as BoutScorecard[];
  const officialIds = judgeRows.map((j) => j.official_id);
  const officialsRes = officialIds.length
    ? await supabase
        .from("officials")
        .select("id, full_name")
        .in("id", officialIds)
    : { data: [] as Pick<Official, "id" | "full_name">[] };
  const officialMap = new Map<string, Pick<Official, "id" | "full_name">>();
  for (const o of (officialsRes.data ?? []) as Pick<Official, "id" | "full_name">[]) {
    officialMap.set(o.id, o);
  }

  const judges: ControlRoomJudge[] = judgeRows.map((j) => {
    const jc = cards.filter((c) => c.judge_official_id === j.official_id);
    return {
      official_id: j.official_id,
      full_name: officialMap.get(j.official_id)?.full_name ?? "Judge",
      totalRed: jc.reduce((s, c) => s + c.red_score, 0),
      totalBlue: jc.reduce((s, c) => s + c.blue_score, 0),
      roundsScored: jc.length,
    };
  });

  const boutsRemaining = bouts.filter((b) => !b.result).length;
  const boutsTotal = bouts.length;
  const sanctioningLabel = sanctioningRes.data?.abbreviation ?? null;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 px-6 py-3">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-white/60">
            <Radio className="h-4 w-4 text-red-500" />
            Control room
            <span className="text-white/30">·</span>
            <span className="text-white">{event.name}</span>
            {sanctioningLabel && (
              <>
                <span className="text-white/30">·</span>
                <span>{sanctioningLabel}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-white/60">
            <span>
              <span className="font-mono text-white">
                {boutsTotal - boutsRemaining}
              </span>
              <span className="text-white/40"> / {boutsTotal} bouts complete</span>
            </span>
            <Link
              href={`/events/${event.id}`}
              className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="h-3 w-3" />
              Exit
            </Link>
          </div>
        </div>
      </header>

      <ControlRoom
        eventId={event.id}
        currentBout={toRoom(currentBout)}
        nextBout={toRoom(nextBout)}
        judges={judges}
        boutsRemaining={boutsRemaining}
      />
    </div>
  );
}
