"use client";

import { useState } from "react";
import { Copy, Mail, MessageCircle, MessageSquare, Share2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

// Share a public page. On a phone this opens the device's own share sheet
// (Messages, Instagram, WhatsApp, whatever is installed). On a computer it
// opens a short list: copy the link, or post to the usual places.
export function ShareButton({
  path,
  title,
  text,
  variant = "light",
  className,
}: {
  // Page to share, relative to the site ("/e/<slug>").
  path: string;
  title: string;
  // One line that goes with the link, e.g. the date and place.
  text: string;
  // "dark" for the event page's dark header.
  variant?: "light" | "dark";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const url = () => `${window.location.origin}${path}`;

  async function nativeShare() {
    try {
      await navigator.share({ title, text, url: url() });
    } catch {
      // Closed without sharing: nothing to do.
    }
  }

  function onClick() {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.share === "function") void nativeShare();
    else setOpen((o) => !o);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Copy the address from the browser bar instead.");
    }
    setOpen(false);
  }

  // Built on click, since the full address is only known in the browser.
  function go(build: (u: string, t: string) => string) {
    const message = `${title} — ${text}`;
    window.open(build(encodeURIComponent(url()), encodeURIComponent(message)), "_blank", "noopener");
    setOpen(false);
  }

  const item =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-muted";

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors",
          variant === "dark"
            ? "border-white/30 text-white hover:bg-white/10"
            : "border-border bg-background text-foreground hover:bg-muted",
        )}
      >
        <Share2 className="h-4 w-4" />
        Share
      </button>

      {open && (
        <>
          {/* Click anywhere else to close. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg"
          >
            <button type="button" role="menuitem" className={item} onClick={copy}>
              <Copy className="h-4 w-4 text-muted-foreground" />
              Copy link
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => go((u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`)}
            >
              <Share2 className="h-4 w-4 text-muted-foreground" />
              Facebook
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => go((u, t) => `https://twitter.com/intent/tweet?text=${t}&url=${u}`)}
            >
              <Share2 className="h-4 w-4 text-muted-foreground" />
              X (Twitter)
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => go((u, t) => `https://wa.me/?text=${t}%20${u}`)}
            >
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              WhatsApp
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => go((u, t) => `sms:?&body=${t}%20${u}`)}
            >
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Text message
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() =>
                go((u, t) => `mailto:?subject=${encodeURIComponent(title)}&body=${t}%0A%0A${u}`)
              }
            >
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email
            </button>
          </div>
        </>
      )}
    </div>
  );
}
