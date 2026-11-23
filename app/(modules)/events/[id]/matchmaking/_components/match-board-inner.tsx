"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { saveMatchBoard } from "../../fighters/actions";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MATCH_KEYS,
  MATCH_KEY_LABELS,
  arrangeFighters,
  pairFlags,
  parseBoard,
  type Candidate,
  type MatchKey,
  type MatchmakingSettings,
} from "@/lib/matchmaking";

type Slot = string | null;
type Board = { priorities: MatchKey[]; pairs: [Slot, Slot][]; bench: string[] };
type Target =
  | { type: "fighter"; id: string }
  | { type: "slot"; pair: number; side: 0 | 1 }
  | { type: "bench" };

function fresh(candidates: Candidate[], priorities: MatchKey[], s: MatchmakingSettings): Board {
  const { pairs, unpaired } = arrangeFighters(candidates, priorities, s);
  return { priorities, pairs, bench: unpaired };
}

// The saved board can be older than the roster: drop fighters who have left
// (or been booked) and put new arrivals with the unpaired.
function reconcile(board: Board, candidates: Candidate[]): Board {
  const known = new Set(candidates.map((c) => c.id));
  const seen = new Set<string>();
  const keep = (id: Slot): Slot => {
    if (!id || !known.has(id) || seen.has(id)) return null;
    seen.add(id);
    return id;
  };
  const pairs = board.pairs
    .map((p) => [keep(p[0]), keep(p[1])] as [Slot, Slot])
    .filter((p) => p[0] || p[1]);
  const bench = board.bench.map(keep).filter((id): id is string => id != null);
  for (const c of candidates) if (!seen.has(c.id)) bench.push(c.id);
  return { priorities: board.priorities, pairs, bench };
}

function load(key: string): Board | null {
  try {
    return parseBoard(JSON.parse(window.localStorage.getItem(key) ?? "null"));
  } catch {
    return null;
  }
}

function boutHref(eventId: string, a: Candidate, b: Candidate): string {
  const q = new URLSearchParams({ red: a.fighterId, blue: b.fighterId });
  const weights = [a.targetWeightLbs, b.targetWeightLbs].filter((w): w is number => w != null);
  if (weights.length > 0) q.set("lbs", String(Math.max(...weights)));
  const wc = a.weightClass ?? b.weightClass;
  if (wc) q.set("wc", wc);
  if (a.competingAs === b.competingAs) q.set("cls", a.competingAs);
  return `/events/${eventId}/bouts/new?${q}`;
}

