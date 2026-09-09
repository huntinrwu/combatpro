import Link from "next/link";
import { Dumbbell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Fighter, Gym } from "@/lib/db/types";

export function GymWidget({
  gym,
  roster,
}: {
  gym: Gym | null;
  roster: Fighter[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Dumbbell className="h-4 w-4" />
          Your gym
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!gym ? (
          <p className="text-sm text-muted-foreground">
            No gym linked to your account.{" "}
            <Link href="/gyms" className="font-medium text-foreground hover:underline">
              Browse gyms →
            </Link>
          </p>
        ) : (
          <>
            <Link
              href={`/gyms/${gym.id}`}
              className="block rounded-lg border border-border/70 p-3 hover:bg-muted/40"
            >
              <div className="font-medium">{gym.name}</div>
              <div className="text-xs text-muted-foreground">
                {[gym.city, gym.state].filter(Boolean).join(", ") || "—"}
              </div>
            </Link>
            {roster.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Roster ({roster.length})
                </div>
                <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
                  {roster.slice(0, 5).map((f) => (
                    <li key={f.id} className="p-2.5 text-sm hover:bg-muted/40">
                      <Link
                        href={`/fighters/${f.id}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="font-medium truncate">{f.full_name}</span>
                        <Badge variant="outline" className="tabular-nums text-[10px]">
                          {f.pro_wins}-{f.pro_losses}-{f.pro_draws}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
