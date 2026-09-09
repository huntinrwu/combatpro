import { Document, Page, Text, View } from "@react-pdf/renderer";

import { BrandLockup } from "./brand-mark";
import { colors, fmtDate, styles } from "./theme";
import {
  BOUT_CLASSES,
  fighterClearanceSummary,
  type Bout,
  type EventRow,
  type Fighter,
  type Ruleset,
} from "@/lib/db/types";
import { weightClassFor, weightClassMatch } from "@/lib/weight-classes";

type ClearanceSummary = ReturnType<typeof fighterClearanceSummary>;

export type BoutAgreementProps = {
  event: Pick<EventRow, "name" | "event_date" | "venue" | "city" | "state" | "primary_sport">;
  bout: Bout;
  red: Fighter | null;
  blue: Fighter | null;
  officials: { role: string; name: string; state: string | null }[];
  sanctioningBody: string | null;
  commission: string | null;
  ruleset?: Ruleset | null;
  redClearance?: ClearanceSummary | null;
  blueClearance?: ClearanceSummary | null;
};

function medicalLine(clearance: ClearanceSummary | null | undefined): {
  text: string;
  color: string;
} | null {
  if (!clearance) return null;
  if (clearance.worstStatus === "active") return null;
  const parts: string[] = [];
  if (clearance.counts.expired > 0) parts.push(`${clearance.counts.expired} expired`);
  if (clearance.counts.missing > 0) parts.push(`${clearance.counts.missing} missing`);
  if (clearance.counts.expiring > 0) parts.push(`${clearance.counts.expiring} expiring`);
  const color =
    clearance.worstStatus === "expired"
      ? colors.red
      : clearance.worstStatus === "expiring"
        ? colors.amber
        : colors.gray;
  return { text: parts.join(" · "), color };
}

function record(f: Fighter | null, boutClass: string) {
  if (!f) return "—";
  const isPro = boutClass === "pro";
  const w = isPro ? f.pro_wins : f.am_wins;
  const l = isPro ? f.pro_losses : f.am_losses;
  const d = isPro ? f.pro_draws : f.am_draws;
  return `${w}-${l}-${d} (${isPro ? "pro" : "amateur"})`;
}

