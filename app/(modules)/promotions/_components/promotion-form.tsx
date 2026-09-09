import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { MediaField } from "@/components/forms/media-field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PROMOTION_SCOPES, SPORTS, type Promotion } from "@/lib/db/types";

// Shared between /promotions/new, /promotions/submit, and /promotions/[id]/edit.
export function PromotionForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  hiddenFields,
  submitterMode = false,
}: {
  action: (fd: FormData) => void | Promise<void>;
  defaults?: Partial<Promotion>;
  submitLabel: string;
  cancelHref: string;
  hiddenFields?: Record<string, string>;
  submitterMode?: boolean;
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
          <FormField label="Promotion name" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              required
              autoFocus
              placeholder='e.g. "Combat Nights Live"'
              defaultValue={defaults?.name ?? ""}
            />
          </FormField>
          <FormField label="Abbreviation" htmlFor="abbreviation" hint="Short code, e.g. CNL, UFC.">
            <Input
              id="abbreviation"
              name="abbreviation"
              defaultValue={defaults?.abbreviation ?? ""}
            />
          </FormField>
          <FormField label="Scope" htmlFor="scope" required>
            <NativeSelect
              id="scope"
              name="scope"
              required
              defaultValue={defaults?.scope ?? "local"}
            >
              {PROMOTION_SCOPES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            label="Sports"
            htmlFor="sports"
            hint="Comma-separated list — e.g. boxing, mma, muay thai."
          >
            <Input
              id="sports"
              name="sports"
              placeholder={SPORTS.slice(0, 3).join(", ")}
              defaultValue={(defaults?.sports ?? []).join(", ")}
            />
          </FormField>
          <FormField label="Founded" htmlFor="founded_year">
            <Input
              id="founded_year"
              name="founded_year"
              type="number"
              min={1800}
              max={new Date().getFullYear()}
              defaultValue={defaults?.founded_year ?? ""}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <FormField label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={defaults?.city ?? ""} />
          </FormField>
          <FormField label="Home state" htmlFor="home_state" hint="2-letter USPS for US.">
            <Input
              id="home_state"
              name="home_state"
              maxLength={2}
              placeholder="FL"
              defaultValue={defaults?.home_state ?? ""}
            />
          </FormField>
          <FormField label="Country" htmlFor="country">
            <Input
              id="country"
              name="country"
              defaultValue={defaults?.country ?? "US"}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact &amp; notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Contact name" htmlFor="contact_name">
            <Input
              id="contact_name"
              name="contact_name"
              defaultValue={defaults?.contact_name ?? ""}
            />
          </FormField>
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
          <FormField label="Logo" htmlFor="logo_url" className="md:col-span-2">
            <MediaField
              id="logo_url"
              name="logo_url"
              kind="promotion-logo"
              defaultValue={defaults?.logo_url}
            />
          </FormField>
          <FormField
            label={submitterMode ? "Notes / anything staff should know" : "Notes"}
            htmlFor="notes"
            className="md:col-span-2"
          >
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={defaults?.notes ?? ""}
              placeholder={
                submitterMode
                  ? "Add links, prior events, or verification cues."
                  : ""
              }
            />
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
