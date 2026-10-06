import { db } from "@/lib/db/client";
import type { Commission, Promotion, SanctioningBody } from "@/lib/db/types";

// Reference-data dropdowns shared by the new + edit event forms.
export type EventFormOptions = {
  commissions: Pick<Commission, "id" | "abbreviation" | "name" | "state">[];
  bodies: Pick<SanctioningBody, "id" | "abbreviation" | "name">[];
  promotions: Pick<Promotion, "id" | "name" | "abbreviation">[];
};

export async function loadEventFormOptions(): Promise<EventFormOptions> {
  const supabase = db();
  const [{ data: commissions }, { data: bodies }, { data: promotions }] = await Promise.all([
    supabase.from("commissions").select("id, abbreviation, name, state").order("state"),
    supabase
      .from("sanctioning_bodies")
      .select("id, abbreviation, name")
      .eq("status", "approved")
      .order("abbreviation"),
    supabase
      .from("promotions")
      .select("id, name, abbreviation")
      .eq("status", "approved")
      .order("name"),
  ]);

  return {
    commissions: (commissions ?? []) as EventFormOptions["commissions"],
    bodies: (bodies ?? []) as EventFormOptions["bodies"],
    promotions: (promotions ?? []) as EventFormOptions["promotions"],
  };
}
