import { StyleSheet, Text, View } from 'react-native';
import { usePalette } from '@/ui/colors';

// Schlanke View-Balken-Zeile (kein react-native-svg / Chart-Lib im Projekt) -
// für Lap-Pace-Vergleiche im Aktivitäts-Detail und ähnliche kleine Charts.

interface BarRowProps {
  label: string;
  value: string;
  /** 0..1, wie voll der Balken relativ zum Maximum der Gruppe ist. */
  fraction: number;
  color?: string;
}

export function BarRow({ label, value, fraction, color }: BarRowProps) {
  const p = usePalette();
  const barColor = color ?? p.accent;
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: p.subtext }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.track, { backgroundColor: p.chipBg }]}>
        <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.value, { color: p.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 44, fontSize: 12, fontWeight: '600' },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  value: { width: 96, fontSize: 12, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
