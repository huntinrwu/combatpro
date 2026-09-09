"use client";

import { useState } from "react";
import { RotateCcw, SkipForward, Trophy } from "lucide-react";

import { declareResultAndAdvance } from "../../actions";
import { clearBoutResult } from "../../../../(modules)/events/[id]/bouts/[boutId]/actions";
import { advanceToNextBout } from "../../../../(modules)/events/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { BOUT_METHODS } from "@/lib/db/types";
import type { ControlRoomBout } from "../../page";

export function ResultForm({
  eventId,
  bout,
  defaultRound,
  declared,
}: {
  eventId: string;
  bout: ControlRoomBout;
  defaultRound: number;
  declared: boolean;
}) {
  const [outcome, setOutcome] = useState<string>(bout.result ?? "");

  if (declared) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
          Result declared
        </div>
        <div className="mt-1 font-heading text-2xl font-semibold">
          {bout.result === "red" && `${bout.red?.full_name ?? "Red corner"} wins`}
          {bout.result === "blue" && `${bout.blue?.full_name ?? "Blue corner"} wins`}
          {bout.result === "draw" && "Draw"}
          {bout.result === "no_contest" && "No contest"}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={advanceToNextBout}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="current_bout_id" value={bout.id} />
            <Button type="submit">
              <SkipForward className="h-4 w-4" />
              Advance to next bout
            </Button>
          </form>
          <form action={clearBoutResult}>
            <input type="hidden" name="bout_id" value={bout.id} />
            <input type="hidden" name="event_id" value={eventId} />
            <Button type="submit" variant="ghost" size="sm">
              <RotateCcw className="h-3.5 w-3.5" />
              Clear result
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const outcomeBtn = (value: string, label: string, tone: "red" | "blue" | "neutral") => {
    const active = outcome === value;
    const base =
      "flex-1 rounded-md border px-3 py-2 text-sm font-semibold uppercase tracking-wider transition-colors";
    const toneMap = {
      red: active
        ? "border-red-500 bg-red-500 text-white"
        : "border-red-500/40 text-red-300 hover:bg-red-500/10",
      blue: active
        ? "border-blue-500 bg-blue-500 text-white"
        : "border-blue-500/40 text-blue-300 hover:bg-blue-500/10",
      neutral: active
        ? "border-white bg-white text-black"
        : "border-white/25 text-white/70 hover:bg-white/10",
    } as const;
    return (
      <button
        type="button"
        onClick={() => setOutcome(value)}
        className={`${base} ${toneMap[tone]}`}
      >
        {label}
      </button>
    );
  };

  return (
    <form
      action={declareResultAndAdvance}
      className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
        Declare result
      </div>

      <input type="hidden" name="bout_id" value={bout.id} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="bout_class" value={bout.bout_class} />
      <input type="hidden" name="result" value={outcome} />

      <div className="flex gap-2">
        {outcomeBtn("red", bout.red?.full_name ? `${bout.red.full_name}` : "Red wins", "red")}
        {outcomeBtn("blue", bout.blue?.full_name ? `${bout.blue.full_name}` : "Blue wins", "blue")}
      </div>
      <div className="flex gap-2">
        {outcomeBtn("draw", "Draw", "neutral")}
        {outcomeBtn("no_contest", "No contest", "neutral")}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-white/60">
          <span className="mb-1 block uppercase tracking-widest">Method</span>
          <NativeSelect
            name="method"
            required
            defaultValue=""
            className="border-white/20 bg-white/5 text-white"
          >
            <option value="" disabled>
              Choose…
            </option>
            {BOUT_METHODS.map((m) => (
              <option key={m.value} value={m.value} className="bg-black">
                {m.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="text-xs text-white/60">
          <span className="mb-1 block uppercase tracking-widest">Round</span>
          <input
            type="number"
            name="round_finished"
            min={1}
            max={bout.rounds}
            defaultValue={defaultRound}
            className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      <label className="block text-xs text-white/60">
        <span className="mb-1 block uppercase tracking-widest">Time in round (optional)</span>
        <input
          type="text"
          name="time_finished"
          placeholder="2:14"
          className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
        />
      </label>

      <Button
        type="submit"
        disabled={!outcome}
        className="w-full bg-white text-black hover:bg-white/90"
      >
        <Trophy className="h-4 w-4" />
        Declare &amp; advance
      </Button>
      <p className="text-[11px] text-white/40">
        Pick a corner button above, choose method, then declare. Fighter records update
        automatically.
      </p>
    </form>
  );
}
