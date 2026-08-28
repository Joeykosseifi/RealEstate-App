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
import type { MarketplaceStackParamList } from '../../navigation/MarketplaceStack';
import { ListingCard } from './ListingCard';

type Props = NativeStackScreenProps<MarketplaceStackParamList, 'MarketplaceSearch'>;

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

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search title, city, area…"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => void load(1, true)}
      />

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
  search: {
    margin: 12,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: '#1a73e8' },
  chipText: { color: '#333', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  listContent: { padding: 12 },
  columnWrapper: { gap: 12, marginBottom: 12 },
  gridCard: { flex: 1, width: undefined },
  footerLoading: { marginVertical: 16 },
  error: { color: '#c0392b', textAlign: 'center', marginTop: 24 },
});
