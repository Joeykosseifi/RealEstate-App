import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { listClients } from '../../api/clients';
import type { ClientListItem, ClientRecordStatus } from '../../api/types';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';
import { Card, EmptyState, ErrorState, FilterChip, SearchInput, SkeletonList } from '../../components/ui';
import { colors, screenPadding, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'ClientsList'>;

const STATUS_FILTERS: { label: string; value: ClientRecordStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Lead', value: 'LEAD' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Viewing', value: 'VIEWING' },
  { label: 'Negotiating', value: 'NEGOTIATING' },
  { label: 'Won', value: 'WON' },
  { label: 'Lost', value: 'LOST' },
  { label: 'Archived', value: 'ARCHIVED' },
];

function ClientRow({ item, onPress }: { item: ClientListItem; onPress: () => void }) {
  const archived = item.status === 'ARCHIVED';
  return (
    <Card onPress={onPress} style={[styles.row, archived && styles.rowArchived]}>
      <Text style={typography.h3}>
        {item.firstName} {item.lastName}
      </Text>
      <Text style={typography.bodySmall}>
        {item.status}
        {item.source ? ` · ${item.source}` : ''}
      </Text>
      <Text style={typography.body}>{item.phone}</Text>
      {item.activeRequirementCount > 0 ? (
        <Text style={styles.rowRequirements}>
          {item.activeRequirementCount} active requirement{item.activeRequirementCount === 1 ? '' : 's'}
        </Text>
      ) : null}
    </Card>
  );
}

/** Client roster — restyled Milestone 7, same search/filter/pagination logic as Properties. */
export function ClientsListScreen({ navigation }: Props): React.JSX.Element {
  const { currentWorkspace, permissions } = useAuth();
  const [items, setItems] = useState<ClientListItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientRecordStatus | undefined>(undefined);
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
        const response = await listClients(currentWorkspace.id, {
          page: nextPage,
          search: search || undefined,
          status: statusFilter,
        });
        setItems((current) => (mode === 'more' ? [...current, ...response.items] : response.items));
        setPage(nextPage);
        setTotalPages(response.meta.totalPages);
      } catch {
        setError('Could not load clients.');
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
      <View style={styles.container}>
        <ErrorState message="No workspace available." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SearchInput value={search} onChangeText={setSearch} placeholder="Search name, phone, email..." />

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(filter) => filter.label}
          style={styles.chipsRow}
          renderItem={({ item: filter }) => (
            <FilterChip label={filter.label} selected={statusFilter === filter.value} onPress={() => setStatusFilter(filter.value)} />
          )}
        />
        {hasActiveFilters ? (
          <TouchableOpacity
            onPress={() => {
              setSearch('');
              setStatusFilter(undefined);
            }}
            style={styles.clearRow}
          >
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
            <ClientRow item={item} onPress={() => navigation.navigate('ClientDetail', { clientId: item.id })} />
          )}
          ListFooterComponent={loadingMore ? <SkeletonList count={1} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="👤"
              title={hasActiveFilters ? 'No clients match your filters.' : 'No clients yet.'}
              message={hasActiveFilters ? undefined : 'Add your first client to start tracking requirements and matches.'}
              actionLabel={!hasActiveFilters && permissions.has('client.create') ? 'Add Client' : undefined}
              onAction={!hasActiveFilters && permissions.has('client.create') ? () => navigation.navigate('AddClient') : undefined}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: screenPadding, paddingTop: spacing.md },
  chipsRow: { flexGrow: 0, marginTop: spacing.smd, marginBottom: spacing.xs },
  clearRow: { marginBottom: spacing.sm },
  clearText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  listPadding: { paddingHorizontal: screenPadding },
  listContent: { paddingHorizontal: screenPadding, paddingBottom: 48 },
  row: { marginBottom: spacing.smd },
  rowArchived: { opacity: 0.6 },
  rowRequirements: { color: colors.brand.primaryNavy, fontSize: 12, marginTop: spacing.xs, fontWeight: '600' },
});
