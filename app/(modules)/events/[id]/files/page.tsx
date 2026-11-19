import { notFound } from "next/navigation";
import { Download, FileText, ImageIcon, Trash2, Upload } from "lucide-react";

import { deleteEventFile } from "./actions";
import { FileUploader } from "./_components/file-uploader";
import { loadEventDetail } from "../_lib/event-detail";
import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";
import { fmtDateShort } from "@/lib/format-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToastedForm } from "@/components/forms/toasted-form";
import {
  EVENT_FILES_BUCKET,
  EVENT_FILE_CATEGORY_LABELS,
  PUBLIC_EVENT_FILE_CATEGORIES,
  fmtFileSize,
  isImageType,
  type EventFile,
} from "@/lib/event-files";

type FileWithUrl = EventFile & { url: string | null };

export default async function EventFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = db();
  const [detail, session, filesRes] = await Promise.all([
    loadEventDetail(id),
    getSessionUser(),
    supabase
      .from("event_files")
      .select("id, event_id, category, filename, storage_path, content_type, size_bytes, uploaded_by, created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!detail) notFound();
  const { event } = detail;
  const canEdit = session ? canEditEvent(event, session) : false;

  if (filesRes.error) {
    console.error("[event_files]", filesRes.error.code, filesRes.error.message);
    return (
      <Card collapsible={false}>
        <CardContent className="text-sm text-muted-foreground">
          Event files aren&apos;t available yet. The database migration{" "}
          <code>0043_event_files.sql</code> needs to be applied.
        </CardContent>
      </Card>
    );
  }

  // Documents are for the people running the event; posters and photos are
  // for anyone who can open it.
  const visible = ((filesRes.data ?? []) as EventFile[]).filter(
    (f) => canEdit || PUBLIC_EVENT_FILE_CATEGORIES.includes(f.category),
  );

  // The bucket is private: every link is a signed URL that expires.
  let files: FileWithUrl[] = [];
  if (visible.length > 0 && session) {
    const { data: signed } = await supabase.storage
      .from(EVENT_FILES_BUCKET)
      .createSignedUrls(
        visible.map((f) => f.storage_path),
        60 * 60,
      );
    files = visible.map((f, i) => ({ ...f, url: signed?.[i]?.signedUrl ?? null }));
  }

  const images = files.filter((f) => isImageType(f.content_type));
  const others = files.filter((f) => !isImageType(f.content_type));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card collapsible={false}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4" />
              Posters and photos ({images.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {images.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No posters or photos yet.{canEdit ? " Upload them from the panel on the right." : ""}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((f) => (
                  <li key={f.id} className="overflow-hidden rounded-lg border border-border/70">
                    <a href={f.url ?? undefined} target="_blank" rel="noopener" title="Open full size">
                      {f.url ? (
                        // Signed URLs change on every load, so next/image caching doesn't apply.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.url}
                          alt={f.filename}
                          loading="lazy"
                          className="aspect-[3/4] w-full bg-muted object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[3/4] items-center justify-center bg-muted text-xs text-muted-foreground">
                          Preview unavailable
                        </div>
                      )}
                    </a>
                    <div className="flex items-start gap-2 p-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium" title={f.filename}>
                          {f.filename}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {EVENT_FILE_CATEGORY_LABELS[f.category]} · {fmtFileSize(f.size_bytes)}
                        </div>
                      </div>
                      {canEdit && <DeleteButton eventId={event.id} file={f} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {(canEdit || others.length > 0) && (
          <Card collapsible={false}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Other files ({others.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {others.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No documents yet. Contracts, permits, insurance certificates and the like go here.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border/70">
                  {others.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium" title={f.filename}>
                          {f.filename}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {fmtFileSize(f.size_bytes)} · added {fmtDateShort(f.created_at.slice(0, 10))}
                        </div>
                      </div>
                      <Badge variant="outline">{EVENT_FILE_CATEGORY_LABELS[f.category]}</Badge>
                      {f.url && (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener"
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`Open ${f.filename}`}
                          title="Open"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {canEdit && <DeleteButton eventId={event.id} file={f} />}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {canEdit && (
        <Card collapsible={false} className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" />
              Upload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploader eventId={event.id} />
            <p className="mt-3 text-xs text-muted-foreground">
              Posters and photos can be seen by anyone signed in who can open this event.
              Documents and other files are only visible to staff and the event&apos;s promoter.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DeleteButton({ eventId, file }: { eventId: string; file: EventFile }) {
  return (
    <ToastedForm action={deleteEventFile} successMessage="File deleted">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="file_id" value={file.id} />
      <button
        type="submit"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
        aria-label={`Delete ${file.filename}`}
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </ToastedForm>
  );
}
