import { Document, Page, Text, View } from "@react-pdf/renderer";

import { BrandLockup } from "./brand-mark";
import { colors, fmtDate, fmtDateTime, styles } from "./theme";
import {
  BOUT_METHODS,
  checkinProgress,
  weighInStatus,
  type Bout,
  type BoutFighterCheck,
  type BoutScorecard,
  type Corner,
  type EventRow,
  type Fighter,
} from "@/lib/db/types";

export type FightReportProps = {
  event: Pick<EventRow, "name" | "event_date" | "venue" | "city" | "state" | "primary_sport">;
  bout: Bout;
  red: Fighter | null;
  blue: Fighter | null;
  officials: { role: string; name: string; state: string | null }[];
  scorecards: BoutScorecard[];
  judges: { official_id: string; name: string }[];
  checks: Partial<Record<Corner, BoutFighterCheck>>;
  sanctioningBody: string | null;
  commission: string | null;
};

function winnerLabel(bout: Bout, red: Fighter | null, blue: Fighter | null): string {
  if (!bout.result) return "Not declared";
  if (bout.result === "red") return `Winner: ${red?.full_name ?? "Red corner"}`;
  if (bout.result === "blue") return `Winner: ${blue?.full_name ?? "Blue corner"}`;
  if (bout.result === "draw") return "Draw";
  return "No contest";
}

function methodLabel(method: string | null): string {
  if (!method) return "—";
  return BOUT_METHODS.find((m) => m.value === method)?.label ?? method;
}

function checkGateLabel(check: BoutFighterCheck | undefined | null): string {
  if (!check) return "No record";
  const p = checkinProgress(check);
  const gates: string[] = [];
  if (p.checkedIn) gates.push("Checked in");
  if (p.weighedIn) gates.push("Weighed in");
  if (p.medicalCleared) gates.push("Medical cleared");
  if (p.clearedToFight) gates.push("Cleared to fight");
  return gates.length ? gates.join(" · ") : "No gates cleared";
}

