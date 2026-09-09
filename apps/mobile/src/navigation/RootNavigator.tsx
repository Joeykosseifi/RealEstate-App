import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { VerificationForm } from '../screens/auth/VerificationScreen';
import { resolveRootRoute } from './resolveInitialRoute';
import { colors, spacing } from '../theme';

const LOADING_BAR_TRACK_WIDTH = 96;
const LOADING_BAR_FILL_WIDTH = 40;

/**
 * Understated indeterminate sweep — there is no real progress value to
 * report while the session is being restored (see `AuthContext.loadSession`),
 * so this never fabricates a percentage; it just loops a short gold bar
 * back and forth to read as "working," matching the approved splash
 * design's horizontal loading treatment in place of a spinner.
 */
function IndeterminateLoadingBar(): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-LOADING_BAR_FILL_WIDTH, LOADING_BAR_TRACK_WIDTH],
  });

  return (
    <View style={styles.loadingBarTrack}>
      <Animated.View style={[styles.loadingBarFill, { transform: [{ translateX }] }]} />
    </View>
  );
}

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
  const { status, user, refreshSession, logout, verificationSkipped, skipVerification } = useAuth();
  const route = resolveRootRoute({ status, accountStatus: user?.accountStatus, verificationSkipped });
  const insets = useSafeAreaInsets();

  if (route === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <View style={styles.loadingTopSpacer} />
        <View style={styles.loadingBrand}>
          <Ionicons name="business" size={76} color={colors.brand.gold} />
          <Text style={styles.loadingTitle}>ProBase</Text>
          <Text style={styles.loadingTagline}>Property. Organized.</Text>
        </View>
        <View style={styles.loadingBottomSpacer} />
        <View style={[styles.loadingBarWrap, { paddingBottom: insets.bottom + spacing.xl }]}>
          <IndeterminateLoadingBar />
        </View>
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
          onSkip={() => skipVerification(user.id)}
          onSignOut={() => void logout()}
        />
      ) : (
        <MainTabs />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  // A single full-bleed navy field — no nested card/panel with a lighter
  // background — so the color reaches every edge of the screen,
  // including behind the status bar and through the bottom safe area.
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.brand.deepNavy,
  },
  // Proportional (flex-ratio) rather than fixed-pixel spacers, so the
  // brand lockup lands around the same ~40% vertical position on any
  // iPhone screen height rather than being tuned to one preview size.
  loadingTopSpacer: { flex: 0.4 },
  loadingBottomSpacer: { flex: 0.6 },
  loadingBrand: { alignItems: 'center', paddingHorizontal: spacing.xl },
  loadingTitle: {
    color: colors.text.inverse,
    fontSize: 30,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  loadingTagline: {
    color: colors.brand.gold,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: spacing.xs,
  },
  loadingBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  loadingBarTrack: {
    width: LOADING_BAR_TRACK_WIDTH,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(201,148,47,0.25)',
    overflow: 'hidden',
  },
  loadingBarFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: LOADING_BAR_FILL_WIDTH,
    borderRadius: 1.5,
    backgroundColor: colors.brand.gold,
  },
});
