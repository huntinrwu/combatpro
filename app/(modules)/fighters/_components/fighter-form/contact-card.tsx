import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Fighter } from "@/lib/db/types";

export function ContactCard({ defaults }: { defaults?: Partial<Fighter> }) {
  return (
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
        <FormField label="Licenses" htmlFor="licenses" className="md:col-span-2">
          <Textarea
            id="licenses"
            name="licenses"
            rows={2}
            defaultValue={defaults?.licenses ?? ""}
            placeholder="Free-form. e.g. WBC #12345 · FSBC lic. #6789 (exp 2027-03)"
          />
        </FormField>
        <FormField label="Notes" htmlFor="notes" className="md:col-span-2">
          <Textarea id="notes" name="notes" rows={3} defaultValue={defaults?.notes ?? ""} />
        </FormField>
      </CardContent>
    </Card>
  );
}
