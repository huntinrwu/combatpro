import { Trash2, UserRound } from "lucide-react";

import { addCornerman, deleteCornerman } from "../cornermen-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  CORNERMAN_ROLES,
  cornermanRoleLabel,
  type BoutCornerman,
  type Corner,
} from "@/lib/db/types";

export function CornermenCard({
  boutId,
  eventId,
  cornermen,
}: {
  boutId: string;
  eventId: string;
  cornermen: BoutCornerman[];
}) {
  const red = cornermen.filter((c) => c.corner === "red");
  const blue = cornermen.filter((c) => c.corner === "blue");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CornerColumn
        corner="red"
        boutId={boutId}
        eventId={eventId}
        list={red}
      />
      <CornerColumn
        corner="blue"
        boutId={boutId}
        eventId={eventId}
        list={blue}
      />
    </div>
  );
}

function CornerColumn({
  corner,
  boutId,
  eventId,
  list,
}: {
  corner: Corner;
  boutId: string;
  eventId: string;
  list: BoutCornerman[];
}) {
  const label = corner === "red" ? "RED corner" : "BLUE corner";
  const tone =
    corner === "red"
      ? "border-red-500/40 bg-red-500/5"
      : "border-blue-500/40 bg-blue-500/5";
  const labelTone =
    corner === "red"
      ? "text-red-700 dark:text-red-300"
      : "text-blue-700 dark:text-blue-300";

  return (
    <div className={`rounded-lg border ${tone} p-3`}>
      <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${labelTone}`}>
        {label}
      </div>

      {list.length === 0 ? (
        <p className="mb-3 text-xs text-muted-foreground">No cornermen yet.</p>
      ) : (
        <ul className="mb-3 space-y-1">
          {list.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2.5 py-1.5 text-sm"
            >
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">{c.name}</div>
                {c.notes && (
                  <div className="text-xs text-muted-foreground">{c.notes}</div>
                )}
              </div>
              <Badge variant="outline" className="text-[10px]">
                {cornermanRoleLabel(c.role)}
              </Badge>
              <form action={deleteCornerman}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="bout_id" value={boutId} />
                <input type="hidden" name="event_id" value={eventId} />
                <Button
                  type="submit"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove cornerman"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        action={addCornerman}
        className="grid gap-2 sm:grid-cols-[1.5fr_1fr_auto] sm:items-end"
      >
        <input type="hidden" name="bout_id" value={boutId} />
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="corner" value={corner} />
        <FormField label="Name" htmlFor={`cm_name_${corner}`}>
          <Input
            id={`cm_name_${corner}`}
            name="name"
            required
            placeholder="Cornerman name"
          />
        </FormField>
        <FormField label="Role" htmlFor={`cm_role_${corner}`}>
          <NativeSelect
            id={`cm_role_${corner}`}
            name="role"
            defaultValue="head_coach"
          >
            {CORNERMAN_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <Button type="submit" size="sm">
          Add
        </Button>
      </form>
    </div>
  );
}
