import * as React from "react";

import { NativeSelect } from "@/components/ui/native-select";
import { SPORTS } from "@/lib/db/types";
import { weightClassesForSport } from "@/lib/weight-classes";

// Sport-scoped weight-class dropdown backed by the canonical catalog. If a
// sport is passed, renders only that sport's classes. Without a sport, groups
// all sports under <optgroup>s so a fighter or bout can be assigned a class
// from any sport in one control (useful when the sport isn't fixed yet).
//
// Passing `defaultValue` matches by class name — the value stored on the row
// is the class name string, not an id. That keeps backwards compat with all
// existing free-text weight_class values.
export function WeightClassSelect({
  name = "weight_class",
  id,
  sport,
  defaultValue,
  required = false,
  className,
  includeBlank = true,
}: {
  name?: string;
  id?: string;
  sport?: string | null;
  defaultValue?: string | null;
  required?: boolean;
  className?: string;
  includeBlank?: boolean;
}) {
  return (
    <NativeSelect
      id={id ?? name}
      name={name}
      defaultValue={defaultValue ?? ""}
      required={required}
      className={className}
    >
      {includeBlank && <option value="">— none —</option>}
      {sport
        ? renderClassOptions(sport)
        : SPORTS.map((s) => (
            <optgroup key={s} label={titleCase(s)}>
              {renderClassOptions(s)}
            </optgroup>
          ))}
    </NativeSelect>
  );
}

function renderClassOptions(sport: string): React.ReactNode {
  const table = weightClassesForSport(sport);
  if (!table) {
    return (
      <option value="" disabled>
        No canonical table
      </option>
    );
  }
  return table.map((wc) => {
    const limit = Number.isFinite(wc.upper_lbs)
      ? `${wc.upper_lbs} lbs`
      : "no limit";
    return (
      <option key={`${sport}:${wc.name}`} value={wc.name}>
        {wc.name} ({limit})
      </option>
    );
  });
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
