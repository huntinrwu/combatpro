import { Document, Page, Text, View } from "@react-pdf/renderer";

import { BrandLockup } from "./brand-mark";
import { styles, colors, fmtDate } from "./theme";
import {
  SPONSOR_TIERS,
  fmtMoney,
  purseBreakdown,
  sponsorTierLabel,
  type BoutPurse,
  type SponsorTier,
} from "@/lib/db/types";

export type PayoutSponsorLine = {
  name: string;
  tier: SponsorTier;
};

export type PayoutRow = {
  bout_order: number | null;
  corner: "red" | "blue";
  fighter_name: string;
  gym_name: string | null;
  purse: BoutPurse | null;
};

export type PayoutSheetProps = {
  event: {
    name: string;
    event_date: string;
    venue: string | null;
    city: string | null;
    state: string | null;
    primary_sport: string;
  };
  promoter: string | null;
  sanctioningBody: string | null;
  commission: string | null;
  rows: PayoutRow[];
  sponsors?: PayoutSponsorLine[];
};

const COL_FLEX = {
  bout: 0.6,
  corner: 0.5,
  fighter: 1.6,
  gross: 1,
  mgr: 1,
  sanc: 0.9,
  tax: 0.9,
  other: 0.9,
  net: 1,
  paid: 0.7,
};

