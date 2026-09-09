import Link from "next/link";
import { Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fighterProRecord, initials } from "@/lib/text-utils";
import type { Fighter } from "@/lib/db/types";

export function RecentFightersWidget({ fighters }: { fighters: Fighter[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Recent fighters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {fighters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fighters in the registry yet.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
            {fighters.map((f) => (
              <li key={f.id} className="p-3 text-sm hover:bg-muted/40">
                <Link href={`/fighters/${f.id}`} className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    {f.photo_url && <AvatarImage src={f.photo_url} alt={f.full_name} />}
                    <AvatarFallback className="text-xs">
                      {initials(f.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {f.full_name}
                      {f.nickname && (
                        <span className="ml-1.5 text-xs italic text-muted-foreground">
                          &ldquo;{f.nickname}&rdquo;
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {f.weight_class ?? "no class"} · {f.primary_sport}
                    </div>
                  </div>
                  <Badge variant="outline" className="tabular-nums">
                    {fighterProRecord(f)}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="pt-1">
          <Link
            href="/fighters"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            All fighters →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
