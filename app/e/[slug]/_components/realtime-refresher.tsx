"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// Subscribes to bout + event changes for this event and calls router.refresh()
// on any DB change so the server re-renders with the latest state. Also shows
// a small connection indicator so fans know the page is auto-updating.
export function RealtimeRefresher({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`public-event:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bouts",
          filter: `event_id=eq.${eventId}`,
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        () => router.refresh(),
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setStatus("offline");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, router]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest">
      <span className="relative inline-flex h-1.5 w-1.5">
        {status === "live" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
        )}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
            status === "live"
              ? "bg-emerald-400"
              : status === "connecting"
                ? "bg-amber-400"
                : "bg-white/40"
          }`}
        />
      </span>
      {status === "live" && "Live updates"}
      {status === "connecting" && "Connecting…"}
      {status === "offline" && "Offline"}
    </span>
  );
}
