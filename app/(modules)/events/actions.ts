"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { orNull, toInt, toNum } from "@/lib/form-utils";
import { requireEventCreator, requireUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";
import { makeEventSlug, type BoutClass, type EventRow, type EventStatus, type ScoringMode } from "@/lib/db/types";
import { weightClassFor } from "@/lib/weight-classes";

export async function createEvent(formData: FormData) {
  const user = await requireEventCreator();
  const name = formData.get("name")?.toString().trim();
  const event_date = formData.get("event_date")?.toString();
  const primary_sport = formData.get("primary_sport")?.toString().trim();

  if (!name || !event_date || !primary_sport) {
    throw new Error("Name, date, and sport are required.");
  }

  const payload = {
    name,
    event_date,
    primary_sport,
    venue: orNull(formData.get("venue")),
    city: orNull(formData.get("city")),
    state: orNull(formData.get("state")),
    country: orNull(formData.get("country")) ?? "US",
    promoter: orNull(formData.get("promoter")),
    promotion_id: (() => {
      const v = orNull(formData.get("promotion_id"));
      return v && v !== "__none__" ? v : null;
    })(),
    commission_id: orNull(formData.get("commission_id")),
    sanctioning_body_id: orNull(formData.get("sanctioning_body_id")),
    status: (formData.get("status")?.toString() as EventStatus) || "draft",
    notes: orNull(formData.get("notes")),
    created_by: user.id,
  };

  const { data, error } = await db()
    .from("events")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Slug depends on the DB-assigned id, so patch it after insert.
  const slug = makeEventSlug(name, event_date, data.id);
  await db().from("events").update({ slug }).eq("id", data.id);

  // Seed the 3 starter sponsorable items — every event begins with Ring,
  // Blue Corner, Red Corner. The promoter adds/removes anything else.
  await db().from("event_sponsorable_items").insert([
    { event_id: data.id, key: "ring", label: "The Ring / Cage", hint: null, sort_order: 0 },
    { event_id: data.id, key: "blue_corner", label: "Blue Corner", hint: null, sort_order: 1 },
    { event_id: data.id, key: "red_corner", label: "Red Corner", hint: null, sort_order: 2 },
  ]);

  revalidatePath("/events");
  redirect(`/events/${data.id}`);
}

export async function updateEvent(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing event id.");

  const { data: existing } = await db()
    .from("events")
    .select("created_by")
    .eq("id", id)
    .maybeSingle<Pick<EventRow, "created_by">>();
  if (!existing) throw new Error("Event not found.");
  if (!canEditEvent(existing, user)) throw new Error("Not authorized to edit this event.");

  const name = formData.get("name")?.toString().trim();
  const event_date = formData.get("event_date")?.toString();
  const primary_sport = formData.get("primary_sport")?.toString().trim();
  if (!name || !event_date || !primary_sport) {
    throw new Error("Name, date, and sport are required.");
  }

  const payload = {
    name,
    event_date,
    primary_sport,
    venue: orNull(formData.get("venue")),
    city: orNull(formData.get("city")),
    state: orNull(formData.get("state")),
    country: orNull(formData.get("country")) ?? "US",
    promoter: orNull(formData.get("promoter")),
    promotion_id: (() => {
      const v = orNull(formData.get("promotion_id"));
      return v && v !== "__none__" ? v : null;
    })(),
    commission_id: orNull(formData.get("commission_id")),
    sanctioning_body_id: orNull(formData.get("sanctioning_body_id")),
    status: (formData.get("status")?.toString() as EventStatus) || "draft",
    notes: orNull(formData.get("notes")),
    slug: makeEventSlug(name, event_date, id),
  };

  const { error } = await db().from("events").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/events/${id}`);
  revalidatePath("/events");
  redirect(`/events/${id}`);
}

export async function createBout(formData: FormData) {
  const event_id = formData.get("event_id")?.toString();
  const sport = formData.get("sport")?.toString().trim();

  if (!event_id || !sport) {
    throw new Error("Event and sport are required.");
  }

  const contracted_weight_lbs = toNum(formData.get("contracted_weight_lbs"));
  const submittedWeightClass = orNull(formData.get("weight_class"));
  const weight_class =
    submittedWeightClass ??
    (contracted_weight_lbs != null ? weightClassFor(sport, contracted_weight_lbs) : null);

  const payload = {
    event_id,
    sport,
    bout_order: toInt(formData.get("bout_order")),
    weight_class,
    contracted_weight_lbs,
    rounds: toInt(formData.get("rounds")),
    round_length_minutes: toNum(formData.get("round_length_minutes")),
    scoring_mode: (orNull(formData.get("scoring_mode")) as ScoringMode | null),
    bout_class:
      (formData.get("bout_class")?.toString() as BoutClass | undefined) ?? "pro",
    red_corner_fighter_id: orNull(formData.get("red_corner_fighter_id")),
    blue_corner_fighter_id: orNull(formData.get("blue_corner_fighter_id")),
    scheduled_start_time: orNull(formData.get("scheduled_start_time")),
    ruleset_id:
      (() => {
        const v = orNull(formData.get("ruleset_id"));
        return v && v !== "__none__" ? v : null;
      })(),
    notes: orNull(formData.get("notes")),
  };

  const { error } = await db().from("bouts").insert(payload);

  if (error) throw new Error(error.message);

  revalidatePath(`/events/${event_id}`);
  redirect(`/events/${event_id}`);
}

export async function setCurrentBout(formData: FormData) {
  const event_id = formData.get("event_id")?.toString();
  const bout_id = formData.get("bout_id")?.toString();
  if (!event_id || !bout_id) throw new Error("event_id and bout_id required.");

  const { error } = await db()
    .from("events")
    .update({ current_bout_id: bout_id })
    .eq("id", event_id);
  if (error) throw new Error(error.message);

  revalidatePath(`/events/${event_id}`);
  revalidatePath(`/events/${event_id}/bouts/${bout_id}`);
  revalidatePath(`/events/${event_id}/run-of-show`);
}

export async function clearCurrentBout(formData: FormData) {
  const event_id = formData.get("event_id")?.toString();
  if (!event_id) throw new Error("event_id required.");

  const { error } = await db()
    .from("events")
    .update({ current_bout_id: null })
    .eq("id", event_id);
  if (error) throw new Error(error.message);

  revalidatePath(`/events/${event_id}`);
  revalidatePath(`/events/${event_id}/run-of-show`);
}

// End the current bout and jump to the next bout on the card that hasn't
// declared a result yet. If no such bout exists, clears the pointer instead.
export async function advanceToNextBout(formData: FormData) {
  const event_id = formData.get("event_id")?.toString();
  const current_bout_id = formData.get("current_bout_id")?.toString();
  if (!event_id) throw new Error("event_id required.");

  const supabase = db();
  const { data: bouts } = await supabase
    .from("bouts")
    .select("id, bout_order, result")
    .eq("event_id", event_id)
    .order("bout_order", { ascending: true, nullsFirst: false });

  const list = (bouts ?? []) as { id: string; bout_order: number | null; result: string | null }[];
  const currentIdx = current_bout_id ? list.findIndex((b) => b.id === current_bout_id) : -1;
  const searchFrom = currentIdx >= 0 ? currentIdx + 1 : 0;
  const next = list.slice(searchFrom).find((b) => b.id !== current_bout_id && !b.result);

  const { error } = await supabase
    .from("events")
    .update({ current_bout_id: next?.id ?? null })
    .eq("id", event_id);
  if (error) throw new Error(error.message);

  revalidatePath(`/events/${event_id}`);
  revalidatePath(`/events/${event_id}/run-of-show`);
  if (current_bout_id) revalidatePath(`/events/${event_id}/bouts/${current_bout_id}`);
  if (next?.id) revalidatePath(`/events/${event_id}/bouts/${next.id}`);
}