export function PayoutSheetPdf({
  event,
  promoter,
  sanctioningBody,
  commission,
  rows,
  sponsors = [],
}: PayoutSheetProps) {
  const sponsorsByTier = new Map<SponsorTier, string[]>();
  for (const s of sponsors) {
    const list = sponsorsByTier.get(s.tier) ?? [];
    list.push(s.name);
    sponsorsByTier.set(s.tier, list);
  }
  const orderedTiers = SPONSOR_TIERS
    .map((t) => t.value)
    .filter((t) => sponsorsByTier.has(t));
  const breakdowns = rows.map((r) => purseBreakdown(r.purse));
  const totals = breakdowns.reduce(
    (acc, b, i) => {
      acc.gross += b.gross;
      acc.mgr += b.managerAmount;
      acc.sanc += b.sanctioningFee;
      acc.tax += b.taxWithholding;
      acc.other += b.otherDeductions;
      acc.net += b.net;
      if (rows[i].purse?.paid_at) acc.paid++;
      return acc;
    },
    { gross: 0, mgr: 0, sanc: 0, tax: 0, other: 0, net: 0, paid: 0 },
  );
  const {
    gross: totalGross,
    mgr: totalMgr,
    sanc: totalSanc,
    tax: totalTax,
    other: totalOther,
    net: totalNet,
    paid: paidCount,
  } = totals;

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.brandBar}>
          <BrandLockup tagline="Event payout sheet" />
          <Text style={styles.docKind}>
            Payout Sheet · {fmtDate(new Date().toISOString())}
          </Text>
        </View>

        <Text style={styles.title}>{event.name}</Text>
        <Text style={styles.subtitle}>
          {fmtDate(event.event_date)}
          {event.venue && ` · ${event.venue}`}
          {(event.city || event.state) && ` · ${[event.city, event.state].filter(Boolean).join(", ")}`}
          {` · ${event.primary_sport}`}
        </Text>

        <View style={styles.grid2}>
          <View style={styles.col}>
            <View style={styles.kv}><Text style={styles.k}>Promoter</Text><Text style={styles.v}>{promoter ?? "—"}</Text></View>
            <View style={styles.kv}><Text style={styles.k}>Commission</Text><Text style={styles.v}>{commission ?? "—"}</Text></View>
          </View>
          <View style={styles.col}>
            <View style={styles.kv}><Text style={styles.k}>Sanctioning</Text><Text style={styles.v}>{sanctioningBody ?? "—"}</Text></View>
            <View style={styles.kv}><Text style={styles.k}>Bouts</Text><Text style={styles.v}>{rows.length / 2} ({rows.length} corners) · {paidCount} paid</Text></View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Payout ledger</Text>

        <View style={styles.table}>
          <View style={[styles.tRow, styles.tHead]}>
            <Text style={[styles.tCell, { flex: COL_FLEX.bout }]}>Bout</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.corner }]}>Corner</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.fighter }]}>Fighter</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.gross, textAlign: "right" }]}>Gross</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.mgr, textAlign: "right" }]}>Manager</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.sanc, textAlign: "right" }]}>Sanc. fee</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.tax, textAlign: "right" }]}>Tax</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.other, textAlign: "right" }]}>Other</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.net, textAlign: "right" }]}>Net</Text>
            <Text style={[styles.tCellLast, { flex: COL_FLEX.paid, textAlign: "center" }]}>Paid</Text>
          </View>

          {rows.map((r, i) => {
            const b = breakdowns[i];
            const isLast = i === rows.length - 1;
            const rowStyle = isLast ? styles.tRowLast : styles.tRow;
            return (
              <View key={`${r.bout_order}-${r.corner}`} style={rowStyle}>
                <Text style={[styles.tCell, { flex: COL_FLEX.bout }]}>{r.bout_order ?? "—"}</Text>
                <Text
                  style={[
                    styles.tCell,
                    { flex: COL_FLEX.corner, color: r.corner === "red" ? colors.red : colors.blue, fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  {r.corner === "red" ? "RED" : "BLUE"}
                </Text>
                <View style={[styles.tCell, { flex: COL_FLEX.fighter }]}>
                  <Text>{r.fighter_name}</Text>
                  {r.gym_name && (
                    <Text style={{ fontSize: 7, color: colors.gray }}>{r.gym_name}</Text>
                  )}
                </View>
                <Text style={[styles.tCell, { flex: COL_FLEX.gross, textAlign: "right" }]}>{fmtMoney(b.gross)}</Text>
                <Text style={[styles.tCell, { flex: COL_FLEX.mgr, textAlign: "right" }]}>{fmtMoney(b.managerAmount)}</Text>
                <Text style={[styles.tCell, { flex: COL_FLEX.sanc, textAlign: "right" }]}>{fmtMoney(b.sanctioningFee)}</Text>
                <Text style={[styles.tCell, { flex: COL_FLEX.tax, textAlign: "right" }]}>{fmtMoney(b.taxWithholding)}</Text>
                <Text style={[styles.tCell, { flex: COL_FLEX.other, textAlign: "right" }]}>{fmtMoney(b.otherDeductions)}</Text>
                <Text
                  style={[
                    styles.tCell,
                    { flex: COL_FLEX.net, textAlign: "right", fontFamily: "Helvetica-Bold", color: colors.emerald },
                  ]}
                >
                  {fmtMoney(b.net)}
                </Text>
                <Text
                  style={[
                    styles.tCellLast,
                    { flex: COL_FLEX.paid, textAlign: "center", color: r.purse?.paid_at ? colors.emerald : colors.gray },
                  ]}
                >
                  {r.purse?.paid_at ? "✓" : "—"}
                </Text>
              </View>
            );
          })}

          <View style={[styles.tRowLast, { backgroundColor: colors.grayBg, fontFamily: "Helvetica-Bold" }]}>
            <Text style={[styles.tCell, { flex: COL_FLEX.bout + COL_FLEX.corner + COL_FLEX.fighter }]}>
              TOTALS ({rows.length} corners)
            </Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.gross, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtMoney(totalGross)}</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.mgr, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtMoney(totalMgr)}</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.sanc, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtMoney(totalSanc)}</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.tax, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtMoney(totalTax)}</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.other, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtMoney(totalOther)}</Text>
            <Text style={[styles.tCell, { flex: COL_FLEX.net, textAlign: "right", fontFamily: "Helvetica-Bold", color: colors.emerald }]}>
              {fmtMoney(totalNet)}
            </Text>
            <Text style={[styles.tCellLast, { flex: COL_FLEX.paid, textAlign: "center", fontFamily: "Helvetica-Bold" }]}>
              {paidCount}/{rows.length}
            </Text>
          </View>
        </View>

        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>Net payout to fighters</Text>
          <Text style={styles.calloutValue}>{fmtMoney(totalNet)}</Text>
        </View>

        {orderedTiers.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Presented by</Text>
            {orderedTiers.map((tier) => (
              <View
                key={tier}
                style={{ flexDirection: "row", marginBottom: 3, alignItems: "flex-start" }}
              >
                <Text
                  style={{
                    width: 80,
                    fontSize: 8,
                    fontFamily: "Helvetica-Bold",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: colors.gray,
                    marginTop: 1,
                  }}
                >
                  {sponsorTierLabel(tier)}
                </Text>
                <Text style={{ flex: 1, fontSize: 10 }}>
                  {sponsorsByTier.get(tier)?.join("  ·  ")}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.sigRow}>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLabel}>Promoter — signature / date</Text>
            <Text style={styles.sigName}>{promoter ?? "____________________"}</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLabel}>Accounting — signature / date</Text>
            <Text style={styles.sigName}>____________________</Text>
          </View>
          {sanctioningBody && (
            <View style={styles.sigBlock}>
              <Text style={styles.sigLabel}>{sanctioningBody} — rep signature</Text>
              <Text style={styles.sigName}>____________________</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text>CombatPro · Event payout sheet · confidential</Text>
          <Text>Generated {fmtDate(new Date().toISOString())}</Text>
        </View>
      </Page>
    </Document>
  );
}
