"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";

import { fmtClock, type TimerState } from "./format";

export function Timer({
  timer,
  roundLengthMs,
  totalRounds,
  onRoundEnd,
  onStart,
  onPause,
  onReset,
  onNextRound,
}: {
  timer: TimerState;
  roundLengthMs: number;
  totalRounds: number;
  onRoundEnd: () => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onNextRound: () => void;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (timer.startedAt == null) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [timer.startedAt]);

  // Re-derived every render — `tick` state forces one every 250ms while
  // running. `Date.now()` during render is intentional here (the tick is the
  // only reason we re-render), so the react-hooks/purity rule is disabled.
  void tick;
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const elapsedMs =
    timer.startedAt == null ? timer.accumulatedMs : timer.accumulatedMs + (nowMs - timer.startedAt);

  const remainingMs = roundLengthMs - elapsedMs;
  const isRunning = timer.startedAt != null;
  const isEndOfRound = remainingMs <= 0;
  const round = timer.round;

  // Auto-pause at end of round.
  const endedRef = useRef(false);
  useEffect(() => {
    if (isEndOfRound && isRunning && !endedRef.current) {
      endedRef.current = true;
      onRoundEnd();
    }
    if (!isEndOfRound) endedRef.current = false;
  }, [isEndOfRound, isRunning, onRoundEnd]);

  return (
    <div
      className={`mt-6 rounded-xl border p-6 text-center transition-colors ${
        isEndOfRound
          ? "animate-pulse border-red-500/70 bg-red-500/10"
          : isRunning
            ? "border-emerald-500/40 bg-emerald-500/[0.04]"
            : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-white/50">
        {isEndOfRound ? "End of round" : isRunning ? "Round in progress" : "Ready"}
      </div>
      <div className="mt-1 font-mono text-7xl font-semibold tabular-nums md:text-8xl">
        {fmtClock(remainingMs)}
      </div>
      <div className="mt-1 text-xs text-white/60">
        Round <span className="font-mono text-white">{round}</span>
        <span className="text-white/40"> / {totalRounds}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {isRunning ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onPause}
            className="min-w-[110px]"
          >
            <Pause className="h-4 w-4" />
            Pause
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={onStart}
            disabled={isEndOfRound}
            className="min-w-[110px] bg-emerald-600 text-white hover:bg-emerald-600/90"
          >
            <Play className="h-4 w-4" />
            Start
          </Button>
        )}
        <Button type="button" variant="outline" size="lg" onClick={onReset}>
          <RotateCcw className="h-4 w-4" />
          Reset round
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onNextRound}
          disabled={round >= totalRounds}
        >
          <SkipForward className="h-4 w-4" />
          Next round
        </Button>
      </div>
    </div>
  );
}
