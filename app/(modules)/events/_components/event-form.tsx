import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  EVENT_STATUSES,
  SPORTS,
  type Commission,
  type EventRow,
  type Promotion,
  type SanctioningBody,
} from "@/lib/db/types";

// Shared between /events/new and /events/[id]/edit.
export function EventForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  commissions,
  bodies,
  promotions,
  hiddenFields,
}: {
  action: (fd: FormData) => void | Promise<void>;
  defaults?: Partial<EventRow>;
  submitLabel: string;
  cancelHref: string;
  commissions: Pick<Commission, "id" | "abbreviation" | "name" | "state">[];
  bodies: Pick<SanctioningBody, "id" | "abbreviation" | "name">[];
  promotions: Pick<Promotion, "id" | "name" | "abbreviation">[];
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
          <CardTitle className="text-base">Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Event name" htmlFor="name" required className="md:col-span-2">
            <Input
              id="name"
              name="name"
              required
              autoFocus
              placeholder="e.g. WBC Title Night VII"
              defaultValue={defaults?.name ?? ""}
            />
          </FormField>
          <FormField label="Date" htmlFor="event_date" required>
            <Input
              id="event_date"
              name="event_date"
              type="date"
              required
              defaultValue={defaults?.event_date ?? ""}
            />
          </FormField>
          <FormField label="Primary sport" htmlFor="primary_sport" required>
            <NativeSelect
              id="primary_sport"
              name="primary_sport"
              required
              defaultValue={defaults?.primary_sport ?? ""}
            >
              <option value="" disabled>Select sport…</option>
              {SPORTS.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Status" htmlFor="status">
            <NativeSelect id="status" name="status" defaultValue={defaults?.status ?? "draft"}>
              {EVENT_STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Promotion" htmlFor="promotion_id">
            <NativeSelect
              id="promotion_id"
              name="promotion_id"
              defaultValue={defaults?.promotion_id ?? "__none__"}
            >
              <option value="__none__">— unaffiliated —</option>
              {promotions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.abbreviation ? `${p.abbreviation} — ` : ""}
                  {p.name}
                </option>
              ))}
            </NativeSelect>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Missing?{" "}
              <Link href="/promotions/submit" className="underline">
                Submit a promotion
              </Link>{" "}
              first.
            </div>
          </FormField>
          <FormField label="Promoter (legacy free-text)" htmlFor="promoter">
            <Input
              id="promoter"
              name="promoter"
              placeholder="Only if not in the registry"
              defaultValue={defaults?.promoter ?? ""}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Venue</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Venue name" htmlFor="venue" className="md:col-span-2">
            <Input
              id="venue"
              name="venue"
              placeholder="e.g. Hard Rock Live"
              defaultValue={defaults?.venue ?? ""}
            />
          </FormField>
          <FormField label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={defaults?.city ?? ""} />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regulatory</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Commission" htmlFor="commission_id">
            <NativeSelect
              id="commission_id"
              name="commission_id"
              defaultValue={defaults?.commission_id ?? ""}
            >
              <option value="">—</option>
              {commissions.map((c) => (
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
              defaultValue={defaults?.sanctioning_body_id ?? ""}
            >
              <option value="">—</option>
              {bodies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.abbreviation} — {b.name}
                </option>
              ))}
            </NativeSelect>
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
