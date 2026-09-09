"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { orNull, toNum } from "@/lib/form-utils";
import type { Corner } from "@/lib/db/types";

function requireCorner(raw: FormDataEntryValue | null): Corner {
  if (raw === "red" || raw === "blue") return raw;
  throw new Error("corner must be 'red' or 'blue'");
}

const toNumber = (raw: FormDataEntryValue | null) => toNum(raw) ?? 0;

function pathsFor(event_id: string, bout_id: string) {
  return [
    `/events/${event_id}/bouts/${bout_id}`,
    `/events/${event_id}`,
    `/payments`,
  ];
}

export async function upsertPurse(formData: FormData) {
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const corner = requireCorner(formData.get("corner"));
  if (!bout_id || !event_id) throw new Error("bout is required.");

  const payload = {
    bout_id,
    corner,
    gross_purse: toNumber(formData.get("gross_purse")),
    manager_pct: toNumber(formData.get("manager_pct")),
    sanctioning_fee: toNumber(formData.get("sanctioning_fee")),
    tax_withholding: toNumber(formData.get("tax_withholding")),
    other_deductions: toNumber(formData.get("other_deductions")),
    other_deductions_note: orNull(formData.get("other_deductions_note")),
    notes: orNull(formData.get("notes")),
  };

  const supabase = db();
  const { data: existing } = await supabase
    .from("bout_purses")
    .select("id")
    .eq("bout_id", bout_id)
    .eq("corner", corner)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("bout_purses")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("bout_purses").insert(payload);
    if (error) throw new Error(error.message);
  }

  for (const p of pathsFor(event_id, bout_id)) revalidatePath(p);
}

export async function markPursePaid(formData: FormData) {
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const corner = requireCorner(formData.get("corner"));
  const paid_by = orNull(formData.get("paid_by"));
  const payment_reference = orNull(formData.get("payment_reference"));
  if (!bout_id || !event_id) throw new Error("bout is required.");

  const { error } = await db()
    .from("bout_purses")
    .update({
      paid_at: new Date().toISOString(),
      paid_by,
      payment_reference,
    })
    .eq("bout_id", bout_id)
    .eq("corner", corner);
  if (error) throw new Error(error.message);

  for (const p of pathsFor(event_id, bout_id)) revalidatePath(p);
}

export async function unmarkPursePaid(formData: FormData) {
  const bout_id = formData.get("bout_id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  const corner = requireCorner(formData.get("corner"));
  if (!bout_id || !event_id) throw new Error("bout is required.");

  const { error } = await db()
    .from("bout_purses")
    .update({ paid_at: null, paid_by: null, payment_reference: null })
    .eq("bout_id", bout_id)
    .eq("corner", corner);
  if (error) throw new Error(error.message);

  for (const p of pathsFor(event_id, bout_id)) revalidatePath(p);
}
