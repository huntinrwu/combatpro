"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";

export type RegisterResult =
  | { status: "idle" }
  | { status: "done"; name: string }
  | { status: "error"; message: string };

// Sign-ups per event before the form stops accepting more. A backstop
// against someone flooding the public form, far above any real card.
const MAX_PER_EVENT = 500;

// Public and unauthenticated on purpose. It can only add a pending sign-up to
// an event that is scheduled and open; staff decide what happens next.
export async function registerForEvent(
  _prev: RegisterResult,
  formData: FormData,
): Promise<RegisterResult> {
  // Honeypot: real people never see or fill this field.
  if (formData.get("website")?.toString()) return { status: "done", name: "" };

  const slug = formData.get("slug")?.toString() ?? "";
  const full_name = (formData.get("full_name")?.toString() ?? "").replace(/\s+/g, " ").trim();
  const contact = (formData.get("contact")?.toString() ?? "").trim() || null;

  if (full_name.length < 2) return { status: "error", message: "Please enter your full name." };
  if (full_name.length > 80) return { status: "error", message: "That name is too long." };
  if (contact && contact.length > 120) {
    return { status: "error", message: "That contact detail is too long." };
  }

  const supabase = db();
  const { data: event } = await supabase
    .from("events")
    .select("id, registration_open")
    .eq("slug", slug)
    .eq("status", "scheduled")
    .maybeSingle<{ id: string; registration_open: boolean }>();
  if (!event || event.registration_open === false) {
    return { status: "error", message: "Registration for this event is closed." };
  }

  const { data: existing, error: readErr } = await supabase
    .from("event_registrations")
    .select("full_name")
    .eq("event_id", event.id);
  if (readErr) {
    console.error("[register]", readErr.code, readErr.message);
    return { status: "error", message: "Registration isn't available right now." };
  }
  const names = (existing ?? []) as { full_name: string }[];
  // Submitting twice is harmless: tell them they're in rather than add a duplicate.
  if (names.some((r) => r.full_name.toLowerCase() === full_name.toLowerCase())) {
    return { status: "done", name: full_name };
  }
  if (names.length >= MAX_PER_EVENT) {
    return { status: "error", message: "Registration for this event is full." };
  }

  const { error } = await supabase
    .from("event_registrations")
    .insert({ event_id: event.id, full_name, contact });
  if (error) {
    console.error("[register]", error.code, error.message);
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  revalidatePath(`/events/${event.id}/fighters`);
  return { status: "done", name: full_name };
}
