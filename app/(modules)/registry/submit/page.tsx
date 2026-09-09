import Link from "next/link";

import { submitSanctioningBody } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const SCOPES = ["international", "national", "regional", "state"];

export default function SubmitSanctioningBodyPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Submit a sanctioning body
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Submissions are marked <strong>pending</strong> and appear in the registry after review.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization details</CardTitle>
          <CardDescription>All required fields marked with *.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitSanctioningBody} className="grid gap-4 md:grid-cols-2">
            <FormField label="Full name" htmlFor="name" required className="md:col-span-2">
              <Input id="name" name="name" required placeholder="e.g. World Boxing Council" />
            </FormField>

            <FormField label="Abbreviation" htmlFor="abbreviation" required>
              <Input id="abbreviation" name="abbreviation" required placeholder="e.g. WBC" />
            </FormField>

            <FormField label="Scope" htmlFor="scope" required>
              <NativeSelect id="scope" name="scope" required defaultValue="">
                <option value="" disabled>
                  Select scope…
                </option>
                {SCOPES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField
              label="Sports covered"
              htmlFor="sports"
              required
              hint="Comma-separated: boxing, mma, kickboxing, muay thai, bjj, wrestling"
              className="md:col-span-2"
            >
              <Input id="sports" name="sports" required placeholder="boxing, mma" />
            </FormField>

            <FormField label="Headquarters" htmlFor="headquarters">
              <Input id="headquarters" name="headquarters" placeholder="City, Country" />
            </FormField>

            <FormField label="Website" htmlFor="website">
              <Input
                id="website"
                name="website"
                type="url"
                placeholder="https://example.org"
              />
            </FormField>

            <FormField label="Contact email" htmlFor="contact_email">
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                placeholder="ops@example.org"
              />
            </FormField>

            <FormField label="Your email" htmlFor="submitted_by_email" hint="For follow-up.">
              <Input
                id="submitted_by_email"
                name="submitted_by_email"
                type="email"
                placeholder="you@example.com"
              />
            </FormField>

            <FormField label="Notes" htmlFor="notes" className="md:col-span-2">
              <Textarea id="notes" name="notes" rows={3} placeholder="Anything reviewers should know." />
            </FormField>

            <div className="flex items-center gap-2 md:col-span-2">
              <Button type="submit">Submit for review</Button>
              <Button variant="ghost" render={<Link href="/registry">Cancel</Link>} />
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
