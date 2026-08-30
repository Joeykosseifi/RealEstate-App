import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { registerAgent, registerClient, registerCompany } from '../../api/auth';
import { ApiError } from '../../api/client';
import type { AccountType } from '../../api/types';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import {
  validateRegistrationForm,
  type RegistrationFormErrors,
  type RegistrationFormValues,
} from '../../auth/validation';
import { AppScreen, Button, TextField } from '../../components/ui';
import { colors, radii, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'CreateAccount'>;

const ACCOUNT_TYPES: {
  value: AccountType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'CLIENT', label: 'Client', description: 'Find properties to buy or rent', icon: 'person-outline' },
  {
    value: 'AGENT',
    label: 'Real Estate Agent',
    description: 'Manage your own properties and clients',
    icon: 'briefcase-outline',
  },
  {
    value: 'COMPANY',
    label: 'Real Estate Company',
    description: 'Manage your company and team',
    icon: 'business-outline',
  },
];

const initialValues: RegistrationFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
  accountType: 'CLIENT',
  companyName: '',
};

/**
 * Real mobile registration (Milestone 6.1, restyled in Milestone 7)
 * using the existing backend — `POST /auth/register/{client,agent,
 * company}` (see docs/API.md "Authentication"). No new frontend-only
 * roles: the account-type picker uses the exact backend `AccountType`
 * enum, and each option calls its matching endpoint directly.
 */
export function CreateAccountScreen({ navigation }: Props): React.JSX.Element {
  const [values, setValues] = useState<RegistrationFormValues>(initialValues);
  const [errors, setErrors] = useState<RegistrationFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = <K extends keyof RegistrationFormValues>(
    field: K,
    value: RegistrationFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const onSubmit = async () => {
    if (submitting) return;
    const formErrors = validateRegistrationForm(values);
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      const input = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        password: values.password,
        acceptedTerms: values.acceptedTerms,
      };

      const user =
        values.accountType === 'CLIENT'
          ? await registerClient(input)
          : values.accountType === 'AGENT'
            ? await registerAgent(input)
            : await registerCompany({ ...input, companyName: values.companyName.trim() });

      navigation.replace('Verification', {
        email: input.email,
        phone: input.phone,
        password: input.password,
        initialEmailVerified: Boolean(user.emailVerifiedAt),
        initialPhoneVerified: Boolean(user.phoneVerifiedAt),
      });
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <Text style={[typography.display, styles.heading]}>Create your{'\n'}ProBase account</Text>
      <Text style={typography.label}>Choose your account type</Text>
        <View style={styles.accountTypeRow}>
          {ACCOUNT_TYPES.map((option) => {
            const selected = values.accountType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.accountTypeOption, selected && styles.accountTypeOptionSelected]}
                onPress={() => setField('accountType', option.value)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={[styles.accountTypeIcon, selected && styles.accountTypeIconSelected]}>
                  <Ionicons
                    name={option.icon}
                    size={22}
                    color={selected ? colors.brand.gold : colors.brand.primaryNavy}
                  />
                </View>
                <View style={styles.accountTypeTextWrap}>
                  <Text style={typography.h3}>{option.label}</Text>
                  <Text style={typography.bodySmall}>{option.description}</Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.brand.gold} />
                ) : (
                  <View style={styles.accountTypeRadio} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TextField
          label="First name"
          value={values.firstName}
          onChangeText={(v) => setField('firstName', v)}
          error={errors.firstName}
          editable={!submitting}
        />
        <TextField
          label="Last name"
          value={values.lastName}
          onChangeText={(v) => setField('lastName', v)}
          error={errors.lastName}
          editable={!submitting}
        />

        {values.accountType === 'COMPANY' && (
          <TextField
            label="Company name"
            value={values.companyName}
            onChangeText={(v) => setField('companyName', v)}
            error={errors.companyName}
            editable={!submitting}
          />
        )}

        <TextField
          label="Email"
          value={values.email}
          onChangeText={(v) => setField('email', v)}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!submitting}
        />
        <TextField
          label="Phone"
          placeholder="+15551234567"
          value={values.phone}
          onChangeText={(v) => setField('phone', v)}
          error={errors.phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          editable={!submitting}
        />
        <TextField
          label="Password"
          value={values.password}
          onChangeText={(v) => setField('password', v)}
          error={errors.password}
          secureTextEntry
          editable={!submitting}
        />
        <TextField
          label="Confirm password"
          value={values.confirmPassword}
          onChangeText={(v) => setField('confirmPassword', v)}
          error={errors.confirmPassword}
          secureTextEntry
          editable={!submitting}
        />

        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setField('acceptedTerms', !values.acceptedTerms)}
          disabled={submitting}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: values.acceptedTerms }}
          accessibilityLabel="I accept the terms of service"
        >
          <View style={[styles.checkbox, values.acceptedTerms && styles.checkboxChecked]}>
            {values.acceptedTerms ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={typography.body}>I accept the terms of service.</Text>
        </TouchableOpacity>
        {errors.acceptedTerms ? <Text style={styles.fieldError}>{errors.acceptedTerms}</Text> : null}

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

        <Button
          label="Create Account"
          onPress={() => void onSubmit()}
          loading={submitting}
          disabled={submitting}
          style={styles.submitButton}
        />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: spacing.lg, marginBottom: spacing.lg },
  accountTypeRow: { gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.lg },
  accountTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.smd,
    backgroundColor: colors.surface,
    gap: spacing.smd,
  },
  accountTypeOptionSelected: { borderColor: colors.brand.gold, backgroundColor: colors.selectedTint },
  accountTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.control,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTypeIconSelected: { backgroundColor: colors.brand.deepNavy },
  accountTypeTextWrap: { flex: 1, gap: 2 },
  accountTypeRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.smd },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.control - 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.brand.primaryNavy, borderColor: colors.brand.primaryNavy },
  checkboxMark: { color: colors.text.inverse, fontSize: 14, fontWeight: '700' },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: spacing.xs },
  error: { color: colors.danger, marginTop: spacing.md, marginBottom: spacing.xs },
  submitButton: { marginTop: spacing.lg },
});
