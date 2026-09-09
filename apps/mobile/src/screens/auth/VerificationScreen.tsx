import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { AppScreen, Button, Card, TextField } from '../../components/ui';
import { colors, linkText, spacing, typography } from '../../theme';

const RESEND_COOLDOWN_SECONDS = 45;

/** A simple client-side countdown — a UX nicety on top of the backend's own real rate limit (3 resends per 15 minutes), not a replacement for it. */
function useCooldown(): { remaining: number; start: () => void } {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  return { remaining, start: () => setRemaining(RESEND_COOLDOWN_SECONDS) };
}

export interface VerificationFormProps {
  email: string;
  phone: string;
  initialEmailVerified: boolean;
  initialPhoneVerified: boolean;
  /** Called once both checks pass; the caller decides what "continue" means (log in, or refresh an existing session). */
  onVerified: () => Promise<void>;
  /**
   * Called when the user chooses "Verify Later" — the account stays
   * exactly as verified/unverified as the backend says (never faked);
   * this only records a local, per-user "don't force this screen again"
   * preference (see AuthContext.skipVerification) and lets the caller
   * get the user into the app (logging in, if no session exists yet).
   */
  onSkip: () => Promise<void>;
  /** Only offered when there's a real way back — the post-registration path can return to Create Account; the post-login resume path can only sign out. */
  onBack?: () => void;
  onSignOut?: () => void;
}

/**
 * The shared UI for "Register → Verification required → Enter code →
 * Verified → Continue" (Milestone 6.1 spec §6, restyled Milestone 7).
 * Used two ways:
 *  - `VerificationScreen` below, reached from `CreateAccount` before any
 *    session exists (email/phone/onVerified=login come from route params).
 *  - `RootNavigator`, rendered directly (no navigation route) for a
 *    `PENDING_VERIFICATION` account that reopens the app or logs back in
 *    before finishing verification.
 * Both real checks (email token, phone OTP) hit the actual backend
 * verification endpoints — never bypassed or simulated. "Verify Later"
 * is the one exception to "must finish this screen": it's a pure
 * client-side navigation choice, never a backend verification state.
 */
