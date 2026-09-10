import { IdCard } from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtPersonNo } from "@/lib/format-utils";

export function PersonNoBadge({
  no,
  className,
}: {
  no: number | null | undefined;
  className?: string;
}) {
  if (no == null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] tracking-wide text-muted-foreground",
        className,
      )}
      title="CombatPro person identifier"
    >
      <IdCard className="h-3 w-3" />
      {fmtPersonNo(no)}
    </span>
  );
}
