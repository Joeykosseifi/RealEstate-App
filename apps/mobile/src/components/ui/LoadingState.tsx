import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../../theme';

/** Full-area spinner — used only where a skeleton isn't practical (e.g. a first paint before any shape is known). */
export function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brand.primaryNavy} />
    </View>
  );
}

/** A skeleton the shape of a `PropertyCard`/list row — used while a real list loads, instead of a blank screen or bare spinner. */
export function SkeletonCard(): React.JSX.Element {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonLine, { width: '60%' }]} />
        <View style={[styles.skeletonLine, { width: '40%', marginTop: spacing.sm }]} />
        <View style={[styles.skeletonLine, { width: '80%', marginTop: spacing.sm }]} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }): React.JSX.Element {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  skeletonCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.smd,
  },
  skeletonImage: {
    width: 72,
    height: 72,
    borderRadius: radii.control,
    backgroundColor: colors.border,
  },
  skeletonBody: { flex: 1, marginLeft: spacing.md, justifyContent: 'center' },
  skeletonLine: { height: 10, borderRadius: 4, backgroundColor: colors.border },
});
