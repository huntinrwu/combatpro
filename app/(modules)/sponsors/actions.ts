"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { orNull as str, toNum } from "@/lib/form-utils";
import { requireStaff } from "@/lib/auth/session";
import {
  SPONSOR_TIERS,
  isBuiltInSponsorItem,
  slugifySponsorItemKey,
  sponsorTierLabel,
  sponsorableItemLabel,
  type SponsorItemKey,
  type SponsorTier,
} from "@/lib/db/types";

function requireTier(raw: FormDataEntryValue | null): SponsorTier {
  const v = typeof raw === "string" ? raw : "";
  const match = SPONSOR_TIERS.find((t) => t.value === v);
  if (!match) throw new Error("Invalid sponsor tier.");
  return match.value;
}

// Accepts either a built-in SPONSORABLE_ITEMS key or an event-scoped custom
// item key registered in event_sponsorable_items for the given event.
async function requireItemForEvent(
  raw: FormDataEntryValue | null,
  event_id: string,
): Promise<SponsorItemKey> {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) throw new Error("Sponsorable item is required.");
  if (isBuiltInSponsorItem(v)) return v;
  const { data } = await db()
    .from("event_sponsorable_items")
    .select("key")
    .eq("event_id", event_id)
    .eq("key", v)
    .maybeSingle<{ key: string }>();
  if (!data) throw new Error("Unknown sponsorable item for this event.");
  return v;
}

export async function createSponsor(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) throw new Error("Sponsor name is required.");

  const payload = {
    name,
    website: str(formData.get("website")),
    logo_url: str(formData.get("logo_url")),
    contact_name: str(formData.get("contact_name")),
    contact_email: str(formData.get("contact_email")),
    contact_phone: str(formData.get("contact_phone")),
    notes: str(formData.get("notes")),
  };

  const { error } = await db().from("sponsors").insert(payload);
  if (error) throw new Error(error.message);

  revalidatePath("/sponsors");
  redirect("/sponsors");
}

export async function updateSponsor(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Sponsor id required.");
  const name = str(formData.get("name"));
  if (!name) throw new Error("Sponsor name is required.");

  const payload = {
    name,
    website: str(formData.get("website")),
    logo_url: str(formData.get("logo_url")),
    contact_name: str(formData.get("contact_name")),
    contact_email: str(formData.get("contact_email")),
    contact_phone: str(formData.get("contact_phone")),
    notes: str(formData.get("notes")),
  };

  const { error } = await db().from("sponsors").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/sponsors");
}

export async function deleteSponsor(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Sponsor id required.");

  const { error } = await db().from("sponsors").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/sponsors");
}

// ── Event-sponsor slot actions (also mirror to event_ledger) ───────────────

function slotRevalidate(event_id: string) {
  revalidatePath(`/events/${event_id}`);
  revalidatePath(`/events/${event_id}/sponsors`);
  revalidatePath("/payments");
  revalidatePath("/sponsors");
}

async function sponsorName(sponsor_id: string): Promise<string> {
  const { data } = await db()
    .from("sponsors")
    .select("name")
    .eq("id", sponsor_id)
    .maybeSingle<{ name: string }>();
  return data?.name ?? "Sponsor";
}

async function itemLabelForLedger(
  event_id: string,
  item: SponsorItemKey,
  slot_label: string | null,
): Promise<string> {
  if (isBuiltInSponsorItem(item)) {
    return item === "custom"
      ? slot_label ?? "custom"
      : sponsorableItemLabel(item);
  }
  const { data } = await db()
    .from("event_sponsorable_items")
    .select("label")
    .eq("event_id", event_id)
    .eq("key", item)
    .maybeSingle<{ label: string }>();
  return data?.label ?? item;
}

function ledgerLabelFor(
  name: string,
  tier: SponsorTier,
  itemLabel: string,
): string {
  return `${sponsorTierLabel(tier)} sponsor — ${name} (${itemLabel})`;
}

