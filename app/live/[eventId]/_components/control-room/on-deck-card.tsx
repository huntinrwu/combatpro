import type { ControlRoomBout } from "../../page";

export function OnDeckCard({ bout }: { bout: ControlRoomBout | null }) {
  if (!bout) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-white/50">
        No more bouts on deck.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-white/50">
        <span>On deck</span>
        <span>
          Bout {bout.bout_order ?? "?"}
          {bout.weight_class ? ` · ${bout.weight_class}` : ""}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-red-400">Red</div>
          <div className="font-heading text-lg font-semibold leading-tight">
            {bout.red?.full_name ?? "TBD"}
          </div>
          {bout.red?.gymLabel && (
            <div className="text-[11px] text-white/50">{bout.red.gymLabel}</div>
          )}
        </div>
        <div className="text-xs uppercase tracking-widest text-white/40">vs</div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-blue-400">Blue</div>
          <div className="font-heading text-lg font-semibold leading-tight">
            {bout.blue?.full_name ?? "TBD"}
          </div>
          {bout.blue?.gymLabel && (
            <div className="text-[11px] text-white/50">{bout.blue.gymLabel}</div>
          )}
        </div>
      </div>
    </div>
  );
}
