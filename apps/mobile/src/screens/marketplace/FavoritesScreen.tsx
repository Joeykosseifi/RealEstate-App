import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listFavorites } from '../../api/marketplace';
import type { MarketplaceFavoriteItem } from '../../api/types';
import type { FavoritesStackParamList } from '../../navigation/client/FavoritesStack';
import { ListingCard } from './ListingCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { colors, radii, screenPadding, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<FavoritesStackParamList, 'FavoritesList'>;

/**
 * Marketplace favorites (Milestone 7 spec §23) — reuses the same public
 * `ListingCard` as Home/Search. Distinct from the professional CRM
 * shortlist (Milestone 4). A favorite whose listing has since become
 * unavailable shows a plain "no longer available" row rather than stale
 * or leaked data.
 */
export function FavoritesScreen({ navigation }: Props): React.JSX.Element {
  const [items, setItems] = useState<MarketplaceFavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await listFavorites();
      setItems(response.items);
    } catch {
      setError('Could not load favorites.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) =>
        item.listing ? (
          <ListingCard listing={item.listing} style={styles.card} onPress={() => navigation.navigate('MarketplaceDetail', { publicationId: item.publicationId })} />
        ) : (
          <View style={styles.unavailableRow}>
            <Text style={typography.bodySmall}>This listing is no longer available.</Text>
          </View>
        )
      }
      ListEmptyComponent={<EmptyState icon="⭐" title="You haven't saved any properties yet." message="Browse the marketplace to find properties you like." />}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { padding: screenPadding },
  card: { width: '100%', marginBottom: spacing.smd },
  unavailableRow: {
    padding: spacing.md,
    marginBottom: spacing.smd,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
