import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { MediaField } from "@/components/forms/media-field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { SanctioningBody } from "@/lib/db/types";

const SCOPES = ["international", "national", "regional", "state"] as const;

export function SanctioningBodyForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  hiddenFields,
}: {
  action: (fd: FormData) => void | Promise<void>;
  defaults?: Partial<SanctioningBody>;
  submitLabel: string;
  cancelHref: string;
  hiddenFields?: Record<string, string>;
}) {
  const sportsStr = defaults?.sports?.join(", ") ?? "";
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
          <FormField label="Name" htmlFor="name" required>
            <Input id="name" name="name" required autoFocus defaultValue={defaults?.name ?? ""} />
          </FormField>
          <FormField label="Abbreviation" htmlFor="abbreviation" required>
            <Input
              id="abbreviation"
              name="abbreviation"
              required
              placeholder="e.g. WBC"
              defaultValue={defaults?.abbreviation ?? ""}
            />
          </FormField>
          <FormField label="Scope" htmlFor="scope" required>
            <NativeSelect id="scope" name="scope" required defaultValue={defaults?.scope ?? ""}>
              <option value="" disabled>Select scope…</option>
              {SCOPES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            label="Sports"
            htmlFor="sports"
            required
            hint="Comma-separated: boxing, mma, kickboxing"
          >
            <Input id="sports" name="sports" required defaultValue={sportsStr} />
          </FormField>
          <FormField label="Headquarters" htmlFor="headquarters">
            <Input
              id="headquarters"
              name="headquarters"
              placeholder="City, Country"
              defaultValue={defaults?.headquarters ?? ""}
            />
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
          <FormField label="Contact email" htmlFor="contact_email">
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={defaults?.contact_email ?? ""}
            />
          </FormField>
          <FormField label="Logo" htmlFor="logo_url" className="md:col-span-2">
            <MediaField
              id="logo_url"
              name="logo_url"
              kind="sb-logo"
              defaultValue={defaults?.logo_url}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea id="notes" name="notes" rows={3} defaultValue={defaults?.notes ?? ""} />
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit">{submitLabel}</Button>
        <Button variant="ghost" render={<Link href={cancelHref}>Cancel</Link>} />
      </div>
    </form>
  );
}