export async function addEventSponsor(formData: FormData) {
  const event_id = str(formData.get("event_id"));
  const sponsor_id = str(formData.get("sponsor_id"));
  if (!event_id || !sponsor_id) throw new Error("event + sponsor required.");
  const tier = requireTier(formData.get("tier"));
  const item_type = await requireItemForEvent(formData.get("item_type"), event_id);
  const slot_label = str(formData.get("slot_label"));
  if (item_type === "custom" && !slot_label) {
    throw new Error("Custom item needs a label.");
  }
  const contract_value = toNum(formData.get("contract_value")) ?? 0;
  const paid_raw = str(formData.get("paid_at"));
  const paid_at = paid_raw ? new Date(paid_raw).toISOString() : null;
  const notes = str(formData.get("notes"));

  const supabase = db();
  const name = await sponsorName(sponsor_id);
  const itemLabel = await itemLabelForLedger(event_id, item_type, slot_label);

  let ledger_entry_id: string | null = null;
  if (contract_value > 0) {
    const { data: ledgerRow, error: ledgerErr } = await supabase
      .from("event_ledger")
      .insert({
        event_id,
        entry_type: "revenue",
        category: "sponsorship",
        label: ledgerLabelFor(name, tier, itemLabel),
        amount: contract_value,
        received_at: paid_at,
      })
      .select("id")
      .single<{ id: string }>();
    if (ledgerErr) throw new Error(ledgerErr.message);
    ledger_entry_id = ledgerRow?.id ?? null;
  }

  const { error } = await supabase.from("event_sponsors").insert({
    event_id,
    sponsor_id,
    tier,
    item_type,
    slot_label,
    contract_value,
    paid_at,
    ledger_entry_id,
    notes,
  });
  if (error) {
    if (ledger_entry_id) {
      await supabase.from("event_ledger").delete().eq("id", ledger_entry_id);
    }
    throw new Error(error.message);
  }

  slotRevalidate(event_id);
}

