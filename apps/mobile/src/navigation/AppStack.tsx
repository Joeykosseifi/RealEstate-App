import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { VerifyAccountScreen } from '../screens/auth/VerifyAccountScreen';

export type AppStackParamList = {
  Main: undefined;
  /** The existing verification flow, reachable from anywhere in the signed-in app (Account, the verification-required prompt). */
  VerifyAccount: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStack(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="VerifyAccount"
        component={VerifyAccountScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
  );
}
