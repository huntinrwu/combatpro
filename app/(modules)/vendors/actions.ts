"use server";

import { revalidatePath } from "next/cache";

import { db, dbErr } from "@/lib/db/client";
import { orNull } from "@/lib/form-utils";
import { requireStaff } from "@/lib/auth/session";

function paths(): string[] {
  return ["/vendors", "/payments", "/payments/cashflow"];
}

export async function addVendor(formData: FormData) {
  await requireStaff();
  const name = formData.get("name")?.toString().trim();
  if (!name) throw new Error("Vendor name is required.");

  const payload = {
    name,
    default_category: orNull(formData.get("default_category")),
    contact_name: orNull(formData.get("contact_name")),
    contact_email: orNull(formData.get("contact_email")),
    contact_phone: orNull(formData.get("contact_phone")),
    website: orNull(formData.get("website")),
    address: orNull(formData.get("address")),
    notes: orNull(formData.get("notes")),
  };

  const { error } = await db().from("vendors").insert(payload);
  if (error) dbErr(error);

  for (const p of paths()) revalidatePath(p);
}

export async function updateVendor(formData: FormData) {
  await requireStaff();
  const id = formData.get("id")?.toString();
  const name = formData.get("name")?.toString().trim();
  if (!id) throw new Error("Vendor id is required.");
  if (!name) throw new Error("Vendor name is required.");

  const payload = {
    name,
    default_category: orNull(formData.get("default_category")),
    contact_name: orNull(formData.get("contact_name")),
    contact_email: orNull(formData.get("contact_email")),
    contact_phone: orNull(formData.get("contact_phone")),
    website: orNull(formData.get("website")),
    address: orNull(formData.get("address")),
    notes: orNull(formData.get("notes")),
  };

  const { error } = await db().from("vendors").update(payload).eq("id", id);
  if (error) dbErr(error);

  for (const p of paths()) revalidatePath(p);
}

export async function deleteVendor(formData: FormData) {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Vendor id is required.");

  const { error } = await db().from("vendors").delete().eq("id", id);
  if (error) dbErr(error);

  for (const p of paths()) revalidatePath(p);
}
