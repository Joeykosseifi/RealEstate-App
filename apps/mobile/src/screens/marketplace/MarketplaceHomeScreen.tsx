import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { searchMarketplace } from '../../api/marketplace';
import type { PublicPropertyListItem } from '../../api/types';
import type { HomeStackParamList } from '../../navigation/client/HomeStack';
import { ListingCard } from './ListingCard';

type Props = NativeStackScreenProps<HomeStackParamList, 'MarketplaceHome'>;

function ListingRail({
  title,
  items,
  loading,
  onPressListing,
}: {
  title: string;
  items: PublicPropertyListItem[];
  loading: boolean;
  onPressListing: (publicationId: string) => void;
}) {
  return (
    <View style={styles.railSection}>
      <Text style={styles.railTitle}>{title}</Text>
      {loading ? (
        <ActivityIndicator style={styles.railLoading} />
      ) : items.length === 0 ? (
        <Text style={styles.emptyText}>Nothing here yet.</Text>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={items}
          keyExtractor={(item) => item.publicationId}
          contentContainerStyle={styles.railContent}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => onPressListing(item.publicationId)}
              style={styles.railCard}
            />
          )}
        />
      )}
    </View>
  );
}

/**
 * The client Home experience — replaces the Milestone 3 placeholder now
 * that the marketplace has real listings. Deterministic sections only
 * (newest, for sale, for rent) — no recommendation AI, per spec.
 */
export function MarketplaceHomeScreen({ navigation }: Props): React.JSX.Element {
  const [newest, setNewest] = useState<PublicPropertyListItem[]>([]);
  const [forSale, setForSale] = useState<PublicPropertyListItem[]>([]);
  const [forRent, setForRent] = useState<PublicPropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [newestRes, saleRes, rentRes] = await Promise.all([
        searchMarketplace({ sort: 'newest', pageSize: 10 }),
        searchMarketplace({ listingPurpose: 'SALE', sort: 'newest', pageSize: 10 }),
        searchMarketplace({ listingPurpose: 'RENT', sort: 'newest', pageSize: 10 }),
      ]);
      setNewest(newestRes.items);
      setForSale(saleRes.items);
      setForRent(rentRes.items);
    } catch {
      setError('Could not load the marketplace.');
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

  const goToDetail = (publicationId: string) =>
    navigation.navigate('MarketplaceDetail', { publicationId });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marketplace</Text>
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={[{ key: 'sections' }]}
          keyExtractor={(item) => item.key}
          renderItem={() => (
            <>
              <ListingRail
                title="New Listings"
                items={newest}
                loading={loading}
                onPressListing={goToDetail}
              />
              <ListingRail
                title="For Sale"
                items={forSale}
                loading={loading}
                onPressListing={goToDetail}
              />
              <ListingRail
                title="For Rent"
                items={forRent}
                loading={loading}
                onPressListing={goToDetail}
              />
            </>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  railSection: { marginBottom: 20 },
  railTitle: { fontSize: 16, fontWeight: '600', marginHorizontal: 16, marginBottom: 10 },
  railContent: { paddingHorizontal: 16, gap: 12 },
  railCard: { marginRight: 12 },
  railLoading: { marginTop: 12 },
  emptyText: { color: '#888', marginHorizontal: 16 },
  error: { color: '#c0392b', textAlign: 'center', marginTop: 24 },
});
