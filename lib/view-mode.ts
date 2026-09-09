// Shared view-mode types + a server-safe helper. Kept out of
// components/view-switcher.tsx so server components can call `pickView`
// without crossing the "use client" boundary (which would turn plain
// function exports into unusable client references).

export type ViewKind =
  | "list"
  | "card"
  | "grid"
  | "compact"
  | "kanban"
  | "gallery"
  | "calendar"
  | "timeline";

export function pickView<K extends ViewKind>(
  raw: string | undefined,
  allowed: readonly K[],
): K {
  if (!raw) return allowed[0]!;
  return (allowed as readonly ViewKind[]).includes(raw as ViewKind)
    ? (raw as K)
    : (allowed[0] as K);
}
