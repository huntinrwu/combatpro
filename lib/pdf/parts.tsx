import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";

import { styles } from "./theme";

type TextStyle = Parameters<typeof StyleSheet.create>[0][string];

// Label / value row used throughout the PDF templates.
export function KV({
  k,
  children,
  vStyle,
}: {
  k: string;
  children?: ReactNode;
  vStyle?: TextStyle;
}) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{k}</Text>
      <Text style={vStyle ? [styles.v, vStyle] : styles.v}>{children}</Text>
    </View>
  );
}
