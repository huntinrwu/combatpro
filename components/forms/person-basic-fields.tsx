import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Person } from "@/lib/db/types";

// Shared field grid rendered inside both /me (self-serve) and
// /admin/persons/[id] (staff) person edit cards. Both post to Server
// Actions with these exact field names, so keeping one component keeps
// the field <-> action contract in sync.
export function PersonBasicFields({
  person,
  prefix,
  showNotes = false,
}: {
  person: Person;
  prefix: string;
  showNotes?: boolean;
}) {
  return (
    <>
      <FormField label="Full name" htmlFor={`${prefix}name`} required className="sm:col-span-2">
        <Input
          id={`${prefix}name`}
          name="full_name"
          required
          defaultValue={person.full_name}
        />
      </FormField>
      <FormField label="Email" htmlFor={`${prefix}email`}>
        <Input
          id={`${prefix}email`}
          name="email"
          type="email"
          defaultValue={person.email ?? ""}
        />
      </FormField>
      <FormField label="Phone" htmlFor={`${prefix}phone`}>
        <Input
          id={`${prefix}phone`}
          name="phone"
          type="tel"
          defaultValue={person.phone ?? ""}
        />
      </FormField>
      <FormField label="Hometown" htmlFor={`${prefix}home`}>
        <Input
          id={`${prefix}home`}
          name="hometown"
          defaultValue={person.hometown ?? ""}
        />
      </FormField>
      <FormField label="Nationality" htmlFor={`${prefix}nat`}>
        <Input
          id={`${prefix}nat`}
          name="nationality"
          defaultValue={person.nationality ?? ""}
        />
      </FormField>
      <FormField label="Date of birth" htmlFor={`${prefix}dob`}>
        <Input
          id={`${prefix}dob`}
          name="date_of_birth"
          type="date"
          defaultValue={person.date_of_birth ?? ""}
        />
      </FormField>
      <FormField label="Avatar URL" htmlFor={`${prefix}avatar`}>
        <Input
          id={`${prefix}avatar`}
          name="avatar_url"
          type="url"
          defaultValue={person.avatar_url ?? ""}
        />
      </FormField>
      {showNotes && (
        <FormField label="Notes" htmlFor={`${prefix}notes`} className="sm:col-span-2">
          <Textarea
            id={`${prefix}notes`}
            name="notes"
            rows={3}
            defaultValue={person.notes ?? ""}
          />
        </FormField>
      )}
    </>
  );
}
