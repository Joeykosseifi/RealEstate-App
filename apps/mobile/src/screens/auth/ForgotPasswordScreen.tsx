import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestPasswordReset, resetPassword } from '../../api/auth';
import { ApiError } from '../../api/client';
import { validatePassword, validatePasswordConfirmation } from '../../auth/validation';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { AppScreen, Button, TextField } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

/**
 * Sign In → Forgot Password → request reset → complete reset → back to
 * Sign In (Milestone 6.1 spec §12, restyled Milestone 7). The backend's
 * reset mechanism is a token emailed as text (same pattern as email
 * verification — see docs/API.md "Authentication"), not a clickable
 * deep link, so this mirrors `VerificationScreen`'s paste-the-token UX.
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
      setError('Enter the reset code from your email.');
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
    <AppScreen>
      {step === 'request' ? (
          <>
            <Text style={[typography.body, styles.intro]}>
              Enter your account email and we&apos;ll send you a password reset code.
            </Text>
            <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!busy} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Send Reset Code" onPress={() => void onRequest()} loading={busy} disabled={!email.trim()} />
          </>
        ) : (
          <>
            {requestedNotice ? (
              <Text style={styles.success}>
                If an account exists for {email.trim()}, a reset code has been sent.
              </Text>
            ) : null}
            <Text style={[typography.body, styles.intro]}>
              Enter the code from your email and choose a new password.
            </Text>
            <TextField label="Reset code" value={token} onChangeText={setToken} autoCapitalize="none" editable={!busy} />
            <TextField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry editable={!busy} />
            <TextField
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!busy}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Reset Password" onPress={() => void onReset()} loading={busy} />
            <TouchableOpacity style={styles.footerLink} onPress={() => setStep('request')} disabled={busy}>
              <Text style={styles.linkText}>Use a different email</Text>
            </TouchableOpacity>
          </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.text.secondary, marginTop: spacing.xl, marginBottom: spacing.lg },
  error: { color: colors.danger, marginBottom: spacing.smd },
  success: { color: colors.success, marginTop: spacing.xl, marginBottom: spacing.sm },
  footerLink: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { color: colors.brand.primaryNavy, fontWeight: '600', fontSize: 14 },
});
