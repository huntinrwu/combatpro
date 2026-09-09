"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { orNull } from "@/lib/form-utils";
import {
  MEDICAL_RECORD_KINDS,
  type MedicalRecordKind,
} from "@/lib/db/types";

const KIND_SET = new Set<MedicalRecordKind>(MEDICAL_RECORD_KINDS.map((k) => k.value));

function requireKind(raw: FormDataEntryValue | null): MedicalRecordKind {
  if (typeof raw === "string" && KIND_SET.has(raw as MedicalRecordKind)) {
    return raw as MedicalRecordKind;
  }
  throw new Error("Invalid medical record kind.");
}

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export async function addMedicalRecord(formData: FormData) {
  const fighter_id = formData.get("fighter_id")?.toString();
  if (!fighter_id) throw new Error("Fighter is required.");

  const kind = requireKind(formData.get("kind"));
  const issued_on = orNull(formData.get("issued_on"));
  if (!issued_on) throw new Error("Issued date is required.");

  let expires_on = orNull(formData.get("expires_on"));
  if (!expires_on) {
    const spec = MEDICAL_RECORD_KINDS.find((k) => k.value === kind);
    if (spec) expires_on = addMonthsISO(issued_on, spec.default_expiry_months);
  }

  const payload = {
    fighter_id,
    kind,
    issued_on,
    expires_on,
    issuing_physician: orNull(formData.get("issuing_physician")),
    issuing_facility: orNull(formData.get("issuing_facility")),
    reference: orNull(formData.get("reference")),
    notes: orNull(formData.get("notes")),
  };

  const { error } = await db().from("fighter_medical_records").insert(payload);
  if (error) throw new Error(error.message);

  revalidatePath(`/fighters/${fighter_id}`);
  revalidatePath("/medical");
}

export async function deleteMedicalRecord(formData: FormData) {
  const id = formData.get("id")?.toString();
  const fighter_id = formData.get("fighter_id")?.toString();
  if (!id || !fighter_id) throw new Error("Record id + fighter are required.");

  const { error } = await db().from("fighter_medical_records").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/fighters/${fighter_id}`);
  revalidatePath("/medical");
}
