import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { listShortlist, removeFromShortlist } from '../../api/clients';
import { ApiError } from '../../api/client';
import type { ClientPropertyShortlistItem } from '../../api/types';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';

type Props = NativeStackScreenProps<ClientsStackParamList, 'Shortlist'>;

export function ShortlistScreen({ route, navigation }: Props): React.JSX.Element {
  const { clientId } = route.params;
  const { currentWorkspace } = useAuth();
  const [items, setItems] = useState<ClientPropertyShortlistItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setError(null);
    try {
      const response = await listShortlist(currentWorkspace.id, clientId);
      setItems(response);
    } catch {
      setError('Could not load the shortlist.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  const toggleSelected = (propertyId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(propertyId)) {
        next.delete(propertyId);
      } else {
        next.add(propertyId);
      }
      return next;
    });
  };

  const onRemove = (shortlistId: string) => {
    if (!currentWorkspace) return;
    Alert.alert('Remove from shortlist?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFromShortlist(currentWorkspace.id, clientId, shortlistId);
            void load();
          } catch (err) {
            Alert.alert(
              'Could not remove',
              err instanceof ApiError ? err.message : 'Please try again.',
            );
          }
        },
      },
    ]);
  };

  const onCreatePresentation = () => {
    if (selected.size === 0) {
      Alert.alert('Select at least one property first.');
      return;
    }
    navigation.navigate('CreatePresentation', { clientId, propertyIds: [...selected] });
  };

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
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.propertyId);
          return (
            <TouchableOpacity
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => toggleSelected(item.propertyId)}
            >
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{item.property.title}</Text>
                <Text style={styles.rowSubtitle}>
                  {item.property.currency} {item.property.price.toLocaleString()} ·{' '}
                  {[item.property.city, item.property.area].filter(Boolean).join(', ')}
                </Text>
                {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => onRemove(item.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>No properties shortlisted yet.</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.presentButton} onPress={onCreatePresentation}>
        <Text style={styles.presentButtonText}>
          Create Presentation{selected.size > 0 ? ` (${selected.size})` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 96 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#c0392b' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
  },
  rowSelected: { borderColor: '#1a73e8', backgroundColor: '#eef4ff' },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSubtitle: { color: '#666', fontSize: 13, marginTop: 2 },
  note: { color: '#888', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  removeText: { color: '#c0392b', fontSize: 13 },
  presentButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  presentButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
