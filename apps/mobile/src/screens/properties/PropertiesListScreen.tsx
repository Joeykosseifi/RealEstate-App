import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { listProperties, type PublicationFilter } from '../../api/properties';
import type { PropertyBusinessStatus, PropertyListItem } from '../../api/types';
import type { PropertiesStackParamList } from '../../navigation/PropertiesStack';
import {
  ActionSheet,
  EmptyState,
  ErrorState,
  FilterChip,
  PropertyCard,
  SearchInput,
  SkeletonList,
} from '../../components/ui';
import { colors, radii, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<PropertiesStackParamList, 'PropertiesList'>;

const PRIMARY_FILTERS: { label: string; value: PublicationFilter | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Private', value: 'PRIVATE' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Pending', value: 'PENDING_REVIEW' },
];

const BUSINESS_STATUS_OPTIONS: { label: string; value: PropertyBusinessStatus | undefined }[] = [
  { label: 'All business statuses', value: undefined },
  { label: 'Available', value: 'AVAILABLE' },
  { label: 'Reserved', value: 'RESERVED' },
  { label: 'Sold', value: 'SOLD' },
  { label: 'Rented', value: 'RENTED' },
  { label: 'Off Market', value: 'OFF_MARKET' },
];

/**
 * The private property database (Milestone 7 spec §14 — a "CRITICAL
 * SCREEN"). Primary filter chips are publication lifecycle (All/
 * Private/Published/Pending), matching what an agent actually scans
 * for; business status and Archived move to a secondary "Filters"
 * sheet so the main view stays uncluttered. See docs/PRODUCT.md
 * "Properties database".
 */
export function PropertiesListScreen({ navigation }: Props): React.JSX.Element {
  const { currentWorkspace, permissions } = useAuth();
  const [items, setItems] = useState<PropertyListItem[]>([]);
  const [search, setSearch] = useState('');
  const [publicationFilter, setPublicationFilter] = useState<PublicationFilter | undefined>(undefined);
  const [businessStatus, setBusinessStatus] = useState<PropertyBusinessStatus | undefined>(undefined);
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
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
          publicationFilter,
          propertyStatus: archivedOnly ? 'ARCHIVED' : businessStatus,
          includeArchived: archivedOnly,
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
    [currentWorkspace, search, publicationFilter, businessStatus, archivedOnly],
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

  const hasActiveFilters =
    search !== '' || publicationFilter !== undefined || businessStatus !== undefined || archivedOnly;

  const clearFilters = () => {
    setSearch('');
    setPublicationFilter(undefined);
    setBusinessStatus(undefined);
    setArchivedOnly(false);
  };

  if (!currentWorkspace) {
    return (
      <View style={styles.container}>
        <ErrorState message="No workspace available." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={styles.searchInput}>
            <SearchInput value={search} onChangeText={setSearch} placeholder="Search title, city, area..." />
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Advanced filters"
          >
            <Ionicons name="options-outline" size={20} color={colors.brand.primaryNavy} />
            {archivedOnly || businessStatus ? <View style={styles.filterDot} /> : null}
          </TouchableOpacity>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={PRIMARY_FILTERS}
          keyExtractor={(filter) => filter.label}
          style={styles.chipsRow}
          renderItem={({ item: filter }) => (
            <FilterChip
              label={filter.label}
              selected={publicationFilter === filter.value && !archivedOnly}
              onPress={() => {
                setPublicationFilter(filter.value);
                setArchivedOnly(false);
              }}
            />
          )}
        />

        {hasActiveFilters ? (
          <TouchableOpacity onPress={clearFilters} style={styles.clearRow}>
            <Text style={styles.clearText}>Clear filters</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.listPadding}>
          <SkeletonList />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load(1, 'initial')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => void load(1, 'refresh')}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          renderItem={({ item }) => (
            <PropertyCard
              property={item}
              publicationStatus={item.publicationStatus}
              imageUrl={null}
              onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.id })}
            />
          )}
          ListFooterComponent={loadingMore ? <SkeletonList count={1} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="🏠"
              title={hasActiveFilters ? 'No properties match your filters.' : 'Your property database is empty.'}
              message={hasActiveFilters ? undefined : 'Add your first property to get started.'}
              actionLabel={
                !hasActiveFilters && permissions.has('property.create') ? 'Add Property' : undefined
              }
              onAction={
                !hasActiveFilters && permissions.has('property.create')
                  ? () => navigation.navigate('AddProperty')
                  : undefined
              }
            />
          }
        />
      )}

      <ActionSheet
        visible={filterSheetOpen}
        title="Business status"
        onClose={() => setFilterSheetOpen(false)}
        items={[
          ...BUSINESS_STATUS_OPTIONS.map((option) => ({
            label: option.label,
            onPress: () => {
              setBusinessStatus(option.value);
              setArchivedOnly(false);
            },
          })),
          {
            label: 'Archived properties',
            onPress: () => {
              setArchivedOnly(true);
              setPublicationFilter(undefined);
              setBusinessStatus(undefined);
            },
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: screenPadding, paddingTop: spacing.md },
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.smd },
  searchInput: { flex: 1 },
  filterButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.gold,
  },
  chipsRow: { flexGrow: 0, marginBottom: spacing.xs },
  clearRow: { marginBottom: spacing.sm },
  clearText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  listPadding: { paddingHorizontal: screenPadding },
  listContent: { paddingHorizontal: screenPadding, paddingBottom: 48 },
});
