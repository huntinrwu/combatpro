import type { ControlRoomBout } from "../../page";

export function BoutHeader({ bout, live }: { bout: ControlRoomBout; live?: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest text-white/50">
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/60 bg-red-500/10 px-2 py-0.5 font-semibold text-red-300">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Live
          </span>
        )}
        <span>Bout {bout.bout_order ?? "?"}</span>
        {bout.weight_class && (
          <>
            <span className="text-white/25">·</span>
            <span>{bout.weight_class}</span>
          </>
        )}
        {bout.contracted_weight_lbs != null && (
          <>
            <span className="text-white/25">·</span>
            <span>{bout.contracted_weight_lbs} lbs</span>
          </>
        )}
        <span className="text-white/25">·</span>
        <span>
          {bout.rounds} × {bout.round_length_minutes}m
        </span>
        <span className="text-white/25">·</span>
        <span className="capitalize">{bout.sport}</span>
        <span className="text-white/25">·</span>
        <span className="capitalize">{bout.bout_class}</span>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <CornerBlock corner="red" fighter={bout.red} />
        <div className="font-heading text-2xl uppercase tracking-widest text-white/40">
          vs
        </div>
        <CornerBlock corner="blue" fighter={bout.blue} />
      </div>
    </div>
  );
}

function CornerBlock({
  corner,
  fighter,
}: {
  corner: "red" | "blue";
  fighter: ControlRoomBout["red"];
}) {
  const isRed = corner === "red";
  return (
    <div className={isRed ? "text-right" : "text-left"}>
      <div
        className={`text-[10px] font-semibold uppercase tracking-widest ${
          isRed ? "text-red-400" : "text-blue-400"
        }`}
      >
        {isRed ? "Red corner" : "Blue corner"}
      </div>
      <div className="font-heading text-3xl font-semibold leading-tight md:text-4xl">
        {fighter?.full_name ?? "TBD"}
      </div>
      {fighter?.nickname && (
        <div className="text-sm text-white/60">&ldquo;{fighter.nickname}&rdquo;</div>
      )}
      {fighter?.gymLabel && (
        <div className="mt-1 text-xs text-white/50">{fighter.gymLabel}</div>
      )}
      {fighter?.record && (
        <div
          className={`mt-1 font-mono text-xs text-white/40 ${
            isRed ? "text-right" : "text-left"
          }`}
        >
          {fighter.record.wins}-{fighter.record.losses}-{fighter.record.draws}
        </div>
      )}
    </div>
  );
}
