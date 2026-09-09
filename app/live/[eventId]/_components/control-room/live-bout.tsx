"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ControlRoomBout, ControlRoomJudge } from "../../page";

import { BoutHeader } from "./bout-header";
import { ControlBar } from "./control-bar";
import type { TimerState } from "./format";
import { JudgeStrip } from "./judge-strip";
import { OnDeckCard } from "./on-deck-card";
import { ResultForm } from "./result-form";
import { Timer } from "./timer";

export function LiveBout({
  eventId,
  bout,
  nextBout,
  judges,
}: {
  eventId: string;
  bout: ControlRoomBout;
  nextBout: ControlRoomBout | null;
  judges: ControlRoomJudge[];
}) {
  const roundLengthMs = bout.round_length_minutes * 60_000;
  const [timer, setTimer] = useState<TimerState>({
    startedAt: null,
    accumulatedMs: 0,
    round: 1,
  });
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

  // Auto-pause at end of round.
  const endedRef = useRef(false);
  useEffect(() => {
    if (isEndOfRound && isRunning && !endedRef.current) {
      endedRef.current = true;
      setTimer((t) =>
        t.startedAt == null ? t : { ...t, startedAt: null, accumulatedMs: roundLengthMs },
      );
    }
    if (!isEndOfRound) endedRef.current = false;
  }, [isEndOfRound, isRunning, roundLengthMs]);

  const start = useCallback(() => {
    setTimer((t) => ({ ...t, startedAt: Date.now() }));
  }, []);
  const pause = useCallback(() => {
    setTimer((t) => {
      if (t.startedAt == null) return t;
      return {
        ...t,
        startedAt: null,
        accumulatedMs: t.accumulatedMs + (Date.now() - t.startedAt),
      };
    });
  }, []);
  const resetRound = useCallback(() => {
    setTimer((t) => ({ ...t, startedAt: null, accumulatedMs: 0 }));
  }, []);
  const nextRound = useCallback(() => {
    setTimer((t) => ({
      startedAt: null,
      accumulatedMs: 0,
      round: Math.min(t.round + 1, bout.rounds),
    }));
  }, [bout.rounds]);

  const isDeclared = Boolean(bout.result);

  // Prefill the round entered on the result form so the operator doesn't have
  // to think — mid-round stoppages default to the current round.
  const defaultRound = isEndOfRound
    ? Math.min(timer.round, bout.rounds)
    : timer.round;

  return (
    <div className="mx-auto max-w-[1600px] px-6 pb-10 pt-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6">
          <BoutHeader bout={bout} live />
          <Timer
            remainingMs={remainingMs}
            round={timer.round}
            totalRounds={bout.rounds}
            isRunning={isRunning}
            isEndOfRound={isEndOfRound}
            onStart={start}
            onPause={pause}
            onReset={resetRound}
            onNextRound={nextRound}
          />
          {judges.length > 0 && <JudgeStrip judges={judges} />}
        </section>

        <section className="space-y-6">
          <ResultForm
            key={bout.id + (isDeclared ? "-declared" : "")}
            eventId={eventId}
            bout={bout}
            defaultRound={defaultRound}
            declared={isDeclared}
          />
          <OnDeckCard bout={nextBout} />
          <ControlBar eventId={eventId} bout={bout} />
        </section>
      </div>
    </div>
  );
}
