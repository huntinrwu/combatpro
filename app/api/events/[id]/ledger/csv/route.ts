import { db } from "@/lib/db/client";
import {
  ledgerCategoryLabel,
  num,
  paymentMethodLabel,
  type EventRow,
  type LedgerEntry,
  type Vendor,
} from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Escapes a value for RFC 4180 CSV: wrap in quotes if it contains
// ", , \r, \n — and double any embedded quotes.
function csvCell(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = db();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, event_date")
    .eq("id", id)
    .maybeSingle<Pick<EventRow, "id" | "name" | "event_date">>();
  if (!event) return new Response("Event not found", { status: 404 });

  const { data: entries } = await supabase
    .from("event_ledger")
    .select("*")
    .eq("event_id", id)
    .order("entry_type", { ascending: true })
    .order("received_at", { ascending: true, nullsFirst: false })
    .order("created_at");
  const rows = (entries ?? []) as LedgerEntry[];

  const vendorIds = Array.from(
    new Set(rows.map((r) => r.vendor_id).filter((x): x is string => Boolean(x))),
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

  const header = [
    "Type",
    "Category",
    "Subcategory",
    "Label",
    "Amount",
    "Signed amount",
    "Payment method",
    "Vendor",
    "Date",
    "Reference",
    "Notes",
  ];

  const lines: string[] = [header.map(csvCell).join(",")];
  for (const e of rows) {
    const amount = num(e.amount);
    const signed = e.entry_type === "expense" ? -amount : amount;
    lines.push(
      [
        e.entry_type,
        ledgerCategoryLabel(e),
        e.subcategory ?? "",
        e.label,
        amount.toFixed(2),
        signed.toFixed(2),
        paymentMethodLabel(e.payment_method) ?? "",
        e.vendor_id ? vendorNameMap.get(e.vendor_id) ?? "" : "",
        e.received_at ?? "",
        e.reference ?? "",
        e.notes ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const slug = event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-");
  const filename = `ledger-${slug}-${event.event_date}.csv`;

  return new Response(lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
