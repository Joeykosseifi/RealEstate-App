import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radii, spacing } from '../../theme';

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * A single filter pill. Selected state uses gold — an explicitly
 * sanctioned use of the accent color as an "active selection" indicator
 * (see docs/DESIGN_SYSTEM.md "Gold usage": accent CTAs, selected states,
 * active navigation — never a whole screen or body text).
 */
export function FilterChip({ label, selected, onPress }: FilterChipProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.smd,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.brand.gold, borderColor: colors.brand.gold },
  label: { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
  labelSelected: { color: colors.text.onGold },
});
