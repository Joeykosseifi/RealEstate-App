import type { PropsWithChildren } from 'react';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '../../theme';

interface CardProps extends PropsWithChildren {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

/** The one card surface used everywhere — a soft border + very subtle shadow, never heavy elevation. */
export function Card({ children, onPress, style, padded = true }: CardProps): React.JSX.Element {
  const content = <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  padded: { padding: spacing.md },
});
