"use server";

import { revalidatePath } from "next/cache";

import { requireEventEditor } from "../_lib/require-editor";
import { db, dbErr } from "@/lib/db/client";
import { orNull } from "@/lib/form-utils";
import {
  EVENT_FILES_BUCKET,
  EVENT_FILE_CATEGORIES,
  EVENT_FILE_MAX_BYTES,
  EVENT_FILE_TYPES,
  eventFileExt,
  fmtFileSize,
} from "@/lib/event-files";

// One file per call: keeps each request under the server-action size limit
// and lets the uploader report progress file by file.
export async function uploadEventFile(formData: FormData) {
  const event_id = orNull(formData.get("event_id"));
  if (!event_id) throw new Error("Missing event.");
  const { user } = await requireEventEditor(event_id);

  const category = EVENT_FILE_CATEGORIES.find((c) => c === formData.get("category"));
  if (!category) throw new Error("Pick what kind of file this is.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("No file received.");
  if (file.size > EVENT_FILE_MAX_BYTES) {
    throw new Error(
      `${file.name} is ${fmtFileSize(file.size)}; the limit is ${fmtFileSize(EVENT_FILE_MAX_BYTES)}.`,
    );
  }
  const ext = eventFileExt(file.name);
  if (!ext) throw new Error(`${file.name}: that file type isn't allowed.`);
  const content_type = EVENT_FILE_TYPES[ext];
  if ((category === "poster" || category === "photo") && !content_type.startsWith("image/")) {
    throw new Error("Posters and photos must be image files (PNG, JPG, WEBP or GIF).");
  }

  const supabase = db();
  const storage_path = `${event_id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from(EVENT_FILES_BUCKET)
    .upload(storage_path, new Uint8Array(await file.arrayBuffer()), {
      contentType: content_type,
      upsert: false,
    });
  if (uploadErr) {
    console.error("[event-files] upload", uploadErr.message);
    throw new Error("Upload failed. Please try again.");
  }

  const { error } = await supabase.from("event_files").insert({
    event_id,
    category,
    filename: file.name.slice(0, 200),
    storage_path,
    content_type,
    size_bytes: file.size,
    uploaded_by: user.id,
  });
  if (error) {
    // Don't leave an orphaned object behind.
    await supabase.storage.from(EVENT_FILES_BUCKET).remove([storage_path]);
    dbErr(error);
  }

  revalidatePath(`/events/${event_id}/files`);
}

export async function deleteEventFile(formData: FormData) {
  const event_id = orNull(formData.get("event_id"));
  const file_id = orNull(formData.get("file_id"));
  if (!event_id || !file_id) throw new Error("Missing fields.");
  await requireEventEditor(event_id);

  const supabase = db();
  const { data: row, error } = await supabase
    .from("event_files")
    .delete()
    .eq("id", file_id)
    .eq("event_id", event_id)
    .select("storage_path")
    .maybeSingle<{ storage_path: string }>();
  if (error) dbErr(error);
  if (row) await supabase.storage.from(EVENT_FILES_BUCKET).remove([row.storage_path]);

  revalidatePath(`/events/${event_id}/files`);
}
