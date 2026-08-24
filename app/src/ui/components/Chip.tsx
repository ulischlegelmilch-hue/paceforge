import { Pressable, StyleSheet, Text } from 'react-native';
import { usePalette } from '@/ui/colors';
import { body } from '@/ui/typography';

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? p.accent : p.surfaceRaised }]}
    >
      <Text style={[body, { color: selected ? p.accentText : p.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
});
