import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { AppScreen, Button, TextField } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

/**
 * Sign-in screen (Milestone 6.1, restyled in Milestone 7 — see
 * docs/DESIGN_SYSTEM.md). The backend's `login` returns one generic
 * "Invalid email or password" message for every failure mode — unknown
 * email, wrong password, suspended, deactivated (see docs/API.md
 * "Authentication") — so this screen shows it verbatim.
 */
export function SignInScreen({ navigation }: Props): React.JSX.Element {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  return (
    <AppScreen>
      <Text style={[typography.display, styles.title]}>Welcome back</Text>

        <TextField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!submitting}
        />
        <TextField
          label="Password"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          editable={!submitting}
        />

        <TouchableOpacity
          style={styles.forgotLink}
          onPress={() => navigation.navigate('ForgotPassword')}
          disabled={submitting}
        >
          <Text style={styles.forgotLinkText}>Forgot password?</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Sign In" onPress={() => void onSubmit()} loading={submitting} disabled={!canSubmit} />

        <View style={styles.createAccountLink}>
          <TouchableOpacity onPress={() => navigation.navigate('CreateAccount')} disabled={submitting}>
            <Text style={typography.bodySmall}>
              Don&apos;t have an account?{' '}
              <Text style={styles.createAccountLinkBold}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.xl, marginTop: spacing.xl },
  forgotLink: { alignSelf: 'flex-end', marginBottom: spacing.md },
  forgotLinkText: { color: colors.brand.primaryNavy, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, marginBottom: spacing.smd, fontSize: 13 },
  createAccountLink: { marginTop: spacing.xl, alignItems: 'center' },
  createAccountLinkBold: { color: colors.brand.primaryNavy, fontWeight: '700' },
});
