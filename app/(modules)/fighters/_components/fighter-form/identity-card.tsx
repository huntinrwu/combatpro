import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { MediaField } from "@/components/forms/media-field";
import { NativeSelect } from "@/components/ui/native-select";
import type { Fighter, Gym } from "@/lib/db/types";

export function IdentityCard({
  defaults,
  gymList,
}: {
  defaults?: Partial<Fighter>;
  gymList: Pick<Gym, "id" | "name">[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identity</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <FormField label="Full name" htmlFor="full_name" required>
          <Input
            id="full_name"
            name="full_name"
            required
            autoFocus
            defaultValue={defaults?.full_name ?? ""}
          />
        </FormField>
        <FormField label="Nickname" htmlFor="nickname">
          <Input
            id="nickname"
            name="nickname"
            placeholder='e.g. "The Truth"'
            defaultValue={defaults?.nickname ?? ""}
          />
        </FormField>
        <FormField label="Date of birth" htmlFor="date_of_birth">
          <Input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            defaultValue={defaults?.date_of_birth ?? ""}
          />
        </FormField>
        <FormField label="Nationality" htmlFor="nationality">
          <Input
            id="nationality"
            name="nationality"
            placeholder="e.g. USA"
            defaultValue={defaults?.nationality ?? ""}
          />
        </FormField>
        <FormField label="Hometown" htmlFor="hometown">
          <Input
            id="hometown"
            name="hometown"
            placeholder="City, State"
            defaultValue={defaults?.hometown ?? ""}
          />
        </FormField>
        <FormField label="Gym" htmlFor="gym_id">
          <NativeSelect
            id="gym_id"
            name="gym_id"
            defaultValue={defaults?.gym_id ?? "__none__"}
          >
            <option value="__none__">— unaffiliated —</option>
            {gymList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </NativeSelect>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Missing? <Link href="/gyms/new" className="underline">Add a gym</Link> first, then reopen this form.
          </div>
        </FormField>
        <FormField label="Gym (legacy free-text)" htmlFor="gym">
          <Input
            id="gym"
            name="gym"
            placeholder="Only if not in the registry"
            defaultValue={defaults?.gym ?? ""}
          />
        </FormField>
        <FormField label="Photo" htmlFor="photo_url" className="md:col-span-2">
          <MediaField
            id="photo_url"
            name="photo_url"
            kind="fighter-photo"
            aspect="round"
            defaultValue={defaults?.photo_url}
            label={{ empty: "Drop a headshot or click to upload" }}
          />
        </FormField>
      </CardContent>
    </Card>
  );
}
