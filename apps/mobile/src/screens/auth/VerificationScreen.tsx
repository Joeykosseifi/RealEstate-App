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
import {
  requestPhoneOtp,
  resendEmailVerification,
  verifyEmail,
  verifyPhoneOtp,
} from '../../api/auth';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import type { AuthStackParamList } from '../../navigation/AuthStack';

export interface VerificationFormProps {
  email: string;
  phone: string;
  initialEmailVerified: boolean;
  initialPhoneVerified: boolean;
  /** Called once both checks pass; the caller decides what "continue" means (log in, or refresh an existing session). */
  onVerified: () => Promise<void>;
  /** Only offered when there's a real way back — the post-registration path can return to Create Account; the post-login resume path can only sign out. */
  onBack?: () => void;
  onSignOut?: () => void;
}

/**
 * The shared UI for "Register → Verification required → Enter code →
 * Verified → Continue" (Milestone 6.1 spec §6). Used two ways:
 *  - `VerificationScreen` below, reached from `CreateAccount` before any
 *    session exists (email/phone/onVerified=login come from route params).
 *  - `RootNavigator`, rendered directly (no navigation route) for a
 *    `PENDING_VERIFICATION` account that reopens the app or logs back in
 *    before finishing verification — see docs/API.md "Registration →
 *    activation flow" ("PENDING_VERIFICATION accounts can already log in").
 * Both real checks (email token, phone OTP) hit the actual backend
 * verification endpoints — never bypassed or simulated.
 */
