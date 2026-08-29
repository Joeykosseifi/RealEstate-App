import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}

/** A compact explanation + next action — never a decorative full-screen illustration. */
export function EmptyState({ title, message, actionLabel, onAction, icon }: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[typography.h3, styles.title]}>{title}</Text>
      {message ? <Text style={[typography.bodySmall, styles.message]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} size="sm" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  icon: { fontSize: 32, marginBottom: spacing.sm },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', marginTop: spacing.xs, color: colors.text.secondary },
  action: { marginTop: spacing.lg },
});
