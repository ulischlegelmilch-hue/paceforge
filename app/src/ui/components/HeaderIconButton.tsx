import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '@/ui/colors';
import { caption } from '@/ui/typography';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Kompakter Icon+Label-Button für Bildschirm-Header - ersetzt gestapelte
// Text-Links (schwer scannbar) durch eine Reihe gleichwertiger, aber
// visuell geordneter Aktionen (Muster großer Lauf-Apps: Icon-Leiste statt
// Link-Liste im Header).
export function HeaderIconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.wrap, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      <View style={[styles.circle, { backgroundColor: p.surfaceRaised }]}>
        <Ionicons name={icon} size={19} color={p.text} />
      </View>
      <Text style={[caption, { color: p.subtext, fontSize: 11, marginTop: 4 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: 56 },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
