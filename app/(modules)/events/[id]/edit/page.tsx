import { notFound, redirect } from "next/navigation";

import { updateEvent } from "../../actions";
import { EventForm } from "../../_components/event-form";
import { db } from "@/lib/db/client";
import { requireUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";
import type { Commission, EventRow, Promotion, SanctioningBody } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const supabase = db();
  const [{ data: event }, { data: commissions }, { data: bodies }, { data: promotions }] =
    await Promise.all([
      supabase.from("events").select("*").eq("id", id).maybeSingle<EventRow>(),
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
  if (!event) notFound();
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
        commissions={(commissions ?? []) as Pick<Commission, "id" | "abbreviation" | "name" | "state">[]}
        bodies={(bodies ?? []) as Pick<SanctioningBody, "id" | "abbreviation" | "name">[]}
        promotions={(promotions ?? []) as Pick<Promotion, "id" | "name" | "abbreviation">[]}
        hiddenFields={{ id }}
      />
    </>
  );
}
