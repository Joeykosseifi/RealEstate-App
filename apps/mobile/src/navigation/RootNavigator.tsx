import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { VerificationForm } from '../screens/auth/VerificationScreen';
import { resolveRootRoute } from './resolveInitialRoute';
import { colors, spacing } from '../theme';

/**
 * Root of the navigation tree (Milestone 6.1). `resolveRootRoute` (a
 * pure, unit-tested function — see resolveInitialRoute.spec.ts) decides
 * between four states: restoring the session, the unauthenticated
 * `AuthStack` (Welcome → Sign In / Create Account), a still-
 * `PENDING_VERIFICATION` account that logged back in before finishing
 * verification, or the real role-aware app (`MainTabs`, unchanged from
 * Milestone 6).
 */
export function RootNavigator(): React.JSX.Element {
  const { status, user, refreshSession, logout } = useAuth();
  const route = resolveRootRoute({ status, accountStatus: user?.accountStatus });

  if (route === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <View style={styles.loadingMark}>
          <Ionicons name="business" size={32} color={colors.brand.gold} />
        </View>
        <Text style={styles.loadingTitle}>ProBase</Text>
        <Text style={styles.loadingTagline}>Property. Organized.</Text>
        <ActivityIndicator color={colors.brand.gold} style={styles.loadingSpinner} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {route === 'auth' ? (
        <AuthStack />
      ) : route === 'verification' && user ? (
        <VerificationForm
          email={user.email}
          phone={user.phone}
          initialEmailVerified={Boolean(user.emailVerifiedAt)}
          initialPhoneVerified={Boolean(user.phoneVerifiedAt)}
          onVerified={refreshSession}
          onSignOut={() => void logout()}
        />
      ) : (
        <MainTabs />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.deepNavy,
  },
  loadingMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  loadingTitle: { color: colors.text.inverse, fontSize: 26, fontWeight: '700' },
  loadingTagline: { color: colors.brand.gold, fontSize: 14, fontWeight: '700', marginTop: 2 },
  loadingSpinner: { marginTop: spacing.xl },
});