export function VerificationForm({
  email,
  phone,
  initialEmailVerified,
  initialPhoneVerified,
  onVerified,
  onSkip,
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
  const [skipping, setSkipping] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailResent, setEmailResent] = useState(false);
  const [otpResent, setOtpResent] = useState(false);

  const emailCooldown = useCooldown();
  const phoneCooldown = useCooldown();

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
    if (emailBusy || emailCooldown.remaining > 0) return;
    setEmailBusy(true);
    setEmailError(null);
    setEmailResent(false);
    try {
      await resendEmailVerification(email);
      setEmailResent(true);
      emailCooldown.start();
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
    if (phoneBusy || phoneCooldown.remaining > 0) return;
    setPhoneBusy(true);
    setPhoneError(null);
    setOtpResent(false);
    try {
      await requestPhoneOtp(phone);
      setOtpResent(true);
      phoneCooldown.start();
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

  const onSkipPress = async () => {
    if (skipping || continuing) return;
    setSkipping(true);
    try {
      await onSkip();
    } catch (err) {
      setEmailError(errorMessage(err, 'Could not continue. Please try again.'));
    } finally {
      setSkipping(false);
    }
  };

  const bothVerified = emailVerified && phoneVerified;

  return (
    <AppScreen>
      <Text style={[typography.display, styles.intro]}>Verify your account</Text>
        <Text style={[typography.body, styles.introBody]}>
          Confirm your email and phone number to finish setting up your account.
        </Text>

        <Card style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={typography.h3}>Email</Text>
            {emailVerified ? <Text style={styles.verifiedBadge}>Verified ✓</Text> : null}
          </View>
          <Text style={typography.bodySmall}>{email}</Text>
          {!emailVerified && (
            <>
              <TextField
                label="Verification code"
                placeholder="Paste the code from your email"
                value={emailToken}
                onChangeText={setEmailToken}
                autoCapitalize="none"
                editable={!emailBusy}
              />
              {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
              {emailResent ? <Text style={styles.success}>Verification email resent.</Text> : null}
              <View style={styles.rowButtons}>
                <Button
                  label="Verify Email"
                  size="sm"
                  onPress={() => void onVerifyEmail()}
                  loading={emailBusy}
                  disabled={!emailToken.trim()}
                />
                <TouchableOpacity
                  onPress={() => void onResendEmail()}
                  disabled={emailBusy || emailCooldown.remaining > 0}
                  hitSlop={8}
                >
                  <Text style={[styles.linkText, emailCooldown.remaining > 0 && styles.linkTextDisabled]}>
                    {emailCooldown.remaining > 0 ? `Resend in ${emailCooldown.remaining}s` : 'Resend'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={typography.h3}>Phone</Text>
            {phoneVerified ? <Text style={styles.verifiedBadge}>Verified ✓</Text> : null}
          </View>
          <Text style={typography.bodySmall}>{phone}</Text>
          {!phoneVerified && (
            <>
              <TextField
                label="6-digit code"
                placeholder="000000"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                editable={!phoneBusy}
              />
              {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}
              {otpResent ? <Text style={styles.success}>Verification code resent.</Text> : null}
              <View style={styles.rowButtons}>
                <Button
                  label="Verify Phone"
                  size="sm"
                  onPress={() => void onVerifyOtp()}
                  loading={phoneBusy}
                  disabled={otp.trim().length !== 6}
                />
                <TouchableOpacity
                  onPress={() => void onResendOtp()}
                  disabled={phoneBusy || phoneCooldown.remaining > 0}
                  hitSlop={8}
                >
                  <Text style={[styles.linkText, phoneCooldown.remaining > 0 && styles.linkTextDisabled]}>
                    {phoneCooldown.remaining > 0 ? `Resend in ${phoneCooldown.remaining}s` : 'Resend'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Card>

        <Button
          label="Continue"
          onPress={() => void onContinue()}
          loading={continuing}
          disabled={!bothVerified}
          style={styles.continueButton}
        />

        {!bothVerified ? (
          <TouchableOpacity style={styles.footerLink} onPress={() => void onSkipPress()} disabled={skipping}>
            <Text style={styles.linkText}>{skipping ? 'Please wait…' : 'Verify Later'}</Text>
          </TouchableOpacity>
        ) : null}
        {onBack ? (
          <TouchableOpacity style={styles.footerLink} onPress={onBack} disabled={continuing}>
            <Text style={styles.linkText}>Back</Text>
          </TouchableOpacity>
        ) : null}
        {onSignOut ? (
          <TouchableOpacity style={styles.footerLink} onPress={onSignOut} disabled={continuing}>
            <Text style={styles.linkText}>Sign out</Text>
          </TouchableOpacity>
        ) : null}
    </AppScreen>
  );
}

type Props = NativeStackScreenProps<AuthStackParamList, 'Verification'>;

/** AuthStack wrapper: verification reached straight from a fresh registration, before any session exists. */
export function VerificationScreen({ route, navigation }: Props): React.JSX.Element {
  const { login, skipVerification } = useAuth();
  const { email, phone, password, initialEmailVerified, initialPhoneVerified } = route.params;

  return (
    <VerificationForm
      email={email}
      phone={phone}
      initialEmailVerified={initialEmailVerified}
      initialPhoneVerified={initialPhoneVerified}
      onVerified={() => login(email, password).then(() => undefined)}
      onSkip={async () => {
        // No session exists yet at this point (registration never
        // returns tokens) — log in first, exactly like "Continue" does,
        // then record the local "don't ask again yet" preference.
        const loggedInUser = await login(email, password);
        await skipVerification(loggedInUser.id);
      }}
      onBack={() => navigation.goBack()}
    />
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: spacing.xl, marginBottom: spacing.xs },
  introBody: { color: colors.text.secondary, marginBottom: spacing.lg },
  section: { marginBottom: spacing.md },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verifiedBadge: { color: colors.success, fontWeight: '700', fontSize: 13 },
  rowButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xs },
  linkText: linkText,
  linkTextDisabled: { color: colors.text.secondary },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.xs },
  success: { color: colors.success, fontSize: 13, marginBottom: spacing.xs },
  continueButton: { marginTop: spacing.sm },
  footerLink: { alignItems: 'center', marginTop: spacing.md },
});
