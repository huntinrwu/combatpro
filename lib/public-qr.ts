import QRCode from "qrcode";

import { db } from "@/lib/db/client";

// Sizes offered for a public page's QR code, in pixels per side.
export const QR_SIZES = { s: 256, m: 512, l: 1024, xl: 2048 } as const;
export type QrSize = keyof typeof QR_SIZES;

// PNG of a QR code that opens one of an event's public pages (`page` is the
// path after /e/<slug>/, or "" for the event page itself). Public, like the pages it points at, so promoters
// can paste or link the image anywhere. `?size=s|m|l|xl` picks the size.
export async function publicQrResponse(request: Request, slug: string, page: string) {
  const { data: event } = await db()
    .from("events")
    .select("id")
    .eq("slug", slug)
    .in("status", ["scheduled", "complete"])
    .maybeSingle<{ id: string }>();
  if (!event) return new Response("Not found", { status: 404 });

  const asked = new URL(request.url).searchParams.get("size") ?? "l";
  const size: QrSize = asked in QR_SIZES ? (asked as QrSize) : "l";

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  const png = await QRCode.toBuffer(`${origin}/e/${slug}${page ? `/${page}` : ""}`, {
    type: "png",
    width: QR_SIZES[size],
    // Four modules of white on every side, the margin scanners expect.
    margin: 4,
    errorCorrectionLevel: "Q",
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${page || "event"}-qr-${slug}-${size}.png"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
