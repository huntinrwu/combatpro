"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/server";
import { dbErr } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/session";
import { parsePersonNo } from "@/lib/format-utils";

export async function mergePersonsByNumber(fd: FormData) {
  await requireAdmin();
  const src = parsePersonNo(fd.get("source_no")?.toString());
  const tgt = parsePersonNo(fd.get("target_no")?.toString());
  if (src == null || tgt == null) {
    throw new Error("Both CP-numbers are required.");
  }
  if (src === tgt) {
    throw new Error("Source and target must be different persons.");
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("persons")
    .select("id, person_no")
    .in("person_no", [src, tgt]);
  const rows = (data ?? []) as { id: string; person_no: number }[];
  const sourceRow = rows.find((r) => r.person_no === src);
  const targetRow = rows.find((r) => r.person_no === tgt);
  if (!sourceRow) throw new Error(`Source CP-${src} not found.`);
  if (!targetRow) throw new Error(`Target CP-${tgt} not found.`);

  // The database merge predates coaches, so move those rows first.
  const { error: coachErr } = await admin
    .from("coaches")
    .update({ person_id: targetRow.id })
    .eq("person_id", sourceRow.id);
  if (coachErr) dbErr(coachErr);

  const { error } = await admin.rpc("merge_persons", {
    p_source: sourceRow.id,
    p_target: targetRow.id,
  });
  if (error) dbErr(error);

  revalidatePath("/admin/persons");
}
