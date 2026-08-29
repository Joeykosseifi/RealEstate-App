import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { searchMarketplace } from '../../api/marketplace';
import type { PublicPropertyListItem } from '../../api/types';
import type { SearchStackParamList } from '../../navigation/client/SearchStack';
import { ListingCard } from './ListingCard';
import { EmptyState, ErrorState, FilterChip, SearchInput, SkeletonList } from '../../components/ui';
import { colors, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<SearchStackParamList, 'MarketplaceSearch'>;

const PURPOSE_FILTERS: { label: string; value: 'SALE' | 'RENT' | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'For Sale', value: 'SALE' },
  { label: 'For Rent', value: 'RENT' },
];

const SORT_OPTIONS: { label: string; value: 'newest' | 'price_asc' | 'price_desc' }[] = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
];

const PAGE_SIZE = 20;

/** Client search (Milestone 7 spec §21) — active filters always visible, easy to clear, compact 2-column results. */
export function MarketplaceSearchScreen({ route, navigation }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [listingPurpose, setListingPurpose] = useState<'SALE' | 'RENT' | undefined>(route.params?.listingPurpose);
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [items, setItems] = useState<PublicPropertyListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const response = await searchMarketplace({
          page: nextPage,
          pageSize: PAGE_SIZE,
          search: search || undefined,
          listingPurpose,
          sort,
        });
        setItems((current) => (replace ? response.items : [...current, ...response.items]));
        setTotalPages(response.meta.totalPages);
        setPage(nextPage);
      } catch {
        setError('Could not load listings.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, listingPurpose, sort],
  );

  useEffect(() => {
    void load(1, true);
  }, [load]);

  const onEndReached = () => {
    if (!loadingMore && page < totalPages) {
      void load(page + 1, false);
    }
  };

  const hasActiveFilters = search !== '' || listingPurpose !== undefined || sort !== 'newest';
  const clearFilters = () => {
    setSearch('');
    setListingPurpose(undefined);
    setSort('newest');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SearchInput value={search} onChangeText={setSearch} placeholder="Search title, city, area…" onSubmit={() => void load(1, true)} />

        <View style={styles.filterRow}>
          {PURPOSE_FILTERS.map((filter) => (
            <FilterChip key={filter.label} label={filter.label} selected={listingPurpose === filter.value} onPress={() => setListingPurpose(filter.value)} />
          ))}
        </View>
        <View style={styles.filterRow}>
          {SORT_OPTIONS.map((option) => (
            <FilterChip key={option.value} label={option.label} selected={sort === option.value} onPress={() => setSort(option.value)} />
          ))}
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.listPadding}>
          <SkeletonList />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load(1, true)} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.publicationId}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          renderItem={({ item }) => (
            <ListingCard listing={item} style={styles.gridCard} onPress={() => navigation.navigate('MarketplaceDetail', { publicationId: item.publicationId })} />
          )}
          ListFooterComponent={loadingMore ? <SkeletonList count={2} /> : null}
          ListEmptyComponent={<EmptyState icon="🔍" title="No listings match your search." message="Try adjusting or clearing your filters." />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: screenPadding, paddingTop: spacing.md },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.smd, alignItems: 'center' },
  clearFiltersButton: { paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  clearFiltersText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  listPadding: { paddingHorizontal: screenPadding },
  listContent: { padding: screenPadding },
  columnWrapper: { gap: spacing.smd, marginBottom: spacing.smd },
  gridCard: { flex: 1, width: undefined },
});
