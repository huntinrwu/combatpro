import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ExternalLink } from "lucide-react";

import { loadEventDetail } from "../_lib/event-detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireModuleAccess } from "@/lib/auth/session";

export default async function EventRegulatoryTabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("events");
  const { id } = await params;
  const detail = await loadEventDetail(id);
  if (!detail) notFound();
  const { event, commission, sanctioningBody: body } = detail;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Regulatory bodies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Commission
            </div>
            {commission ? (
              <div className="mt-1 flex items-center gap-2">
                <span>
                  {commission.abbreviation} — {commission.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({commission.jurisdiction})
                  </span>
                </span>
                {commission.website && (
                  <a
                    href={commission.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="mt-1 text-muted-foreground">
                No commission assigned.{" "}
                <Link href="/registry" className="underline hover:text-foreground">
                  Browse registry
                </Link>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Sanctioning body
            </div>
            {body ? (
              <div className="mt-1 flex items-center gap-2">
                <Link
                  href={`/sb/${body.id}`}
                  className="hover:underline"
                >
                  {body.abbreviation} — {body.name}
                </Link>
                <span className="text-xs text-muted-foreground capitalize">
                  · {body.scope}
                </span>
                {body.website && (
                  <a
                    href={body.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="mt-1 text-muted-foreground">
                No sanctioning body assigned.
              </div>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Promoter
            </div>
            <div className="mt-1">{event.promoter ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Private notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-muted-foreground">Not shown on the public page.</p>
          {event.notes ? (
            <p className="whitespace-pre-wrap text-sm">{event.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No private notes for this event.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
