import Link from "next/link";
import { Dumbbell, Pencil, Swords, TrendingUp } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDateShort as fmtEventDate } from "@/lib/format-utils";
import { initials } from "@/lib/text-utils";
import type { Fighter, Gym } from "@/lib/db/types";

export type FighterNextBout = {
  boutId: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  eventSlug: string | null;
  opponentName: string | null;
  corner: "red" | "blue";
} | null;

export function FighterWidget({
  profile,
  nextBout,
  gym,
}: {
  profile: Fighter | null;
  nextBout: FighterNextBout;
  gym: Pick<Gym, "id" | "name" | "city" | "state"> | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords className="h-4 w-4" />
          Your fighter profile
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto"
            render={
              <Link href="/me" aria-label="Edit fighter profile">
                <Pencil className="h-3 w-3" />
                Manage
              </Link>
            }
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!profile ? (
          <p className="text-sm text-muted-foreground">
            No fighter profile linked to your account.{" "}
            <Link href="/fighters" className="font-medium text-foreground hover:underline">
              Browse fighters →
            </Link>
          </p>
        ) : (
          <>
            <Link
              href={`/fighters/${profile.id}`}
              className="flex items-center gap-3 rounded-lg border border-border/70 p-3 hover:bg-muted/40"
            >
              <Avatar className="h-11 w-11">
                {profile.photo_url && (
                  <AvatarImage src={profile.photo_url} alt={profile.full_name} />
                )}
                <AvatarFallback>{initials(profile.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{profile.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {profile.weight_class ?? "no class"} · {profile.primary_sport}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" /> Pro
                </div>
                <Badge variant="outline" className="tabular-nums">
                  {profile.pro_wins}-{profile.pro_losses}-{profile.pro_draws}
                </Badge>
              </div>
            </Link>
            {gym && (
              <Link
                href={`/gyms/${gym.id}`}
                className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm hover:bg-muted/40"
              >
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Your gym
                  </div>
                  <div className="truncate font-medium">{gym.name}</div>
                  {(gym.city || gym.state) && (
                    <div className="text-xs text-muted-foreground">
                      {[gym.city, gym.state].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>
              </Link>
            )}
            {nextBout ? (
              <div className="rounded-lg border border-border/70 p-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Next bout
                </div>
                <Link
                  href={
                    nextBout.eventSlug
                      ? `/e/${nextBout.eventSlug}`
                      : `/events/${nextBout.eventId}`
                  }
                  className="block hover:underline"
                >
                  <div className="text-sm font-medium">{nextBout.eventName}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtEventDate(nextBout.eventDate)}
                    {nextBout.opponentName && <> · vs {nextBout.opponentName}</>}
                  </div>
                </Link>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No scheduled bouts.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
