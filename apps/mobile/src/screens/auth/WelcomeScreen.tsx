import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { Button } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

/**
 * The unauthenticated app's entry point (Milestone 6.1, restyled in
 * Milestone 7 and again in the ProBase visual-parity pass) — Welcome →
 * Sign In / Create Account. Deliberately no onboarding carousel: get the
 * user into the app quickly (see docs/PRODUCT.md).
 */
export function WelcomeScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Ionicons name="business" size={36} color={colors.brand.gold} />
        </View>
        <Text style={[typography.display, styles.title]}>ProBase</Text>
        <Text style={styles.tagline}>Property. Organized.</Text>
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
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.brand.deepNavy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { color: colors.brand.deepNavy },
  tagline: { color: colors.brand.gold, fontSize: 15, fontWeight: '700', marginTop: 2, marginBottom: spacing.smd },
  subtitle: { color: colors.text.secondary, textAlign: 'center', paddingHorizontal: spacing.md },
  actions: { gap: spacing.smd, paddingBottom: spacing.xl },
});
