import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { searchMarketplace } from '../../api/marketplace';
import type { PublicPropertyListItem } from '../../api/types';
import type { HomeStackParamList } from '../../navigation/client/HomeStack';
import type { ClientTabParamList } from '../../navigation/client/ClientTabs';
import { ListingCard } from './ListingCard';
import { ErrorState, SearchInput, SkeletonList } from '../../components/ui';
import { colors, radii, screenPadding, spacing, typography } from '../../theme';

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
        <View style={styles.railSkeletonRow}>
          <View style={styles.railSkeletonCard} />
          <View style={styles.railSkeletonCard} />
        </View>
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
            <ListingCard listing={item} onPress={() => onPressListing(item.publicationId)} style={styles.railCard} />
          )}
        />
      )}
    </View>
  );
}

/**
 * The client Home experience (Milestone 7 spec §20) — "Find your perfect
 * property," prominent search, Buy/Rent shortcuts, and deterministic
 * sections only (newest, for sale, for rent) — no recommendation AI.
 * Source of truth remains approved publication snapshots exclusively.
 */
export function MarketplaceHomeScreen({ navigation }: Props): React.JSX.Element {
  const tabNavigation = useNavigation<NavigationProp<ClientTabParamList>>();
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

  const goToDetail = (publicationId: string) => navigation.navigate('MarketplaceDetail', { publicationId });
  const goToSearch = (listingPurpose?: 'SALE' | 'RENT') =>
    tabNavigation.navigate('Search', { screen: 'MarketplaceSearch', params: { listingPurpose } });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={typography.display}>Find your perfect property</Text>
        <TouchableOpacity onPress={() => goToSearch()} accessibilityRole="button">
          <View pointerEvents="none">
            <SearchInput value="" onChangeText={() => {}} placeholder="Search by title, city, or area" />
          </View>
        </TouchableOpacity>
        <View style={styles.purposeRow}>
          <TouchableOpacity style={styles.purposeButton} onPress={() => goToSearch('SALE')}>
            <Text style={styles.purposeButtonText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.purposeButton} onPress={() => goToSearch('RENT')}>
            <Text style={styles.purposeButtonText}>Rent</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <FlatList
          data={[{ key: 'sections' }]}
          keyExtractor={(item) => item.key}
          renderItem={() => (
            <>
              <ListingRail title="New Listings" items={newest} loading={loading} onPressListing={goToDetail} />
              <ListingRail title="For Sale" items={forSale} loading={loading} onPressListing={goToDetail} />
              <ListingRail title="For Rent" items={forRent} loading={loading} onPressListing={goToDetail} />
            </>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: screenPadding, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.smd },
  purposeRow: { flexDirection: 'row', gap: spacing.sm },
  purposeButton: {
    flex: 1,
    backgroundColor: colors.brand.primaryNavy,
    borderRadius: radii.button,
    paddingVertical: spacing.smd,
    alignItems: 'center',
  },
  purposeButtonText: { color: colors.text.inverse, fontWeight: '700' },
  railSection: { marginBottom: spacing.xl },
  railTitle: { ...typography.h2, marginHorizontal: screenPadding, marginBottom: spacing.smd },
  railContent: { paddingHorizontal: screenPadding, gap: spacing.smd },
  railCard: { marginRight: spacing.smd },
  railSkeletonRow: { flexDirection: 'row', gap: spacing.smd, paddingHorizontal: screenPadding },
  railSkeletonCard: { width: 230, height: 220, borderRadius: radii.cardLarge, backgroundColor: colors.border },
  emptyText: { color: colors.text.secondary, marginHorizontal: screenPadding },
});
