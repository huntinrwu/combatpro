"use client";

import { useState } from "react";
import { Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PAGES = [
  { key: "lineup", label: "Lineup", blurb: "Registered fighters and tentative matchups." },
  { key: "register", label: "Sign-up", blurb: "The fighter registration form." },
] as const;

// Must match QR_SIZES in lib/public-qr.ts.
const SIZES = [
  { key: "s", label: "Small", px: 256 },
  { key: "m", label: "Medium", px: 512 },
  { key: "l", label: "Large", px: 1024 },
  { key: "xl", label: "Extra large", px: 2048 },
] as const;

const chip = "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors";
const chipOn = "border-foreground bg-foreground text-background";
const chipOff = "border-border text-muted-foreground hover:bg-muted hover:text-foreground";

// QR codes for an event's public pages, with ways to take them elsewhere:
// copy the link, copy the image, or download it, at a choice of sizes.
export function ShareLineupCard({
  slug,
  eventId,
  publicRoster,
  publicBouts,
}: {
  slug: string;
  eventId: string;
  publicRoster: boolean;
  publicBouts: boolean;
}) {
  const [page, setPage] = useState<(typeof PAGES)[number]>(PAGES[0]);
  const [size, setSize] = useState<(typeof SIZES)[number]>(SIZES[2]);
  const pagePath = `/e/${slug}/${page.key}`;
  const qrPath = `${pagePath}/qr?size=${size.key}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${pagePath}`);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Open the page and copy its address instead.");
    }
  }

  async function copyImage() {
    try {
      // Passing the promise keeps Safari happy: it needs the write to start
      // inside the click.
      const blob = fetch(qrPath).then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.blob();
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success(`QR code copied (${size.label.toLowerCase()})`);
    } catch {
      toast.error("Couldn't copy the image here. Use Download instead.");
    }
  }

  return (
    <Card collapsible={false} className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4" />
          QR codes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-9 text-xs text-muted-foreground">Page</span>
          {PAGES.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={page.key === p.key}
              onClick={() => setPage(p)}
              className={cn(chip, page.key === p.key ? chipOn : chipOff)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-9 text-xs text-muted-foreground">Size</span>
          {SIZES.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={size.key === s.key}
              onClick={() => setSize(s)}
              className={cn(chip, size.key === s.key ? chipOn : chipOff)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-start gap-3">
          {/* Served by our own route; a plain img keeps it copyable by right-click too. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${pagePath}/qr?size=s`}
            alt={`QR code for the ${page.label.toLowerCase()} page`}
            className="h-28 w-28 shrink-0 rounded-md border border-border bg-white"
          />
          <p className="text-xs text-muted-foreground">
            {page.blurb} {size.label} is about {size.px} px wide. Keep the white border around
            the code and don&apos;t stretch it, or it may not scan.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Public right now: fighter list {publicRoster ? "shown" : "hidden"}, bout list{" "}
          {publicBouts ? "shown" : "hidden"}.{" "}
          <a href={`/events/${eventId}/edit`} className="underline hover:text-foreground">
            Change
          </a>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={copyImage}>
            <Copy className="h-3 w-3" />
            Copy QR image
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={
              <a href={qrPath} download={`${page.key}-qr-${slug}-${size.key}.png`}>
                <Download className="h-3 w-3" />
                Download
              </a>
            }
          />
          <Button type="button" size="sm" variant="outline" onClick={copyLink}>
            <Copy className="h-3 w-3" />
            Copy link
          </Button>
          <Button
            size="sm"
            variant="ghost"
            render={
              <a href={pagePath} target="_blank" rel="noopener">
                <ExternalLink className="h-3 w-3" />
                Open page
              </a>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
