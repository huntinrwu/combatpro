import Link from "next/link";
import { ArrowRight, Landmark, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDateShort as fmtEventDate } from "@/lib/format-utils";
import type { EventRow } from "@/lib/db/types";

export function RegulatorWidget({
  role,
  pendingSbCount,
  pendingPromotionsCount,
  upcomingSanctioned,
}: {
  role: "sanctioning_body" | "commission";
  pendingSbCount: number;
  pendingPromotionsCount: number;
  upcomingSanctioned: EventRow[];
}) {
  const isSb = role === "sanctioning_body";
  const label = isSb ? "Sanctioning body" : "Commission";
  const Icon = isSb ? ShieldCheck : Landmark;
  const modulePath = isSb ? "/sb" : "/registry";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {label} desk
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/registry"
            className="rounded-lg border border-border/70 p-3 text-sm hover:bg-muted/40"
          >
            <div className="text-2xl font-semibold tabular-nums">{pendingSbCount}</div>
            <div className="text-xs text-muted-foreground">Pending SB registrations</div>
          </Link>
          <Link
            href="/promotions"
            className="rounded-lg border border-border/70 p-3 text-sm hover:bg-muted/40"
          >
            <div className="text-2xl font-semibold tabular-nums">{pendingPromotionsCount}</div>
            <div className="text-xs text-muted-foreground">Pending promotions</div>
          </Link>
        </div>
        {upcomingSanctioned.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Upcoming sanctioned events
            </div>
            <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
              {upcomingSanctioned.map((e) => {
                const href = e.slug ? `/e/${e.slug}` : `/events/${e.id}`;
                return (
                  <li key={e.id} className="p-3 text-sm hover:bg-muted/40">
                    <Link href={href} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtEventDate(e.event_date)}
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <Link
          href={modulePath}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Open {label.toLowerCase()} module →
        </Link>
      </CardContent>
    </Card>
  );
}