// The matchmaking board: fighters who still need an opponent, lined up in
// pairs. The matchmaker picks what to line them up by, then drags (or taps)
// fighters between pairings. The arrangement is kept in this browser until
// the bouts are created.
export default function MatchBoardInner({
  eventId,
  candidates,
  settings,
  canEdit,
  savedBoard,
}: {
  eventId: string;
  candidates: Candidate[];
  settings: MatchmakingSettings;
  canEdit: boolean;
  // The board last saved on the event, if any.
  savedBoard: Board | null;
}) {
  const storageKey = `combatpro-matchboard-${eventId}`;
  const [saved, setSaved] = useState<Board>(
    () => savedBoard ?? load(storageKey) ?? fresh(candidates, [], settings),
  );
  // Suggestions are only shown to the public once the matchmaker has saved a board.
  const [published, setPublished] = useState(savedBoard != null);
  // Fighter picked up by tapping, waiting for a place to go.
  const [picked, setPicked] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const board = useMemo(() => reconcile(saved, candidates), [saved, candidates]);
  // Always one empty row at the bottom to start a new pairing in.
  const rows: [Slot, Slot][] = [...board.pairs, [null, null]];

  function commit(next: Board) {
    setSaved(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Private browsing or a full disk: the board still works for this visit.
    }
    if (!canEdit) return;
    setPublished(true);
    // Saved on the event too, so other devices and the public lineup page see it.
    saveMatchBoard(eventId, next).catch(() => toast.error("Couldn't save the board."));
  }

  function togglePriority(key: MatchKey | null) {
    const priorities =
      key === null
        ? []
        : board.priorities.includes(key)
          ? board.priorities.filter((k) => k !== key)
          : [...board.priorities, key];
    setPicked(null);
    commit(fresh(candidates, priorities, settings));
  }

  function move(id: string, target: Target) {
    const pairs = rows.map((p) => [...p] as [Slot, Slot]);
    const bench = [...board.bench];
    type Loc = { pair: number; side: 0 | 1 } | { bench: number };
    const locate = (x: string): Loc | null => {
      for (let i = 0; i < pairs.length; i++) {
        if (pairs[i][0] === x) return { pair: i, side: 0 };
        if (pairs[i][1] === x) return { pair: i, side: 1 };
      }
      const b = bench.indexOf(x);
      return b >= 0 ? { bench: b } : null;
    };
    const put = (loc: Loc, value: string) => {
      if ("bench" in loc) bench[loc.bench] = value;
      else pairs[loc.pair][loc.side] = value;
    };
    const clear = (loc: Loc) => {
      if ("bench" in loc) bench.splice(loc.bench, 1);
      else pairs[loc.pair][loc.side] = null;
    };

    const from = locate(id);
    if (!from) return;
    // Dropping on an occupied slot is the same as dropping on its fighter.
    const occupant = target.type === "slot" ? pairs[target.pair]?.[target.side] : null;
    const swapWith = target.type === "fighter" ? target.id : occupant;

    if (swapWith) {
      if (swapWith === id) return;
      const to = locate(swapWith);
      if (!to) return;
      put(from, swapWith);
      put(to, id);
    } else if (target.type === "slot") {
      clear(from);
      pairs[target.pair][target.side] = id;
    } else if (target.type === "bench") {
      if ("bench" in from) return;
      clear(from);
      bench.push(id);
    }
    commit({ priorities: board.priorities, pairs: pairs.filter((p) => p[0] || p[1]), bench });
  }

  // Tap-to-move, for touch screens and keyboards where dragging isn't available.
  function tap(target: Target) {
    if (!picked) {
      if (target.type === "fighter") setPicked(target.id);
      return;
    }
    if (target.type === "fighter" && target.id === picked) {
      setPicked(null);
      return;
    }
    move(picked, target);
    setPicked(null);
  }

  function dropProps(target: Target) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (dragging) e.preventDefault();
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragging) move(dragging, target);
        setDragging(null);
      },
    };
  }

  function fighterCard(id: string, corner?: "red" | "blue") {
    const c = byId.get(id);
    if (!c) return null;
    const weight =
      [c.weightClass, c.targetWeightLbs != null ? `${c.targetWeightLbs} lbs` : null]
        .filter(Boolean)
        .join(" · ") || null;
    return (
      // A div, not a button: Firefox will not start a drag from a button.
      <div
        key={id}
        role="button"
        tabIndex={0}
        draggable
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            tap({ type: "fighter", id });
          }
        }}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
          setDragging(id);
          setPicked(null);
        }}
        onDragEnd={() => setDragging(null)}
        onClick={() => tap({ type: "fighter", id })}
        aria-pressed={picked === id}
        {...dropProps({ type: "fighter", id })}
        className={cn(
          "w-full cursor-grab select-none rounded-md border border-border bg-card px-2.5 py-1.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing",
          corner === "red" && "border-l-2 border-l-red-500/70",
          corner === "blue" && "border-l-2 border-l-blue-500/70",
          picked === id && "ring-2 ring-brand",
          dragging === id && "opacity-40",
        )}
      >
        <div className="truncate text-sm font-medium">{c.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {[c.gender === "female" ? "Female" : c.gender === "male" ? "Male" : null, c.age != null ? `age ${c.age}` : null, weight].filter(Boolean).join(" · ") ||
            "No details yet"}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {[
            `${c.fights} fight${c.fights === 1 ? "" : "s"}`,
            `${c.wins} win${c.wins === 1 ? "" : "s"}`,
            c.competingAs === "pro" ? "Pro" : null,
            c.gym,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
    );
  }

  function emptySlot(pair: number, side: 0 | 1) {
    const target: Target = { type: "slot", pair, side };
    return (
      <button
        type="button"
        onClick={() => tap(target)}
        {...dropProps(target)}
        className={cn(
          "flex h-full min-h-[4.25rem] w-full items-center justify-center rounded-md border border-dashed border-border px-2 text-xs text-muted-foreground",
          (picked || dragging) && "border-brand/60 bg-brand/5",
        )}
      >
        {picked ? "Tap to place here" : "Drop a fighter here"}
      </button>
    );
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No one needs an opponent. Everyone on the roster is already on a bout, or the roster is
        empty.{" "}
        <Link href={`/events/${eventId}/fighters`} className="underline">
          Fighters tab
        </Link>
      </p>
    );
  }

  const chip =
    "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors";
  const chipOn = "border-foreground bg-foreground text-background";
  const chipOff = "border-border text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">Match by</span>
          {MATCH_KEYS.map((key) => {
            const pos = board.priorities.indexOf(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={pos >= 0}
                onClick={() => togglePriority(key)}
                className={cn(chip, pos >= 0 ? chipOn : chipOff)}
              >
                {pos >= 0 && board.priorities.length > 1 && (
                  <span className="tabular-nums opacity-70">{pos + 1}</span>
                )}
                {MATCH_KEY_LABELS[key]}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={board.priorities.length === 0}
            onClick={() => togglePriority(null)}
            className={cn(chip, board.priorities.length === 0 ? chipOn : chipOff)}
          >
            No priority
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {board.priorities.length === 0
            ? "Balanced suggestions using the rules for this event."
            : "Fighters are lined up in the order you picked, and neighbours are paired."}{" "}
          Drag a fighter to move them, or tap one and then tap where they should go.
          {canEdit &&
            " Pairings here show on the public lineup page as tentative, unless the bout list is hidden."}
        </p>
      </div>

      {canEdit && !published && board.pairs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            These are suggestions only you can see. They are not on the public lineup page yet.
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => commit(board)}>
            Use these pairings
          </Button>
        </div>
      )}

      <ul className="space-y-2">
        {rows.map((p, i) => {
          const a = p[0] ? byId.get(p[0]) : undefined;
          const b = p[1] ? byId.get(p[1]) : undefined;
          const flags = a && b ? pairFlags(a, b, settings) : [];
          const isNew = !p[0] && !p[1];
          return (
            <li key={`${p[0] ?? "x"}|${p[1] ?? "x"}|${isNew ? "new" : i}`}>
              {isNew && (
                <div className="mb-1 text-xs text-muted-foreground">New pairing</div>
              )}
              <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
                {p[0] ? fighterCard(p[0], "red") : emptySlot(i, 0)}
                <span className="self-center text-xs text-muted-foreground">vs</span>
                {p[1] ? fighterCard(p[1], "blue") : emptySlot(i, 1)}
              </div>
              {a && b && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {flags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Good match</span>
                  ) : (
                    flags.map((f) => (
                      <Badge key={f} variant="warning">
                        {f}
                      </Badge>
                    ))
                  )}
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      render={
                        <Link href={boutHref(eventId, a, b)}>
                          <Plus className="h-3 w-3" />
                          Create bout
                        </Link>
                      }
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div
        {...dropProps({ type: "bench" })}
        onClick={() => picked && tap({ type: "bench" })}
        className={cn(
          "rounded-md border border-dashed border-border p-3",
          (picked || dragging) && "border-brand/60 bg-brand/5",
        )}
      >
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Not paired ({board.bench.length})
        </div>
        {board.bench.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Everyone is paired. Drop a fighter here to take them out of a pairing.
          </p>
        ) : (
          <div
            className="grid gap-2 sm:grid-cols-2"
            // A tap on a fighter here picks them up; it shouldn't also count as a tap on the box.
            onClick={(e) => e.stopPropagation()}
          >
            {board.bench.map((id) => fighterCard(id))}
          </div>
        )}
      </div>
    </div>
  );
}
