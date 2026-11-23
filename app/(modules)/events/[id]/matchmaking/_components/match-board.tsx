"use client";

import dynamic from "next/dynamic";

// The board restores its arrangement from this browser's storage, so it is
// rendered in the browser only.
export const MatchBoard = dynamic(() => import("./match-board-inner"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading fighters…</p>,
});
