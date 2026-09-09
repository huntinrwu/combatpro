"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";

async function decide(id: string, status: "approved" | "rejected") {
  await requireStaff();
  const admin = createAdminClient();
  await admin.from("gyms").update({ approval_status: status }).eq("id", id);
  revalidatePath("/admin/gyms");
  revalidatePath("/admin/access-requests");
}

export async function approveGym(fd: FormData) {
  const id = fd.get("id")?.toString();
  if (!id) return;
  await decide(id, "approved");
}

export async function rejectGym(fd: FormData) {
  const id = fd.get("id")?.toString();
  if (!id) return;
  await decide(id, "rejected");
}
