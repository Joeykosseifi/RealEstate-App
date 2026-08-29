import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { CreateAccountScreen } from '../screens/auth/CreateAccountScreen';
import { VerificationScreen } from '../screens/auth/VerificationScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  /**
   * Reached only from a fresh `CreateAccount` submission, before any
   * session exists — carries the just-registered credentials so
   * "Continue" can log the user in once both checks pass (see
   * `screens/auth/VerificationScreen`). The equivalent post-login resume
   * case (app reopened before verifying) is handled by `RootNavigator`
   * directly, outside this stack, since it needs an existing session.
   */
  Verification: {
    email: string;
    phone: string;
    password: string;
    initialEmailVerified: boolean;
    initialPhoneVerified: boolean;
  };
  ForgotPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * The unauthenticated entry flow (Milestone 6.1): Welcome → Sign In /
 * Create Account, with Create Account leading into Verification and
 * Sign In leading into Forgot Password. See docs/PRODUCT.md "Mobile
 * registration & onboarding".
 */
export function AuthStack(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Sign In' }} />
      <Stack.Screen
        name="CreateAccount"
        component={CreateAccountScreen}
        options={{ title: 'Create Account' }}
      />
      <Stack.Screen
        name="Verification"
        component={VerificationScreen}
        options={{ title: 'Verify Your Account', headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: 'Reset Password' }}
      />
    </Stack.Navigator>
  );
}
