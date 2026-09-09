import { Trophy } from "lucide-react";

export function CardComplete({ eventId }: { eventId: string }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[1600px] flex-col items-center justify-center px-6 text-center">
      <Trophy className="h-12 w-12 text-emerald-400" />
      <h1 className="mt-4 font-heading text-4xl font-semibold">Card complete</h1>
      <p className="mt-2 text-sm text-white/60">
        Every bout has a declared result. Finalize the event to lock in records
        and generate fight reports.
      </p>
      <a
        href={`/events/${eventId}/finalize`}
        className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
      >
        Go to Finalize
      </a>
    </div>
  );
}
