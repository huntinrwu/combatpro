"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { orNull as str } from "@/lib/form-utils";
import { getSessionUser, requireStaff } from "@/lib/auth/session";
import { extractRulesetFromPdf, type ExtractedRuleset } from "@/lib/ai/parse-ruleset";

const BUCKET = "ruleset-pdfs";
const MAX_PDF_BYTES = 15 * 1024 * 1024;

async function pdfBufferFromForm(fd: FormData, field = "pdf"): Promise<{
  buffer: Buffer;
  size: number;
  filename: string;
}> {
  const file = fd.get(field);
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please choose a PDF file to upload.");
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(`PDF is too large (${(file.size / 1024 / 1024).toFixed(1)}MB, max 15MB).`);
  }
  if (file.type && file.type !== "application/pdf") {
    throw new Error("Only PDF files are accepted.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return { buffer, size: file.size, filename: file.name || "ruleset.pdf" };
}

type ExtractOutcome =
  | { status: "ok"; data: ExtractedRuleset }
  | { status: "disabled" } // no API key configured
  | { status: "error"; error: string };

async function tryExtract(buffer: Buffer, sport: string): Promise<ExtractOutcome> {
  try {
    const data = await extractRulesetFromPdf(buffer, sport);
    if (data === null) return { status: "disabled" };
    return { status: "ok", data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: "error", error: msg };
  }
}

function safeSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function createRulesetFromPdf(formData: FormData) {
  const staff = await requireStaff();

  const name = str(formData.get("name"));
  const sport = str(formData.get("sport"));
  if (!name || !sport) throw new Error("Name and sport are required.");

  const commRaw = str(formData.get("commission_id"));
  const commission_id = commRaw && commRaw !== "__none__" ? commRaw : null;
  const sbRaw = str(formData.get("sanctioning_body_id"));
  const sanctioning_body_id = sbRaw && sbRaw !== "__none__" ? sbRaw : null;

  const { buffer, size, filename } = await pdfBufferFromForm(formData);

  const supabase = db();
  const extraction = await tryExtract(buffer, sport);

  // Create the ruleset row. Parsed fields land only if extraction succeeded.
  const base =
    extraction.status === "ok"
      ? extraction.data
      : ({
          rounds_championship: null,
          rounds_non_championship: null,
          round_length_minutes: null,
          rest_length_seconds: null,
          scoring_mode: null,
          weight_allowance_lbs: null,
          glove_specs: null,
          wraps_spec: null,
          three_knockdown_rule: false,
          standing_eight_count: false,
          open_scoring: false,
          protective_gear: null,
          notes: null,
        } satisfies ExtractedRuleset);

  const { data: inserted, error: insertErr } = await supabase
    .from("rulesets")
    .insert({
      name,
      sport,
      commission_id,
      sanctioning_body_id,
      is_default: false,
      ...base,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertErr || !inserted) throw new Error(insertErr?.message ?? "Failed to create ruleset.");

  const rulesetId = inserted.id;
  const storagePath = `${rulesetId}/${Date.now()}-${safeSlug(filename)}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadErr) {
    await supabase.from("rulesets").delete().eq("id", rulesetId);
    throw new Error(`Storage upload failed: ${uploadErr.message}`);
  }

  await supabase.from("ruleset_pdf_versions").insert({
    ruleset_id: rulesetId,
    storage_path: storagePath,
    original_filename: filename,
    file_size_bytes: size,
    uploaded_by: staff.id,
    extracted_json: extraction.status === "ok" ? extraction.data : null,
    extraction_error: extraction.status === "error" ? extraction.error : null,
    is_current: true,
  });

  revalidatePath("/registry");
  revalidatePath(`/rules/${rulesetId}`);
  redirect(`/rules/${rulesetId}`);
}

export async function uploadNewPdfVersion(formData: FormData) {
  const staff = await requireStaff();
  const rulesetId = str(formData.get("ruleset_id"));
  if (!rulesetId) throw new Error("Missing ruleset id.");

  const { buffer, size, filename } = await pdfBufferFromForm(formData);

  const supabase = db();
  const { data: ruleset } = await supabase
    .from("rulesets")
    .select("id, sport")
    .eq("id", rulesetId)
    .maybeSingle<{ id: string; sport: string }>();
  if (!ruleset) throw new Error("Ruleset not found.");

  const extraction = await tryExtract(buffer, ruleset.sport);

  const storagePath = `${rulesetId}/${Date.now()}-${safeSlug(filename)}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

  // Demote prior versions
  await supabase
    .from("ruleset_pdf_versions")
    .update({ is_current: false })
    .eq("ruleset_id", rulesetId)
    .eq("is_current", true);

  await supabase.from("ruleset_pdf_versions").insert({
    ruleset_id: rulesetId,
    storage_path: storagePath,
    original_filename: filename,
    file_size_bytes: size,
    uploaded_by: staff.id,
    extracted_json: extraction.status === "ok" ? extraction.data : null,
    extraction_error: extraction.status === "error" ? extraction.error : null,
    is_current: true,
  });

  // Mirror parsed fields onto rulesets row (source-of-truth is latest PDF).
  if (extraction.status === "ok") {
    await supabase.from("rulesets").update(extraction.data).eq("id", rulesetId);
  }

  revalidatePath(`/rules/${rulesetId}`);
}

export async function deleteRuleset(formData: FormData) {
  await requireStaff();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing id.");

  const supabase = db();

  // Collect storage paths so we can wipe files too — DB cascade will drop
  // the rows on ruleset delete but leaves orphaned objects in Storage.
  const { data: versions } = await supabase
    .from("ruleset_pdf_versions")
    .select("storage_path")
    .eq("ruleset_id", id);
  const paths = ((versions ?? []) as { storage_path: string }[]).map((v) => v.storage_path);
  if (paths.length) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase.from("rulesets").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/registry");
  revalidatePath("/rules");
  redirect("/registry");
}

export async function assignBoutRuleset(formData: FormData) {
  const bout_id = str(formData.get("bout_id"));
  const event_id = str(formData.get("event_id"));
  if (!bout_id || !event_id) throw new Error("Missing bout_id / event_id.");

  const raw = str(formData.get("ruleset_id"));
  const ruleset_id = raw && raw !== "__none__" ? raw : null;

  const { error } = await db()
    .from("bouts")
    .update({ ruleset_id })
    .eq("id", bout_id);

  if (error) throw new Error(error.message);

  revalidatePath(`/events/${event_id}/bouts/${bout_id}`);
}

// Returns a short-lived signed URL for the given storage path. Server-only —
// caller enforces auth. Used by the detail page to render a download link.
export async function signedRulesetPdfUrl(storagePath: string): Promise<string | null> {
  const u = await getSessionUser();
  if (!u) return null;
  const supabase = db();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 10);
  return data?.signedUrl ?? null;
}
