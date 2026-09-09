import type { ControlRoomBout, ControlRoomJudge } from "../page";

import { CardComplete } from "./control-room/card-complete";
import { LiveBout } from "./control-room/live-bout";
import { NoLiveBout } from "./control-room/no-live-bout";

export function ControlRoom({
  eventId,
  currentBout,
  nextBout,
  judges,
  boutsRemaining,
}: {
  eventId: string;
  currentBout: ControlRoomBout | null;
  nextBout: ControlRoomBout | null;
  judges: ControlRoomJudge[];
  boutsRemaining: number;
}) {
  if (!currentBout && boutsRemaining === 0) {
    return <CardComplete eventId={eventId} />;
  }

  if (!currentBout) {
    return <NoLiveBout eventId={eventId} nextBout={nextBout} />;
  }

  return (
    <LiveBout
      key={currentBout.id}
      eventId={eventId}
      bout={currentBout}
      nextBout={nextBout}
      judges={judges}
    />
  );
}
