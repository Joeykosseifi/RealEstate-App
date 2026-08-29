import { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { getClient, listShortlist } from '../../api/clients';
import { createPresentation, generatePresentation } from '../../api/presentations';
import { ApiError } from '../../api/client';
import type { ClientPropertyShortlistItem } from '../../api/types';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';
import { AppScreen, Button, Card, LoadingState, TextField } from '../../components/ui';
import { colors, radii, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'CreatePresentation'>;

/**
 * Selection + reorder + per-property notes + title, then Generate — one
 * screen covering the whole "Create Presentation" flow (Milestone 7
 * spec §27). Reordering is up/down arrows rather than drag-and-drop,
 * which keeps this screen usable without a gesture-handling dependency.
 * Presentation-safe generation behavior is unchanged from Milestone 4.
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
    setOrder((current) => (current.includes(propertyId) ? current.filter((id) => id !== propertyId) : [...current, propertyId]));
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
        items: order.map((propertyId) => ({ propertyId, agentNote: notes[propertyId]?.trim() || undefined })),
      });
      await generatePresentation(currentWorkspace.id, presentation.id);
      navigation.replace('PresentationDetail', { presentationId: presentation.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate this presentation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;

  const byId = new Map(shortlist.map((item) => [item.propertyId, item]));

  return (
    <AppScreen>
      <TextField label="Title" value={title} onChangeText={setTitle} />

      <Text style={typography.label}>Choose Properties</Text>
      {shortlist.length === 0 ? (
        <Text style={typography.bodySmall}>Nothing shortlisted for this client yet.</Text>
      ) : (
        shortlist.map((item) => {
          const isSelected = order.includes(item.propertyId);
          return (
            <Card key={item.id} onPress={() => toggle(item.propertyId)} style={[{ marginBottom: spacing.sm }, isSelected && { borderColor: colors.brand.primaryNavy, backgroundColor: colors.selectedTint }]}>
              <Text style={typography.h3}>{item.property.title}</Text>
              <Text style={typography.bodySmall}>
                {item.property.currency} {item.property.price.toLocaleString()}
              </Text>
            </Card>
          );
        })
      )}

      {order.length > 0 ? (
        <>
          <Text style={[typography.label, { marginTop: spacing.md }]}>Order & Notes</Text>
          {order.map((propertyId, index) => {
            const item = byId.get(propertyId);
            return (
              <View key={propertyId} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'flex-start' }}>
                <View style={{ gap: 4 }}>
                  <TouchableOpacity onPress={() => move(index, -1)} disabled={index === 0}>
                    <Text style={{ fontSize: 16, padding: 4, color: index === 0 ? colors.border : colors.brand.primaryNavy }}>▲</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => move(index, 1)} disabled={index === order.length - 1}>
                    <Text style={{ fontSize: 16, padding: 4, color: index === order.length - 1 ? colors.border : colors.brand.primaryNavy }}>▼</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>{item?.property.title ?? propertyId}</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radii.input, padding: spacing.sm, fontSize: 14, marginTop: spacing.xs }}
                    placeholder="Note for the client (optional)"
                    value={notes[propertyId] ?? ''}
                    onChangeText={(text) => setNotes((current) => ({ ...current, [propertyId]: text }))}
                  />
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      {error ? <Text style={{ color: colors.danger, marginTop: spacing.md, textAlign: 'center' }}>{error}</Text> : null}

      <Button label="Generate PDF" onPress={() => void onGenerate()} loading={submitting} style={{ marginTop: spacing.lg }} />
    </AppScreen>
  );
}