export function BoutAgreementPdf({
  event,
  bout,
  red,
  blue,
  officials,
  sanctioningBody,
  commission,
  ruleset,
  redClearance,
  blueClearance,
}: BoutAgreementProps) {
  const redMedical = medicalLine(redClearance);
  const blueMedical = medicalLine(blueClearance);
  const boutClassLabel =
    BOUT_CLASSES.find((c) => c.value === bout.bout_class)?.label ?? bout.bout_class;
  const referees = officials.filter((o) => o.role === "referee");
  const judges = officials.filter((o) => o.role === "judge");
  const doctors = officials.filter((o) => o.role === "doctor");
  const weightClassOk = weightClassMatch(
    bout.sport,
    bout.contracted_weight_lbs,
    bout.weight_class,
  );
  const expectedWeightClass =
    bout.contracted_weight_lbs != null
      ? weightClassFor(bout.sport, bout.contracted_weight_lbs)
      : null;

  return (
    <Document
      title={`Bout Agreement — ${red?.full_name ?? "Red"} vs ${blue?.full_name ?? "Blue"}`}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.brandBar}>
          <BrandLockup tagline="Sanctioning documentation" />
          <Text style={styles.docKind}>Bout Agreement</Text>
        </View>

        <Text style={styles.title}>
          {red?.full_name ?? "TBD"} vs {blue?.full_name ?? "TBD"}
        </Text>
        <Text style={styles.subtitle}>
          {event.name} · {fmtDate(event.event_date)}
          {event.venue ? ` · ${event.venue}` : ""}
          {event.city || event.state ? ` · ${[event.city, event.state].filter(Boolean).join(", ")}` : ""}
        </Text>

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
              <Text style={styles.k}>Class</Text>
              <Text style={styles.v}>{boutClassLabel}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Sport</Text>
              <Text style={[styles.v, { textTransform: "capitalize" }]}>{bout.sport}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Contest terms</Text>
        <View style={styles.grid2}>
          <View style={styles.col}>
            <View style={styles.kv}>
              <Text style={styles.k}>Weight class</Text>
              <Text style={styles.v}>
                {bout.weight_class ?? "—"}
                {weightClassOk === false && expectedWeightClass && (
                  <Text style={{ color: colors.red, fontSize: 8 }}>
                    {"  "}
                    (expected {expectedWeightClass})
                  </Text>
                )}
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Contract weight</Text>
              <Text style={styles.v}>
                {bout.contracted_weight_lbs != null ? `${bout.contracted_weight_lbs} lbs` : "—"}
              </Text>
            </View>
          </View>
          <View style={styles.col}>
            <View style={styles.kv}>
              <Text style={styles.k}>Rounds</Text>
              <Text style={styles.v}>
                {bout.rounds ?? "—"} × {bout.round_length_minutes ?? "—"} min
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Scoring</Text>
              <Text style={styles.v}>
                {bout.scoring_mode ? bout.scoring_mode.replace(/_/g, " ") : "—"}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Corners</Text>
        <View style={styles.grid2}>
          <View style={[styles.cornerCard, { borderLeftColor: colors.red, flex: 1 }]}>
            <Text style={[styles.cornerLabel, { color: colors.red }]}>Red corner</Text>
            <Text style={styles.cornerName}>{red?.full_name ?? "TBD"}</Text>
            {red?.nickname && (
              <Text style={{ fontSize: 9, color: colors.gray, fontStyle: "italic" }}>
                &quot;{red.nickname}&quot;
              </Text>
            )}
            <Text style={styles.cornerRecord}>Record: {record(red, bout.bout_class)}</Text>
            <View style={styles.kv}>
              <Text style={styles.k}>Gym</Text>
              <Text style={styles.v}>{red?.gym ?? "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Hometown</Text>
              <Text style={styles.v}>{red?.hometown ?? "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Stance</Text>
              <Text style={[styles.v, { textTransform: "capitalize" }]}>{red?.stance ?? "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Medical</Text>
              <Text
                style={[
                  styles.v,
                  redMedical ? { color: redMedical.color, fontFamily: "Helvetica-Bold" } : {},
                ]}
              >
                {redMedical ? redMedical.text : "All clear on event date"}
              </Text>
            </View>
          </View>
          <View style={[styles.cornerCard, { borderLeftColor: colors.blue, flex: 1 }]}>
            <Text style={[styles.cornerLabel, { color: colors.blue }]}>Blue corner</Text>
            <Text style={styles.cornerName}>{blue?.full_name ?? "TBD"}</Text>
            {blue?.nickname && (
              <Text style={{ fontSize: 9, color: colors.gray, fontStyle: "italic" }}>
                &quot;{blue.nickname}&quot;
              </Text>
            )}
            <Text style={styles.cornerRecord}>Record: {record(blue, bout.bout_class)}</Text>
            <View style={styles.kv}>
              <Text style={styles.k}>Gym</Text>
              <Text style={styles.v}>{blue?.gym ?? "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Hometown</Text>
              <Text style={styles.v}>{blue?.hometown ?? "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Stance</Text>
              <Text style={[styles.v, { textTransform: "capitalize" }]}>{blue?.stance ?? "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Medical</Text>
              <Text
                style={[
                  styles.v,
                  blueMedical ? { color: blueMedical.color, fontFamily: "Helvetica-Bold" } : {},
                ]}
              >
                {blueMedical ? blueMedical.text : "All clear on event date"}
              </Text>
            </View>
          </View>
        </View>

        {ruleset && (
          <>
            <Text style={styles.sectionTitle}>Ruleset — {ruleset.name}</Text>
            <View style={styles.grid2}>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.k}>Rounds (champ)</Text>
                  <Text style={styles.v}>
                    {ruleset.rounds_championship != null
                      ? `${ruleset.rounds_championship} × ${ruleset.round_length_minutes ?? "—"} min`
                      : "—"}
                  </Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Rounds (non-champ)</Text>
                  <Text style={styles.v}>
                    {ruleset.rounds_non_championship != null
                      ? `${ruleset.rounds_non_championship} × ${ruleset.round_length_minutes ?? "—"} min`
                      : "—"}
                  </Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Rest between rounds</Text>
                  <Text style={styles.v}>
                    {ruleset.rest_length_seconds != null ? `${ruleset.rest_length_seconds} sec` : "—"}
                  </Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Weight allowance</Text>
                  <Text style={styles.v}>
                    {ruleset.weight_allowance_lbs != null ? `${ruleset.weight_allowance_lbs} lbs` : "—"}
                  </Text>
                </View>
              </View>
              <View style={styles.col}>
                <View style={styles.kv}>
                  <Text style={styles.k}>3-KD rule</Text>
                  <Text style={styles.v}>{ruleset.three_knockdown_rule ? "Yes" : "No"}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Standing 8-count</Text>
                  <Text style={styles.v}>{ruleset.standing_eight_count ? "Yes" : "No"}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Open scoring</Text>
                  <Text style={styles.v}>{ruleset.open_scoring ? "Yes" : "No"}</Text>
                </View>
              </View>
            </View>
            {(ruleset.glove_specs || ruleset.wraps_spec || ruleset.protective_gear) && (
              <View style={{ marginTop: 6 }}>
                {ruleset.glove_specs && (
                  <View style={styles.kv}>
                    <Text style={styles.k}>Gloves</Text>
                    <Text style={styles.v}>{ruleset.glove_specs}</Text>
                  </View>
                )}
                {ruleset.wraps_spec && (
                  <View style={styles.kv}>
                    <Text style={styles.k}>Wraps</Text>
                    <Text style={styles.v}>{ruleset.wraps_spec}</Text>
                  </View>
                )}
                {ruleset.protective_gear && (
                  <View style={styles.kv}>
                    <Text style={styles.k}>Protective gear</Text>
                    <Text style={styles.v}>{ruleset.protective_gear}</Text>
                  </View>
                )}
              </View>
            )}
            {ruleset.notes && (
              <Text style={{ fontSize: 9, color: colors.gray, marginTop: 4 }}>
                {ruleset.notes}
              </Text>
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>Assigned officials</Text>
        {officials.length === 0 ? (
          <Text style={{ color: colors.gray, fontStyle: "italic" }}>
            No officials assigned yet — must be complete before the bout.
          </Text>
        ) : (
          <View>
            <View style={styles.kv}>
              <Text style={styles.k}>Referee</Text>
              <Text style={styles.v}>
                {referees.map((r) => r.name).join(", ") || "—"}
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Judges</Text>
              <Text style={styles.v}>
                {judges.map((j) => j.name).join(", ") || "—"}
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Ringside doctor</Text>
              <Text style={styles.v}>
                {doctors.map((d) => d.name).join(", ") || "—"}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Acknowledgement</Text>
        <Text style={{ fontSize: 9, color: colors.gray }}>
          Each undersigned fighter acknowledges having read and understood the contest terms
          above, is medically fit to compete, and agrees to abide by the rules of the sanctioning
          body and the regulator listed on this agreement.
        </Text>

        <View style={styles.sigRow}>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLabel}>Red corner fighter</Text>
            <Text style={styles.sigName}>{red?.full_name ?? "—"}</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLabel}>Blue corner fighter</Text>
            <Text style={styles.sigName}>{blue?.full_name ?? "—"}</Text>
          </View>
        </View>
        <View style={styles.sigRow}>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLabel}>Promoter</Text>
            <Text style={styles.sigName}> </Text>
          </View>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLabel}>Sanctioning body representative</Text>
            <Text style={styles.sigName}>{sanctioningBody ?? " "}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>Generated by CombatPro · {fmtDate(new Date().toISOString())}</Text>
          <Text>Bout {bout.id.slice(0, 8)}</Text>
        </View>
      </Page>
    </Document>
  );
}
