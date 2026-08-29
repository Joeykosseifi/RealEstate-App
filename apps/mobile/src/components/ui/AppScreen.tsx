import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, screenPadding } from '../../theme';

interface AppScreenProps extends PropsWithChildren {
  /** Plain View instead of ScrollView — for screens that manage their own FlatList/scrolling. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * Standard screen chrome (Milestone 7 design system) — the app
 * background color, consistent horizontal padding, and an optional
 * pull-to-refresh scroll container. Screens that need a FlatList/
 * SectionList render their own scrolling and pass `scroll={false}`.
 */
export function AppScreen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  padded = true,
  style,
  contentContainerStyle,
}: AppScreenProps): React.JSX.Element {
  if (!scroll) {
    return <View style={[styles.container, padded && styles.padded, style]}>{children}</View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={[styles.container, style]}
        contentContainerStyle={[padded && styles.padded, styles.scrollContent, contentContainerStyle]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={colors.brand.primaryNavy}
            />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  padded: { paddingHorizontal: screenPadding },
  scrollContent: { paddingBottom: 48 },
});
