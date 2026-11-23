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
  const text = (name: string) => (formData.get(name)?.toString() ?? "").replace(/\s+/g, " ").trim();
  const email = text("email").toLowerCase();
  const phone = text("phone") || null;
  const gym_name = text("gym_name");
  const weight_class = text("weight_class");
  const count = (name: string) => {
    const raw = text(name);
    const n = raw === "" ? Number.NaN : Number(raw);
    return Number.isInteger(n) && n >= 0 && n <= 500 ? n : null;
  };
  const gender = text("gender");
  const date_of_birth = text("date_of_birth");
  const wins = count("wins");
  const losses = count("losses");
  const draws = count("draws");

  if (full_name.length < 2) return { status: "error", message: "Please enter your full name." };
  if (full_name.length > 80) return { status: "error", message: "That name is too long." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    return { status: "error", message: "Please enter a valid email address." };
  }
  if (phone && phone.length > 40) {
    return { status: "error", message: "That phone number is too long." };
  }
  if (gym_name.length < 2 || gym_name.length > 80) {
    return { status: "error", message: "Please enter your gym (or \"Independent\")." };
  }
  if (!weight_class || weight_class.length > 60) {
    return { status: "error", message: "Please choose the weight class you want to fight at." };
  }
  if (gender !== "male" && gender !== "female") {
    return { status: "error", message: "Please choose male or female." };
  }
  const born = /^\d{4}-\d{2}-\d{2}$/.test(date_of_birth) ? new Date(date_of_birth) : null;
  if (!born || Number.isNaN(born.getTime()) || born > new Date() || born.getFullYear() < 1920) {
    return { status: "error", message: "Please enter your date of birth." };
  }
  if (wins == null || losses == null || draws == null) {
    return { status: "error", message: "Please enter your record as whole numbers (use 0 if none)." };
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
    .select("full_name, email")
    .eq("event_id", event.id);
  if (readErr) {
    console.error("[register]", readErr.code, readErr.message);
    return { status: "error", message: "Registration isn't available right now." };
  }
  const names = (existing ?? []) as { full_name: string; email: string | null }[];
  // Submitting twice is harmless: tell them they're in rather than add a duplicate.
  // Two different people can share a name, so the email has to match too.
  if (
    names.some(
      (r) => r.full_name.toLowerCase() === full_name.toLowerCase() && (r.email ?? email) === email,
    )
  ) {
    return { status: "done", name: full_name };
  }
  if (names.length >= MAX_PER_EVENT) {
    return { status: "error", message: "Registration for this event is full." };
  }

  const { error } = await supabase
    .from("event_registrations")
    .insert({
      event_id: event.id,
      full_name,
      email,
      phone,
      gym_name,
      weight_class,
      wins,
      losses,
      draws,
      gender,
      date_of_birth,
    });
  if (error) {
    console.error("[register]", error.code, error.message);
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  revalidatePath(`/events/${event.id}/fighters`);
  return { status: "done", name: full_name };
}
