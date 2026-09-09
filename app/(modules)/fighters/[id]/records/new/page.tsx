import Link from "next/link";
import { notFound } from "next/navigation";

import { submitFightRecord } from "../../../records-actions";
import { db } from "@/lib/db/client";
import { requireUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FIGHT_OUTCOMES, SPORTS, type Fighter } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function SubmitFightRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const supabase = db();

  const [{ data: fighter }, { data: others }] = await Promise.all([
    supabase.from("fighters").select("id, full_name").eq("id", id).maybeSingle<Fighter>(),
    supabase.from("fighters").select("id, full_name").neq("id", id).order("full_name"),
  ]);
  if (!fighter) notFound();

  const opponents = (others ?? []) as Pick<Fighter, "id" | "full_name">[];

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Submit a fight for {fighter.full_name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submissions land as{" "}
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 text-amber-700 dark:text-amber-300">
            🟡 Reported
          </span>{" "}
          — auto-promoted to{" "}
          <span className="rounded border border-blue-500/40 bg-blue-500/10 px-1 text-blue-700 dark:text-blue-300">
            🔵 Corroborated
          </span>{" "}
          when another submission matches, or flagged{" "}
          <span className="rounded border border-red-500/40 bg-red-500/10 px-1 text-red-700 dark:text-red-300">
            🔴 Disputed
          </span>{" "}
          if the result conflicts.
        </p>
      </header>

      <form action={submitFightRecord} className="space-y-6">
        <input type="hidden" name="fighter_id" value={fighter.id} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bout</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField label="Fight date" htmlFor="fight_date" required>
              <Input id="fight_date" name="fight_date" type="date" required autoFocus />
            </FormField>
            <FormField label="Result (for this fighter)" htmlFor="result" required>
              <NativeSelect id="result" name="result" required defaultValue="">
                <option value="" disabled>Select result…</option>
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
              hint="If listed here, opponent_name auto-fills."
            >
              <NativeSelect id="opponent_fighter_id" name="opponent_fighter_id" defaultValue="__none__">
                <option value="__none__">— Not in registry —</option>
                {opponents.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.full_name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Opponent name" htmlFor="opponent_name" required>
              <Input id="opponent_name" name="opponent_name" required />
            </FormField>
            <FormField label="Method" htmlFor="method">
              <Input id="method" name="method" placeholder="e.g. KO, TKO R3, decision" />
            </FormField>
            <FormField label="Round finished" htmlFor="round_finished">
              <Input id="round_finished" name="round_finished" type="number" min={1} max={20} />
            </FormField>
            <FormField label="Time finished" htmlFor="time_finished">
              <Input id="time_finished" name="time_finished" placeholder="e.g. 2:14" />
            </FormField>
            <FormField label="Sport" htmlFor="sport">
              <NativeSelect id="sport" name="sport" defaultValue="">
                <option value="">—</option>
                {SPORTS.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Weight class" htmlFor="weight_class">
              <Input id="weight_class" name="weight_class" />
            </FormField>
            <FormField label="Pro or amateur" htmlFor="is_pro">
              <label className="flex items-center gap-2 text-sm">
                <input id="is_pro" name="is_pro" type="checkbox" defaultChecked />
                Pro bout
              </label>
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Context (optional)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField label="Event name" htmlFor="event_name">
              <Input id="event_name" name="event_name" placeholder="e.g. UFC 300, Tampa Bay Fight Night" />
            </FormField>
            <FormField label="Location" htmlFor="location">
              <Input id="location" name="location" placeholder="City, State" />
            </FormField>
            <FormField
              label="Source"
              htmlFor="source_label"
              className="md:col-span-2"
              hint="Where did you get this? e.g. FSBC record card, Boxrec, personal observation."
            >
              <Input id="source_label" name="source_label" />
            </FormField>
            <FormField label="Notes" htmlFor="notes" className="md:col-span-2">
              <Textarea id="notes" name="notes" rows={2} />
            </FormField>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit">Submit fight</Button>
          <Button variant="ghost" render={<Link href={`/fighters/${fighter.id}`}>Cancel</Link>} />
        </div>
      </form>
    </>
  );
}
