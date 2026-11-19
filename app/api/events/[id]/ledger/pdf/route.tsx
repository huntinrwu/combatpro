import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import { FinancialsReportPdf } from "@/lib/pdf/financials-report";
import { purseBreakdown } from "@/lib/db/types";
import type { BoutPurse, EventRow } from "@/lib/db/types";
import { loadLedger } from "@/app/api/_lib/ledger";
import { pdfResponse } from "@/app/api/_lib/pdf";
import { fileSlug } from "@/app/api/_lib/slug";

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

  return pdfResponse(
    <FinancialsReportPdf
      event={event}
      promoter={event.promoter}
      entries={ledgerRows}
      vendorNameMap={vendorNameMap}
      purseNet={purseNet}
    />,
    `financials-${fileSlug(event.name)}-${event.event_date}.pdf`,
  );
}
