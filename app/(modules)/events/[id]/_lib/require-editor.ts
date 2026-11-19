import { db } from "@/lib/db/client";
import { requireUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";
import type { EventRow } from "@/lib/db/types";

export type EditableEvent = Pick<EventRow, "created_by" | "primary_sport" | "event_type">;

// Gate for event-scoped server actions: staff, or the promoter who created
// the event. Lives outside the "use server" files so it is not itself exposed
// as an action.
export async function requireEventEditor(eventId: string) {
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
