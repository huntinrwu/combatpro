import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  black: "#0a0a0a",
  gray: "#525252",
  grayLight: "#a3a3a3",
  grayBg: "#f5f5f5",
  border: "#d4d4d4",
  red: "#c1121f",
  blue: "#1e4dd8",
  emerald: "#059669",
  amber: "#b45309",
};

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.black,
    lineHeight: 1.4,
  },
  brandBar: {
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingBottom: 8,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  brand: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  brandTagline: {
    fontSize: 8,
    color: colors.gray,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 2,
  },
  docKind: {
    fontSize: 9,
    color: colors.gray,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 11,
    color: colors.gray,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.gray,
    marginTop: 12,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 3,
  },
  grid2: {
    flexDirection: "row",
    gap: 16,
  },
  col: {
    flex: 1,
  },
  kv: {
    flexDirection: "row",
    marginBottom: 2,
  },
  k: {
    width: 110,
    color: colors.gray,
  },
  v: {
    flex: 1,
  },
  cornerCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: 10,
    marginBottom: 6,
  },
  cornerLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  cornerName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  cornerRecord: {
    fontSize: 9,
    color: colors.gray,
    marginBottom: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tRowLast: {
    flexDirection: "row",
  },
  tHead: {
    backgroundColor: colors.grayBg,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.gray,
  },
  tCell: {
    padding: 5,
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  tCellLast: {
    padding: 5,
    flex: 1,
  },
  sigRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 20,
  },
  sigBlock: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: colors.black,
    paddingTop: 4,
  },
  sigLabel: {
    fontSize: 8,
    color: colors.gray,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sigName: {
    fontSize: 10,
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 7,
    color: colors.grayLight,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  callout: {
    padding: 8,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.grayBg,
  },
  calloutTitle: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.gray,
    marginBottom: 3,
  },
  calloutValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
});

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
