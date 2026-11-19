import { db } from "@/lib/db/client";
import { EVENT_FILES_BUCKET } from "@/lib/event-files";

// Public, stable URL for an event poster. The bucket itself stays private;
// this serves only files tagged "poster" on events the public page shows
// (scheduled or complete), so drafts and documents are never reachable here.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; fileId: string }> },
) {
  const { slug, fileId } = await params;
  const supabase = db();

  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .in("status", ["scheduled", "complete"])
    .maybeSingle<{ id: string }>();
  if (!event) return new Response("Not found", { status: 404 });

  const { data: file } = await supabase
    .from("event_files")
    .select("storage_path, content_type")
    .eq("id", fileId)
    .eq("event_id", event.id)
    .eq("category", "poster")
    .maybeSingle<{ storage_path: string; content_type: string }>();
  if (!file || !file.content_type.startsWith("image/")) {
    return new Response("Not found", { status: 404 });
  }

  const { data: blob, error } = await supabase.storage
    .from(EVENT_FILES_BUCKET)
    .download(file.storage_path);
  if (error || !blob) return new Response("Not found", { status: 404 });

  return new Response(blob, {
    headers: {
      "Content-Type": file.content_type,
      // A poster's id never points at different bytes, so it can be cached.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
