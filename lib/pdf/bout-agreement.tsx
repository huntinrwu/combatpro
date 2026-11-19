import { Document, Page, Text, View } from "@react-pdf/renderer";

import { BrandLockup } from "./brand-mark";
import { KV } from "./parts";
import { colors, fmtDate, styles, type PdfEvent } from "./theme";
import {
  BOUT_CLASSES,
  fighterClearanceSummary,
  type Bout,
  type Corner,
  type Fighter,
  type Ruleset,
} from "@/lib/db/types";
import { weightClassFor, weightClassMatch } from "@/lib/weight-classes";

type ClearanceSummary = ReturnType<typeof fighterClearanceSummary>;

export type BoutAgreementProps = {
  event: PdfEvent;
  bout: Bout;
  red: Fighter | null;
  blue: Fighter | null;
  officials: { role: string; name: string }[];
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

function CornerCard({
  corner,
  fighter,
  boutClass,
  medical,
}: {
  corner: Corner;
  fighter: Fighter | null;
  boutClass: string;
  medical: ReturnType<typeof medicalLine>;
}) {
  const color = corner === "red" ? colors.red : colors.blue;
  return (
    <View style={[styles.cornerCard, { borderLeftColor: color, flex: 1 }]}>
      <Text style={[styles.cornerLabel, { color }]}>
        {corner === "red" ? "Red corner" : "Blue corner"}
      </Text>
      <Text style={styles.cornerName}>{fighter?.full_name ?? "TBD"}</Text>
      {fighter?.nickname && (
        <Text style={{ fontSize: 9, color: colors.gray, fontStyle: "italic" }}>
          &quot;{fighter.nickname}&quot;
        </Text>
      )}
      <Text style={styles.cornerRecord}>Record: {record(fighter, boutClass)}</Text>
      <KV k="Gym">{fighter?.gym ?? "—"}</KV>
      <KV k="Hometown">{fighter?.hometown ?? "—"}</KV>
      <KV k="Stance" vStyle={{ textTransform: "capitalize" }}>
        {fighter?.stance ?? "—"}
      </KV>
      <KV
        k="Medical"
        vStyle={medical ? { color: medical.color, fontFamily: "Helvetica-Bold" } : undefined}
      >
        {medical ? medical.text : "All clear on event date"}
      </KV>
    </View>
  );
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
            <KV k="Sanctioning body">{sanctioningBody ?? "—"}</KV>
            <KV k="Regulator">{commission ?? "—"}</KV>
          </View>
          <View style={styles.col}>
            <KV k="Class">{boutClassLabel}</KV>
            <KV k="Sport" vStyle={{ textTransform: "capitalize" }}>{bout.sport}</KV>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Contest terms</Text>
        <View style={styles.grid2}>
          <View style={styles.col}>
            <KV k="Weight class">
              {bout.weight_class ?? "—"}
              {weightClassOk === false && expectedWeightClass && (
                <Text style={{ color: colors.red, fontSize: 8 }}>
                  {"  "}
                  (expected {expectedWeightClass})
                </Text>
              )}
            </KV>
            <KV k="Contract weight">
              {bout.contracted_weight_lbs != null ? `${bout.contracted_weight_lbs} lbs` : "—"}
            </KV>
          </View>
          <View style={styles.col}>
            <KV k="Rounds">
              {bout.rounds ?? "—"} × {bout.round_length_minutes ?? "—"} min
            </KV>
            <KV k="Scoring">
              {bout.scoring_mode ? bout.scoring_mode.replace(/_/g, " ") : "—"}
            </KV>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Corners</Text>
        <View style={styles.grid2}>
          <CornerCard corner="red" fighter={red} boutClass={bout.bout_class} medical={redMedical} />
          <CornerCard corner="blue" fighter={blue} boutClass={bout.bout_class} medical={blueMedical} />
        </View>

        {ruleset && (
          <>
            <Text style={styles.sectionTitle}>Ruleset — {ruleset.name}</Text>
            <View style={styles.grid2}>
              <View style={styles.col}>
                <KV k="Rounds (champ)">
                  {ruleset.rounds_championship != null
                    ? `${ruleset.rounds_championship} × ${ruleset.round_length_minutes ?? "—"} min`
                    : "—"}
                </KV>
                <KV k="Rounds (non-champ)">
                  {ruleset.rounds_non_championship != null
                    ? `${ruleset.rounds_non_championship} × ${ruleset.round_length_minutes ?? "—"} min`
                    : "—"}
                </KV>
                <KV k="Rest between rounds">
                  {ruleset.rest_length_seconds != null ? `${ruleset.rest_length_seconds} sec` : "—"}
                </KV>
                <KV k="Weight allowance">
                  {ruleset.weight_allowance_lbs != null ? `${ruleset.weight_allowance_lbs} lbs` : "—"}
                </KV>
              </View>
              <View style={styles.col}>
                <KV k="3-KD rule">{ruleset.three_knockdown_rule ? "Yes" : "No"}</KV>
                <KV k="Standing 8-count">{ruleset.standing_eight_count ? "Yes" : "No"}</KV>
                <KV k="Open scoring">{ruleset.open_scoring ? "Yes" : "No"}</KV>
              </View>
            </View>
            {(ruleset.glove_specs || ruleset.wraps_spec || ruleset.protective_gear) && (
              <View style={{ marginTop: 6 }}>
                {ruleset.glove_specs && (
                  <KV k="Gloves">{ruleset.glove_specs}</KV>
                )}
                {ruleset.wraps_spec && (
                  <KV k="Wraps">{ruleset.wraps_spec}</KV>
                )}
                {ruleset.protective_gear && (
                  <KV k="Protective gear">{ruleset.protective_gear}</KV>
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
            <KV k="Referee">
              {referees.map((r) => r.name).join(", ") || "—"}
            </KV>
            <KV k="Judges">
              {judges.map((j) => j.name).join(", ") || "—"}
            </KV>
            <KV k="Ringside doctor">
              {doctors.map((d) => d.name).join(", ") || "—"}
            </KV>
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
