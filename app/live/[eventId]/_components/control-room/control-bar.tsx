import { X } from "lucide-react";

import { clearCurrentBout } from "../../../../(modules)/events/actions";
import { Button } from "@/components/ui/button";
import type { ControlRoomBout } from "../../page";

export function ControlBar({
  eventId,
  bout,
}: {
  eventId: string;
  bout: ControlRoomBout;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-white/60">
      <form action={clearCurrentBout} className="contents">
        <input type="hidden" name="event_id" value={eventId} />
        <Button type="submit" variant="ghost" size="sm" className="text-white/60">
          <X className="h-3.5 w-3.5" />
          Clear live
        </Button>
      </form>
      <a
        href={`/events/${eventId}/bouts/${bout.id}`}
        className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
      >
        Open full bout page
      </a>
    </div>
  );
}
