import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT_STATUS_VARIANT as STATUS_VARIANT } from "@/lib/ui-config";
import { fmtDateShortWithDay as fmtEventDate } from "@/lib/format-utils";
import type { EventRow } from "@/lib/db/types";

export function UpcomingEventsWidget({ events }: { events: EventRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          Upcoming events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming events on the calendar.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
            {events.map((e) => {
              const loc = [e.city, e.state].filter(Boolean).join(", ");
              const href = e.slug ? `/e/${e.slug}` : `/events/${e.id}`;
              return (
                <li key={e.id} className="p-3 text-sm hover:bg-muted/40">
                  <Link href={href} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.name}</span>
                        <Badge variant={STATUS_VARIANT[e.status] ?? "outline"}>
                          {e.status}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {fmtEventDate(e.event_date)}
                        {loc && (
                          <>
                            {" · "}
                            <MapPin className="mr-0.5 inline h-3 w-3" />
                            {loc}
                          </>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="pt-1">
          <Link
            href="/events"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            All events →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
