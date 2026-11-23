import QRCode from "qrcode";

import { db } from "@/lib/db/client";

// PNG of the QR code that opens this event's public lineup page. Public, like
// the page it points at, so promoters can paste or link the image anywhere.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: event } = await db()
    .from("events")
    .select("id")
    .eq("slug", slug)
    .in("status", ["scheduled", "complete"])
    .maybeSingle<{ id: string }>();
  if (!event) return new Response("Not found", { status: 404 });

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  const png = await QRCode.toBuffer(`${origin}/e/${slug}/lineup`, {
    type: "png",
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="lineup-qr-${slug}.png"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
