"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import type { EventStatus } from "@/lib/db/types";

function str(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length ? t : null;
}

function revalidate(event_id: string) {
  revalidatePath(`/events/${event_id}`);
  revalidatePath(`/events/${event_id}/finalize`);
  revalidatePath(`/events/${event_id}/regulatory`);
  revalidatePath("/events");
  // SB dashboards read fight_report counts + event completion
  revalidatePath("/sb", "layout");
}

// Bulk-file fight reports for every bout on the event that has a declared
// result and does NOT yet have a fight_report row. Silently skips bouts
// without a result. Uses the sanctioning body name (if any) as default
// filed_with so the audit trail has something meaningful.
export async function fileAllFightReports(formData: FormData) {
  const event_id = str(formData.get("event_id"));
  if (!event_id) throw new Error("event is required.");

  const supabase = db();

  const [{ data: event }, { data: bouts }] = await Promise.all([
    supabase
      .from("events")
      .select("sanctioning_body_id")
      .eq("id", event_id)
      .maybeSingle<{ sanctioning_body_id: string | null }>(),
    supabase
      .from("bouts")
      .select("id, result")
      .eq("event_id", event_id),
  ]);

  const declaredBouts = ((bouts ?? []) as { id: string; result: string | null }[])
    .filter((b) => b.result != null)
    .map((b) => b.id);

  if (declaredBouts.length === 0) {
    revalidate(event_id);
    return;
  }

  let filed_with: string | null = null;
  if (event?.sanctioning_body_id) {
    const { data: sb } = await supabase
      .from("sanctioning_bodies")
      .select("name")
      .eq("id", event.sanctioning_body_id)
      .maybeSingle<{ name: string }>();
    filed_with = sb?.name ?? null;
  }

  const { data: existingDocs } = await supabase
    .from("bout_documents")
    .select("bout_id")
    .eq("kind", "fight_report")
    .in("bout_id", declaredBouts);

  const alreadyFiled = new Set(
    ((existingDocs ?? []) as { bout_id: string }[]).map((d) => d.bout_id),
  );
  const missing = declaredBouts.filter((id) => !alreadyFiled.has(id));
  if (missing.length === 0) {
    revalidate(event_id);
    return;
  }

  const payload = missing.map((bout_id) => ({
    bout_id,
    kind: "fight_report" as const,
    filed_with,
  }));
  const { error } = await supabase.from("bout_documents").insert(payload);
  if (error) throw new Error(error.message);

  revalidate(event_id);
}

// Flip the event's status. Guarded server-side too so a stale UI can't sneak
// an event to complete with un-declared bouts.
export async function setEventStatus(formData: FormData) {
  const event_id = str(formData.get("event_id"));
  const status = str(formData.get("status")) as EventStatus | null;
  if (!event_id || !status) throw new Error("event + status required.");
  if (!["draft", "scheduled", "complete", "canceled"].includes(status)) {
    throw new Error("invalid status");
  }

  const supabase = db();

  if (status === "complete") {
    const { data: bouts } = await supabase
      .from("bouts")
      .select("id, result")
      .eq("event_id", event_id);
    const undeclared = ((bouts ?? []) as { result: string | null }[]).filter(
      (b) => b.result == null,
    );
    if ((bouts ?? []).length === 0 || undeclared.length > 0) {
      throw new Error(
        "All bouts must have a declared result before marking the event complete.",
      );
    }
  }

  const { error } = await supabase
    .from("events")
    .update({ status })
    .eq("id", event_id);
  if (error) throw new Error(error.message);

  revalidate(event_id);
}
