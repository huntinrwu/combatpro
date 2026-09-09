import Link from "next/link";
import { Radio, SkipForward, Tv, Zap } from "lucide-react";

import { advanceToNextBout, clearCurrentBout, setCurrentBout } from "../../../../actions";
import { Button } from "@/components/ui/button";
import type { Bout } from "@/lib/db/types";

type JudgeSeat = { id: string; official_id: string; full_name: string };

export function BoutActionBar({
  bout,
  eventId,
  isLive,
  isDone,
  judges,
}: {
  bout: Bout;
  eventId: string;
  isLive: boolean;
  isDone: boolean;
  judges: JudgeSeat[];
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <Button
        render={
          <Link href={`/scoring/${bout.id}/display`}>
            <Tv className="h-4 w-4" />
            Open cage-side display
          </Link>
        }
      />
      {isLive ? (
        <>
          <form action={advanceToNextBout} className="contents">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="current_bout_id" value={bout.id} />
            <Button type="submit" variant="outline">
              <SkipForward className="h-4 w-4" />
              End &amp; advance to next
            </Button>
          </form>
          <form action={clearCurrentBout} className="contents">
            <input type="hidden" name="event_id" value={eventId} />
            <Button type="submit" variant="ghost" size="sm">
              Clear live
            </Button>
          </form>
        </>
      ) : (
        !isDone && (
          <form action={setCurrentBout} className="contents">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="bout_id" value={bout.id} />
            <Button type="submit" variant="outline">
              <Zap className="h-4 w-4" />
              Mark as live
            </Button>
          </form>
        )
      )}
      {judges.length > 0 ? (
        judges.map((j, idx) => (
          <Button
            key={j.id}
            variant="outline"
            render={
              <Link href={`/scoring/${bout.id}?judge=${j.official_id}`}>
                <Radio className="h-4 w-4" />
                Judge {idx + 1}: {j.full_name}
              </Link>
            }
          />
        ))
      ) : (
        <p className="text-xs text-muted-foreground">
          No judges on the event roster.{" "}
          <Link
            href={`/events/${eventId}/officials`}
            className="underline hover:text-foreground"
          >
            Add judges on the Officials tab
          </Link>
          .
        </p>
      )}
    </div>
  );
}
