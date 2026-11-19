import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { db } from "@/lib/db/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT_FILES_BUCKET, type EventFile } from "@/lib/event-files";

// Shown on the event edit page: the current poster(s) at a glance, with the
// way through to the Files tab where they are uploaded and removed.
export async function EventPostersCard({ eventId }: { eventId: string }) {
  const supabase = db();
  const { data, error } = await supabase
    .from("event_files")
    .select("id, filename, storage_path")
    .eq("event_id", eventId)
    .eq("category", "poster")
    .order("created_at", { ascending: false });
  // Table not there yet: say nothing rather than break the edit page.
  if (error) return null;

  const posters = (data ?? []) as Pick<EventFile, "id" | "filename" | "storage_path">[];
  const { data: signed } = posters.length
    ? await supabase.storage
        .from(EVENT_FILES_BUCKET)
        .createSignedUrls(
          posters.map((p) => p.storage_path),
          60 * 60,
        )
    : { data: [] };

  return (
    <Card className="mt-6" collapsible={false}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="h-4 w-4" />
          Event poster{posters.length === 1 ? "" : "s"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {posters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No poster yet. The poster is shown on the public event page.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {posters.map((p, i) => (
              <li key={p.id} className="w-28">
                {signed?.[i]?.signedUrl ? (
                  // Signed URLs change on every load, so next/image caching doesn't apply.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signed[i].signedUrl}
                    alt={p.filename}
                    className="aspect-[3/4] w-full rounded-md border border-border/70 bg-muted object-cover"
                  />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center rounded-md border border-border/70 bg-muted text-[10px] text-muted-foreground">
                    No preview
                  </div>
                )}
                <div className="mt-1 truncate text-[10px] text-muted-foreground" title={p.filename}>
                  {i === 0 && posters.length > 1 ? "Main · " : ""}
                  {p.filename}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/events/${eventId}/files`}>Manage posters and files</Link>}
          />
          <span className="text-xs text-muted-foreground">
            Upload, replace or remove posters, photos and documents on the Files tab.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
