import { cn } from "@/lib/utils";

// Calendar-page tile for an event date ("DEC / 18"). `iso` is a plain
// YYYY-MM-DD date; it is read as written, with no timezone shifting.
export function DateTile({
  iso,
  size = "md",
  className,
}: {
  iso: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const [, month, day] = iso.split("-").map(Number);
  const label = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][
    (month || 1) - 1
  ];
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-center",
        size === "sm" ? "w-10" : "w-14",
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          "bg-brand font-semibold tracking-wider text-brand-foreground",
          size === "sm" ? "py-0.5 text-[9px]" : "py-0.5 text-[10px]",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "font-heading font-semibold tabular-nums leading-none",
          size === "sm" ? "py-1 text-base" : "py-1.5 text-2xl",
        )}
      >
        {day || "–"}
      </div>
    </div>
  );
}
