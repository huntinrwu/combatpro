export const EVENT_FILES_BUCKET = "event-files";

// Server actions accept up to 15 MB per request (next.config.ts); one file is
// sent per request, so this stays comfortably under that.
export const EVENT_FILE_MAX_BYTES = 12 * 1024 * 1024;

export const EVENT_FILE_CATEGORIES = ["poster", "photo", "document", "other"] as const;
export type EventFileCategory = (typeof EVENT_FILE_CATEGORIES)[number];

export const EVENT_FILE_CATEGORY_LABELS: Record<EventFileCategory, string> = {
  poster: "Event poster",
  photo: "Photo",
  document: "Document",
  other: "Other",
};

// Posters and photos are for everyone who can open the event; documents and
// "other" (contracts, permits, insurance) are for the people running it.
export const PUBLIC_EVENT_FILE_CATEGORIES: readonly EventFileCategory[] = ["poster", "photo"];

// Extension → content type we store and serve. The type comes from this map,
// never from the browser. SVG and HTML are left out on purpose: they can
// carry scripts.
export const EVENT_FILE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
};

export const EVENT_FILE_ACCEPT = Object.keys(EVENT_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

export function eventFileExt(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ext in EVENT_FILE_TYPES ? ext : null;
}

export function isImageType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

export function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export type EventFile = {
  id: string;
  event_id: string;
  category: EventFileCategory;
  filename: string;
  storage_path: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
};
