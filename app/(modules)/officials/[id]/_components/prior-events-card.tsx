import { Trash2 } from "lucide-react";

import { addPriorEvent, deletePriorEvent } from "../prior-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { fmtDateShortWithDay as fmtEventDate } from "@/lib/format-utils";
import { OFFICIAL_ROLES, type OfficialPriorEvent } from "@/lib/db/types";

export function PriorEventsCard({
  officialId,
  events,
  canEdit,
}: {
  officialId: string;
  events: OfficialPriorEvent[];
  canEdit: boolean;
}) {
  const sorted = [...events].sort((a, b) => b.event_date.localeCompare(a.event_date));

  return (
    <div className="space-y-4">
      {canEdit && (
        <form
          action={addPriorEvent}
          className="grid gap-2 rounded-md bg-muted/30 p-3 sm:grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] sm:items-end"
        >
          <input type="hidden" name="official_id" value={officialId} />
          <FormField label="Date" htmlFor="prior_date" required>
            <Input id="prior_date" name="event_date" type="date" required />
          </FormField>
          <FormField label="Event name" htmlFor="prior_name" required>
            <Input
              id="prior_name"
              name="event_name"
              required
              placeholder="e.g. FSBC Fight Night 22"
            />
          </FormField>
          <FormField label="Role" htmlFor="prior_role" required>
            <NativeSelect id="prior_role" name="role" required defaultValue="">
              <option value="" disabled>
                Role…
              </option>
              {OFFICIAL_ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Sanct. body" htmlFor="prior_sb">
            <Input id="prior_sb" name="sanctioning_body" placeholder="FSBC / WBC / ISKA…" />
          </FormField>
          <FormField label="Venue / city" htmlFor="prior_venue">
            <Input id="prior_venue" name="venue" placeholder="Kissimmee, FL" />
          </FormField>
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "No backfilled events yet. Add pre-CombatPro work above."
            : "No backfilled events."}
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
          {sorted.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <Badge variant="secondary" className="capitalize">
                {e.role}
              </Badge>
              <div className="flex-1">
                <div className="font-medium">{e.event_name}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtEventDate(e.event_date)}
                  {e.sanctioning_body && <> · {e.sanctioning_body}</>}
                  {e.venue && <> · {e.venue}</>}
                  {(e.city || e.state) && (
                    <>
                      {" · "}
                      {[e.city, e.state].filter(Boolean).join(", ")}
                    </>
                  )}
                </div>
                {e.notes && (
                  <div className="mt-0.5 text-xs italic text-muted-foreground/80">
                    {e.notes}
                  </div>
                )}
              </div>
              {canEdit && (
                <form action={deletePriorEvent}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="official_id" value={officialId} />
                  <Button
                    type="submit"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete prior event"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

