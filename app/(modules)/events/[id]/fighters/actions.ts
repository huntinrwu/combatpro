"use server";

import { revalidatePath } from "next/cache";

import { db, dbErr } from "@/lib/db/client";
import { syncFighterWeightClass } from "@/lib/db/fighter-weight-class";
import { requireUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";
import { idOrNull, orNull, toNum } from "@/lib/form-utils";
import { defaultCompetingAs, parseMatchmaking, type MatchmakingSettings } from "@/lib/matchmaking";
import { weightClassFor } from "@/lib/weight-classes";
import {
  EVENT_FIGHTER_STATUSES,
  SPORTS,
  type BoutClass,
  type EventFighterStatus,
  type EventRow,
  type Fighter,
} from "@/lib/db/types";

type EditableEvent = Pick<EventRow, "created_by" | "primary_sport" | "event_type">;

// Staff, or the promoter who created the event.
async function requireEventEditor(eventId: string) {
  const user = await requireUser();
  const { data: event } = await db()
    .from("events")
    .select("created_by, primary_sport, event_type")
    .eq("id", eventId)
    .maybeSingle<EditableEvent>();
  if (!event) throw new Error("Event not found.");
  if (!canEditEvent(event, user)) throw new Error("Not authorized to edit this event.");
  return { user, event };
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

// The event type settles pro vs amateur when it can; otherwise go by whether
// the fighter has ever fought pro. Always overridable per roster entry.
function competingAsFor(
  event: EditableEvent,
  fighter: Parameters<typeof defaultCompetingAs>[0],
): BoutClass {
  if (event.event_type === "pro_card") return "pro";
  if (event.event_type === "amateur_card" || event.event_type === "smoker") return "amateur";
  return defaultCompetingAs(fighter);
}

function done(eventId: string) {
  revalidatePath(`/events/${eventId}/fighters`);
  revalidatePath(`/events/${eventId}/matchmaking`);
}

// Add one or more registry fighters to the event roster. Fighters already on
// the roster are left as they are. Weight class is left blank on purpose: it
// is set for this event, not copied from the last one.
export async function addEventFighters(formData: FormData) {
  const event_id = orNull(formData.get("event_id"));
  if (!event_id) throw new Error("Missing event.");
  const { user, event } = await requireEventEditor(event_id);

  const fighterIds = [
    ...new Set(formData.getAll("fighter_id").map((v) => v.toString()).filter(Boolean)),
  ];
  if (fighterIds.length === 0) throw new Error("Pick at least one fighter.");
  const status = parseStatus(formData.get("status") ?? "confirmed");

  const supabase = db();
  const { data: fighters } = await supabase
    .from("fighters")
    .select("id, pro_wins, pro_losses, pro_draws, am_wins, am_losses, am_draws")
    .in("id", fighterIds);

  const rows = (
    (fighters ?? []) as Pick<
      Fighter,
      "id" | "pro_wins" | "pro_losses" | "pro_draws" | "am_wins" | "am_losses" | "am_draws"
    >[]
  ).map((f) => ({
    event_id,
    fighter_id: f.id,
    status,
    competing_as: competingAsFor(event, f),
    added_by: user.id,
  }));
  if (rows.length === 0) throw new Error("Those fighters no longer exist.");

  const { error } = await supabase
    .from("event_fighters")
    .upsert(rows, { onConflict: "event_id,fighter_id", ignoreDuplicates: true });
  if (error) dbErr(error);
  done(event_id);
}

// Create a bare-bones fighter in the registry and put them on this event in
// one step. The rest of the profile is filled in from the fighter page.
export async function createAndAddFighter(formData: FormData) {
  const event_id = orNull(formData.get("event_id"));
  if (!event_id) throw new Error("Missing event.");
  const { user, event } = await requireEventEditor(event_id);

  const full_name = orNull(formData.get("full_name"));
  const primary_sport = SPORTS.find((s) => s === formData.get("primary_sport"));
  if (!full_name || !primary_sport) throw new Error("Name and sport are required.");

  const target_weight_lbs = parseTargetWeight(formData.get("target_weight_lbs"));
  const weight_class =
    orNull(formData.get("weight_class")) ??
    (target_weight_lbs != null ? weightClassFor(event.primary_sport, target_weight_lbs) : null);

  const supabase = db();
  const { data: fighter, error } = await supabase
    .from("fighters")
    .insert({ full_name, primary_sport, weight_class, gym_id: idOrNull(formData.get("gym_id")) })
    .select("id")
    .single<{ id: string }>();
  if (error) dbErr(error);

  const { error: rosterErr } = await supabase.from("event_fighters").insert({
    event_id,
    fighter_id: fighter!.id,
    status: "confirmed",
    target_weight_lbs,
    weight_class,
    competing_as: event.event_type === "pro_card" ? "pro" : "amateur",
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
  const { event } = await requireEventEditor(event_id);

  const target_weight_lbs = parseTargetWeight(formData.get("target_weight_lbs"));
  // A class picked by hand wins; otherwise it follows the target weight.
  const weight_class =
    orNull(formData.get("weight_class")) ??
    (target_weight_lbs != null ? weightClassFor(event.primary_sport, target_weight_lbs) : null);
  const competing_as = formData.get("competing_as") === "pro" ? "pro" : "amateur";

  const { data, error } = await db()
    .from("event_fighters")
    .update({
      status: parseStatus(formData.get("status")),
      target_weight_lbs,
      weight_class,
      competing_as,
      notes: orNull(formData.get("notes")),
    })
    .eq("id", entry_id)
    .eq("event_id", event_id)
    .select("fighter_id")
    .maybeSingle<{ fighter_id: string }>();
  if (error) dbErr(error);

  if (data) {
    await syncFighterWeightClass(data.fighter_id);
    revalidatePath(`/fighters/${data.fighter_id}`);
  }
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

  await syncFighterWeightClass(entry.fighter_id);
  done(event_id);
}

// Per-event matchmaking rules.
export async function saveMatchmakingSettings(formData: FormData) {
  const event_id = orNull(formData.get("event_id"));
  if (!event_id) throw new Error("Missing event.");
  await requireEventEditor(event_id);

  const maxWeightGapLbs = toNum(formData.get("maxWeightGapLbs"));
  const maxFightGap = toNum(formData.get("maxFightGap"));
  if (maxWeightGapLbs == null || maxWeightGapLbs < 0 || maxWeightGapLbs > 100) {
    throw new Error("Weight gap must be between 0 and 100 lbs.");
  }
  if (maxFightGap == null || maxFightGap < 0 || maxFightGap > 200) {
    throw new Error("Experience gap must be between 0 and 200 fights.");
  }

  const settings: MatchmakingSettings = parseMatchmaking({
    maxWeightGapLbs,
    maxFightGap: Math.round(maxFightGap),
    allowProAm: formData.get("allowProAm") === "on",
    allowSameGym: formData.get("allowSameGym") === "on",
  });

  const { error } = await db().from("events").update({ matchmaking: settings }).eq("id", event_id);
  if (error) dbErr(error);
  revalidatePath(`/events/${event_id}/matchmaking`);
}
