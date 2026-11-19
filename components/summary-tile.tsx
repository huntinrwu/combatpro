import type { ComponentType, ReactNode } from "react";

// Compact money/stat tile used on the payments, cash-flow and vendor pages.
export function SummaryTile({
  label,
  value,
  valueClassName,
  icon,
  hint,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold ${valueClassName ?? ""}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

const ICON_TILE_TONE = {
  warn: "border-amber-500/40 bg-amber-500/5",
  ok: "border-emerald-500/30 bg-emerald-500/5",
  muted: "border-border bg-muted/20",
} as const;

// Larger headline tile with a leading icon, used on dashboard-style detail pages.
export function IconSummaryTile({
  Icon,
  label,
  value,
  hint,
  tone = "muted",
}: {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: keyof typeof ICON_TILE_TONE;
}) {
  return (
    <div className={`rounded-lg border p-3 ${ICON_TILE_TONE[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
