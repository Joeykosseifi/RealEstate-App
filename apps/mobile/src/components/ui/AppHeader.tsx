import { StyleSheet, Text, View } from 'react-native';
import { colors, screenPadding, spacing, typography } from '../../theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

/** Major page title header — used at the top of a tab's root screen (not inside a native-stack header). */
export function AppHeader({ title, subtitle, right }: AppHeaderProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={typography.display}>{title}</Text>
        {subtitle ? <Text style={[typography.bodySmall, styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  textCol: { flexShrink: 1 },
  subtitle: { marginTop: spacing.xs, color: colors.text.secondary },
});
