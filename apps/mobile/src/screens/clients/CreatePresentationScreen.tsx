import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { getClient, listShortlist } from '../../api/clients';
import { createPresentation, generatePresentation } from '../../api/presentations';
import { ApiError } from '../../api/client';
import type { ClientPropertyShortlistItem } from '../../api/types';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';

type Props = NativeStackScreenProps<ClientsStackParamList, 'CreatePresentation'>;

/**
 * Selection + reorder + per-property notes + title, then Generate — one
 * screen covering the whole "Create Presentation" flow from the spec.
 * Reordering is up/down arrows rather than drag-and-drop, which keeps
 * this screen usable without adding a gesture-handling dependency.
 */
export function CreatePresentationScreen({ route, navigation }: Props): React.JSX.Element {
  const { clientId, propertyIds } = route.params;
  const { currentWorkspace } = useAuth();
  const [shortlist, setShortlist] = useState<ClientPropertyShortlistItem[]>([]);
  const [order, setOrder] = useState<string[]>(propertyIds);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('Properties for You');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setError(null);
    try {
      const [items, client] = await Promise.all([
        listShortlist(currentWorkspace.id, clientId),
        getClient(currentWorkspace.id, clientId),
      ]);
      setShortlist(items);
      setTitle(`Properties for ${client.firstName}`);
    } catch {
      setError('Could not load the shortlist.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (propertyId: string) => {
    setOrder((current) =>
      current.includes(propertyId)
        ? current.filter((id) => id !== propertyId)
        : [...current, propertyId],
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    setOrder((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const onGenerate = async () => {
    if (!currentWorkspace) return;
    if (order.length === 0) {
      setError('Select at least one property.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const presentation = await createPresentation(currentWorkspace.id, {
        title: title.trim() || 'Properties for You',
        clientId,
        items: order.map((propertyId) => ({
          propertyId,
          agentNote: notes[propertyId]?.trim() || undefined,
        })),
      });
      await generatePresentation(currentWorkspace.id, presentation.id);
      navigation.replace('PresentationDetail', { presentationId: presentation.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate this presentation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.center} />;
  }

  const byId = new Map(shortlist.map((item) => [item.propertyId, item]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />

      <Text style={styles.sectionTitle}>Choose Properties</Text>
      {shortlist.length === 0 ? (
        <Text style={styles.hint}>Nothing shortlisted for this client yet.</Text>
      ) : (
        shortlist.map((item) => {
          const isSelected = order.includes(item.propertyId);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.pickRow, isSelected && styles.pickRowSelected]}
              onPress={() => toggle(item.propertyId)}
            >
              <Text style={styles.pickRowTitle}>{item.property.title}</Text>
              <Text style={styles.hint}>
                {item.property.currency} {item.property.price.toLocaleString()}
              </Text>
            </TouchableOpacity>
          );
        })
      )}

      {order.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Order & Notes</Text>
          {order.map((propertyId, index) => {
            const item = byId.get(propertyId);
            return (
              <View key={propertyId} style={styles.orderRow}>
                <View style={styles.orderControls}>
                  <TouchableOpacity onPress={() => move(index, -1)} disabled={index === 0}>
                    <Text style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}>
                      ▲
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => move(index, 1)}
                    disabled={index === order.length - 1}
                  >
                    <Text
                      style={[
                        styles.moveButton,
                        index === order.length - 1 && styles.moveButtonDisabled,
                      ]}
                    >
                      ▼
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.orderContent}>
                  <Text style={styles.pickRowTitle}>{item?.property.title ?? propertyId}</Text>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="Note for the client (optional)"
                    value={notes[propertyId] ?? ''}
                    onChangeText={(text) =>
                      setNotes((current) => ({ ...current, [propertyId]: text }))
                    }
                  />
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.generateButton, submitting && styles.buttonDisabled]}
        onPress={() => void onGenerate()}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.generateButtonText}>Generate PDF</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  hint: { color: '#888', fontSize: 13 },
  pickRow: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
  },
  pickRowSelected: { borderColor: '#1a73e8', backgroundColor: '#eef4ff' },
  pickRowTitle: { fontSize: 15, fontWeight: '600' },
  orderRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  orderControls: { gap: 4 },
  moveButton: { fontSize: 16, color: '#1a73e8', padding: 4 },
  moveButtonDisabled: { color: '#ccc' },
  orderContent: { flex: 1 },
  noteInput: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    marginTop: 4,
  },
  error: { color: '#c0392b', marginTop: 12, textAlign: 'center' },
  generateButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  generateButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
