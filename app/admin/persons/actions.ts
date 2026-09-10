"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

function parsePersonNo(input: string | undefined | null): number | null {
  if (!input) return null;
  const n = Number.parseInt(input.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

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

  const { error } = await admin.rpc("merge_persons", {
    p_source: sourceRow.id,
    p_target: targetRow.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/persons");
}
