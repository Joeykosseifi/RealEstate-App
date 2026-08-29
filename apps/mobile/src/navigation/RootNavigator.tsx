import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { VerificationForm } from '../screens/auth/VerificationScreen';
import { resolveRootRoute } from './resolveInitialRoute';

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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
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
