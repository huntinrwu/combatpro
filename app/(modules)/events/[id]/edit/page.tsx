import { notFound, redirect } from "next/navigation";

import { updateEvent } from "../../actions";
import { EventForm } from "../../_components/event-form";
import { loadEventFormOptions } from "../../_lib/event-form-options";
import { loadEventDetail } from "../_lib/event-detail";
import { requireUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  // Event comes from the per-request cache the [id] layout already populated.
  const [detail, { commissions, bodies, promotions }] = await Promise.all([
    loadEventDetail(id),
    loadEventFormOptions(),
  ]);
  if (!detail) notFound();
  const { event } = detail;
  if (!canEditEvent(event, user)) redirect(`/events/${id}`);

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit event</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.isStaff ? "Staff edit." : "Only the promoter who created this event can edit it."}
        </p>
      </header>

      <EventForm
        action={updateEvent}
        defaults={event}
        submitLabel="Save changes"
        cancelHref={`/events/${id}`}
        commissions={commissions}
        bodies={bodies}
        promotions={promotions}
        hiddenFields={{ id }}
      />
    </>
  );
}
