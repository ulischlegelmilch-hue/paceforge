import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { usePalette } from '@/ui/colors';
import { button as buttonType } from '@/ui/typography';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
}) {
  const p = usePalette();
  const isDisabled = disabled || loading;

  const variantStyle: StyleProp<ViewStyle> =
    variant === 'primary'
      ? { backgroundColor: p.accent }
      : variant === 'secondary'
        ? { backgroundColor: p.surfaceRaised }
        : { backgroundColor: 'transparent' };

  const textColor = variant === 'primary' ? p.accentText : variant === 'secondary' ? p.text : p.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.base, variantStyle, { opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[buttonType, { color: textColor }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    paddingVertical: 16,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
