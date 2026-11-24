import { db, dbErr } from "@/lib/db/client";

// The shared person record behind a fighter or official, creating it if the
// record was added before one existed. Used to tie another role (coach,
// owner) to the same human so their pages link to each other.
export async function personIdFor(
  table: "fighters" | "officials",
  recordId: string,
): Promise<string> {
  const supabase = db();
  const { data: row } = await supabase
    .from(table)
    .select("person_id, full_name, contact_email, contact_phone")
    .eq("id", recordId)
    .maybeSingle<{
      person_id: string | null;
      full_name: string;
      contact_email: string | null;
      contact_phone: string | null;
    }>();
  if (!row) throw new Error("That profile no longer exists.");
  if (row.person_id) return row.person_id;

  // Emails are unique across people: reuse the person who already has it.
  let personId: string | null = null;
  if (row.contact_email) {
    const { data: existing } = await supabase
      .from("persons")
      .select("id")
      .ilike("email", row.contact_email.replace(/[%_\\]/g, "\\$&"))
      .is("merged_into_person_id", null)
      .limit(1)
      .maybeSingle<{ id: string }>();
    personId = existing?.id ?? null;
  }
  if (!personId) {
    const { data: created, error } = await supabase
      .from("persons")
      .insert({
        full_name: row.full_name,
        email: row.contact_email,
        phone: row.contact_phone,
      })
      .select("id")
      .single<{ id: string }>();
    if (error) dbErr(error);
    personId = created!.id;
  }

  const { error } = await supabase.from(table).update({ person_id: personId }).eq("id", recordId);
  if (error) dbErr(error);
  return personId;
}
