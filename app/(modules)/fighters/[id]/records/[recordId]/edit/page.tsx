import Link from "next/link";
import { notFound } from "next/navigation";

import { updateFightRecord } from "../../../../records-actions";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  FIGHT_CONFIDENCE,
  FIGHT_CONFIDENCE_META,
  FIGHT_OUTCOMES,
  SPORTS,
  type Fighter,
  type FightRecord,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function EditFightRecordPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  await requireStaff();
  const { id, recordId } = await params;
  const supabase = db();

  const [{ data: fighter }, { data: record }, { data: others }] = await Promise.all([
    supabase.from("fighters").select("id, full_name").eq("id", id).maybeSingle<Fighter>(),
    supabase
      .from("fight_records")
      .select("*")
      .eq("id", recordId)
      .eq("fighter_id", id)
      .maybeSingle<FightRecord>(),
    supabase.from("fighters").select("id, full_name").neq("id", id).order("full_name"),
  ]);
  if (!fighter || !record) notFound();

  const opponents = (others ?? []) as Pick<Fighter, "id" | "full_name">[];
  const confidenceMeta = FIGHT_CONFIDENCE_META[record.confidence];

  return (
    <>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Edit fight record
          </h1>
          <Badge variant="outline" className={confidenceMeta.className}>
            <span className="mr-1" aria-hidden>{confidenceMeta.icon}</span>
            {confidenceMeta.label}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {fighter.full_name} vs {record.opponent_name} —{" "}
          <span className="tabular-nums">{record.fight_date}</span>. Corrections
          re-run the corroboration check against any other submissions for the
          same fighter + opponent + date.
        </p>
      </header>

      <form action={updateFightRecord} className="space-y-6">
        <input type="hidden" name="id" value={record.id} />
        <input type="hidden" name="fighter_id" value={fighter.id} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bout</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField label="Fight date" htmlFor="fight_date" required>
              <Input
                id="fight_date"
                name="fight_date"
                type="date"
                required
                defaultValue={record.fight_date}
              />
            </FormField>
            <FormField label="Result (for this fighter)" htmlFor="result" required>
              <NativeSelect
                id="result"
                name="result"
                required
                defaultValue={record.result}
              >
                {FIGHT_OUTCOMES.map((r) => (
                  <option key={r} value={r} className="capitalize">
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Opponent — from registry (optional)"
              htmlFor="opponent_fighter_id"
              hint="If listed here, opponent_name is what shows on the card."
            >
              <NativeSelect
                id="opponent_fighter_id"
                name="opponent_fighter_id"
                defaultValue={record.opponent_fighter_id ?? "__none__"}
              >
                <option value="__none__">— Not in registry —</option>
                {opponents.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.full_name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Opponent name" htmlFor="opponent_name" required>
              <Input
                id="opponent_name"
                name="opponent_name"
                required
                defaultValue={record.opponent_name}
              />
            </FormField>
            <FormField label="Method" htmlFor="method">
              <Input
                id="method"
                name="method"
                placeholder="e.g. KO, TKO R3, decision"
                defaultValue={record.method ?? ""}
              />
            </FormField>
            <FormField label="Round finished" htmlFor="round_finished">
              <Input
                id="round_finished"
                name="round_finished"
                type="number"
                min={1}
                max={20}
                defaultValue={record.round_finished ?? ""}
              />
            </FormField>
            <FormField label="Time finished" htmlFor="time_finished">
              <Input
                id="time_finished"
                name="time_finished"
                placeholder="e.g. 2:14"
                defaultValue={record.time_finished ?? ""}
              />
            </FormField>
            <FormField label="Sport" htmlFor="sport">
              <NativeSelect id="sport" name="sport" defaultValue={record.sport ?? ""}>
                <option value="">—</option>
                {SPORTS.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Weight class" htmlFor="weight_class">
              <Input
                id="weight_class"
                name="weight_class"
                defaultValue={record.weight_class ?? ""}
              />
            </FormField>
            <FormField label="Pro or amateur" htmlFor="is_pro">
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="is_pro"
                  name="is_pro"
                  type="checkbox"
                  defaultChecked={record.is_pro}
                />
                Pro bout
              </label>
            </FormField>
            <FormField
              label="Confidence"
              htmlFor="confidence"
              hint="Staff override. Bumping to Verified locks the row against auto-demotion."
            >
              <NativeSelect
                id="confidence"
                name="confidence"
                defaultValue={record.confidence}
              >
                {FIGHT_CONFIDENCE.map((c) => (
                  <option key={c} value={c}>
                    {FIGHT_CONFIDENCE_META[c].icon} {FIGHT_CONFIDENCE_META[c].label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField label="Event name" htmlFor="event_name">
              <Input
                id="event_name"
                name="event_name"
                placeholder="e.g. UFC 300, Tampa Bay Fight Night"
                defaultValue={record.event_name ?? ""}
              />
            </FormField>
            <FormField label="Location" htmlFor="location">
              <Input
                id="location"
                name="location"
                placeholder="City, State"
                defaultValue={record.location ?? ""}
              />
            </FormField>
            <FormField
              label="Source"
              htmlFor="source_label"
              className="md:col-span-2"
              hint="Where did you get this? e.g. FSBC record card, Boxrec, personal observation."
            >
              <Input
                id="source_label"
                name="source_label"
                defaultValue={record.source_label ?? ""}
              />
            </FormField>
            <FormField label="Notes" htmlFor="notes" className="md:col-span-2">
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={record.notes ?? ""}
              />
            </FormField>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit">Save changes</Button>
          <Button
            variant="ghost"
            render={<Link href={`/fighters/${fighter.id}`}>Cancel</Link>}
          />
        </div>
      </form>
    </>
  );
}
