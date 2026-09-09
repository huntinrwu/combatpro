"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

async function decide(id: string, status: "approved" | "rejected") {
  const reviewer = await requireAdmin();
  const admin = createAdminClient();
  await admin
    .from("user_role_grants")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer.id,
    })
    .eq("id", id);
  revalidatePath("/admin/access-requests");
}

export async function approveRoleGrant(fd: FormData) {
  const id = fd.get("id")?.toString();
  if (!id) return;
  await decide(id, "approved");
}

export async function rejectRoleGrant(fd: FormData) {
  const id = fd.get("id")?.toString();
  if (!id) return;
  await decide(id, "rejected");
}
