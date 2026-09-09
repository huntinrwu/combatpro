import type { ControlRoomJudge } from "../../page";

export function JudgeStrip({ judges }: { judges: ControlRoomJudge[] }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {judges.map((j, i) => {
        const leaning =
          j.totalRed > j.totalBlue
            ? "red"
            : j.totalBlue > j.totalRed
              ? "blue"
              : j.roundsScored > 0
                ? "even"
                : null;
        return (
          <div
            key={j.official_id}
            className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2"
          >
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-white/50">
              <span>Judge {i + 1}</span>
              <span className="font-mono text-white/60">{j.roundsScored}r</span>
            </div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
              <span className={leaning === "red" ? "text-red-400" : "text-white/50"}>
                {j.totalRed}
              </span>
              <span className="mx-1 text-white/30">–</span>
              <span className={leaning === "blue" ? "text-blue-400" : "text-white/50"}>
                {j.totalBlue}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
