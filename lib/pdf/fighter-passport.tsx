import { Document, Page, Text, View } from "@react-pdf/renderer";

import { BrandLockup } from "./brand-mark";
import { colors, fmtDate, styles } from "./theme";
import {
  MEDICAL_RECORD_KINDS,
  recordStatus,
  type ClearanceStatus,
  type Fighter,
  type FighterMedicalRecord,
  type Gym,
  type MedicalRecordKind,
} from "@/lib/db/types";

export type NormalizedResult = "win" | "loss" | "draw" | "no_contest" | null;

export type PassportBoutNormalizedRow = {
  event_name: string;
  event_date: string;
  opponent: string | null;
  normalizedResult: NormalizedResult;
  method: string | null;
  round_finished: number | null;
  time_finished: string | null;
  bout_class: "pro" | "amateur";
};

export type FighterPassportProps = {
  fighter: Fighter;
  gym: Pick<Gym, "id" | "name"> | null;
  medicals: FighterMedicalRecord[];
  recentBouts: PassportBoutNormalizedRow[];
};

function computeAge(dobISO: string | null, asOf: Date = new Date()): number | null {
  if (!dobISO) return null;
  const dob = new Date(`${dobISO}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  let age = asOf.getFullYear() - dob.getFullYear();
  const m = asOf.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < dob.getDate())) age--;
  return age;
}

function statusColor(s: ClearanceStatus): string {
  if (s === "expired") return colors.red;
  if (s === "expiring") return colors.amber;
  if (s === "missing") return colors.gray;
  return colors.emerald;
}

function statusLabel(s: ClearanceStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function medicalKindLabel(k: MedicalRecordKind): string {
  return MEDICAL_RECORD_KINDS.find((x) => x.value === k)?.label ?? k;
}

// The passport is per-fighter, so results are from that fighter's perspective:
// caller resolves whether the fighter was the red or blue corner and normalizes.
function normalizedResultLabel(r: NormalizedResult, boutClass: "pro" | "amateur"): string {
  if (!r) return "Scheduled";
  const tag = boutClass === "pro" ? "P" : "A";
  if (r === "win") return `Win (${tag})`;
  if (r === "loss") return `Loss (${tag})`;
  if (r === "draw") return `Draw (${tag})`;
  return `NC (${tag})`;
}

const MEDICAL_COL = { kind: 2, issued: 1, expires: 1, status: 1 };
const BOUT_COL = { date: 1, event: 2.2, opponent: 2, result: 1, method: 1.4 };

export function FighterPassportPdf({
  fighter,
  gym,
  medicals,
  recentBouts,
}: FighterPassportProps) {
  const age = computeAge(fighter.date_of_birth);

  // Take latest issued per kind; if none for a kind, leave a "Missing" row so
  // the reviewer sees the gap at a glance.
  const latestByKind = new Map<MedicalRecordKind, FighterMedicalRecord>();
  for (const r of medicals) {
    const cur = latestByKind.get(r.kind);
    if (!cur || new Date(r.issued_on) > new Date(cur.issued_on)) {
      latestByKind.set(r.kind, r);
    }
  }
  const medRows = MEDICAL_RECORD_KINDS.map(({ value }) => {
    const rec = latestByKind.get(value) ?? null;
    const st = recordStatus(rec);
    return { kind: value, rec, status: st };
  });

  return (
    <Document title={`Fighter passport — ${fighter.full_name}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.brandBar}>
          <BrandLockup tagline="Fighter passport" />
          <Text style={styles.docKind}>
            Passport · {fmtDate(new Date().toISOString())}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { marginBottom: 2 }]}>{fighter.full_name}</Text>
            {fighter.nickname && (
              <Text style={{ fontSize: 11, color: colors.gray, fontStyle: "italic" }}>
                &quot;{fighter.nickname}&quot;
              </Text>
            )}
            <Text style={{ fontSize: 10, color: colors.gray, marginTop: 4, textTransform: "capitalize" }}>
              {fighter.primary_sport}
              {fighter.weight_class ? ` · ${fighter.weight_class}` : ""}
              {fighter.stance ? ` · ${fighter.stance}` : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 6,
                paddingHorizontal: 10,
                backgroundColor: colors.grayBg,
                alignItems: "flex-end",
              }}
            >
              <Text style={{ fontSize: 8, color: colors.gray, textTransform: "uppercase", letterSpacing: 1 }}>
                Career record
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2 }}>
                Pro {fighter.pro_wins}-{fighter.pro_losses}-{fighter.pro_draws}
              </Text>
              <Text style={{ fontSize: 9, color: colors.gray, marginTop: 1 }}>
                Am {fighter.am_wins}-{fighter.am_losses}-{fighter.am_draws}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Identity</Text>
        <View style={styles.grid2}>
          <View style={styles.col}>
            <View style={styles.kv}>
              <Text style={styles.k}>Date of birth</Text>
              <Text style={styles.v}>
                {fighter.date_of_birth ? fmtDate(fighter.date_of_birth) : "—"}
                {age != null && ` (age ${age})`}
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Nationality</Text>
              <Text style={styles.v}>{fighter.nationality ?? "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Hometown</Text>
              <Text style={styles.v}>{fighter.hometown ?? "—"}</Text>
            </View>
          </View>
          <View style={styles.col}>
            <View style={styles.kv}>
              <Text style={styles.k}>Gym</Text>
              <Text style={styles.v}>{gym?.name ?? fighter.gym ?? "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Height / Reach</Text>
              <Text style={styles.v}>
                {fighter.height_cm != null ? `${fighter.height_cm} cm` : "—"} /{" "}
                {fighter.reach_cm != null ? `${fighter.reach_cm} cm` : "—"}
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Contact</Text>
              <Text style={styles.v}>
                {fighter.contact_email ?? fighter.contact_phone ?? "—"}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Licenses &amp; sanctioning IDs</Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            padding: 8,
            minHeight: 32,
          }}
        >
          <Text style={{ fontSize: 10, lineHeight: 1.4 }}>
            {fighter.licenses ?? "—"}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Medical clearances</Text>
        <View style={styles.table}>
          <View style={[styles.tRow, styles.tHead]}>
            <Text style={[styles.tCell, { flex: MEDICAL_COL.kind }]}>Kind</Text>
            <Text style={[styles.tCell, { flex: MEDICAL_COL.issued }]}>Issued</Text>
            <Text style={[styles.tCell, { flex: MEDICAL_COL.expires }]}>Expires</Text>
            <Text style={[styles.tCellLast, { flex: MEDICAL_COL.status, textAlign: "center" }]}>Status</Text>
          </View>
          {medRows.map((row, i) => {
            const isLast = i === medRows.length - 1;
            const rowStyle = isLast ? styles.tRowLast : styles.tRow;
            return (
              <View key={row.kind} style={rowStyle}>
                <Text style={[styles.tCell, { flex: MEDICAL_COL.kind }]}>
                  {medicalKindLabel(row.kind)}
                </Text>
                <Text style={[styles.tCell, { flex: MEDICAL_COL.issued }]}>
                  {row.rec ? fmtDate(row.rec.issued_on) : "—"}
                </Text>
                <Text style={[styles.tCell, { flex: MEDICAL_COL.expires }]}>
                  {row.rec?.expires_on ? fmtDate(row.rec.expires_on) : "—"}
                </Text>
                <Text
                  style={[
                    styles.tCellLast,
                    {
                      flex: MEDICAL_COL.status,
                      textAlign: "center",
                      color: statusColor(row.status),
                      fontFamily: "Helvetica-Bold",
                    },
                  ]}
                >
                  {statusLabel(row.status)}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Recent bouts</Text>
        {recentBouts.length === 0 ? (
          <Text style={{ fontSize: 10, color: colors.gray }}>No bouts on record.</Text>
        ) : (
          <View style={styles.table}>
            <View style={[styles.tRow, styles.tHead]}>
              <Text style={[styles.tCell, { flex: BOUT_COL.date }]}>Date</Text>
              <Text style={[styles.tCell, { flex: BOUT_COL.event }]}>Event</Text>
              <Text style={[styles.tCell, { flex: BOUT_COL.opponent }]}>Opponent</Text>
              <Text style={[styles.tCell, { flex: BOUT_COL.result }]}>Result</Text>
              <Text style={[styles.tCellLast, { flex: BOUT_COL.method }]}>Method</Text>
            </View>
            {recentBouts.map((b, i) => {
              const isLast = i === recentBouts.length - 1;
              const rowStyle = isLast ? styles.tRowLast : styles.tRow;
              const label = normalizedResultLabel(b.normalizedResult, b.bout_class);
              const color =
                b.normalizedResult === "win"
                  ? colors.emerald
                  : b.normalizedResult === "loss"
                    ? colors.red
                    : colors.gray;
              return (
                <View key={`${b.event_date}-${b.event_name}-${i}`} style={rowStyle}>
                  <Text style={[styles.tCell, { flex: BOUT_COL.date }]}>
                    {fmtDate(b.event_date)}
                  </Text>
                  <Text style={[styles.tCell, { flex: BOUT_COL.event }]}>
                    {b.event_name}
                  </Text>
                  <Text style={[styles.tCell, { flex: BOUT_COL.opponent }]}>
                    {b.opponent ?? "TBD"}
                  </Text>
                  <Text
                    style={[
                      styles.tCell,
                      { flex: BOUT_COL.result, color, fontFamily: "Helvetica-Bold" },
                    ]}
                  >
                    {label}
                  </Text>
                  <Text style={[styles.tCellLast, { flex: BOUT_COL.method }]}>
                    {b.method ? b.method.replace(/_/g, " ") : "—"}
                    {b.round_finished ? ` · R${b.round_finished}` : ""}
                    {b.time_finished ? ` (${b.time_finished})` : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.sigRow}>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLabel}>Fighter — signature / date</Text>
            <Text style={styles.sigName}>{fighter.full_name}</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLabel}>Commission rep — signature / date</Text>
            <Text style={styles.sigName}>____________________</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>CombatPro · Fighter passport · confidential</Text>
          <Text>Generated {fmtDate(new Date().toISOString())}</Text>
        </View>
      </Page>
    </Document>
  );
}

