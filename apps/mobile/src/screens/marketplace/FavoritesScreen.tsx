import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listFavorites } from '../../api/marketplace';
import type { MarketplaceFavoriteItem } from '../../api/types';
import type { FavoritesStackParamList } from '../../navigation/client/FavoritesStack';
import { ListingCard } from './ListingCard';

type Props = NativeStackScreenProps<FavoritesStackParamList, 'FavoritesList'>;

/**
 * Marketplace favorites — distinct from the professional CRM shortlist
 * (Milestone 4). A favorite whose listing has since become unavailable
 * shows a plain "no longer available" row rather than stale or leaked
 * data — see docs/PERMISSIONS.md "Favorite of an unpublished listing."
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

  if (loading) {
    return <ActivityIndicator style={styles.center} />;
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) =>
        item.listing ? (
          <ListingCard
            listing={item.listing}
            style={styles.card}
            onPress={() =>
              navigation.navigate('MarketplaceDetail', { publicationId: item.publicationId })
            }
          />
        ) : (
          <View style={styles.unavailableRow}>
            <Text style={styles.unavailableText}>This listing is no longer available.</Text>
          </View>
        )
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text>No favorites yet.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#c0392b' },
  listContent: { padding: 12 },
  card: { width: '100%', marginBottom: 12 },
  unavailableRow: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#f7f7f7',
  },
  unavailableText: { color: '#888' },
});
