import { setCurrentBout } from "../../../../(modules)/events/actions";
import type { ControlRoomBout } from "../../page";

export function NoLiveBout({
  eventId,
  nextBout,
}: {
  eventId: string;
  nextBout: ControlRoomBout | null;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[1600px] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-3xl font-semibold">No bout is live.</h1>
      <p className="mt-2 text-sm text-white/60">
        Pick the next bout on deck to begin.
      </p>
      {nextBout && (
        <form action={setCurrentBout} className="mt-6">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="bout_id" value={nextBout.id} />
          <button
            type="submit"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
          >
            Set bout {nextBout.bout_order ?? "?"} live —{" "}
            {nextBout.red?.full_name ?? "TBD"} vs {nextBout.blue?.full_name ?? "TBD"}
          </button>
        </form>
      )}
    </div>
  );
}
