import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

/**
 * The unauthenticated app's entry point (Milestone 6.1) — Welcome →
 * Sign In / Create Account. Kept functional and plain; the full visual
 * design system is a later milestone (see the M6.1 spec).
 */
export function WelcomeScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>Real Estate Platform</Text>
        <Text style={styles.subtitle}>
          Browse the marketplace as a client, or manage your own property business as an agent or
          company.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('CreateAccount')}
        >
          <Text style={styles.primaryButtonText}>Create Account</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('SignIn')}
        >
          <Text style={styles.secondaryButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'space-between',
  },
  hero: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  actions: { gap: 12, paddingBottom: 24 },
  primaryButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1a73e8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#1a73e8', fontSize: 16, fontWeight: '600' },
});