export function FightReportPdf({
  event,
  bout,
  red,
  blue,
  officials,
  scorecards,
  judges,
  checks,
  sanctioningBody,
  commission,
}: FightReportProps) {
  const totalRounds = bout.rounds ?? 10;
  const cardsByJudge = new Map<string, BoutScorecard[]>();
  for (const c of scorecards) {
    const arr = cardsByJudge.get(c.judge_official_id) ?? [];
    arr.push(c);
    cardsByJudge.set(c.judge_official_id, arr);
  }
  for (const arr of cardsByJudge.values()) arr.sort((a, b) => a.round_number - b.round_number);

  const totalsByJudge = new Map<string, { red: number; blue: number }>();
  for (const [id, arr] of cardsByJudge) {
    totalsByJudge.set(id, {
      red: arr.reduce((s, c) => s + c.red_score, 0),
      blue: arr.reduce((s, c) => s + c.blue_score, 0),
    });
  }

  const redCheck = checks.red;
  const blueCheck = checks.blue;
  const redWeighStatus = weighInStatus(bout.contracted_weight_lbs, redCheck?.weigh_in_lbs ?? null);
  const blueWeighStatus = weighInStatus(bout.contracted_weight_lbs, blueCheck?.weigh_in_lbs ?? null);

  return (
    <Document
      title={`Fight Report — ${red?.full_name ?? "Red"} vs ${blue?.full_name ?? "Blue"}`}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.brandBar}>
          <BrandLockup tagline="Sanctioning documentation" />
          <Text style={styles.docKind}>Fight Report</Text>
        </View>

        <Text style={styles.title}>
          {red?.full_name ?? "TBD"} vs {blue?.full_name ?? "TBD"}
        </Text>
        <Text style={styles.subtitle}>
          {event.name} · {fmtDate(event.event_date)}
          {event.venue ? ` · ${event.venue}` : ""}
          {event.city || event.state ? ` · ${[event.city, event.state].filter(Boolean).join(", ")}` : ""}
        </Text>

        {/* Big result callout */}
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>Official result</Text>
          <Text style={styles.calloutValue}>{winnerLabel(bout, red, blue)}</Text>
          <Text style={{ fontSize: 10, color: colors.gray, marginTop: 2 }}>
            {methodLabel(bout.method)}
            {bout.round_finished ? ` · Round ${bout.round_finished} of ${totalRounds}` : ""}
            {bout.time_finished ? ` · Time ${bout.time_finished}` : ""}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Sanctioning</Text>
        <View style={styles.grid2}>
          <View style={styles.col}>
            <View style={styles.kv}>
              <Text style={styles.k}>Sanctioning body</Text>
              <Text style={styles.v}>{sanctioningBody ?? "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Regulator</Text>
              <Text style={styles.v}>{commission ?? "—"}</Text>
            </View>
          </View>
          <View style={styles.col}>
            <View style={styles.kv}>
              <Text style={styles.k}>Weight class</Text>
              <Text style={styles.v}>{bout.weight_class ?? "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Contract weight</Text>
              <Text style={styles.v}>
                {bout.contracted_weight_lbs != null ? `${bout.contracted_weight_lbs} lbs` : "—"}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Fighter check-in</Text>
        <View style={styles.grid2}>
          <View style={[styles.cornerCard, { borderLeftColor: colors.red, flex: 1 }]}>
            <Text style={[styles.cornerLabel, { color: colors.red }]}>Red corner</Text>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>
              {red?.full_name ?? "TBD"}
            </Text>
            <View style={styles.kv}>
              <Text style={styles.k}>Weigh-in</Text>
              <Text style={styles.v}>
                {redCheck?.weigh_in_lbs != null
                  ? `${redCheck.weigh_in_lbs} lbs${
                      redWeighStatus === "over"
                        ? " (OVER contract)"
                        : redWeighStatus === "under"
                          ? " (under)"
                          : " (on contract)"
                    }`
                  : "—"}
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Weighed at</Text>
              <Text style={styles.v}>{fmtDateTime(redCheck?.weigh_in_at)}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Gates</Text>
              <Text style={styles.v}>{checkGateLabel(redCheck)}</Text>
            </View>
            {redCheck?.override_reason && (
              <View style={styles.kv}>
                <Text style={styles.k}>Override</Text>
                <Text style={[styles.v, { color: colors.amber, fontStyle: "italic" }]}>
                  {redCheck.override_reason}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.cornerCard, { borderLeftColor: colors.blue, flex: 1 }]}>
            <Text style={[styles.cornerLabel, { color: colors.blue }]}>Blue corner</Text>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>
              {blue?.full_name ?? "TBD"}
            </Text>
            <View style={styles.kv}>
              <Text style={styles.k}>Weigh-in</Text>
              <Text style={styles.v}>
                {blueCheck?.weigh_in_lbs != null
                  ? `${blueCheck.weigh_in_lbs} lbs${
                      blueWeighStatus === "over"
                        ? " (OVER contract)"
                        : blueWeighStatus === "under"
                          ? " (under)"
                          : " (on contract)"
                    }`
                  : "—"}
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Weighed at</Text>
              <Text style={styles.v}>{fmtDateTime(blueCheck?.weigh_in_at)}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Gates</Text>
              <Text style={styles.v}>{checkGateLabel(blueCheck)}</Text>
            </View>
            {blueCheck?.override_reason && (
              <View style={styles.kv}>
                <Text style={styles.k}>Override</Text>
                <Text style={[styles.v, { color: colors.amber, fontStyle: "italic" }]}>
                  {blueCheck.override_reason}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Judges&rsquo; scorecards</Text>
        {judges.length === 0 || scorecards.length === 0 ? (
          <Text style={{ color: colors.gray, fontStyle: "italic" }}>
            No scorecards submitted. Result was decided by stoppage or is not yet declared.
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={[styles.tRow, styles.tHead]}>
              <Text style={styles.tCell}>Round</Text>
              {judges.map((j, idx) => (
                <Text key={j.official_id} style={styles.tCell}>
                  J{idx + 1} · {j.name}
                </Text>
              ))}
              <Text style={styles.tCellLast}>KD (R/B)</Text>
            </View>
            {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round, rIdx, arr) => {
              const rowCards = judges.map((j) =>
                (cardsByJudge.get(j.official_id) ?? []).find((c) => c.round_number === round),
              );
              const kdRed = rowCards.reduce((m, c) => Math.max(m, c?.knockdowns_red ?? 0), 0);
              const kdBlue = rowCards.reduce((m, c) => Math.max(m, c?.knockdowns_blue ?? 0), 0);
              const isLast = rIdx === arr.length - 1;
              const rowStyle = isLast ? styles.tRowLast : styles.tRow;
              return (
                <View key={round} style={rowStyle}>
                  <Text style={styles.tCell}>{round}</Text>
                  {rowCards.map((c, idx) => (
                    <Text key={idx} style={styles.tCell}>
                      {c ? `${c.red_score}–${c.blue_score}` : "—"}
                    </Text>
                  ))}
                  <Text style={styles.tCellLast}>
                    {kdRed || kdBlue ? `${kdRed}/${kdBlue}` : "—"}
                  </Text>
                </View>
              );
            })}
            {/* Totals row */}
            <View
              style={{
                flexDirection: "row",
                borderTopWidth: 2,
                borderTopColor: colors.black,
                backgroundColor: colors.grayBg,
              }}
            >
              <Text style={[styles.tCell, { fontFamily: "Helvetica-Bold" }]}>Totals</Text>
              {judges.map((j) => {
                const t = totalsByJudge.get(j.official_id) ?? { red: 0, blue: 0 };
                return (
                  <Text
                    key={j.official_id}
                    style={[styles.tCell, { fontFamily: "Helvetica-Bold" }]}
                  >
                    {t.red}–{t.blue}
                  </Text>
                );
              })}
              <Text style={styles.tCellLast}> </Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Certification</Text>
        <Text style={{ fontSize: 9, color: colors.gray }}>
          The undersigned officials certify that the above result reflects the outcome of the
          bout as adjudicated under the rules of the sanctioning body.
        </Text>

        <View style={styles.sigRow}>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLabel}>Referee</Text>
            <Text style={styles.sigName}>
              {officials.filter((o) => o.role === "referee").map((o) => o.name).join(", ") || " "}
            </Text>
          </View>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLabel}>Ringside doctor</Text>
            <Text style={styles.sigName}>
              {officials.filter((o) => o.role === "doctor").map((o) => o.name).join(", ") || " "}
            </Text>
          </View>
        </View>
        <View style={styles.sigRow}>
          {judges.slice(0, 3).map((j, idx) => (
            <View key={j.official_id} style={styles.sigBlock}>
              <Text style={styles.sigLabel}>Judge {idx + 1}</Text>
              <Text style={styles.sigName}>{j.name}</Text>
            </View>
          ))}
          {/* Pad to 3 columns */}
          {Array.from({ length: Math.max(0, 3 - judges.length) }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.sigBlock}>
              <Text style={styles.sigLabel}>Judge {judges.length + i + 1}</Text>
              <Text style={styles.sigName}> </Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>Generated by CombatPro · {fmtDate(new Date().toISOString())}</Text>
          <Text>Bout {bout.id.slice(0, 8)}</Text>
        </View>
      </Page>
    </Document>
  );
}
