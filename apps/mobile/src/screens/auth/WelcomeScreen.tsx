import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { Button } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

/**
 * The unauthenticated app's entry point (Milestone 6.1, restyled in
 * Milestone 7) — Welcome → Sign In / Create Account. Deliberately no
 * onboarding carousel: get the user into the app quickly.
 */
export function WelcomeScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Text style={styles.markText}>PB</Text>
        </View>
        <Text style={[typography.display, styles.title]}>ProBase</Text>
        <Text style={[typography.body, styles.subtitle]}>
          A secure private property database, CRM, and marketplace for real estate professionals
          and clients.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Create Account" onPress={() => navigation.navigate('CreateAccount')} />
        <Button label="Sign In" variant="secondary" onPress={() => navigation.navigate('SignIn')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.brand.primaryNavy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  markText: { fontSize: 22, fontWeight: '700', color: colors.text.inverse },
  title: { color: colors.brand.deepNavy, marginBottom: spacing.smd },
  subtitle: { color: colors.text.secondary, textAlign: 'center', paddingHorizontal: spacing.md },
  actions: { gap: spacing.smd, paddingBottom: spacing.xl },
});
