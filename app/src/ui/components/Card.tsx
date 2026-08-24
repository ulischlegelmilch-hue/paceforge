import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { usePalette } from '@/ui/colors';

// Karte OHNE 1px-Rahmen (Tiefe über Oberflächenfarbe statt Linie, ruhigerer
// Look) - für Rahmen-Sonderfälle (z. B. Warnkarten) `outlined` nutzen.
export function Card({
  children,
  style,
  outlined,
  outlineColor,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  outlined?: boolean;
  outlineColor?: string;
}) {
  const p = usePalette();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.surface },
        outlined && { borderWidth: 1.5, borderColor: outlineColor ?? p.accent },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 20 },
});
