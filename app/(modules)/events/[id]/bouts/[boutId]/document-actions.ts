"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { orNull } from "@/lib/form-utils";
import type { BoutDocumentKind } from "@/lib/db/types";

function requireKind(raw: FormDataEntryValue | null): BoutDocumentKind {
  if (raw === "bout_agreement" || raw === "fight_report") return raw;
  throw new Error("document kind must be bout_agreement or fight_report");
}

export async function markDocumentFiled(formData: FormData) {
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const kind = requireKind(formData.get("kind"));
  const filed_with = orNull(formData.get("filed_with"));
  const filed_by = orNull(formData.get("filed_by"));
  const reference = orNull(formData.get("reference"));
  const notes = orNull(formData.get("notes"));

  if (!bout_id || !event_id) throw new Error("bout is required.");

  const supabase = db();
  const { data: existing } = await supabase
    .from("bout_documents")
    .select("id")
    .eq("bout_id", bout_id)
    .eq("kind", kind)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("bout_documents")
      .update({
        filed_at: new Date().toISOString(),
        filed_with,
        filed_by,
        reference,
        notes,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("bout_documents").insert({
      bout_id,
      kind,
      filed_with,
      filed_by,
      reference,
      notes,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/events/${event_id}/bouts/${bout_id}`);
  revalidatePath(`/events/${event_id}`);
}

export async function unmarkDocumentFiled(formData: FormData) {
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const kind = requireKind(formData.get("kind"));

  if (!bout_id || !event_id) throw new Error("bout is required.");

  const { error } = await db()
    .from("bout_documents")
    .delete()
    .eq("bout_id", bout_id)
    .eq("kind", kind);
  if (error) throw new Error(error.message);

  revalidatePath(`/events/${event_id}/bouts/${bout_id}`);
  revalidatePath(`/events/${event_id}`);
}
