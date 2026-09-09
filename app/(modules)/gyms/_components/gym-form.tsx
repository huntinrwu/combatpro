import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { MediaField } from "@/components/forms/media-field";
import { Textarea } from "@/components/ui/textarea";
import type { Gym } from "@/lib/db/types";

// Shared between /gyms/new and /gyms/[id]/edit. `action` is a server action
// bound at the call site — new uses createGym, edit uses updateGym (which
// reads the id from a hidden field).
export function GymForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  hiddenFields,
}: {
  action: (fd: FormData) => void | Promise<void>;
  defaults?: Partial<Gym>;
  submitLabel: string;
  cancelHref: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form action={action} className="space-y-6">
      {hiddenFields &&
        Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Gym name" htmlFor="name" required>
            <Input id="name" name="name" required autoFocus defaultValue={defaults?.name ?? ""} />
          </FormField>
          <FormField label="Head coach" htmlFor="head_coach">
            <Input id="head_coach" name="head_coach" defaultValue={defaults?.head_coach ?? ""} />
          </FormField>
          <FormField label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={defaults?.city ?? ""} />
          </FormField>
          <FormField label="State" htmlFor="state">
            <Input id="state" name="state" placeholder="e.g. FL" defaultValue={defaults?.state ?? ""} />
          </FormField>
          <FormField label="Country" htmlFor="country">
            <Input id="country" name="country" defaultValue={defaults?.country ?? "USA"} />
          </FormField>
          <FormField label="Website" htmlFor="website">
            <Input
              id="website"
              name="website"
              type="url"
              placeholder="https://"
              defaultValue={defaults?.website ?? ""}
            />
          </FormField>
          <FormField label="Logo" htmlFor="logo_url" className="md:col-span-2">
            <MediaField
              id="logo_url"
              name="logo_url"
              kind="gym-logo"
              defaultValue={defaults?.logo_url}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact &amp; notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Email" htmlFor="contact_email">
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={defaults?.contact_email ?? ""}
            />
          </FormField>
          <FormField label="Phone" htmlFor="contact_phone">
            <Input
              id="contact_phone"
              name="contact_phone"
              type="tel"
              defaultValue={defaults?.contact_phone ?? ""}
            />
          </FormField>
          <FormField label="Notes" htmlFor="notes" className="md:col-span-2">
            <Textarea id="notes" name="notes" rows={3} defaultValue={defaults?.notes ?? ""} />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit">{submitLabel}</Button>
        <Button variant="ghost" render={<Link href={cancelHref}>Cancel</Link>} />
      </div>
    </form>
  );
}
