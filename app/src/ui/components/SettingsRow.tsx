import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '@/ui/colors';
import { bodyStrong, caption } from '@/ui/typography';
import { Card } from '@/ui/components/Card';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Aufklappbare Einstellungs-Zeile - ersetzt permanent ausgeklappte Karten mit
// Fließtext/Formularen (vorher z.B. Garmin-Login immer sichtbar) durch eine
// kompakte Zeile, die den Inhalt erst bei Bedarf zeigt (Muster großer Apps:
// Einstellungen als Liste, nicht als Wand aus Karten).
export function SettingsRow({
  icon,
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  icon: IoniconName;
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <Card style={styles.card}>
      <Pressable onPress={onToggle} style={({ pressed }) => [styles.head, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={[styles.iconWrap, { backgroundColor: p.surfaceRaised }]}>
          <Ionicons name={icon} size={18} color={p.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[bodyStrong, { color: p.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[caption, { color: p.subtext, marginTop: 2 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={p.subtext} />
      </Pressable>
      {expanded && <View style={styles.body}>{children}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { marginTop: 14 },
});
