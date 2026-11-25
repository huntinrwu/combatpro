"use client";

import { useSyncExternalStore } from "react";
import { CalendarPlus } from "lucide-react";

// A web page can't ask a device which calendar it uses, so this goes by the
// device: iPhones, iPads and Macs get the calendar file, which opens Apple
// Calendar; everything else gets Google Calendar, the usual one on Android,
// Windows and Chromebooks. The other option is always one tap away.
const isAppleDevice = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
const subscribe = () => () => {};

export function AddToCalendar({ googleUrl, icsUrl }: { googleUrl: string; icsUrl: string }) {
  // False while rendering on the server, then the real answer in the browser.
  const apple = useSyncExternalStore(subscribe, isAppleDevice, () => false);

  const google = { href: googleUrl, label: "Google Calendar", external: true };
  const file = { href: icsUrl, label: "Apple Calendar or Outlook", external: false };
  const [main, other] = apple ? [file, google] : [google, file];

  return (
    <div className="pt-2">
      <a
        href={main.href}
        {...(main.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        Add to calendar
      </a>
      <div className="mt-1.5 text-xs text-muted-foreground">
        Or use{" "}
        <a
          href={other.href}
          {...(other.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="underline hover:text-foreground"
        >
          {other.label}
        </a>
      </div>
    </div>
  );
}
