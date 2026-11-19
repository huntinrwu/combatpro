import { db } from "./client";

// A fighter's profile weight class is not typed in: it is whatever class they
// are entered at on their most recent event (upcoming events count, withdrawn
// entries don't). Call after any roster change that could affect it.
export async function syncFighterWeightClass(fighterId: string): Promise<void> {
  const supabase = db();
  const { data, error } = await supabase
    .from("event_fighters")
    .select("weight_class, status, event:events(event_date)")
    .eq("fighter_id", fighterId)
    .not("weight_class", "is", null)
    .neq("status", "withdrawn");
  if (error) {
    console.error("[syncFighterWeightClass]", error.code, error.message);
    return;
  }

  const rows = (data ?? []) as unknown as {
    weight_class: string;
    event: { event_date: string } | null;
  }[];
  const latest = rows
    .filter((r) => r.event)
    .sort((a, b) => b.event!.event_date.localeCompare(a.event!.event_date))[0];
  // No event history yet: leave whatever is on the profile alone.
  if (!latest) return;

  await supabase.from("fighters").update({ weight_class: latest.weight_class }).eq("id", fighterId);
}
