import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import {
  ledgerCategoryLabel,
  num,
  paymentMethodLabel,
  type EventRow,
} from "@/lib/db/types";
import { loadLedger } from "@/app/api/_lib/ledger";
import { fileSlug } from "@/app/api/_lib/slug";

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
  await requireStaff();
  const { id } = await params;
  const supabase = db();

  const [{ data: event }, { rows, vendorNameMap }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, event_date")
      .eq("id", id)
      .maybeSingle<Pick<EventRow, "id" | "name" | "event_date">>(),
    loadLedger(id),
  ]);
  if (!event) return new Response("Event not found", { status: 404 });

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

  const filename = `ledger-${fileSlug(event.name)}-${event.event_date}.csv`;

  return new Response(lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
