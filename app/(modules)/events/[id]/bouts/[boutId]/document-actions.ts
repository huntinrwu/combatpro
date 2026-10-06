"use server";

import { revalidatePath } from "next/cache";

import { db, dbErr } from "@/lib/db/client";
import { orNull } from "@/lib/form-utils";
import { requireStaff } from "@/lib/auth/session";
import type { BoutDocumentKind } from "@/lib/db/types";

function requireKind(raw: FormDataEntryValue | null): BoutDocumentKind {
  if (raw === "bout_agreement" || raw === "fight_report") return raw;
  throw new Error("document kind must be bout_agreement or fight_report");
}

export async function markDocumentFiled(formData: FormData) {
  await requireStaff();
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const kind = requireKind(formData.get("kind"));
  const filed_with = orNull(formData.get("filed_with"));
  const filed_by = orNull(formData.get("filed_by"));
  const reference = orNull(formData.get("reference"));
  const notes = orNull(formData.get("notes"));

  if (!bout_id || !event_id) throw new Error("bout is required.");

  // One row per (bout, kind) — unique constraint makes this a single upsert.
  // Re-filing bumps filed_at.
  const { error } = await db()
    .from("bout_documents")
    .upsert(
      {
        bout_id,
        kind,
        filed_at: new Date().toISOString(),
        filed_with,
        filed_by,
        reference,
        notes,
      },
      { onConflict: "bout_id,kind" },
    );
  if (error) dbErr(error);

  revalidatePath(`/events/${event_id}/bouts/${bout_id}`);
  revalidatePath(`/events/${event_id}`);
}

export async function unmarkDocumentFiled(formData: FormData) {
  await requireStaff();
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const kind = requireKind(formData.get("kind"));

  if (!bout_id || !event_id) throw new Error("bout is required.");

  const { error } = await db()
    .from("bout_documents")
    .delete()
    .eq("bout_id", bout_id)
    .eq("kind", kind);
  if (error) dbErr(error);

  revalidatePath(`/events/${event_id}/bouts/${bout_id}`);
  revalidatePath(`/events/${event_id}`);
}
