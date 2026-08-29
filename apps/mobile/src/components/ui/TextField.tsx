import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

interface TextFieldProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  optional?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  editable?: boolean;
  multiline?: boolean;
  maxLength?: number;
}

/**
 * Persistent-label text field (Milestone 7 forms) — never relies on the
 * placeholder alone as the label, per docs/DESIGN_SYSTEM.md "Forms". A
 * `secureTextEntry` field automatically gets a Show/Hide toggle.
 */
export function TextField({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  optional,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  editable = true,
  multiline,
  maxLength,
}: TextFieldProps): React.JSX.Element {
  const [reveal, setReveal] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={typography.label}>
          {label}
          {optional ? <Text style={styles.optional}> (optional)</Text> : null}
        </Text>
      ) : null}
      <View style={[styles.inputRow, error && styles.inputRowError, !editable && styles.disabled]}>
        <TextInput
          style={[styles.input, multiline && styles.multiline]}
          placeholder={placeholder}
          placeholderTextColor={colors.text.secondary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword && !reveal}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          editable={editable}
          multiline={multiline}
          maxLength={maxLength}
          accessibilityLabel={label ?? placeholder}
        />
        {isPassword ? (
          <TouchableOpacity onPress={() => setReveal((v) => !v)} hitSlop={8}>
            <Text style={styles.toggle}>{reveal ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  optional: { color: colors.text.secondary, fontWeight: '400' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.input,
    backgroundColor: colors.surface,
    marginTop: spacing.xs,
  },
  inputRowError: { borderColor: colors.danger },
  disabled: { backgroundColor: colors.background },
  input: { flex: 1, paddingVertical: 12, paddingHorizontal: spacing.smd, fontSize: 15, color: colors.text.primary },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  toggle: { color: colors.brand.primaryNavy, fontWeight: '600', fontSize: 13, marginRight: spacing.smd },
  error: { color: colors.danger, fontSize: 12, marginTop: spacing.xs },
});
