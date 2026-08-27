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
];

function PropertyRow({ item, onPress }: { item: PropertyListItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowSubtitle}>
          {item.propertyType} · {item.listingPurpose} · {item.propertyStatus}
        </Text>
        <Text style={styles.rowPrice}>
          {item.currency} {item.price.toLocaleString()}
        </Text>
        {item.city ? <Text style={styles.rowLocation}>{[item.city, item.area].filter(Boolean).join(', ')}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function PropertiesListScreen({ navigation }: Props): React.JSX.Element {
  const { currentWorkspace } = useAuth();
  const [items, setItems] = useState<PropertyListItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PropertyBusinessStatus | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setError(null);
    try {
      const response = await listProperties(currentWorkspace.id, {
        search: search || undefined,
        propertyStatus: statusFilter,
      });
      setItems(response.items);
    } catch {
      setError('Could not load properties.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

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
        <TextInput
          style={styles.search}
          placeholder="Search title, city, area..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void load()}
        />
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddProperty')}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
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
      />

      {loading ? (
        <ActivityIndicator style={styles.center} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
          renderItem={({ item }) => (
            <PropertyRow item={item} onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.id })} />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>No properties yet.</Text>
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
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
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
  row: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0' },
  rowContent: { gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: '#666', fontSize: 13 },
  rowPrice: { fontSize: 15, fontWeight: '500', marginTop: 2 },
  rowLocation: { color: '#888', fontSize: 13 },
  error: { color: '#c0392b', textAlign: 'center', marginTop: 24 },
});
