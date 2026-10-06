import { createEvent } from "../actions";
import { EventForm } from "../_components/event-form";
import { loadEventFormOptions } from "../_lib/event-form-options";
import { requireEventCreator } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireEventCreator();
  const { commissions, bodies, promotions } = await loadEventFormOptions();

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
        commissions={commissions}
        bodies={bodies}
        promotions={promotions}
      />
    </>
  );
}
