import { Plus, X } from "lucide-react";

import { addCoach, removeCoach, updateCoach } from "../../coaches/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToastedForm } from "@/components/forms/toasted-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { COACH_ROLES, type Coach, type Fighter } from "@/lib/db/types";

type FighterOption = Pick<Fighter, "id" | "full_name" | "person_id">;

// The fields shared by an existing person's row and the "add" row.
function PersonFields({
  person,
  idPrefix,
  fighters,
}: {
  person?: Coach;
  idPrefix: string;
  fighters: FighterOption[];
}) {
  // The fighter profile that shares this person's record, if any.
  const linked = person?.person_id
    ? (fighters.find((f) => f.person_id === person.person_id)?.id ?? "__none__")
    : "__none__";
  return (
    <>
      <Input
        name="full_name"
        required
        defaultValue={person?.full_name ?? ""}
        placeholder="Name"
        aria-label="Name"
        className="h-8 min-w-36 flex-1 text-sm"
      />
      <NativeSelect
        name="role"
        defaultValue={person ? (person.role ?? "none") : "head_coach"}
        aria-label="Coaching role"
        className="h-8 w-32 text-sm"
      >
        {COACH_ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
        <option value="none">Not a coach</option>
      </NativeSelect>
      <label
        htmlFor={`${idPrefix}_owner`}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-input px-2 text-sm"
      >
        <input
          id={`${idPrefix}_owner`}
          type="checkbox"
          name="is_owner"
          defaultChecked={person?.is_owner ?? false}
        />
        Owner
      </label>
      <Input
        name="contact_email"
        type="email"
        defaultValue={person?.contact_email ?? ""}
        placeholder="Email"
        aria-label="Email"
        className="h-8 min-w-40 flex-1 text-sm"
      />
      <Input
        name="contact_phone"
        type="tel"
        defaultValue={person?.contact_phone ?? ""}
        placeholder="Phone"
        aria-label="Phone"
        className="h-8 w-36 text-sm"
      />
      <NativeSelect
        name="fighter_id"
        defaultValue={linked}
        aria-label="Also a fighter"
        title="Pick their fighter profile if this person also fights"
        className="h-8 w-44 text-sm"
      >
        <option value="__none__">Not a fighter</option>
        {fighters.map((f) => (
          <option key={f.id} value={f.id}>
            Fighter: {f.full_name}
          </option>
        ))}
      </NativeSelect>
    </>
  );
}

// Staff-only editor on the gym's Edit page: the gym's coaches and owners. A
// person can be a head coach, a junior coach, an owner, or an owner who also
// coaches. Each row saves by itself.
export function GymPeopleEditor({
  gymId,
  people,
  fighters,
}: {
  gymId: string;
  people: Coach[];
  // Every fighter in the registry, for the "also a fighter" picker.
  fighters: FighterOption[];
}) {
  return (
    <Card id="people">
      <CardHeader>
        <CardTitle className="text-base">Coaches &amp; owners</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {people.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No coaches or owners listed yet. Add the first one below.
          </p>
        )}
        {people.map((p) => (
          <div key={p.id} className="flex items-start gap-1.5">
            <ToastedForm
              action={updateCoach}
              successMessage="Saved"
              className="flex flex-1 flex-wrap items-center gap-2"
            >
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="gym_id" value={gymId} />
              <PersonFields person={p} idPrefix={p.id} fighters={fighters} />
              <Button type="submit" size="sm" variant="outline">
                Save
              </Button>
            </ToastedForm>
            <ToastedForm action={removeCoach} successMessage="Removed">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="gym_id" value={gymId} />
              <Button
                type="submit"
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${p.full_name}`}
                title="Remove"
              >
                <X className="h-4 w-4" />
              </Button>
            </ToastedForm>
          </div>
        ))}

        <div className="border-t border-border/60 pt-3">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Add a person
          </div>
          <ToastedForm
            action={addCoach}
            successMessage="Added"
            resetOnSuccess
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="gym_id" value={gymId} />
            <PersonFields idPrefix="new" fighters={fighters} />
            <Button type="submit" size="sm">
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </ToastedForm>
        </div>
        <p className="text-xs text-muted-foreground">
          Each row saves with its own Save button, separately from the gym details above. If
          someone also fights, pick their fighter profile so both roles show as one person.
        </p>
      </CardContent>
    </Card>
  );
}
