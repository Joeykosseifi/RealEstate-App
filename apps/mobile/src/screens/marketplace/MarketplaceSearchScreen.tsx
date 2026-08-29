import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { searchMarketplace } from '../../api/marketplace';
import type { PublicPropertyListItem } from '../../api/types';
import type { SearchStackParamList } from '../../navigation/client/SearchStack';
import { ListingCard } from './ListingCard';

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

export function MarketplaceSearchScreen({ route, navigation }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [listingPurpose, setListingPurpose] = useState<'SALE' | 'RENT' | undefined>(
    route.params?.listingPurpose,
  );
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
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.search, styles.flex1]}
          placeholder="Search title, city, area…"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void load(1, true)}
        />
        {search !== '' && (
          <TouchableOpacity
            style={styles.clearSearchButton}
            onPress={() => setSearch('')}
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearSearchButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {PURPOSE_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.label}
            style={[styles.chip, listingPurpose === filter.value && styles.chipActive]}
            onPress={() => setListingPurpose(filter.value)}
          >
            <Text
              style={[styles.chipText, listingPurpose === filter.value && styles.chipTextActive]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.filterRow}>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.chip, sort === option.value && styles.chipActive]}
            onPress={() => setSort(option.value)}
          >
            <Text style={[styles.chipText, sort === option.value && styles.chipTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
        {hasActiveFilters && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.center} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
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
            <ListingCard
              listing={item}
              style={styles.gridCard}
              onPress={() =>
                navigation.navigate('MarketplaceDetail', { publicationId: item.publicationId })
              }
            />
          )}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footerLoading} /> : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>No listings match your search.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  searchRow: { flexDirection: 'row', alignItems: 'center', margin: 12, gap: 8 },
  flex1: { flex: 1 },
  search: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearSearchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchButtonText: { color: '#666', fontWeight: '600' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: '#1a73e8' },
  chipText: { color: '#333', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  clearFiltersButton: { paddingHorizontal: 4, paddingVertical: 6 },
  clearFiltersText: { color: '#c0392b', fontSize: 12, fontWeight: '600' },
  listContent: { padding: 12 },
  columnWrapper: { gap: 12, marginBottom: 12 },
  gridCard: { flex: 1, width: undefined },
  footerLoading: { marginVertical: 16 },
  error: { color: '#c0392b', textAlign: 'center', marginTop: 24 },
});
