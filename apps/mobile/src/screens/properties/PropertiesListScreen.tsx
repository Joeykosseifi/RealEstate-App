import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { listProperties } from '../../api/properties';
import type { PropertyBusinessStatus, PropertyListItem } from '../../api/types';
import type { PropertiesStackParamList } from '../../navigation/PropertiesStack';

type Props = NativeStackScreenProps<PropertiesStackParamList, 'PropertiesList'>;

const STATUS_FILTERS: { label: string; value: PropertyBusinessStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Available', value: 'AVAILABLE' },
  { label: 'Reserved', value: 'RESERVED' },
  { label: 'Sold', value: 'SOLD' },
  { label: 'Rented', value: 'RENTED' },
  { label: 'Off Market', value: 'OFF_MARKET' },
  { label: 'Archived', value: 'ARCHIVED' },
];

const PAGE_SIZE = 20;

function PropertyRow({ item, onPress }: { item: PropertyListItem; onPress: () => void }) {
  const archived = item.propertyStatus === 'ARCHIVED';
  return (
    <TouchableOpacity style={[styles.row, archived && styles.rowArchived]} onPress={onPress}>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowSubtitle}>
          {item.propertyType} · {item.listingPurpose} · {item.propertyStatus}
        </Text>
        <Text style={styles.rowPrice}>
          {item.currency} {item.price.toLocaleString()}
        </Text>
        {item.city ? (
          <Text style={styles.rowLocation}>
            {[item.city, item.area].filter(Boolean).join(', ')}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function PropertiesListScreen({ navigation }: Props): React.JSX.Element {
  const { currentWorkspace, permissions } = useAuth();
  const [items, setItems] = useState<PropertyListItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PropertyBusinessStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage: number, mode: 'initial' | 'refresh' | 'more') => {
      if (!currentWorkspace) return;
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'more') setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const response = await listProperties(currentWorkspace.id, {
          page: nextPage,
          search: search || undefined,
          propertyStatus: statusFilter,
        });
        setItems((current) => (mode === 'more' ? [...current, ...response.items] : response.items));
        setPage(nextPage);
        setTotalPages(response.meta.totalPages);
      } catch {
        setError('Could not load properties.');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [currentWorkspace, search, statusFilter],
  );

  useEffect(() => {
    void load(1, 'initial');
  }, [load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load(1, 'refresh'));
    return unsubscribe;
  }, [navigation, load]);

  const onEndReached = () => {
    if (!loadingMore && !loading && page < totalPages) {
      void load(page + 1, 'more');
    }
  };

  const hasActiveFilters = search !== '' || statusFilter !== undefined;

  if (!currentWorkspace) {
    return (
      <View style={styles.center}>
        <Text>No workspace available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchWrapper}>
          <TextInput
            style={styles.search}
            placeholder="Search title, city, area..."
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => void load(1, 'initial')}
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
        {permissions.has('property.create') && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddProperty')}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        horizontal
        style={styles.filters}
        showsHorizontalScrollIndicator={false}
        data={STATUS_FILTERS}
        keyExtractor={(filter) => filter.label}
        renderItem={({ item: filter }) => (
          <TouchableOpacity
            style={[styles.chip, statusFilter === filter.value && styles.chipActive]}
            onPress={() => setStatusFilter(filter.value)}
          >
            <Text style={[styles.chipText, statusFilter === filter.value && styles.chipTextActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          hasActiveFilters ? (
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={() => {
                setSearch('');
                setStatusFilter(undefined);
              }}
            >
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <ActivityIndicator style={styles.center} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void load(1, 'initial')}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(1, 'refresh')} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          renderItem={({ item }) => (
            <PropertyRow
              item={item}
              onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.id })}
            />
          )}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footerLoading} /> : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>
                {hasActiveFilters
                  ? 'No properties match your search.'
                  : 'No properties yet — add your first one.'}
              </Text>
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
  header: { flexDirection: 'row', padding: 12, gap: 8 },
  searchWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: {
    flex: 1,
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
  addButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  filters: { paddingHorizontal: 12, marginBottom: 4, flexGrow: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#1a73e8' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#fff' },
  clearFiltersButton: { justifyContent: 'center', paddingHorizontal: 4 },
  clearFiltersText: { color: '#c0392b', fontSize: 12, fontWeight: '600' },
  row: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0' },
  rowArchived: { opacity: 0.6, backgroundColor: '#fafafa' },
  rowContent: { gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: '#666', fontSize: 13 },
  rowPrice: { fontSize: 15, fontWeight: '500', marginTop: 2 },
  rowLocation: { color: '#888', fontSize: 13 },
  error: { color: '#c0392b', textAlign: 'center' },
  retryButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#eef4ff',
  },
  retryButtonText: { color: '#1a73e8', fontWeight: '600' },
  footerLoading: { marginVertical: 16 },
});
