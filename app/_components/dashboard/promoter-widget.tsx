import Link from "next/link";
import { ArrowRight, Megaphone, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT_STATUS_VARIANT as STATUS_VARIANT } from "@/lib/ui-config";
import { fmtDateShort as fmtEventDate } from "@/lib/format-utils";
import type { EventRow } from "@/lib/db/types";

export function PromoterWidget({
  events,
  totalOwned,
}: {
  events: EventRow[];
  totalOwned: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-4 w-4" />
          Your events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {totalOwned === 0
              ? "You haven't created any events yet."
              : `${totalOwned} event${totalOwned === 1 ? "" : "s"} you've created.`}
          </span>
          <Button size="sm" render={<Link href="/events/new"><Plus className="h-3.5 w-3.5" />New event</Link>} />
        </div>
        {events.length > 0 && (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
            {events.map((e) => {
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
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
