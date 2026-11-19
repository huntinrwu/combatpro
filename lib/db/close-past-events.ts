import { db } from "./client";

// Today's calendar date in US Eastern time, as YYYY-MM-DD. Event dates are
// plain dates, so "past" means the day after the event, Eastern.
function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

// Mark every scheduled event whose date has passed as complete. Drafts and
// canceled events are left alone. Safe to call as often as needed: once an
// event is complete it no longer matches. Returns how many were closed.
export async function closePastEvents(): Promise<number> {
  const { data, error } = await db()
    .from("events")
    .update({ status: "complete" })
    .eq("status", "scheduled")
    .lt("event_date", todayEastern())
    .select("id");
  if (error) {
    console.error("[closePastEvents]", error.code, error.message);
    return 0;
  }
  return data?.length ?? 0;
}
