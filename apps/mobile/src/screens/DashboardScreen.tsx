import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { getDashboard } from '../api/dashboard';
import type { ProfessionalTabParamList } from '../navigation/professional/ProfessionalTabs';
import type { PropertyListItem, WorkspaceDashboard } from '../api/types';
import { Avatar, Button, Card, ErrorState, PropertyCard, SectionHeader, SkeletonList } from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

type Props = BottomTabScreenProps<ProfessionalTabParamList, 'Dashboard'>;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={18} color={colors.brand.primaryNavy} />
      </View>
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
 * permission, so it's just not rendered — never shown as a zero. No
 * notifications/bell and no profile photo exist as features anywhere in
 * the app, so this screen deliberately doesn't show either — see
 * docs/DESIGN_SYSTEM.md.
 */
export function DashboardScreen({ navigation }: Props): React.JSX.Element {
  const { user, currentWorkspace, workspaces, permissions, selectWorkspace } = useAuth();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
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

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  if (!currentWorkspace) {
    return (
      <View style={styles.container}>
        <ErrorState message="No workspace available." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isFocused ? <StatusBar style="light" /> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.surface} />}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerRow}>
            <View style={styles.flex1}>
              <Text style={styles.greeting}>
                {greeting()}, {user?.firstName} 👋
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
                {workspaces.length > 1 ? <Ionicons name="chevron-down" size={12} color={colors.text.inverse} /> : null}
              </TouchableOpacity>
            </View>
            <Avatar name={fullName || 'User'} size={44} />
          </View>
        </View>

        <View style={styles.body}>
          {permissions.has('property.create') ? (
            <Button
              label="+ Add New Property"
              variant="gold"
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
                    <StatTile icon="home-outline" label="Total" value={dashboard.properties.total} />
                    <StatTile icon="lock-closed-outline" label="Private" value={dashboard.properties.private} />
                    <StatTile icon="checkmark-circle-outline" label="Published" value={dashboard.properties.published} />
                    <StatTile icon="time-outline" label="Pending Review" value={dashboard.properties.pendingReview} />
                  </View>

                  {dashboard.properties.recent.length > 0 && (
                    <View style={styles.recentBlock}>
                      <SectionHeader
                        title="Recent Properties"
                        actionLabel="See All"
                        onAction={() => navigation.navigate('Properties', { screen: 'PropertiesList' })}
                      />
                      {dashboard.properties.recent.map((property: PropertyListItem) => (
                        <PropertyCard
                          key={property.id}
                          property={property}
                          publicationStatus={property.publicationStatus}
                          imageUrl={null}
                          onPress={() => goToProperty(property.id)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {dashboard.clients && (
                <View style={styles.section}>
                  <SectionHeader title="Clients" />
                  <View style={styles.statsRow}>
                    <StatTile icon="people-outline" label="Total" value={dashboard.clients.total} />
                    <StatTile icon="document-text-outline" label="Active Requirements" value={dashboard.clients.activeRequirements} />
                  </View>

                  {dashboard.clients.recent.length > 0 && (
                    <View style={styles.recentBlock}>
                      <SectionHeader
                        title="Recent Clients"
                        actionLabel="See All"
                        onAction={() => navigation.navigate('Clients', { screen: 'ClientsList' })}
                      />
                      {dashboard.clients.recent.map((client) => (
                        <Card key={client.id} onPress={() => goToClient(client.id)} style={styles.clientCard}>
                          <View style={styles.clientRow}>
                            <Avatar name={`${client.firstName} ${client.lastName}`} size={40} />
                            <View style={styles.flex1}>
                              <Text style={typography.h3} numberOfLines={1}>
                                {client.firstName} {client.lastName}
                              </Text>
                              <Text style={typography.bodySmall}>{client.status}</Text>
                            </View>
                          </View>
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
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  flex1: { flex: 1 },
  header: {
    backgroundColor: colors.brand.deepNavy,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radii.cardLarge,
    borderBottomRightRadius: radii.cardLarge,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.smd },
  greeting: { color: colors.text.inverse, fontSize: 20, fontWeight: '700', marginBottom: spacing.sm },
  workspacePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.smd,
    paddingVertical: 6,
    maxWidth: 220,
    gap: 4,
  },
  workspacePillText: { fontSize: 12, fontWeight: '600', color: colors.text.inverse, flexShrink: 1 },
  body: { paddingHorizontal: spacing.lg, marginTop: -spacing.lg },
  addButton: { marginTop: spacing.lg, marginBottom: spacing.lg },
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
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.control,
    backgroundColor: colors.selectedTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.brand.primaryNavy },
  statLabel: { color: colors.text.secondary, fontSize: 12, marginTop: 2 },
  recentBlock: { marginTop: spacing.lg },
  clientCard: { marginBottom: spacing.sm },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.smd },
});
