import { Path, Rect, Svg, View, Text } from "@react-pdf/renderer";

import { colors } from "./theme";

// Two chevrons pointing inward — red-corner vs blue-corner motif —
// rendered as React-PDF SVG primitives so the mark ships inside the doc
// without an external image fetch.
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x={0} y={0} width={32} height={32} rx={7} ry={7} fill={colors.black} />
      <Path
        d="M12 9 L6 16 L12 23"
        stroke="white"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M20 9 L26 16 L20 23"
        stroke="white"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function BrandLockup({
  tagline,
  markSize = 22,
}: {
  tagline?: string;
  markSize?: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <BrandMark size={markSize} />
      <View>
        <Text
          style={{
            fontSize: 15,
            fontFamily: "Helvetica-Bold",
            letterSpacing: 1.2,
          }}
        >
          COMBATPRO
        </Text>
        {tagline && (
          <Text
            style={{
              fontSize: 7,
              color: colors.gray,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginTop: 1,
            }}
          >
            {tagline}
          </Text>
        )}
      </View>
    </View>
  );
}
