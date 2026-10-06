import { renderToBuffer } from "@react-pdf/renderer";

import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import { FinancialsReportPdf } from "@/lib/pdf/financials-report";
import { purseBreakdown } from "@/lib/db/types";
import type { BoutPurse, EventRow } from "@/lib/db/types";
import { loadLedger } from "@/app/api/_lib/ledger";
import { fileSlug } from "@/app/api/_lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireStaff();
  const { id } = await params;
  const supabase = db();

  // Purses are joined through bouts so we don't need the bout ids first.
  const [{ data: event }, { rows: ledgerRows, vendorNameMap }, { data: purses }] =
    await Promise.all([
      supabase
        .from("events")
        .select("name, event_date, venue, city, state, primary_sport, promoter")
        .eq("id", id)
        .maybeSingle<
          Pick<
            EventRow,
            "name" | "event_date" | "venue" | "city" | "state" | "primary_sport" | "promoter"
          >
        >(),
      loadLedger(id),
      supabase
        .from("bout_purses")
        .select("*, bouts!inner(event_id)")
        .eq("bouts.event_id", id),
    ]);
  if (!event) return new Response("Event not found", { status: 404 });

  let purseNet = 0;
  for (const p of (purses ?? []) as BoutPurse[]) {
    purseNet += purseBreakdown(p).net;
  }

  const buffer = await renderToBuffer(
    <FinancialsReportPdf
      event={{
        name: event.name,
        event_date: event.event_date,
        venue: event.venue,
        city: event.city,
        state: event.state,
        primary_sport: event.primary_sport,
      }}
      promoter={event.promoter}
      entries={ledgerRows}
      vendorNameMap={vendorNameMap}
      purseNet={purseNet}
    />,
  );

  const filename = `financials-${fileSlug(event.name)}-${event.event_date}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
