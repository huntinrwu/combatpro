"use client";

import {
  FIGHT_CONFIDENCE,
  FIGHT_CONFIDENCE_META,
  type FightConfidence,
} from "@/lib/db/types";

// Inline confidence picker — submits its enclosing <form> on change.
export function ConfidenceSelect({ defaultValue }: { defaultValue: FightConfidence }) {
  return (
    <select
      name="confidence"
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="rounded-md border border-border/60 bg-transparent px-1 py-0.5 text-xs"
      aria-label="Set confidence"
    >
      {FIGHT_CONFIDENCE.map((c) => (
        <option key={c} value={c}>
          {FIGHT_CONFIDENCE_META[c].icon} {FIGHT_CONFIDENCE_META[c].label}
        </option>
      ))}
    </select>
  );
}
