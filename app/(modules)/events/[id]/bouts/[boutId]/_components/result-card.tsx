import { RotateCcw, Trophy } from "lucide-react";

import { clearBoutResult, declareBoutResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  BOUT_CLASSES,
  BOUT_METHODS,
  BOUT_OUTCOMES,
  type Bout,
  type BoutMethod,
  type BoutOutcome,
} from "@/lib/db/types";

type Suggestion = { outcome: BoutOutcome; method: BoutMethod };

export function ResultCard({
  bout,
  eventId,
  red,
  blue,
  totalRounds,
  suggestion,
  declaredMethodLabel,
  winnerName,
}: {
  bout: Bout;
  eventId: string;
  red: { full_name: string } | null;
  blue: { full_name: string } | null;
  totalRounds: number;
  suggestion: Suggestion | null;
  declaredMethodLabel: string | null;
  winnerName: string | null;
}) {
  const isDeclared = Boolean(bout.result);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" />
          {isDeclared ? "Result" : "Declare result"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isDeclared && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="text-xs uppercase tracking-wide text-amber-800/80 dark:text-amber-300/80">
              Official result
            </div>
            <div className="mt-1 font-heading text-2xl font-semibold">
              {bout.result === "draw" && "Draw"}
              {bout.result === "no_contest" && "No contest"}
              {winnerName && <>Winner: {winnerName}</>}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {declaredMethodLabel}
              {bout.round_finished && (
                <>
                  {" "}
                  · Round {bout.round_finished} of {totalRounds}
                </>
              )}
              {bout.time_finished && <> at {bout.time_finished}</>}
            </div>
            <form action={clearBoutResult} className="mt-3">
              <input type="hidden" name="bout_id" value={bout.id} />
              <input type="hidden" name="event_id" value={eventId} />
              <Button size="sm" variant="ghost" type="submit">
                <RotateCcw className="h-3.5 w-3.5" />
                Clear result
              </Button>
            </form>
          </div>
        )}

        {suggestion && !isDeclared && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            <div className="flex-1">
              <div className="font-medium">Suggested from scorecards</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {suggestion.outcome === "red" && `Winner: ${red?.full_name ?? "Red"}`}
                {suggestion.outcome === "blue" && `Winner: ${blue?.full_name ?? "Blue"}`}
                {suggestion.outcome === "draw" && "Draw"}
                {" · "}
                {BOUT_METHODS.find((m) => m.value === suggestion.method)?.label}
                <span className="ml-1 text-muted-foreground/70">
                  (or override below if a stoppage occurred)
                </span>
              </div>
            </div>
            <form action={declareBoutResult}>
              <input type="hidden" name="bout_id" value={bout.id} />
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="result" value={suggestion.outcome} />
              <input type="hidden" name="method" value={suggestion.method} />
              <input type="hidden" name="bout_class" value={bout.bout_class} />
              <input type="hidden" name="round_finished" value={totalRounds} />
              <Button type="submit" size="sm">
                <Trophy className="h-3.5 w-3.5" />
                Apply
              </Button>
            </form>
          </div>
        )}

        <form action={declareBoutResult} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="bout_id" value={bout.id} />
          <input type="hidden" name="event_id" value={eventId} />

          <FormField label="Outcome" htmlFor="result" required>
            <NativeSelect
              id="result"
              name="result"
              required
              defaultValue={bout.result ?? suggestion?.outcome ?? ""}
            >
              <option value="" disabled>
                Select outcome…
              </option>
              {BOUT_OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === "red" && (red?.full_name ? `${red.full_name} wins` : o.label)}
                  {o.value === "blue" && (blue?.full_name ? `${blue.full_name} wins` : o.label)}
                  {(o.value === "draw" || o.value === "no_contest") && o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <FormField label="Method" htmlFor="method" required>
            <NativeSelect
              id="method"
              name="method"
              required
              defaultValue={(bout.method as string | null) ?? suggestion?.method ?? ""}
            >
              <option value="" disabled>
                Select method…
              </option>
              {BOUT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <FormField
            label="Round finished"
            htmlFor="round_finished"
            hint={`Leave as ${totalRounds} for a full-distance decision.`}
          >
            <Input
              id="round_finished"
              name="round_finished"
              type="number"
              min={1}
              max={totalRounds}
              defaultValue={bout.round_finished ?? totalRounds}
            />
          </FormField>

          <FormField label="Time in round" htmlFor="time_finished" hint="Format m:ss, e.g. 2:14.">
            <Input
              id="time_finished"
              name="time_finished"
              defaultValue={bout.time_finished ?? ""}
              placeholder="2:14"
            />
          </FormField>

          <FormField
            label="Class"
            htmlFor="bout_class"
            hint="Pro results affect pro W-L-D; amateur affects amateur W-L-D."
          >
            <NativeSelect id="bout_class" name="bout_class" defaultValue={bout.bout_class}>
              {BOUT_CLASSES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <FormField label="Result notes" htmlFor="notes" className="sm:col-span-2">
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={bout.notes ?? ""}
              placeholder="e.g. Vasquez rocked Mendez-Rojas in R4, held on to win via UD."
            />
          </FormField>

          <div className="sm:col-span-2">
            <Button type="submit">{isDeclared ? "Update result" : "Declare result"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
