import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { getDashboard } from '../api/dashboard';
import type { ProfessionalTabParamList } from '../navigation/professional/ProfessionalTabs';
import type { PropertyListItem, WorkspaceDashboard } from '../api/types';
import {
  AppScreen,
  Button,
  Card,
  ErrorState,
  SectionHeader,
  SkeletonList,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

type Props = BottomTabScreenProps<ProfessionalTabParamList, 'Dashboard'>;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function StatTile({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * Real-data-only dashboard (see docs/PRODUCT.md "Professional
 * dashboard") — every number comes from `GET /workspaces/:id/dashboard`;
 * nothing here is fabricated. A section (properties/clients) is simply
 * absent from the response when the caller lacks the matching view
 * permission, so it's just not rendered — never shown as a zero.
 */
export function DashboardScreen({ navigation }: Props): React.JSX.Element {
  const { user, currentWorkspace, workspaces, permissions, selectWorkspace } = useAuth();
  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!currentWorkspace) return;
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const data = await getDashboard(currentWorkspace.id);
        setDashboard(data);
      } catch {
        setError('Could not load your dashboard.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentWorkspace],
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  const goToProperty = (propertyId: string) =>
    navigation.navigate('Properties', { screen: 'PropertyDetail', params: { propertyId } });
  const goToClient = (clientId: string) =>
    navigation.navigate('Clients', { screen: 'ClientDetail', params: { clientId } });

  const nextWorkspace = () => {
    if (workspaces.length < 2 || !currentWorkspace) return;
    const index = workspaces.findIndex((w) => w.id === currentWorkspace.id);
    selectWorkspace(workspaces[(index + 1) % workspaces.length]);
  };

  if (!currentWorkspace) {
    return (
      <AppScreen>
        <ErrorState message="No workspace available." />
      </AppScreen>
    );
  }

  return (
    <AppScreen refreshing={refreshing} onRefresh={() => void load(true)}>
      <View style={styles.header}>
        <Text style={typography.h2}>
          {greeting()}, {user?.firstName}
        </Text>
        <TouchableOpacity
          style={styles.workspacePill}
          onPress={nextWorkspace}
          disabled={workspaces.length < 2}
          accessibilityRole="button"
          accessibilityLabel={`Current workspace: ${currentWorkspace.name}`}
        >
          <Text style={styles.workspacePillText} numberOfLines={1}>
            {currentWorkspace.name}
          </Text>
          {workspaces.length > 1 ? <Text style={styles.workspacePillChevron}>▾</Text> : null}
        </TouchableOpacity>
      </View>

      {permissions.has('property.create') ? (
        <Button
          label="+ Add New Property"
          onPress={() => navigation.navigate('Properties', { screen: 'AddProperty' })}
          style={styles.addButton}
        />
      ) : null}

      {loading ? (
        <SkeletonList count={2} />
      ) : error || !dashboard ? (
        <ErrorState message={error ?? undefined} onRetry={() => void load()} />
      ) : (
        <>
          {dashboard.properties && (
            <View style={styles.section}>
              <SectionHeader title="Properties" />
              <View style={styles.statsRow}>
                <StatTile label="Total" value={dashboard.properties.total} />
                <StatTile label="Private" value={dashboard.properties.private} />
                <StatTile label="Published" value={dashboard.properties.published} />
                <StatTile label="Pending Review" value={dashboard.properties.pendingReview} />
              </View>

              {dashboard.properties.recent.length > 0 && (
                <View style={styles.recentBlock}>
                  <SectionHeader
                    title="Recent Properties"
                    actionLabel="View all"
                    onAction={() => navigation.navigate('Properties', { screen: 'PropertiesList' })}
                  />
                  {dashboard.properties.recent.map((property: PropertyListItem) => (
                    <Card key={property.id} onPress={() => goToProperty(property.id)} style={styles.recentCard}>
                      <Text style={typography.h3} numberOfLines={1}>
                        {property.title}
                      </Text>
                      <Text style={typography.bodySmall}>
                        {property.currency} {property.price.toLocaleString()} · {property.propertyStatus}
                      </Text>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          )}

          {dashboard.clients && (
            <View style={styles.section}>
              <SectionHeader title="Clients" />
              <View style={styles.statsRow}>
                <StatTile label="Total" value={dashboard.clients.total} />
                <StatTile label="Active Requirements" value={dashboard.clients.activeRequirements} />
              </View>

              {dashboard.clients.recent.length > 0 && (
                <View style={styles.recentBlock}>
                  <SectionHeader
                    title="Recent Clients"
                    actionLabel="View all"
                    onAction={() => navigation.navigate('Clients', { screen: 'ClientsList' })}
                  />
                  {dashboard.clients.recent.map((client) => (
                    <Card key={client.id} onPress={() => goToClient(client.id)} style={styles.recentCard}>
                      <Text style={typography.h3} numberOfLines={1}>
                        {client.firstName} {client.lastName}
                      </Text>
                      <Text style={typography.bodySmall}>{client.status}</Text>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          )}

          {!dashboard.properties && !dashboard.clients && (
            <Text style={typography.bodySmall}>Nothing to show yet for your role in this workspace.</Text>
          )}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  workspacePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.smd,
    paddingVertical: 6,
    maxWidth: 160,
    gap: 4,
  },
  workspacePillText: { fontSize: 12, fontWeight: '600', color: colors.brand.primaryNavy, flexShrink: 1 },
  workspacePillChevron: { fontSize: 10, color: colors.text.secondary },
  addButton: { marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statTile: {
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.smd,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.brand.primaryNavy },
  statLabel: { color: colors.text.secondary, fontSize: 12, marginTop: 2 },
  recentBlock: { marginTop: spacing.lg },
  recentCard: { marginBottom: spacing.sm },
});
