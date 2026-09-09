import Link from "next/link";

import { createRulesetFromPdf } from "../actions";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SPORTS, type Commission, type SanctioningBody } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function NewRulesetPage({
  searchParams,
}: {
  searchParams: Promise<{ commission?: string; sb?: string; sport?: string }>;
}) {
  await requireStaff();
  const { commission, sb, sport } = await searchParams;

  const supabase = db();
  const [{ data: sbs }, { data: comms }] = await Promise.all([
    supabase.from("sanctioning_bodies").select("id, name, abbreviation").order("name"),
    supabase.from("commissions").select("id, name, abbreviation, state").order("state"),
  ]);
  const sbList = (sbs ?? []) as Pick<SanctioningBody, "id" | "name" | "abbreviation">[];
  const commList = (comms ?? []) as Pick<Commission, "id" | "name" | "abbreviation" | "state">[];

  const cancelHref = commission
    ? `/registry/commissions/${commission}`
    : sb
      ? `/sb/${sb}`
      : "/registry";

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">New ruleset</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the official rules PDF. You can replace it at any time — old versions stay
          in history. Auto-parsing of structured fields runs when an{" "}
          <span className="font-mono text-xs">ANTHROPIC_API_KEY</span> is configured;
          otherwise the PDF is stored and the parsed fields stay blank.
        </p>
      </header>

      <form action={createRulesetFromPdf} className="space-y-6" encType="multipart/form-data">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField label="Name" htmlFor="name" required>
              <Input
                id="name"
                name="name"
                required
                autoFocus
                placeholder='e.g. "FSBC boxing — professional"'
              />
            </FormField>
            <FormField label="Sport" htmlFor="sport" required>
              <NativeSelect id="sport" name="sport" required defaultValue={sport ?? ""}>
                <option value="" disabled>Select sport…</option>
                {SPORTS.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Commission" htmlFor="commission_id">
              <NativeSelect
                id="commission_id"
                name="commission_id"
                defaultValue={commission ?? "__none__"}
              >
                <option value="__none__">— None —</option>
                {commList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.abbreviation}
                    {c.state ? ` (${c.state})` : ""} — {c.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Sanctioning body" htmlFor="sanctioning_body_id">
              <NativeSelect
                id="sanctioning_body_id"
                name="sanctioning_body_id"
                defaultValue={sb ?? "__none__"}
              >
                <option value="__none__">— None —</option>
                {sbList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.abbreviation} — {s.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rules PDF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField label="PDF file" htmlFor="pdf" required hint="Up to 15MB.">
              <Input id="pdf" name="pdf" type="file" accept="application/pdf" required />
            </FormField>
            <p className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              The PDF is stored and shown to anyone opening this ruleset. Prior versions
              stay downloadable from the detail page. When an{" "}
              <span className="font-mono">ANTHROPIC_API_KEY</span> is set on the server,
              Claude will also extract structured fields on upload.
            </p>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit">Create &amp; parse</Button>
          <Button variant="ghost" render={<Link href={cancelHref}>Cancel</Link>} />
        </div>
      </form>
    </>
  );
}
