import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from '../../theme';

type Variant = 'primary' | 'secondary' | 'destructive' | 'gold';
type Size = 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * The one button component for every screen (Milestone 7). `gold` is
 * reserved for the single highest-value CTA on a screen (e.g. the "+"
 * quick-create action) — never the default for ordinary actions, per
 * docs/DESIGN_SYSTEM.md "Gold usage."
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[
        styles.base,
        size === 'sm' ? styles.sizeSm : styles.sizeMd,
        variantStyles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.brand.primaryNavy : colors.text.inverse} />
      ) : (
        <Text style={[styles.label, labelVariantStyles[variant], size === 'sm' && styles.labelSm]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'ghost' | 'filled';
  style?: StyleProp<ViewStyle>;
}

/** Icon-only control — always requires an accessibility label (there is no visible text fallback). */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'ghost',
  style,
}: IconButtonProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.iconButton, variant === 'filled' && styles.iconButtonFilled, style]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sizeMd: { paddingVertical: 14, paddingHorizontal: spacing.lg },
  sizeSm: { paddingVertical: 10, paddingHorizontal: spacing.md },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, fontWeight: '600' },
  labelSm: { fontSize: 13 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonFilled: { backgroundColor: colors.background },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.brand.primaryNavy },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  destructive: { backgroundColor: colors.danger },
  gold: { backgroundColor: colors.brand.gold },
};

const labelVariantStyles: Record<Variant, { color: string }> = {
  primary: { color: colors.text.inverse },
  secondary: { color: colors.brand.primaryNavy },
  destructive: { color: colors.text.inverse },
  gold: { color: colors.text.onGold },
};
