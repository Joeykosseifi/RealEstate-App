import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { registerAgent, registerClient, registerCompany } from '../../api/auth';
import { ApiError } from '../../api/client';
import type { AccountType } from '../../api/types';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import {
  validateRegistrationForm,
  type RegistrationFormErrors,
  type RegistrationFormValues,
} from '../../auth/validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'CreateAccount'>;

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'CLIENT', label: 'Client' },
  { value: 'AGENT', label: 'Independent Agent' },
  { value: 'COMPANY', label: 'Real Estate Company' },
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
 * Real mobile registration (Milestone 6.1) using the existing backend —
 * `POST /auth/register/{client,agent,company}` (see docs/API.md
 * "Authentication"). No new frontend-only roles: the account-type picker
 * uses the exact backend `AccountType` enum, and each option calls its
 * matching endpoint directly rather than one endpoint with a role field.
 * Registration never returns a session (see docs/API.md "Registration →
 * activation flow") — a successful submission moves to `Verification`,
 * which is responsible for eventually signing the user in.
 */
export function CreateAccountScreen({ navigation }: Props): React.JSX.Element {
  const [values, setValues] = useState<RegistrationFormValues>(initialValues);
  const [errors, setErrors] = useState<RegistrationFormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
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
      if (err instanceof ApiError) {
        // Duplicate email/phone (409) and DTO validation failures (400)
        // both arrive here as a human-readable message already — see
        // docs/API.md "Authentication". Never a raw stack trace.
        setSubmitError(err.message);
      } else {
        setSubmitError('Could not reach the server. Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>I am a...</Text>
        <View style={styles.accountTypeRow}>
          {ACCOUNT_TYPES.map((option) => {
            const selected = values.accountType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.accountTypeOption, selected && styles.accountTypeOptionSelected]}
                onPress={() => setField('accountType', option.value)}
                disabled={submitting}
              >
                <Text
                  style={[
                    styles.accountTypeOptionText,
                    selected && styles.accountTypeOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          placeholder="First name"
          value={values.firstName}
          onChangeText={(v) => setField('firstName', v)}
          editable={!submitting}
        />
        {errors.firstName ? <Text style={styles.fieldError}>{errors.firstName}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Last name"
          value={values.lastName}
          onChangeText={(v) => setField('lastName', v)}
          editable={!submitting}
        />
        {errors.lastName ? <Text style={styles.fieldError}>{errors.lastName}</Text> : null}

        {values.accountType === 'COMPANY' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Company name"
              value={values.companyName}
              onChangeText={(v) => setField('companyName', v)}
              editable={!submitting}
            />
            {errors.companyName ? (
              <Text style={styles.fieldError}>{errors.companyName}</Text>
            ) : null}
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={values.email}
          onChangeText={(v) => setField('email', v)}
          editable={!submitting}
        />
        {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Phone (e.g. +15551234567)"
          autoComplete="tel"
          keyboardType="phone-pad"
          value={values.phone}
          onChangeText={(v) => setField('phone', v)}
          editable={!submitting}
        />
        {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}

        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            secureTextEntry={!showPassword}
            value={values.password}
            onChangeText={(v) => setField('password', v)}
            editable={!submitting}
          />
          <TouchableOpacity style={styles.toggleButton} onPress={() => setShowPassword((v) => !v)}>
            <Text style={styles.toggleButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          secureTextEntry={!showPassword}
          value={values.confirmPassword}
          onChangeText={(v) => setField('confirmPassword', v)}
          editable={!submitting}
        />
        {errors.confirmPassword ? (
          <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
        ) : null}

        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setField('acceptedTerms', !values.acceptedTerms)}
          disabled={submitting}
        >
          <View style={[styles.checkbox, values.acceptedTerms && styles.checkboxChecked]}>
            {values.acceptedTerms ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.termsText}>I accept the terms of service.</Text>
        </TouchableOpacity>
        {errors.acceptedTerms ? (
          <Text style={styles.fieldError}>{errors.acceptedTerms}</Text>
        ) : null}

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={() => void onSubmit()}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingBottom: 48 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },
  accountTypeRow: { gap: 8, marginBottom: 20 },
  accountTypeOption: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
  },
  accountTypeOptionSelected: { borderColor: '#1a73e8', backgroundColor: '#eef4ff' },
  accountTypeOptionText: { fontSize: 15, color: '#333' },
  accountTypeOptionTextSelected: { color: '#1a73e8', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
    fontSize: 16,
  },
  fieldError: { color: '#c0392b', fontSize: 12, marginBottom: 8 },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    marginBottom: 4,
  },
  passwordInput: { flex: 1, padding: 12, fontSize: 16 },
  toggleButton: { paddingHorizontal: 12 },
  toggleButtonText: { color: '#1a73e8', fontWeight: '600', fontSize: 13 },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 4, gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  termsText: { fontSize: 14, color: '#333', flexShrink: 1 },
  error: { color: '#c0392b', marginTop: 8, marginBottom: 4 },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
