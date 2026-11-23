import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";

import { RegisterForm } from "./_components/register-form";
import { db } from "@/lib/db/client";
import { fmtDateLong } from "@/lib/format-utils";
import { weightClassesForSport } from "@/lib/weight-classes";
import type { EventRow } from "@/lib/db/types";

type RegisterEvent = Pick<
  EventRow,
  | "id"
  | "name"
  | "event_date"
  | "venue"
  | "city"
  | "state"
  | "status"
  | "primary_sport"
  | "registration_open"
>;

async function loadEvent(slug: string) {
  const { data } = await db()
    .from("events")
    .select("id, name, event_date, venue, city, state, status, primary_sport, registration_open")
    .eq("slug", slug)
    .in("status", ["scheduled", "complete"])
    .maybeSingle<RegisterEvent>();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  return { title: event ? `Register — ${event.name}` : "Event not found — CombatPro" };
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) notFound();

  const open = event.status === "scheduled" && event.registration_open !== false;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
        <Link
          href={`/e/${slug}`}
          className="-my-2 inline-flex items-center gap-1 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to event
        </Link>

        <h1 className="mt-6 font-heading text-3xl font-semibold tracking-tight">
          Register to fight
        </h1>
        <p className="mt-2 font-medium">{event.name}</p>
        <div className="mt-1 space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {fmtDateLong(event.event_date)}
          </div>
          {(event.venue || event.city || event.state) && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {[event.venue, event.city, event.state].filter(Boolean).join(", ")}
            </div>
          )}
        </div>

        <div className="mt-8">
          {open ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Fill this in and the organizers will follow up. This is a request to be
                considered, not a confirmed spot on the card.
              </p>
              <RegisterForm
                slug={slug}
                weightClasses={(weightClassesForSport(event.primary_sport) ?? []).map((c) => c.name)}
              />
            </>
          ) : (
            <div className="rounded-lg border border-border p-5 text-sm text-muted-foreground">
              Registration for this event is closed.
            </div>
          )}
        </div>
      </main>
      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        Powered by CombatPro
      </footer>
    </div>
  );
}
