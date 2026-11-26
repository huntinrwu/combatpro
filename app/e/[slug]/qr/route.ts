import { publicQrResponse } from "@/lib/public-qr";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return publicQrResponse(request, (await params).slug, "");
}
