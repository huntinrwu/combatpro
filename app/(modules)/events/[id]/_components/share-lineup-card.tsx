"use client";

import { Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// The public lineup page's QR code, with ways to take it elsewhere: copy the
// link, copy the image, or download it for a poster or social post.
export function ShareLineupCard({ slug }: { slug: string }) {
  const lineupPath = `/e/${slug}/lineup`;
  const qrPath = `${lineupPath}/qr`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${lineupPath}`);
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
      toast.success("QR code copied");
    } catch {
      toast.error("Couldn't copy the image here. Use Download instead.");
    }
  }

  return (
    <Card collapsible={false} className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4" />
          Share the lineup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          {/* Served by our own route; a plain img keeps it copyable by right-click too. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrPath}
            alt="QR code for the public lineup page"
            className="h-28 w-28 shrink-0 rounded-md border border-border bg-white"
          />
          <p className="text-xs text-muted-foreground">
            Opens the public page of registered fighters and tentative matchups. Put it on
            posters, flyers or social posts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={copyLink}>
            <Copy className="h-3 w-3" />
            Copy link
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={copyImage}>
            <Copy className="h-3 w-3" />
            Copy QR image
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={
              <a href={qrPath} download={`lineup-qr-${slug}.png`}>
                <Download className="h-3 w-3" />
                Download
              </a>
            }
          />
          <Button
            size="sm"
            variant="ghost"
            render={
              <a href={lineupPath} target="_blank" rel="noopener">
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
