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
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestPasswordReset, resetPassword } from '../../api/auth';
import { ApiError } from '../../api/client';
import { validatePassword, validatePasswordConfirmation } from '../../auth/validation';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

/**
 * Sign In → Forgot Password → request reset → complete reset → back to
 * Sign In (Milestone 6.1 spec §12). The backend's reset mechanism is a
 * token emailed as text (same pattern as email verification — see
 * docs/API.md "Authentication"), not a clickable deep link, so this
 * mirrors `VerificationScreen`'s paste-the-token UX rather than
 * inventing a weaker in-app-only reset.
 */
export function ForgotPasswordScreen({ navigation }: Props): React.JSX.Element {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestedNotice, setRequestedNotice] = useState(false);

  const onRequest = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      // Always resolves — the backend never reveals whether the email is
      // registered (see docs/API.md). We move to step 2 unconditionally.
      await requestPasswordReset(email.trim());
      setRequestedNotice(true);
      setStep('reset');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    if (busy) return;
    const passwordError = validatePassword(newPassword);
    const confirmError = validatePasswordConfirmation(newPassword, confirmPassword);
    if (!token.trim()) {
      setError('Enter the reset token from your email.');
      return;
    }
    if (passwordError || confirmError) {
      setError(passwordError ?? confirmError ?? null);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await resetPassword(token.trim(), newPassword);
      navigation.navigate('SignIn');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {step === 'request' ? (
          <>
            <Text style={styles.intro}>
              Enter your account email and we&apos;ll send you a password reset code.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, (!email.trim() || busy) && styles.buttonDisabled]}
              onPress={() => void onRequest()}
              disabled={!email.trim() || busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send Reset Code</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {requestedNotice ? (
              <Text style={styles.success}>
                If an account exists for {email.trim()}, a reset code has been sent.
              </Text>
            ) : null}
            <Text style={styles.intro}>
              Enter the code from your email and choose a new password.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Reset code"
              autoCapitalize="none"
              value={token}
              onChangeText={setToken}
              editable={!busy}
            />
            <TextInput
              style={styles.input}
              placeholder="New password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!busy}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!busy}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, busy && styles.buttonDisabled]}
              onPress={() => void onReset()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setStep('request')}
              disabled={busy}
            >
              <Text style={styles.linkButtonText}>Use a different email</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingBottom: 48 },
  intro: { fontSize: 15, color: '#444', marginBottom: 16, lineHeight: 21 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { marginTop: 16, alignItems: 'center' },
  linkButtonText: { color: '#1a73e8', fontWeight: '600', fontSize: 14 },
  error: { color: '#c0392b', marginBottom: 8 },
  success: { color: '#1a7f37', marginBottom: 12 },
});
