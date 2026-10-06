"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db, dbErr } from "@/lib/db/client";
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
// `customLabel` is the custom item's label (null for built-ins), returned so
// callers building ledger labels don't have to look the row up again.
async function requireItemForEvent(
  raw: FormDataEntryValue | null,
  event_id: string,
): Promise<{ key: SponsorItemKey; customLabel: string | null }> {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) throw new Error("Sponsorable item is required.");
  if (isBuiltInSponsorItem(v)) return { key: v, customLabel: null };
  const { data } = await db()
    .from("event_sponsorable_items")
    .select("label")
    .eq("event_id", event_id)
    .eq("key", v)
    .maybeSingle<{ label: string }>();
  if (!data) throw new Error("Unknown sponsorable item for this event.");
  return { key: v, customLabel: data.label };
}

function sponsorPayload(formData: FormData, name: string) {
  return {
    name,
    website: str(formData.get("website")),
    logo_url: str(formData.get("logo_url")),
    contact_name: str(formData.get("contact_name")),
    contact_email: str(formData.get("contact_email")),
    contact_phone: str(formData.get("contact_phone")),
    notes: str(formData.get("notes")),
  };
}

export async function createSponsor(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) throw new Error("Sponsor name is required.");

  const { error } = await db().from("sponsors").insert(sponsorPayload(formData, name));
  if (error) dbErr(error);

  revalidatePath("/sponsors");
  redirect("/sponsors");
}

export async function updateSponsor(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Sponsor id required.");
  const name = str(formData.get("name"));
  if (!name) throw new Error("Sponsor name is required.");

  const { error } = await db()
    .from("sponsors")
    .update(sponsorPayload(formData, name))
    .eq("id", id);
  if (error) dbErr(error);

  revalidatePath("/sponsors");
}

export async function deleteSponsor(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Sponsor id required.");

  const { error } = await db().from("sponsors").delete().eq("id", id);
  if (error) dbErr(error);

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

function itemLabelForLedger(
  item: { key: SponsorItemKey; customLabel: string | null },
  slot_label: string | null,
): string {
  if (isBuiltInSponsorItem(item.key)) {
    return item.key === "custom"
      ? slot_label ?? "custom"
      : sponsorableItemLabel(item.key);
  }
  return item.customLabel ?? item.key;
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
  const [item, name] = await Promise.all([
    requireItemForEvent(formData.get("item_type"), event_id),
    sponsorName(sponsor_id),
  ]);
  const item_type = item.key;
  const slot_label = str(formData.get("slot_label"));
  if (item_type === "custom" && !slot_label) {
    throw new Error("Custom item needs a label.");
  }
  const contract_value = toNum(formData.get("contract_value")) ?? 0;
  const paid_raw = str(formData.get("paid_at"));
  const paid_at = paid_raw ? new Date(paid_raw).toISOString() : null;
  const notes = str(formData.get("notes"));

  const supabase = db();
  const itemLabel = itemLabelForLedger(item, slot_label);

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
    dbErr(error);
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
  const supabase = db();
  const [item, name, { data: existing }] = await Promise.all([
    requireItemForEvent(formData.get("item_type"), event_id),
    sponsorName(sponsor_id),
    supabase
      .from("event_sponsors")
      .select("ledger_entry_id")
      .eq("id", id)
      .maybeSingle<{ ledger_entry_id: string | null }>(),
  ]);
  const item_type = item.key;
  const slot_label = str(formData.get("slot_label"));
  if (item_type === "custom" && !slot_label) {
    throw new Error("Custom item needs a label.");
  }
  const contract_value = toNum(formData.get("contract_value")) ?? 0;
  const paid_raw = str(formData.get("paid_at"));
  const paid_at = paid_raw ? new Date(paid_raw).toISOString() : null;
  const notes = str(formData.get("notes"));

  if (!existing) throw new Error("Slot not found.");

  const label = ledgerLabelFor(name, tier, itemLabelForLedger(item, slot_label));

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
  if (error) dbErr(error);

  slotRevalidate(event_id);
}

export async function removeEventSponsor(formData: FormData) {
  const id = str(formData.get("id"));
  const event_id = str(formData.get("event_id"));
  if (!id || !event_id) throw new Error("slot id + event required.");

  const supabase = db();
  // Delete and read back the linked ledger row id in one round-trip.
  const { data: existing, error } = await supabase
    .from("event_sponsors")
    .delete()
    .eq("id", id)
    .select("ledger_entry_id")
    .maybeSingle<{ ledger_entry_id: string | null }>();
  if (error) dbErr(error);

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
    dbErr(error);
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

  // unique (event_id, key): the upsert only writes label/hint, so `hidden`
  // and sort_order on an existing row are left untouched.
  const { error } = await db()
    .from("event_sponsorable_items")
    .upsert({ event_id, key, label, hint }, { onConflict: "event_id,key" });
  if (error) dbErr(error);

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
  if (error) dbErr(error);

  revalidatePath(`/events/${event_id}/sponsors`);
}

export async function setEventSponsorTarget(formData: FormData) {
  const event_id = str(formData.get("event_id"));
  if (!event_id) throw new Error("event required.");
  const { key: item_type } = await requireItemForEvent(formData.get("item_type"), event_id);
  const raw =toNum(formData.get("target_value"));
  const target_value = raw != null && raw >= 0 ? raw : 0;

  const supabase = db();
  if (target_value === 0) {
    const { error } = await supabase
      .from("event_sponsor_targets")
      .delete()
      .eq("event_id", event_id)
      .eq("item_type", item_type);
    if (error) dbErr(error);
  } else {
    const { error } = await supabase
      .from("event_sponsor_targets")
      .upsert(
        { event_id, item_type, target_value },
        { onConflict: "event_id,item_type" },
      );
    if (error) dbErr(error);
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
  if (error) dbErr(error);

  if (existing.ledger_entry_id) {
    await supabase
      .from("event_ledger")
      .update({ received_at: nextPaidAt })
      .eq("id", existing.ledger_entry_id);
  }

  slotRevalidate(event_id);
}
