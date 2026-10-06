import { db } from "@/lib/db/client";
import type { LedgerEntry } from "@/lib/db/types";

// Shared by the ledger CSV + PDF exports: entries in export order plus a
// vendor id → name map. Vendor names are embedded so it's a single query.
export async function loadLedger(eventId: string) {
  const { data } = await db()
    .from("event_ledger")
    .select("*, vendor:vendors(name)")
    .eq("event_id", eventId)
    .order("entry_type", { ascending: true })
    .order("received_at", { ascending: true, nullsFirst: false })
    .order("created_at");

  const rows = (data ?? []) as unknown as (LedgerEntry & {
    vendor: { name: string } | null;
  })[];
  const vendorNameMap = new Map<string, string>();
  for (const r of rows) {
    if (r.vendor_id && r.vendor) vendorNameMap.set(r.vendor_id, r.vendor.name);
  }
  return { rows, vendorNameMap };
}
