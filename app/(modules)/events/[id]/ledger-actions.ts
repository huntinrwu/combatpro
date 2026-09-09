"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { orNull, toNum } from "@/lib/form-utils";
import { PAYMENT_METHODS, type LedgerEntryType, type PaymentMethod } from "@/lib/db/types";

function requireType(raw: FormDataEntryValue | null): LedgerEntryType {
  if (raw === "revenue" || raw === "expense") return raw;
  throw new Error("entry_type must be 'revenue' or 'expense'");
}

function optionalPaymentMethod(raw: FormDataEntryValue | null): PaymentMethod | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = PAYMENT_METHODS.find((p) => p.value === trimmed);
  if (!match) throw new Error("Unknown payment method: " + trimmed);
  return match.value;
}

function paths(event_id: string): string[] {
  return [`/events/${event_id}`, `/events/${event_id}/financials`, "/payments", "/payments/cashflow"];
}

export async function addLedgerEntry(formData: FormData) {
  const event_id = formData.get("event_id")?.toString();
  if (!event_id) throw new Error("event is required.");

  const entry_type = requireType(formData.get("entry_type"));
  const category = formData.get("category")?.toString().trim();
  const label = formData.get("label")?.toString().trim();
  if (!category || !label) throw new Error("Category and label are required.");

  const payload = {
    event_id,
    entry_type,
    category,
    subcategory: orNull(formData.get("subcategory")),
    label,
    amount: toNum(formData.get("amount")) ?? 0,
    vendor_id: orNull(formData.get("vendor_id")),
    payment_method: optionalPaymentMethod(formData.get("payment_method")),
    received_at: orNull(formData.get("received_at")),
    reference: orNull(formData.get("reference")),
    notes: orNull(formData.get("notes")),
  };

  const { error } = await db().from("event_ledger").insert(payload);
  if (error) throw new Error(error.message);

  for (const p of paths(event_id)) revalidatePath(p);
}

export async function deleteLedgerEntry(formData: FormData) {
  const id = formData.get("id")?.toString();
  const event_id = formData.get("event_id")?.toString();
  if (!id || !event_id) throw new Error("entry id + event are required.");

  const { error } = await db().from("event_ledger").delete().eq("id", id);
  if (error) throw new Error(error.message);

  for (const p of paths(event_id)) revalidatePath(p);
}
