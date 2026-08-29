import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { listShortlist, removeFromShortlist } from '../../api/clients';
import { ApiError } from '../../api/client';
import type { ClientPropertyShortlistItem } from '../../api/types';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';
import { Button, Card, EmptyState, ErrorState, LoadingState, confirmDestructive } from '../../components/ui';
import { colors, radii, screenPadding, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'Shortlist'>;

/** Shortlist management (Milestone 7 spec §27) — select shortlisted properties, then "Generate Presentation" is the obvious next action. */
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
      if (next.has(propertyId)) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });
  };

  const onRemove = (shortlistId: string) =>
    confirmDestructive('Remove from shortlist?', undefined, 'Remove', async () => {
      if (!currentWorkspace) return;
      try {
        await removeFromShortlist(currentWorkspace.id, clientId, shortlistId);
        void load();
      } catch (err) {
        Alert.alert('Could not remove', err instanceof ApiError ? err.message : 'Please try again.');
      }
    });

  const onCreatePresentation = () => {
    if (selected.size === 0) {
      Alert.alert('Select at least one property first.');
      return;
    }
    navigation.navigate('CreatePresentation', { clientId, propertyIds: [...selected] });
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.propertyId);
          return (
            <Card onPress={() => toggleSelected(item.propertyId)} style={[styles.row, isSelected && styles.rowSelected]}>
              <View style={styles.rowInner}>
                <View style={styles.rowContent}>
                  <Text style={typography.h3}>{item.property.title}</Text>
                  <Text style={typography.bodySmall}>
                    {item.property.currency} {item.property.price.toLocaleString()} ·{' '}
                    {[item.property.city, item.property.area].filter(Boolean).join(', ')}
                  </Text>
                  {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => onRemove(item.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={<EmptyState icon="⭐" title="No properties shortlisted yet." />}
      />
      <Button
        label={`Create Presentation${selected.size > 0 ? ` (${selected.size})` : ''}`}
        onPress={onCreatePresentation}
        style={styles.presentButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: screenPadding, paddingBottom: 96 },
  row: { marginBottom: spacing.sm },
  rowSelected: { borderColor: colors.brand.primaryNavy, backgroundColor: colors.selectedTint },
  rowInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowContent: { flex: 1 },
  note: { color: colors.text.secondary, fontSize: 12, marginTop: spacing.xs, fontStyle: 'italic' },
  removeText: { color: colors.danger, fontSize: 13 },
  presentButton: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radii.button,
  },
});
