import { db, dbErr } from "@/lib/db/client";

// The shared person record behind a fighter, creating it if the fighter was
// added before one existed. Used to tie another role (coach, owner) to the
// same human.
export async function personIdForFighter(fighterId: string): Promise<string> {
  const supabase = db();
  const { data: fighter } = await supabase
    .from("fighters")
    .select("person_id, full_name, contact_email, contact_phone, date_of_birth")
    .eq("id", fighterId)
    .maybeSingle<{
      person_id: string | null;
      full_name: string;
      contact_email: string | null;
      contact_phone: string | null;
      date_of_birth: string | null;
    }>();
  if (!fighter) throw new Error("That fighter no longer exists.");
  if (fighter.person_id) return fighter.person_id;

  // Emails are unique across people: reuse the person who already has it.
  let personId: string | null = null;
  if (fighter.contact_email) {
    const { data: existing } = await supabase
      .from("persons")
      .select("id")
      .ilike("email", fighter.contact_email.replace(/[%_\\]/g, "\\$&"))
      .limit(1)
      .maybeSingle<{ id: string }>();
    personId = existing?.id ?? null;
  }
  if (!personId) {
    const { data: created, error } = await supabase
      .from("persons")
      .insert({
        full_name: fighter.full_name,
        email: fighter.contact_email,
        phone: fighter.contact_phone,
        date_of_birth: fighter.date_of_birth,
      })
      .select("id")
      .single<{ id: string }>();
    if (error) dbErr(error);
    personId = created!.id;
  }

  const { error } = await supabase
    .from("fighters")
    .update({ person_id: personId })
    .eq("id", fighterId);
  if (error) dbErr(error);
  return personId;
}
