import { cn } from "@/lib/utils";

// A gym's logo in a small square tile, or its first letter when it has none.
// Logos sit on white so they read the same in light and dark mode.
export function GymLogo({
  src,
  name,
  size = 24,
  className,
}: {
  src: string | null | undefined;
  name: string;
  // Pixels per side.
  size?: number;
  className?: string;
}) {
  const box = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70",
    className,
  );
  if (!src) {
    return (
      <span
        aria-hidden
        className={cn(box, "bg-muted font-heading text-muted-foreground")}
        style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.45)) }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <span className={cn(box, "bg-white")} style={{ width: size, height: size }}>
      {/* Stored in our public storage bucket; small enough not to need the optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
    </span>
  );
}
