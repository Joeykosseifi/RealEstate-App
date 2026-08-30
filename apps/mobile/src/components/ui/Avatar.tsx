import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme';

interface AvatarProps {
  /** First letter of each is used, e.g. "Sarah Khoury" -> "SK". Falls back to "?" for an empty name. */
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Initials-only avatar (no photo — no user/client profile-picture field
 * exists anywhere in the data model, see docs/DESIGN_SYSTEM.md). The one
 * avatar treatment used everywhere a person needs a visual anchor.
 */
export function Avatar({ name, size = 44, style }: AvatarProps): React.JSX.Element {
  const fontSize = Math.round(size * 0.4);
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize }]}>{initialsFor(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.brand.primaryNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: colors.text.inverse, fontWeight: '700' },
});
