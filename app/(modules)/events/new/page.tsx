import { createEvent } from "../actions";
import { EventForm } from "../_components/event-form";
import { db } from "@/lib/db/client";
import { requireEventCreator } from "@/lib/auth/session";
import type { Commission, Promotion, SanctioningBody } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireEventCreator();
  const supabase = db();
  const [{ data: commissions }, { data: bodies }, { data: promotions }] = await Promise.all([
    supabase.from("commissions").select("id, abbreviation, name, state").order("state"),
    supabase
      .from("sanctioning_bodies")
      .select("id, abbreviation, name, status")
      .eq("status", "approved")
      .order("abbreviation"),
    supabase
      .from("promotions")
      .select("id, name, abbreviation, status")
      .eq("status", "approved")
      .order("name"),
  ]);

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">New event</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bouts get added after the event is created.
        </p>
      </header>

      <EventForm
        action={createEvent}
        submitLabel="Create event"
        cancelHref="/events"
        commissions={(commissions ?? []) as Pick<Commission, "id" | "abbreviation" | "name" | "state">[]}
        bodies={(bodies ?? []) as Pick<SanctioningBody, "id" | "abbreviation" | "name">[]}
        promotions={(promotions ?? []) as Pick<Promotion, "id" | "name" | "abbreviation">[]}
      />
    </>
  );
}
