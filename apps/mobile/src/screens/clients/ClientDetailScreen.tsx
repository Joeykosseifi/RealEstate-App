import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { archiveClient, archiveRequirement, getClient, restoreClient } from '../../api/clients';
import { listPresentations } from '../../api/presentations';
import { ApiError } from '../../api/client';
import type { ClientDetail, PropertyPresentationSummary } from '../../api/types';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';

type Props = NativeStackScreenProps<ClientsStackParamList, 'ClientDetail'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function ClientDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { clientId } = route.params;
  const { currentWorkspace, permissions } = useAuth();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [presentations, setPresentations] = useState<PropertyPresentationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setError(null);
    try {
      const [detail, presentationsPage] = await Promise.all([
        getClient(currentWorkspace.id, clientId),
        listPresentations(currentWorkspace.id, clientId),
      ]);
      setClient(detail);
      setPresentations(presentationsPage.items);
    } catch {
      setError('Could not load this client.');
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

  const onArchive = () => {
    if (!currentWorkspace) return;
    Alert.alert('Archive client', 'This can be restored later. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await archiveClient(currentWorkspace.id, clientId);
            void load();
          } catch (err) {
            Alert.alert(
              'Could not archive',
              err instanceof ApiError ? err.message : 'Please try again.',
            );
          }
        },
      },
    ]);
  };

  const onRestore = async () => {
    if (!currentWorkspace) return;
    try {
      await restoreClient(currentWorkspace.id, clientId);
      void load();
    } catch (err) {
      Alert.alert('Could not restore', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  const onArchiveRequirement = (requirementId: string) => {
    if (!currentWorkspace) return;
    Alert.alert(
      'Archive requirement',
      'This preserves history and can be recreated later. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            await archiveRequirement(currentWorkspace.id, clientId, requirementId);
            void load();
          },
        },
      ],
    );
  };

  if (loading) {
    return <ActivityIndicator style={styles.center} />;
  }
  if (error || !client) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Client not found.'}</Text>
      </View>
    );
  }

  const canEdit = permissions.has('client.edit');
  const canArchive = permissions.has('client.archive');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {client.firstName} {client.lastName}
      </Text>
      <Text style={styles.status}>
        {client.status}
        {client.source ? ` · ${client.source}` : ''}
        {client.assignedToUserId ? ' · Assigned' : ''}
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact</Text>
        <Row label="Phone" value={client.phone} />
        {client.whatsappPhone ? <Row label="WhatsApp" value={client.whatsappPhone} /> : null}
        {client.email ? <Row label="Email" value={client.email} /> : null}
        {client.notes ? <Text style={styles.notes}>{client.notes}</Text> : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Requirements</Text>
          {canEdit ? (
            <TouchableOpacity onPress={() => navigation.navigate('AddRequirement', { clientId })}>
              <Text style={styles.linkText}>+ Add</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {client.requirements.length === 0 ? (
          <Text style={styles.hint}>No requirements yet.</Text>
        ) : (
          client.requirements.map((requirement) => (
            <View key={requirement.id} style={styles.requirementCard}>
              <Text style={styles.requirementTitle}>{requirement.title}</Text>
              <Text style={styles.requirementSubtitle}>
                {requirement.listingPurpose} · {requirement.propertyTypes.join(', ') || 'Any type'}
              </Text>
              {requirement.maxPrice ? (
                <Text style={styles.requirementSubtitle}>
                  Up to {requirement.currency} {requirement.maxPrice.toLocaleString()}
                </Text>
              ) : null}
              <View style={styles.requirementActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() =>
                    navigation.navigate('MatchResults', {
                      clientId,
                      requirementId: requirement.id,
                      requirementTitle: requirement.title,
                    })
                  }
                >
                  <Text style={styles.secondaryButtonText}>Find Matches</Text>
                </TouchableOpacity>
                {canEdit ? (
                  <TouchableOpacity onPress={() => onArchiveRequirement(requirement.id)}>
                    <Text style={styles.archiveLink}>Archive</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shortlist ({client.shortlist.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Shortlist', { clientId })}>
            <Text style={styles.linkText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Presentations</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('CreatePresentation', { clientId, propertyIds: [] })}
          >
            <Text style={styles.linkText}>+ New</Text>
          </TouchableOpacity>
        </View>
        {presentations.length === 0 ? (
          <Text style={styles.hint}>No presentations yet.</Text>
        ) : (
          presentations.map((presentation) => (
            <TouchableOpacity
              key={presentation.id}
              style={styles.presentationRow}
              onPress={() =>
                navigation.navigate('PresentationDetail', { presentationId: presentation.id })
              }
            >
              <Text style={styles.presentationTitle}>{presentation.title}</Text>
              <Text style={styles.hint}>
                {presentation.status} · {presentation.itemCount} propert
                {presentation.itemCount === 1 ? 'y' : 'ies'}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {canArchive && client.status !== 'ARCHIVED' ? (
        <TouchableOpacity style={styles.archiveButton} onPress={onArchive}>
          <Text style={styles.archiveButtonText}>Archive Client</Text>
        </TouchableOpacity>
      ) : null}
      {canArchive && client.status === 'ARCHIVED' ? (
        <TouchableOpacity style={styles.restoreButton} onPress={() => void onRestore()}>
          <Text style={styles.restoreButtonText}>Restore Client</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#c0392b' },
  title: { fontSize: 22, fontWeight: '700' },
  status: { color: '#666', marginTop: 4, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#555', textTransform: 'uppercase' },
  linkText: { color: '#1a73e8', fontWeight: '600' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  detailLabel: { color: '#888' },
  detailValue: { fontWeight: '500' },
  notes: { color: '#333', marginTop: 8 },
  hint: { color: '#888', fontSize: 13 },
  requirementCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  requirementTitle: { fontSize: 15, fontWeight: '600' },
  requirementSubtitle: { color: '#666', fontSize: 13, marginTop: 2 },
  requirementActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  secondaryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eef4ff',
  },
  secondaryButtonText: { color: '#1a73e8', fontWeight: '600', fontSize: 13 },
  archiveLink: { color: '#c0392b', fontSize: 13 },
  presentationRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  presentationTitle: { fontSize: 15, fontWeight: '500' },
  archiveButton: {
    borderWidth: 1,
    borderColor: '#c0392b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  archiveButtonText: { color: '#c0392b', fontWeight: '600' },
  restoreButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  restoreButtonText: { color: '#fff', fontWeight: '600' },
});
