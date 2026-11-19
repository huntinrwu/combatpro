"use server";

import { revalidatePath } from "next/cache";

import { db, dbErr } from "@/lib/db/client";
import { requireUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";
import { idOrNull, orNull, toNum } from "@/lib/form-utils";
import { EVENT_FIGHTER_STATUSES, SPORTS, type EventFighterStatus } from "@/lib/db/types";

// Staff, or the promoter who created the event.
async function requireEventEditor(eventId: string) {
  const user = await requireUser();
  const { data: event } = await db()
    .from("events")
    .select("created_by")
    .eq("id", eventId)
    .maybeSingle<{ created_by: string | null }>();
  if (!event) throw new Error("Event not found.");
  if (!canEditEvent(event, user)) throw new Error("Not authorized to edit this event.");
  return user;
}

function parseStatus(raw: FormDataEntryValue | null): EventFighterStatus {
  const status = EVENT_FIGHTER_STATUSES.find((s) => s === raw);
  if (!status) throw new Error("Invalid status.");
  return status;
}

function parseTargetWeight(raw: FormDataEntryValue | null): number | null {
  const n = toNum(raw);
  if (n == null) return null;
  if (n < 60 || n > 500) throw new Error("Target weight must be between 60 and 500 lbs.");
  return n;
}

function done(eventId: string) {
  revalidatePath(`/events/${eventId}/fighters`);
}

// Add one or more registry fighters to the event roster. Fighters already on
// the roster are left as they are.
export async function addEventFighters(formData: FormData) {
  const event_id = orNull(formData.get("event_id"));
  if (!event_id) throw new Error("Missing event.");
  const user = await requireEventEditor(event_id);

  const fighterIds = [
    ...new Set(formData.getAll("fighter_id").map((v) => v.toString()).filter(Boolean)),
  ];
  if (fighterIds.length === 0) throw new Error("Pick at least one fighter.");
  const status = parseStatus(formData.get("status") ?? "confirmed");

  const { error } = await db()
    .from("event_fighters")
    .upsert(
      fighterIds.map((fighter_id) => ({ event_id, fighter_id, status, added_by: user.id })),
      { onConflict: "event_id,fighter_id", ignoreDuplicates: true },
    );
  if (error) dbErr(error);
  done(event_id);
}

// Create a bare-bones fighter in the registry and put them on this event in
// one step. The rest of the profile is filled in from the fighter page.
export async function createAndAddFighter(formData: FormData) {
  const event_id = orNull(formData.get("event_id"));
  if (!event_id) throw new Error("Missing event.");
  const user = await requireEventEditor(event_id);

  const full_name = orNull(formData.get("full_name"));
  const primary_sport = SPORTS.find((s) => s === formData.get("primary_sport"));
  if (!full_name || !primary_sport) throw new Error("Name and sport are required.");

  const supabase = db();
  const { data: fighter, error } = await supabase
    .from("fighters")
    .insert({
      full_name,
      primary_sport,
      weight_class: orNull(formData.get("weight_class")),
      gym_id: idOrNull(formData.get("gym_id")),
    })
    .select("id")
    .single<{ id: string }>();
  if (error) dbErr(error);

  const { error: rosterErr } = await supabase.from("event_fighters").insert({
    event_id,
    fighter_id: fighter!.id,
    status: "confirmed",
    target_weight_lbs: parseTargetWeight(formData.get("target_weight_lbs")),
    added_by: user.id,
  });
  if (rosterErr) dbErr(rosterErr);

  done(event_id);
  revalidatePath("/fighters");
}

export async function updateEventFighter(formData: FormData) {
  const event_id = orNull(formData.get("event_id"));
  const entry_id = orNull(formData.get("entry_id"));
  if (!event_id || !entry_id) throw new Error("Missing fields.");
  await requireEventEditor(event_id);

  const { error } = await db()
    .from("event_fighters")
    .update({
      status: parseStatus(formData.get("status")),
      target_weight_lbs: parseTargetWeight(formData.get("target_weight_lbs")),
      notes: orNull(formData.get("notes")),
    })
    .eq("id", entry_id)
    .eq("event_id", event_id);
  if (error) dbErr(error);
  done(event_id);
}

// Removing is only allowed while the fighter is not on a bout; otherwise mark
// them withdrawn (or take them off the bout first) so the card stays honest.
export async function removeEventFighter(formData: FormData) {
  const event_id = orNull(formData.get("event_id"));
  const entry_id = orNull(formData.get("entry_id"));
  if (!event_id || !entry_id) throw new Error("Missing fields.");
  await requireEventEditor(event_id);

  const supabase = db();
  const { data: entry } = await supabase
    .from("event_fighters")
    .select("fighter_id")
    .eq("id", entry_id)
    .eq("event_id", event_id)
    .maybeSingle<{ fighter_id: string }>();
  if (!entry) return;

  const { data: onCard } = await supabase
    .from("bouts")
    .select("id")
    .eq("event_id", event_id)
    .or(
      `red_corner_fighter_id.eq.${entry.fighter_id},blue_corner_fighter_id.eq.${entry.fighter_id}`,
    )
    .limit(1);
  if (onCard && onCard.length > 0) {
    throw new Error("This fighter is on a bout. Mark them withdrawn, or change the bout first.");
  }

  const { error } = await supabase
    .from("event_fighters")
    .delete()
    .eq("id", entry_id)
    .eq("event_id", event_id);
  if (error) dbErr(error);
  done(event_id);
}
