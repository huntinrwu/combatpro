export type TimerState = {
  startedAt: number | null;
  accumulatedMs: number;
  round: number;
};

export function fmtClock(ms: number) {
  const clamped = Math.max(0, ms);
  const totalSec = Math.ceil(clamped / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
