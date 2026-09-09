import Link from "next/link";
import { notFound } from "next/navigation";

import { createBout } from "../../../actions";
import { db } from "@/lib/db/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { WeightClassSelect } from "@/components/weight-class-select";
import { BOUT_CLASSES, SCORING_MODES, SPORTS } from "@/lib/db/types";
import type { EventRow, Fighter, Ruleset } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function NewBoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = db();

  const [{ data: event }, { data: fighters }, { data: rulesets }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, primary_sport, sanctioning_body_id")
      .eq("id", id)
      .maybeSingle<Pick<EventRow, "id" | "name" | "primary_sport" | "sanctioning_body_id">>(),
    supabase
      .from("fighters")
      .select("id, full_name, primary_sport")
      .order("full_name"),
    supabase.from("rulesets").select("id, name, sport, sanctioning_body_id, is_default").order("name"),
  ]);

  if (!event) notFound();

  const fighterList = (fighters ?? []) as Pick<Fighter, "id" | "full_name" | "primary_sport">[];
  const rulesetList = (rulesets ?? []) as Pick<
    Ruleset,
    "id" | "name" | "sport" | "sanctioning_body_id" | "is_default"
  >[];

  // Auto-pick a default: prefer (event's sanctioning body, event's primary sport, is_default),
  // else any (sport, body, is_default), else empty.
  const defaultRulesetId =
    rulesetList.find(
      (r) =>
        r.is_default &&
        r.sport === event.primary_sport &&
        r.sanctioning_body_id === event.sanctioning_body_id,
    )?.id ??
    rulesetList.find((r) => r.is_default && r.sport === event.primary_sport)?.id ??
    "__none__";

  return (
    <>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          <Link href={`/events/${event.id}`} className="hover:text-foreground">
            {event.name}
          </Link>
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Add bout</h1>
      </header>

      <form action={createBout} className="space-y-6">
        <input type="hidden" name="event_id" value={event.id} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matchup</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField label="Red corner" htmlFor="red_corner_fighter_id">
              <NativeSelect
                id="red_corner_fighter_id"
                name="red_corner_fighter_id"
                defaultValue=""
              >
                <option value="">TBD</option>
                {fighterList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.full_name} ({f.primary_sport})
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Blue corner" htmlFor="blue_corner_fighter_id">
              <NativeSelect
                id="blue_corner_fighter_id"
                name="blue_corner_fighter_id"
                defaultValue=""
              >
                <option value="">TBD</option>
                {fighterList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.full_name} ({f.primary_sport})
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <FormField label="Sport" htmlFor="sport" required>
              <NativeSelect
                id="sport"
                name="sport"
                required
                defaultValue={event.primary_sport}
              >
                {SPORTS.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Weight class" htmlFor="weight_class">
              <WeightClassSelect id="weight_class" name="weight_class" />
            </FormField>
            <FormField label="Contracted weight (lbs)" htmlFor="contracted_weight_lbs">
              <Input
                id="contracted_weight_lbs"
                name="contracted_weight_lbs"
                type="number"
                step="0.5"
                min={0}
              />
            </FormField>
            <FormField label="Rounds" htmlFor="rounds">
              <Input id="rounds" name="rounds" type="number" min={1} max={15} defaultValue={3} />
            </FormField>
            <FormField label="Round length (min)" htmlFor="round_length_minutes">
              <Input
                id="round_length_minutes"
                name="round_length_minutes"
                type="number"
                step="0.5"
                min={1}
                max={10}
                defaultValue={3}
              />
            </FormField>
            <FormField label="Bout order" htmlFor="bout_order">
              <Input id="bout_order" name="bout_order" type="number" min={1} />
            </FormField>
            <FormField
              label="Scheduled start"
              htmlFor="scheduled_start_time"
              hint="Freeform — e.g. 7:30 PM. Shown on the run-of-show."
            >
              <Input
                id="scheduled_start_time"
                name="scheduled_start_time"
                placeholder="7:30 PM"
              />
            </FormField>
            <FormField label="Class" htmlFor="bout_class">
              <NativeSelect id="bout_class" name="bout_class" defaultValue="pro">
                {BOUT_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Scoring mode" htmlFor="scoring_mode" className="md:col-span-3">
              <NativeSelect id="scoring_mode" name="scoring_mode" defaultValue="10_point_must">
                {SCORING_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Ruleset"
              htmlFor="ruleset_id"
              className="md:col-span-3"
              hint="Optional. Attaches a rule pack (gloves, wraps, KD rules) to the bout agreement PDF."
            >
              <NativeSelect
                id="ruleset_id"
                name="ruleset_id"
                defaultValue={defaultRulesetId}
              >
                <option value="__none__">— None —</option>
                {rulesetList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.sport}
                    {r.is_default ? " · default" : ""})
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
            <Textarea id="notes" name="notes" rows={3} />
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit">Add bout</Button>
          <Button variant="ghost" render={<Link href={`/events/${event.id}`}>Cancel</Link>} />
        </div>
      </form>
    </>
  );
}
