import Link from "next/link";
import { CalendarClock, Gavel } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDateShort as fmtEventDate } from "@/lib/format-utils";
import type { Official } from "@/lib/db/types";

export type OfficialUpcoming = {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventSlug: string | null;
  role: string;
};

export function OfficialWidget({
  profile,
  upcoming,
}: {
  profile: Official | null;
  upcoming: OfficialUpcoming[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gavel className="h-4 w-4" />
          Your officiating
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!profile ? (
          <p className="text-sm text-muted-foreground">
            No official profile linked to your account.{" "}
            <Link href="/officials" className="font-medium text-foreground hover:underline">
              Browse officials →
            </Link>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link
                href={`/officials/${profile.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {profile.full_name}
              </Link>
              {profile.roles.map((r) => (
                <Badge key={r} variant="secondary" className="capitalize">
                  {r}
                </Badge>
              ))}
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming bout assignments.
              </p>
            ) : (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  Upcoming assignments
                </div>
                <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
                  {upcoming.map((u, i) => {
                    const href = u.eventSlug ? `/e/${u.eventSlug}` : `/events/${u.eventId}`;
                    return (
                      <li key={`${u.eventId}-${i}`} className="p-3 text-sm hover:bg-muted/40">
                        <Link href={href} className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{u.eventName}</div>
                            <div className="text-xs text-muted-foreground">
                              {fmtEventDate(u.eventDate)}
                            </div>
                          </div>
                          <Badge variant="secondary" className="capitalize">
                            {u.role}
                          </Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
