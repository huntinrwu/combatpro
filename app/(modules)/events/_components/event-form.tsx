import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { parsePublicInfo } from "@/lib/public-info";
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
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
  const publicInfo = parsePublicInfo(defaults?.public_info);
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
          <FormField label="Type of event" htmlFor="event_type" required>
            <NativeSelect
              id="event_type"
              name="event_type"
              required
              defaultValue={defaults?.event_type ?? ""}
            >
              <option value="" disabled>Select type…</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_LABELS[t]}
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
          <CardTitle className="text-base">Public page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            What spectators and fighters see on the event&apos;s public page. The name, date,
            venue, city and state above show there too. Leave anything blank to leave it off.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Street address" htmlFor="public_address" className="md:col-span-2">
              <Input
                id="public_address"
                name="public_address"
                maxLength={200}
                placeholder="e.g. 123 Main St"
                defaultValue={publicInfo.address ?? ""}
              />
            </FormField>
            <FormField label="Doors open" htmlFor="public_doors">
              <Input id="public_doors" name="public_doors" type="time" defaultValue={publicInfo.doors ?? ""} />
            </FormField>
            <FormField label="Fights start" htmlFor="public_start">
              <Input id="public_start" name="public_start" type="time" defaultValue={publicInfo.start ?? ""} />
            </FormField>
            <FormField label="Admission" htmlFor="public_admission">
              <Input
                id="public_admission"
                name="public_admission"
                maxLength={200}
                placeholder="e.g. Free admission, spectators welcome"
                defaultValue={publicInfo.admission ?? ""}
              />
            </FormField>
            <FormField label="Ticket link" htmlFor="public_ticket_url">
              <Input
                id="public_ticket_url"
                name="public_ticket_url"
                maxLength={500}
                placeholder="https://"
                defaultValue={publicInfo.ticketUrl ?? ""}
              />
            </FormField>
            <FormField
              label="More details"
              htmlFor="public_about"
              hint="Parking, what to bring, who to contact, anything else people should know."
              className="md:col-span-2"
            >
              <Textarea
                id="public_about"
                name="public_about"
                rows={4}
                maxLength={3000}
                defaultValue={publicInfo.about ?? ""}
              />
            </FormField>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="public_roster"
              className="mt-1"
              defaultChecked={defaults?.public_roster ?? true}
            />
            <span>
              Show registered fighters to the public
              <span className="block text-xs text-muted-foreground">
                The list of fighters on this event, with gym and target weight.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="public_bouts"
              className="mt-1"
              defaultChecked={defaults?.public_bouts ?? true}
            />
            <span>
              Show the bout list to the public
              <span className="block text-xs text-muted-foreground">
                The fight card, results and tentative matchups. Untick to keep matchups private
                until you are ready.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regulatory</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              name="medicals_required"
              className="mt-1"
              defaultChecked={defaults?.medicals_required ?? true}
            />
            <span>
              Medicals required for this event
              <span className="block text-xs text-muted-foreground">
                Untick for smokers and other events that don&apos;t need them. Medical warnings
                and the medical check-in step are then hidden for this event.
              </span>
            </span>
          </label>
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
