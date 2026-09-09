import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { MediaField } from "@/components/forms/media-field";
import { Textarea } from "@/components/ui/textarea";
import type { Commission } from "@/lib/db/types";

export function CommissionForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  hiddenFields,
}: {
  action: (fd: FormData) => void | Promise<void>;
  defaults?: Partial<Commission>;
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
          <FormField label="Name" htmlFor="name" required>
            <Input id="name" name="name" required autoFocus defaultValue={defaults?.name ?? ""} />
          </FormField>
          <FormField label="Abbreviation" htmlFor="abbreviation" required>
            <Input
              id="abbreviation"
              name="abbreviation"
              required
              placeholder="e.g. FSBC"
              defaultValue={defaults?.abbreviation ?? ""}
            />
          </FormField>
          <FormField label="Jurisdiction" htmlFor="jurisdiction" required>
            <Input
              id="jurisdiction"
              name="jurisdiction"
              required
              placeholder="e.g. Florida"
              defaultValue={defaults?.jurisdiction ?? ""}
            />
          </FormField>
          <FormField label="State" htmlFor="state" hint="2-letter USPS.">
            <Input
              id="state"
              name="state"
              maxLength={2}
              placeholder="FL"
              defaultValue={defaults?.state ?? ""}
            />
          </FormField>
          <FormField label="Country" htmlFor="country">
            <Input id="country" name="country" defaultValue={defaults?.country ?? "US"} />
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
              kind="commission-logo"
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
