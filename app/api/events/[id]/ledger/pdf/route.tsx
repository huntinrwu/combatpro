import { renderToBuffer } from "@react-pdf/renderer";

import { db } from "@/lib/db/client";
import { FinancialsReportPdf } from "@/lib/pdf/financials-report";
import { purseBreakdown } from "@/lib/db/types";
import type {
  BoutPurse,
  EventRow,
  LedgerEntry,
  Vendor,
} from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = db();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle<EventRow>();
  if (!event) return new Response("Event not found", { status: 404 });

  const [{ data: entries }, { data: bouts }] = await Promise.all([
    supabase
      .from("event_ledger")
      .select("*")
      .eq("event_id", id)
      .order("entry_type", { ascending: true })
      .order("received_at", { ascending: true, nullsFirst: false })
      .order("created_at"),
    supabase.from("bouts").select("id").eq("event_id", id),
  ]);

  const boutIds = ((bouts ?? []) as { id: string }[]).map((b) => b.id);
  const { data: purses } = boutIds.length
    ? await supabase.from("bout_purses").select("*").in("bout_id", boutIds)
    : { data: [] as BoutPurse[] };

  let purseNet = 0;
  for (const p of (purses ?? []) as BoutPurse[]) {
    purseNet += purseBreakdown(p).net;
  }

  const ledgerRows = (entries ?? []) as LedgerEntry[];
  const vendorIds = Array.from(
    new Set(ledgerRows.map((r) => r.vendor_id).filter((x): x is string => Boolean(x))),
  );
  const vendorNameMap = new Map<string, string>();
  if (vendorIds.length) {
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, name")
      .in("id", vendorIds);
    for (const v of ((vendors ?? []) as Pick<Vendor, "id" | "name">[])) {
      vendorNameMap.set(v.id, v.name);
    }
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

  const slug = event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-");
  const filename = `financials-${slug}-${event.event_date}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
