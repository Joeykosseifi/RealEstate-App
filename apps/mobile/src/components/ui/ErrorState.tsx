import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { Button } from './Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

/**
 * A network/server failure — always distinguishable from an empty
 * database, and never a raw backend error string (see
 * docs/DESIGN_SYSTEM.md "Errors").
 */
export function ErrorState({ message, onRetry }: ErrorStateProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={[typography.h3, styles.title]}>Something went wrong</Text>
      <Text style={[typography.bodySmall, styles.message]}>
        {message ?? 'Please check your connection and try again.'}
      </Text>
      {onRetry ? <Button label="Retry" onPress={onRetry} size="sm" variant="secondary" style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  icon: { fontSize: 28, marginBottom: spacing.sm },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', marginTop: spacing.xs, color: colors.text.secondary },
  action: { marginTop: spacing.lg },
});
