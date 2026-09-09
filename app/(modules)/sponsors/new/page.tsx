import Link from "next/link";

import { createSponsor } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { MediaField } from "@/components/forms/media-field";
import { Textarea } from "@/components/ui/textarea";

export default function NewSponsorPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">New sponsor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the name is required. Everything else can be added later.
        </p>
      </header>

      <form action={createSponsor} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField label="Sponsor name" htmlFor="name" required>
              <Input id="name" name="name" required autoFocus />
            </FormField>
            <FormField label="Website" htmlFor="website">
              <Input id="website" name="website" type="url" placeholder="https://" />
            </FormField>
            <FormField label="Logo" htmlFor="logo_url" className="md:col-span-2">
              <MediaField id="logo_url" name="logo_url" kind="sponsor-logo" />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact &amp; notes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField label="Contact name" htmlFor="contact_name">
              <Input id="contact_name" name="contact_name" />
            </FormField>
            <FormField label="Contact email" htmlFor="contact_email">
              <Input id="contact_email" name="contact_email" type="email" />
            </FormField>
            <FormField label="Contact phone" htmlFor="contact_phone">
              <Input id="contact_phone" name="contact_phone" type="tel" />
            </FormField>
            <FormField label="Notes" htmlFor="notes" className="md:col-span-2">
              <Textarea id="notes" name="notes" rows={3} />
            </FormField>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit">Create sponsor</Button>
          <Button variant="ghost" render={<Link href="/sponsors">Cancel</Link>} />
        </div>
      </form>
    </>
  );
}
