"use client";

import { X } from "lucide-react";

import { setFighterClassPreference } from "../weight-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { WeightClassSelect } from "@/components/weight-class-select";
import { SPORTS, type FighterClassPreference } from "@/lib/db/types";
import { weightClassFor } from "@/lib/weight-classes";

function toNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function ClassPreferencesCard({
  fighterId,
  preferences,
  walkingWeightLbs,
  isStaff,
}: {
  fighterId: string;
  preferences: FighterClassPreference[];
  walkingWeightLbs: number | string | null;
  isStaff: boolean;
}) {
  const walking = toNum(walkingWeightLbs);
  const prefBySport = new Map<string, FighterClassPreference>();
  for (const p of preferences) prefBySport.set(p.sport, p);

  const unassignedSports = SPORTS.filter((s) => !prefBySport.has(s));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        One target weight class per sport. Bouts will pre-suggest the matching class.
      </p>

      {preferences.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No preferences set{isStaff ? "" : " yet"}.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
          {SPORTS.map((sport) => {
            const p = prefBySport.get(sport);
            if (!p) return null;
            const derived = walking != null ? weightClassFor(sport, walking) : null;
            const stretchNote =
              walking != null && derived && derived !== p.class_name
                ? `walking ${walking} → ${derived}`
                : null;
            return (
              <li key={sport} className="flex items-center gap-3 p-3 text-sm">
                <Badge variant="outline" className="capitalize">
                  {sport}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.class_name}</div>
                  {stretchNote && (
                    <div className="text-xs text-muted-foreground">{stretchNote}</div>
                  )}
                </div>
                {isStaff && (
                  <form action={setFighterClassPreference}>
                    <input type="hidden" name="fighter_id" value={fighterId} />
                    <input type="hidden" name="sport" value={sport} />
                    <input type="hidden" name="class_name" value="" />
                    <button
                      type="submit"
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label="Remove"
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isStaff && unassignedSports.length > 0 && (
        <form
          action={setFighterClassPreference}
          className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border/60 bg-muted/20 p-3"
        >
          <input type="hidden" name="fighter_id" value={fighterId} />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Sport
            </label>
            <NativeSelect name="sport" defaultValue="" required>
              <option value="" disabled>
                Sport…
              </option>
              {unassignedSports.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Class
            </label>
            <WeightClassSelect name="class_name" includeBlank={false} required />
          </div>
          <Button type="submit">Add</Button>
        </form>
      )}
    </div>
  );
}