export function VerificationForm({
  email,
  phone,
  initialEmailVerified,
  initialPhoneVerified,
  onVerified,
  onBack,
  onSignOut,
}: VerificationFormProps): React.JSX.Element {
  const [emailVerified, setEmailVerified] = useState(initialEmailVerified);
  const [phoneVerified, setPhoneVerified] = useState(initialPhoneVerified);
  const [emailToken, setEmailToken] = useState('');
  const [otp, setOtp] = useState('');

  const [emailBusy, setEmailBusy] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailResent, setEmailResent] = useState(false);
  const [otpResent, setOtpResent] = useState(false);

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof ApiError ? err.message : fallback;

  const onVerifyEmail = async () => {
    if (emailBusy || !emailToken.trim()) return;
    setEmailBusy(true);
    setEmailError(null);
    try {
      await verifyEmail(emailToken.trim());
      setEmailVerified(true);
    } catch (err) {
      setEmailError(errorMessage(err, 'Could not verify your email. Check your connection.'));
    } finally {
      setEmailBusy(false);
    }
  };

  const onResendEmail = async () => {
    if (emailBusy) return;
    setEmailBusy(true);
    setEmailError(null);
    setEmailResent(false);
    try {
      await resendEmailVerification(email);
      setEmailResent(true);
    } catch (err) {
      setEmailError(errorMessage(err, 'Could not resend the verification email.'));
    } finally {
      setEmailBusy(false);
    }
  };

  const onVerifyOtp = async () => {
    if (phoneBusy || otp.trim().length !== 6) return;
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      await verifyPhoneOtp(phone, otp.trim());
      setPhoneVerified(true);
    } catch (err) {
      setPhoneError(errorMessage(err, 'Could not verify your phone. Check your connection.'));
    } finally {
      setPhoneBusy(false);
    }
  };

  const onResendOtp = async () => {
    if (phoneBusy) return;
    setPhoneBusy(true);
    setPhoneError(null);
    setOtpResent(false);
    try {
      await requestPhoneOtp(phone);
      setOtpResent(true);
    } catch (err) {
      setPhoneError(errorMessage(err, 'Could not resend the verification code.'));
    } finally {
      setPhoneBusy(false);
    }
  };

  const onContinue = async () => {
    if (continuing) return;
    setContinuing(true);
    try {
      await onVerified();
    } catch (err) {
      setEmailError(errorMessage(err, 'Could not continue. Please try again.'));
    } finally {
      setContinuing(false);
    }
  };

  const bothVerified = emailVerified && phoneVerified;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Verify your email and phone number to finish setting up your account.
        </Text>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Email — {email}</Text>
            {emailVerified ? <Text style={styles.verifiedBadge}>Verified ✓</Text> : null}
          </View>
          {!emailVerified && (
            <>
              <Text style={styles.hint}>Enter the verification code we emailed you.</Text>
              <TextInput
                style={styles.input}
                placeholder="Verification token"
                autoCapitalize="none"
                value={emailToken}
                onChangeText={setEmailToken}
                editable={!emailBusy}
              />
              {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
              {emailResent ? <Text style={styles.success}>Verification email resent.</Text> : null}
              <View style={styles.rowButtons}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    (!emailToken.trim() || emailBusy) && styles.buttonDisabled,
                  ]}
                  onPress={() => void onVerifyEmail()}
                  disabled={!emailToken.trim() || emailBusy}
                >
                  {emailBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify Email</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => void onResendEmail()}
                  disabled={emailBusy}
                >
                  <Text style={styles.linkButtonText}>Resend</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Phone — {phone}</Text>
            {phoneVerified ? <Text style={styles.verifiedBadge}>Verified ✓</Text> : null}
          </View>
          {!phoneVerified && (
            <>
              <Text style={styles.hint}>Enter the 6-digit code we texted you.</Text>
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                editable={!phoneBusy}
              />
              {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}
              {otpResent ? <Text style={styles.success}>Verification code resent.</Text> : null}
              <View style={styles.rowButtons}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    (otp.trim().length !== 6 || phoneBusy) && styles.buttonDisabled,
                  ]}
                  onPress={() => void onVerifyOtp()}
                  disabled={otp.trim().length !== 6 || phoneBusy}
                >
                  {phoneBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify Phone</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => void onResendOtp()}
                  disabled={phoneBusy}
                >
                  <Text style={styles.linkButtonText}>Resend</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, !bothVerified && styles.buttonDisabled]}
          onPress={() => void onContinue()}
          disabled={!bothVerified || continuing}
        >
          {continuing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        {onBack ? (
          <TouchableOpacity style={styles.linkButton} onPress={onBack} disabled={continuing}>
            <Text style={styles.linkButtonText}>Back</Text>
          </TouchableOpacity>
        ) : null}
        {onSignOut ? (
          <TouchableOpacity style={styles.linkButton} onPress={onSignOut} disabled={continuing}>
            <Text style={styles.linkButtonText}>Sign out</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type Props = NativeStackScreenProps<AuthStackParamList, 'Verification'>;

/** AuthStack wrapper: verification reached straight from a fresh registration, before any session exists. */
export function VerificationScreen({ route, navigation }: Props): React.JSX.Element {
  const { login } = useAuth();
  const { email, phone, password, initialEmailVerified, initialPhoneVerified } = route.params;

  return (
    <VerificationForm
      email={email}
      phone={phone}
      initialEmailVerified={initialEmailVerified}
      initialPhoneVerified={initialPhoneVerified}
      onVerified={() => login(email, password)}
      onBack={() => navigation.goBack()}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingBottom: 48 },
  intro: { fontSize: 15, color: '#444', marginBottom: 24, lineHeight: 21 },
  section: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  verifiedBadge: { color: '#1a7f37', fontWeight: '600', fontSize: 13 },
  hint: { color: '#888', fontSize: 13, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  rowButtons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  linkButton: { paddingVertical: 8, alignItems: 'center' },
  linkButtonText: { color: '#1a73e8', fontWeight: '600', fontSize: 14 },
  continueButton: {
    backgroundColor: '#1a7f37',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  error: { color: '#c0392b', fontSize: 13, marginBottom: 8 },
  success: { color: '#1a7f37', fontSize: 13, marginBottom: 8 },
});
