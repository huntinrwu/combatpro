import { addCoach } from "../actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { ToastedForm } from "@/components/forms/toasted-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { COACH_ROLES, type Gym } from "@/lib/db/types";

// The add form on the Coaches page: a person who coaches, owns a gym, or both.
export function AddCoachForm({ gyms }: { gyms: Pick<Gym, "id" | "name">[] }) {
  return (
    <ToastedForm action={addCoach} successMessage="Added" resetOnSuccess className="space-y-3">
      <FormField label="Name" htmlFor="coach_name" required>
        <Input id="coach_name" name="full_name" required />
      </FormField>
      <FormField label="Coaching role" htmlFor="coach_role">
        <NativeSelect id="coach_role" name="role" defaultValue="head_coach">
          {COACH_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
          <option value="none">Not a coach</option>
        </NativeSelect>
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_owner" />
        Owns the gym
      </label>
      <FormField label="Gym" htmlFor="coach_gym">
        <NativeSelect id="coach_gym" name="gym_id" defaultValue="__none__">
          <option value="__none__">No gym</option>
          {gyms.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Email" htmlFor="coach_email">
        <Input id="coach_email" name="contact_email" type="email" />
      </FormField>
      <FormField label="Phone" htmlFor="coach_phone">
        <Input id="coach_phone" name="contact_phone" type="tel" />
      </FormField>
      <Button type="submit" size="sm">
        Add
      </Button>
    </ToastedForm>
  );
}
