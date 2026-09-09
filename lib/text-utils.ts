import type { Fighter } from "./db/types";

// First two initials of a name, uppercased. Used for avatar fallbacks
// across fighter/official/user surfaces.
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

// Pro W-L-D string. Amateur record is displayed separately when needed.
export function fighterProRecord(
  f: Pick<Fighter, "pro_wins" | "pro_losses" | "pro_draws">,
): string {
  return `${f.pro_wins}-${f.pro_losses}-${f.pro_draws}`;
}
