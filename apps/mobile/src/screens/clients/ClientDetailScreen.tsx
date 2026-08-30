import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { archiveClient, archiveRequirement, getClient, restoreClient } from '../../api/clients';
import { listPresentations } from '../../api/presentations';
import { ApiError } from '../../api/client';
import type { ClientDetail, PropertyPresentationSummary } from '../../api/types';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';
import {
  AppScreen,
  Avatar,
  Button,
  Card,
  ContactActions,
  ErrorState,
  LoadingState,
  SectionHeader,
  confirmDestructive,
} from '../../components/ui';
import { colors, dangerLinkText, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'ClientDetail'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={typography.bodySmall}>{label}</Text>
      <Text style={[typography.body, styles.rowValue]}>{value}</Text>
    </View>
  );
}

/**
 * Client detail — the hub of the CRM workflow (Milestone 7 spec §25):
 * Client → Requirements → Matches → Shortlist → Presentation, each with
 * an obvious CTA so the agent never hunts across screens. Contact
 * actions reuse the exact Call/WhatsApp/Email pattern already built for
 * the marketplace's "Contact Agent" flow (`ContactActions`) — no new
 * functionality, just the existing phone/whatsapp/email fields made
 * tappable the same way they already are elsewhere in the app.
 */
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

  const onArchive = () =>
    confirmDestructive('Archive client', 'This can be restored later. Continue?', 'Archive', async () => {
      if (!currentWorkspace) return;
      try {
        await archiveClient(currentWorkspace.id, clientId);
        void load();
      } catch (err) {
        Alert.alert('Could not archive', err instanceof ApiError ? err.message : 'Please try again.');
      }
    });

  const onRestore = async () => {
    if (!currentWorkspace) return;
    try {
      await restoreClient(currentWorkspace.id, clientId);
      void load();
    } catch (err) {
      Alert.alert('Could not restore', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  const onArchiveRequirement = (requirementId: string) =>
    confirmDestructive(
      'Archive requirement',
      'This preserves history and can be recreated later. Continue?',
      'Archive',
      async () => {
        if (!currentWorkspace) return;
        try {
          await archiveRequirement(currentWorkspace.id, clientId, requirementId);
          void load();
        } catch (err) {
          Alert.alert('Could not archive', err instanceof ApiError ? err.message : 'Please try again.');
        }
      },
    );

  if (loading) return <LoadingState />;
  if (error || !client) return <ErrorState message={error ?? 'Client not found.'} onRetry={() => void load()} />;

  const canEdit = permissions.has('client.edit');
  const canArchive = permissions.has('client.archive');

  return (
    <AppScreen>
      <View style={styles.identity}>
        <Avatar name={`${client.firstName} ${client.lastName}`} size={56} />
        <View style={styles.identityText}>
          <Text style={typography.h1}>
            {client.firstName} {client.lastName}
          </Text>
          <Text style={typography.bodySmall}>
            {client.status}
            {client.source ? ` · ${client.source}` : ''}
            {client.assignedToUserId ? ' · Assigned' : ''}
          </Text>
        </View>
      </View>

      <Card style={styles.section}>
        <SectionHeader title="Contact" />
        <Row label="Phone" value={client.phone} />
        {client.whatsappPhone ? <Row label="WhatsApp" value={client.whatsappPhone} /> : null}
        {client.email ? <Row label="Email" value={client.email} /> : null}
        <View style={styles.contactActions}>
          <ContactActions phone={client.phone} whatsapp={client.whatsappPhone} email={client.email} variant="icons" />
        </View>
        {client.notes ? <Text style={styles.notes}>{client.notes}</Text> : null}
      </Card>

      <View style={styles.section}>
        <SectionHeader
          title="Requirements"
          actionLabel={canEdit ? '+ Add' : undefined}
          onAction={() => navigation.navigate('AddRequirement', { clientId })}
        />
        {client.requirements.length === 0 ? (
          <Text style={typography.bodySmall}>No requirements yet.</Text>
        ) : (
          client.requirements.map((requirement) => (
            <Card key={requirement.id} style={styles.requirementCard}>
              <Text style={typography.h3}>{requirement.title}</Text>
              <Text style={typography.bodySmall}>
                {requirement.listingPurpose} · {requirement.propertyTypes.join(', ') || 'Any type'}
              </Text>
              {requirement.maxPrice ? (
                <Text style={typography.bodySmall}>
                  Up to {requirement.currency} {requirement.maxPrice.toLocaleString()}
                </Text>
              ) : null}
              <View style={styles.requirementActions}>
                <Button
                  label="Find Matches"
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    navigation.navigate('MatchResults', {
                      clientId,
                      requirementId: requirement.id,
                      requirementTitle: requirement.title,
                    })
                  }
                />
                {canEdit ? (
                  <TouchableOpacity onPress={() => onArchiveRequirement(requirement.id)}>
                    <Text style={styles.archiveLink}>Archive</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Card>
          ))
        )}
      </View>

      <Card style={styles.section}>
        <SectionHeader title={`Shortlist (${client.shortlist.length})`} actionLabel="View" onAction={() => navigation.navigate('Shortlist', { clientId })} />
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Presentations" actionLabel="+ New" onAction={() => navigation.navigate('CreatePresentation', { clientId, propertyIds: [] })} />
        {presentations.length === 0 ? (
          <Text style={typography.bodySmall}>No presentations yet.</Text>
        ) : (
          presentations.map((presentation) => (
            <Card key={presentation.id} onPress={() => navigation.navigate('PresentationDetail', { presentationId: presentation.id })} style={styles.requirementCard}>
              <Text style={typography.h3}>{presentation.title}</Text>
              <Text style={typography.bodySmall}>
                {presentation.status} · {presentation.itemCount} propert{presentation.itemCount === 1 ? 'y' : 'ies'}
              </Text>
            </Card>
          ))
        )}
      </View>

      {canArchive && client.status !== 'ARCHIVED' ? (
        <Button label="Archive Client" variant="destructive" onPress={onArchive} style={styles.bottomAction} />
      ) : null}
      {canArchive && client.status === 'ARCHIVED' ? (
        <Button label="Restore Client" onPress={() => void onRestore()} style={styles.bottomAction} />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.smd, marginBottom: spacing.lg },
  identityText: { flex: 1 },
  section: { marginBottom: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  rowValue: { fontWeight: '600' },
  contactActions: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  notes: { ...typography.body, marginTop: spacing.sm },
  requirementCard: { marginBottom: spacing.sm },
  requirementActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  archiveLink: dangerLinkText,
  bottomAction: { marginTop: spacing.sm },
});
