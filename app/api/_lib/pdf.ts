import { renderToBuffer } from "@react-pdf/renderer";

// Renders a React-PDF document and returns it as an inline, uncached PDF response.
export async function pdfResponse(
  doc: Parameters<typeof renderToBuffer>[0],
  filename: string,
): Promise<Response> {
  const buffer = await renderToBuffer(doc);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
