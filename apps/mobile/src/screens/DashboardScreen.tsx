import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { getDashboard } from '../api/dashboard';
import type { ProfessionalTabParamList } from '../navigation/professional/ProfessionalTabs';
import type { PropertyListItem, WorkspaceDashboard } from '../api/types';

type Props = BottomTabScreenProps<ProfessionalTabParamList, 'Dashboard'>;

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
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
  const { currentWorkspace, permissions } = useAuth();
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

  if (!currentWorkspace) {
    return (
      <View style={styles.center}>
        <Text>No workspace available.</Text>
      </View>
    );
  }
  if (loading) {
    return <ActivityIndicator style={styles.center} />;
  }
  if (error || !dashboard) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Dashboard unavailable.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>{currentWorkspace.name}</Text>

      {permissions.has('property.create') || permissions.has('client.create') ? (
        <View style={styles.quickActions}>
          {permissions.has('property.create') && (
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Properties', { screen: 'AddProperty' })}
            >
              <Text style={styles.quickActionText}>+ Property</Text>
            </TouchableOpacity>
          )}
          {permissions.has('client.create') && (
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Clients', { screen: 'AddClient' })}
            >
              <Text style={styles.quickActionText}>+ Client</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {dashboard.properties && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Properties</Text>
          <View style={styles.statsRow}>
            <StatCard label="Active" value={dashboard.properties.total} />
            <StatCard label="Private" value={dashboard.properties.private} />
            <StatCard label="Published" value={dashboard.properties.published} />
            <StatCard label="Pending Review" value={dashboard.properties.pendingReview} />
          </View>

          {dashboard.properties.recent.length > 0 && (
            <View style={styles.recentList}>
              <Text style={styles.recentTitle}>Recent Properties</Text>
              {dashboard.properties.recent.map((property: PropertyListItem) => (
                <TouchableOpacity
                  key={property.id}
                  style={styles.recentRow}
                  onPress={() => goToProperty(property.id)}
                >
                  <Text style={styles.recentRowTitle}>{property.title}</Text>
                  <Text style={styles.hint}>
                    {property.currency} {property.price.toLocaleString()} ·{' '}
                    {property.propertyStatus}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {dashboard.clients && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clients</Text>
          <View style={styles.statsRow}>
            <StatCard label="Total" value={dashboard.clients.total} />
            <StatCard label="Active Requirements" value={dashboard.clients.activeRequirements} />
          </View>

          {dashboard.clients.recent.length > 0 && (
            <View style={styles.recentList}>
              <Text style={styles.recentTitle}>Recent Clients</Text>
              {dashboard.clients.recent.map((client) => (
                <TouchableOpacity
                  key={client.id}
                  style={styles.recentRow}
                  onPress={() => goToClient(client.id)}
                >
                  <Text style={styles.recentRowTitle}>
                    {client.firstName} {client.lastName}
                  </Text>
                  <Text style={styles.hint}>{client.status}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {!dashboard.properties && !dashboard.clients && (
        <View style={styles.center}>
          <Text style={styles.hint}>Nothing to show yet for your role in this workspace.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#c0392b' },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#666', marginTop: 2, marginBottom: 16 },
  quickActions: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  quickAction: {
    flex: 1,
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickActionText: { color: '#fff', fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    flexBasis: '47%',
    backgroundColor: '#f7f9fc',
    borderRadius: 10,
    padding: 14,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: '#1a73e8' },
  statLabel: { color: '#666', fontSize: 12, marginTop: 2 },
  recentList: { marginTop: 12 },
  recentTitle: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  recentRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  recentRowTitle: { fontSize: 15, fontWeight: '500' },
  hint: { color: '#888', fontSize: 12, marginTop: 2 },
});
