import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../auth/AuthContext';
import type { AppStackParamList } from '../../navigation/AppStack';
import { colors } from '../../theme';
import { VerificationForm } from './VerificationScreen';

type Props = NativeStackScreenProps<AppStackParamList, 'VerifyAccount'>;

/**
 * The existing `VerificationForm` for an already-signed-in account.
 * Verification state only ever changes through the real verify
 * endpoints; on success the session is re-fetched so the app switches
 * from the public-only experience to the full workspace experience.
 * "Verify Later"/back simply close this screen.
 */
export function VerifyAccountScreen({ navigation }: Props): React.JSX.Element {
  const { user, refreshSession } = useAuth();

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {user ? (
        <VerificationForm
          email={user.email}
          phone={user.phone}
          initialEmailVerified={Boolean(user.emailVerifiedAt)}
          initialPhoneVerified={Boolean(user.phoneVerifiedAt)}
          onVerified={async () => {
            await refreshSession();
            close();
          }}
          onSkip={async () => close()}
          onBack={close}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