export async function updateEventSponsor(formData: FormData) {
  const id = str(formData.get("id"));
  const event_id = str(formData.get("event_id"));
  if (!id || !event_id) throw new Error("slot id + event required.");
  const sponsor_id = str(formData.get("sponsor_id"));
  if (!sponsor_id) throw new Error("Sponsor required.");
  const tier = requireTier(formData.get("tier"));
  const item_type = await requireItemForEvent(formData.get("item_type"), event_id);
  const slot_label = str(formData.get("slot_label"));
  if (item_type === "custom" && !slot_label) {
    throw new Error("Custom item needs a label.");
  }
  const contract_value = toNum(formData.get("contract_value")) ?? 0;
  const paid_raw = str(formData.get("paid_at"));
  const paid_at = paid_raw ? new Date(paid_raw).toISOString() : null;
  const notes = str(formData.get("notes"));

  const supabase = db();
  const { data: existing } = await supabase
    .from("event_sponsors")
    .select("ledger_entry_id")
    .eq("id", id)
    .maybeSingle<{ ledger_entry_id: string | null }>();
  if (!existing) throw new Error("Slot not found.");

  const name = await sponsorName(sponsor_id);
  const itemLabel = await itemLabelForLedger(event_id, item_type, slot_label);
  const label = ledgerLabelFor(name, tier, itemLabel);

  let ledger_entry_id: string | null = existing.ledger_entry_id;
  if (contract_value > 0) {
    if (ledger_entry_id) {
      const { error: ledgerErr } = await supabase
        .from("event_ledger")
        .update({ label, amount: contract_value, received_at: paid_at })
        .eq("id", ledger_entry_id);
      if (ledgerErr) throw new Error(ledgerErr.message);
    } else {
      const { data: ledgerRow, error: ledgerErr } = await supabase
        .from("event_ledger")
        .insert({
          event_id,
          entry_type: "revenue",
          category: "sponsorship",
          label,
          amount: contract_value,
          received_at: paid_at,
        })
        .select("id")
        .single<{ id: string }>();
      if (ledgerErr) throw new Error(ledgerErr.message);
      ledger_entry_id = ledgerRow?.id ?? null;
    }
  } else if (ledger_entry_id) {
    await supabase.from("event_ledger").delete().eq("id", ledger_entry_id);
    ledger_entry_id = null;
  }

  const { error } = await supabase
    .from("event_sponsors")
    .update({
      sponsor_id,
      tier,
      item_type,
      slot_label,
      contract_value,
      paid_at,
      ledger_entry_id,
      notes,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  slotRevalidate(event_id);
}

export async function removeEventSponsor(formData: FormData) {
  const id = str(formData.get("id"));
  const event_id = str(formData.get("event_id"));
  if (!id || !event_id) throw new Error("slot id + event required.");

  const supabase = db();
  const { data: existing } = await supabase
    .from("event_sponsors")
    .select("ledger_entry_id")
    .eq("id", id)
    .maybeSingle<{ ledger_entry_id: string | null }>();

  const { error } = await supabase.from("event_sponsors").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (existing?.ledger_entry_id) {
    await supabase.from("event_ledger").delete().eq("id", existing.ledger_entry_id);
  }

  slotRevalidate(event_id);
}

export async function addEventSponsorableItem(formData: FormData) {
  const event_id = str(formData.get("event_id"));
  if (!event_id) throw new Error("event required.");
  const label = str(formData.get("label"));
  if (!label) throw new Error("Label is required.");
  const hint = str(formData.get("hint"));
  const key = slugifySponsorItemKey(label);
  if (!key) throw new Error("Label must contain letters or numbers.");
  if (isBuiltInSponsorItem(key)) {
    throw new Error(`"${label}" collides with a built-in item — pick a different name.`);
  }

  const { error } = await db()
    .from("event_sponsorable_items")
    .insert({ event_id, key, label, hint });
  if (error) {
    if (error.code === "23505") {
      throw new Error("That item already exists for this event.");
    }
    throw new Error(error.message);
  }

  revalidatePath(`/events/${event_id}/sponsors`);
}

// Edits label/hint for any item — built-in or custom — via (event_id, key)
// upsert. Built-ins that have never been edited get an override row created;
// existing rows are updated in-place. Preserves `hidden` state.
export async function updateEventSponsorableItem(formData: FormData) {
  const event_id = str(formData.get("event_id"));
  const key = str(formData.get("key"));
  if (!event_id || !key) throw new Error("event + key required.");
  const label = str(formData.get("label"));
  if (!label) throw new Error("Label is required.");
  const hint = str(formData.get("hint"));

  const supabase = db();
  const { data: existing } = await supabase
    .from("event_sponsorable_items")
    .select("id")
    .eq("event_id", event_id)
    .eq("key", key)
    .maybeSingle<{ id: string }>();

  if (existing) {
    const { error } = await supabase
      .from("event_sponsorable_items")
      .update({ label, hint })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("event_sponsorable_items")
      .insert({ event_id, key, label, hint });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/events/${event_id}/sponsors`);
}

export async function removeEventSponsorableItem(formData: FormData) {
  const id = str(formData.get("id"));
  const event_id = str(formData.get("event_id"));
  if (!id || !event_id) throw new Error("id + event required.");

  const supabase = db();
  const { data: item } = await supabase
    .from("event_sponsorable_items")
    .select("id, key")
    .eq("id", id)
    .eq("event_id", event_id)
    .maybeSingle<{ id: string; key: string }>();
  if (!item) throw new Error("Item not found.");

  const { count: usedCount } = await supabase
    .from("event_sponsors")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event_id)
    .eq("item_type", item.key);
  if ((usedCount ?? 0) > 0) {
    throw new Error("Remove or reassign sponsors on this item first.");
  }

  await supabase
    .from("event_sponsor_targets")
    .delete()
    .eq("event_id", event_id)
    .eq("item_type", item.key);

  const { error } = await supabase
    .from("event_sponsorable_items")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/events/${event_id}/sponsors`);
}

export async function setEventSponsorTarget(formData: FormData) {
  const event_id = str(formData.get("event_id"));
  if (!event_id) throw new Error("event required.");
  const item_type = await requireItemForEvent(formData.get("item_type"), event_id);
  const raw = toNum(formData.get("target_value"));
  const target_value = raw != null && raw >= 0 ? raw : 0;

  const supabase = db();
  if (target_value === 0) {
    const { error } = await supabase
      .from("event_sponsor_targets")
      .delete()
      .eq("event_id", event_id)
      .eq("item_type", item_type);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("event_sponsor_targets")
      .upsert(
        { event_id, item_type, target_value },
        { onConflict: "event_id,item_type" },
      );
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/events/${event_id}/sponsors`);
}

export async function toggleEventSponsorPaid(formData: FormData) {
  const id = str(formData.get("id"));
  const event_id = str(formData.get("event_id"));
  if (!id || !event_id) throw new Error("slot id + event required.");

  const supabase = db();
  const { data: existing } = await supabase
    .from("event_sponsors")
    .select("paid_at, ledger_entry_id")
    .eq("id", id)
    .maybeSingle<{ paid_at: string | null; ledger_entry_id: string | null }>();
  if (!existing) throw new Error("Slot not found.");

  const nextPaidAt = existing.paid_at ? null : new Date().toISOString();

  const { error } = await supabase
    .from("event_sponsors")
    .update({ paid_at: nextPaidAt })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (existing.ledger_entry_id) {
    await supabase
      .from("event_ledger")
      .update({ received_at: nextPaidAt })
      .eq("id", existing.ledger_entry_id);
  }

  slotRevalidate(event_id);
}
