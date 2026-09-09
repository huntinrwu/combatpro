import { Document, Page, Text, View } from "@react-pdf/renderer";

import { BrandLockup } from "./brand-mark";
import { colors, fmtDate, styles } from "./theme";
import {
  fmtMoney,
  ledgerCategoryLabel,
  num,
  paymentMethodLabel,
  type LedgerEntry,
} from "@/lib/db/types";

export type FinancialsReportProps = {
  event: {
    name: string;
    event_date: string;
    venue: string | null;
    city: string | null;
    state: string | null;
    primary_sport: string;
  };
  promoter: string | null;
  entries: LedgerEntry[];
  vendorNameMap: Map<string, string>;
  purseNet: number;
};

const COL = {
  date: 0.9,
  label: 2.2,
  category: 1.2,
  method: 1,
  vendor: 1.4,
  amount: 1,
};

function totalOf(entries: LedgerEntry[]): number {
  return entries.reduce((s, e) => s + num(e.amount), 0);
}

function LedgerTable({
  entries,
  vendorNameMap,
  isRevenue,
}: {
  entries: LedgerEntry[];
  vendorNameMap: Map<string, string>;
  isRevenue: boolean;
}) {
  const total = totalOf(entries);
  const accent = isRevenue ? colors.emerald : colors.red;

  return (
    <View style={styles.table}>
      <View style={[styles.tRow, styles.tHead]}>
        <Text style={[styles.tCell, { flex: COL.date }]}>Date</Text>
        <Text style={[styles.tCell, { flex: COL.label }]}>Label</Text>
        <Text style={[styles.tCell, { flex: COL.category }]}>Category</Text>
        <Text style={[styles.tCell, { flex: COL.method }]}>Method</Text>
        <Text style={[styles.tCell, { flex: COL.vendor }]}>Vendor</Text>
        <Text style={[styles.tCellLast, { flex: COL.amount, textAlign: "right" }]}>
          Amount
        </Text>
      </View>

      {entries.length === 0 && (
        <View style={styles.tRowLast}>
          <Text
            style={[
              styles.tCellLast,
              { padding: 8, color: colors.grayLight, textAlign: "center" },
            ]}
          >
            No {isRevenue ? "revenue" : "expense"} entries.
          </Text>
        </View>
      )}

      {entries.map((e, i) => {
        const isLast = i === entries.length - 1;
        const rowStyle = isLast ? styles.tRowLast : styles.tRow;
        const vendorName = e.vendor_id ? vendorNameMap.get(e.vendor_id) ?? "" : "";
        return (
          <View key={e.id} style={rowStyle}>
            <Text style={[styles.tCell, { flex: COL.date }]}>
              {e.received_at ? fmtDate(e.received_at) : "—"}
            </Text>
            <View style={[styles.tCell, { flex: COL.label }]}>
              <Text>{e.label}</Text>
              {e.subcategory && (
                <Text style={{ fontSize: 7, color: colors.gray }}>{e.subcategory}</Text>
              )}
            </View>
            <Text style={[styles.tCell, { flex: COL.category }]}>
              {ledgerCategoryLabel(e)}
            </Text>
            <Text style={[styles.tCell, { flex: COL.method }]}>
              {paymentMethodLabel(e.payment_method) ?? "—"}
            </Text>
            <Text style={[styles.tCell, { flex: COL.vendor }]}>{vendorName || "—"}</Text>
            <Text
              style={[
                styles.tCellLast,
                {
                  flex: COL.amount,
                  textAlign: "right",
                  fontFamily: "Helvetica-Bold",
                  color: accent,
                },
              ]}
            >
              {isRevenue ? "" : "−"}
              {fmtMoney(num(e.amount))}
            </Text>
          </View>
        );
      })}

      {entries.length > 0 && (
        <View
          style={[
            styles.tRowLast,
            { backgroundColor: colors.grayBg, borderTopWidth: 1, borderTopColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.tCell,
              {
                flex: COL.date + COL.label + COL.category + COL.method + COL.vendor,
                fontFamily: "Helvetica-Bold",
              },
            ]}
          >
            TOTAL ({entries.length} {entries.length === 1 ? "entry" : "entries"})
          </Text>
          <Text
            style={[
              styles.tCellLast,
              {
                flex: COL.amount,
                textAlign: "right",
                fontFamily: "Helvetica-Bold",
                color: accent,
              },
            ]}
          >
            {isRevenue ? "" : "−"}
            {fmtMoney(total)}
          </Text>
        </View>
      )}
    </View>
  );
}

export function FinancialsReportPdf({
  event,
  promoter,
  entries,
  vendorNameMap,
  purseNet,
}: FinancialsReportProps) {
  const revenue = entries.filter((e) => e.entry_type === "revenue");
  const expenses = entries.filter((e) => e.entry_type === "expense");
  const revTotal = totalOf(revenue);
  const expTotal = totalOf(expenses);
  const net = revTotal - expTotal - purseNet;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.brandBar}>
          <BrandLockup tagline="Event financials report" />
          <Text style={styles.docKind}>
            Financials · {fmtDate(new Date().toISOString())}
          </Text>
        </View>

        <Text style={styles.title}>{event.name}</Text>
        <Text style={styles.subtitle}>
          {fmtDate(event.event_date)}
          {event.venue && ` · ${event.venue}`}
          {(event.city || event.state) &&
            ` · ${[event.city, event.state].filter(Boolean).join(", ")}`}
          {` · ${event.primary_sport}`}
        </Text>

        <View style={styles.grid2}>
          <View style={styles.col}>
            <View style={styles.kv}>
              <Text style={styles.k}>Promoter</Text>
              <Text style={styles.v}>{promoter ?? "—"}</Text>
            </View>
          </View>
          <View style={styles.col}>
            <View style={styles.kv}>
              <Text style={styles.k}>Entries</Text>
              <Text style={styles.v}>
                {revenue.length} revenue · {expenses.length} expense
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Profit &amp; loss</Text>

        <View style={styles.table}>
          <View style={styles.tRow}>
            <Text style={[styles.tCell, { flex: 3 }]}>Revenue</Text>
            <Text
              style={[
                styles.tCellLast,
                { flex: 1, textAlign: "right", color: colors.emerald, fontFamily: "Helvetica-Bold" },
              ]}
            >
              {fmtMoney(revTotal)}
            </Text>
          </View>
          <View style={styles.tRow}>
            <Text style={[styles.tCell, { flex: 3 }]}>Expenses</Text>
            <Text
              style={[
                styles.tCellLast,
                { flex: 1, textAlign: "right", color: colors.red, fontFamily: "Helvetica-Bold" },
              ]}
            >
              −{fmtMoney(expTotal)}
            </Text>
          </View>
          <View style={styles.tRow}>
            <Text style={[styles.tCell, { flex: 3 }]}>Fighter purses (net)</Text>
            <Text
              style={[
                styles.tCellLast,
                { flex: 1, textAlign: "right", color: colors.red, fontFamily: "Helvetica-Bold" },
              ]}
            >
              −{fmtMoney(purseNet)}
            </Text>
          </View>
          <View style={[styles.tRowLast, { backgroundColor: colors.grayBg }]}>
            <Text style={[styles.tCell, { flex: 3, fontFamily: "Helvetica-Bold" }]}>Net</Text>
            <Text
              style={[
                styles.tCellLast,
                {
                  flex: 1,
                  textAlign: "right",
                  fontFamily: "Helvetica-Bold",
                  color: net >= 0 ? colors.emerald : colors.red,
                },
              ]}
            >
              {net >= 0 ? "" : "−"}
              {fmtMoney(Math.abs(net))}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Revenue</Text>
        <LedgerTable entries={revenue} vendorNameMap={vendorNameMap} isRevenue />

        <Text style={styles.sectionTitle} break={expenses.length > 6}>
          Expenses
        </Text>
        <LedgerTable
          entries={expenses}
          vendorNameMap={vendorNameMap}
          isRevenue={false}
        />

        <View style={styles.footer} fixed>
          <Text>{event.name} — Financials report</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
