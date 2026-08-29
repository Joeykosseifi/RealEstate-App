import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { addToShortlist, getMatches } from '../../api/clients';
import { ApiError } from '../../api/client';
import type { PropertyMatchResult } from '../../api/types';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';
import { Button, Card, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { colors, priceText, screenPadding, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'MatchResults'>;

function MatchCard({
  result,
  onShortlist,
  shortlisting,
}: {
  result: PropertyMatchResult;
  onShortlist: () => void;
  shortlisting: boolean;
}) {
  const { property, score, explanation } = result;
  const location = [property.area, property.city].filter(Boolean).join(', ') || property.country;

  return (
    <Card style={styles.card}>
      <Text style={styles.score}>{score}% Match</Text>
      <Text style={typography.h3}>{property.title}</Text>
      <Text style={priceText}>
        {property.currency} {property.price.toLocaleString()}
      </Text>
      <Text style={[typography.bodySmall, styles.factsLine]}>
        {[
          property.bedrooms != null ? `${property.bedrooms} Bed` : null,
          property.bathrooms != null ? `${property.bathrooms} Bath` : null,
          property.areaSqm != null ? `${property.areaSqm} m²` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        {location ? ` · ${location}` : ''}
      </Text>

      {explanation.matchedCriteria.map((criterion) => (
        <Text key={criterion} style={styles.matched}>
          ✓ {criterion}
        </Text>
      ))}
      {explanation.missingPreferredCriteria.map((criterion) => (
        <Text key={criterion} style={styles.missing}>
          ✗ Preferred: {criterion}
        </Text>
      ))}

      <Button label="Add to Shortlist" size="sm" onPress={onShortlist} loading={shortlisting} style={styles.shortlistButton} />
    </Card>
  );
}

/**
 * Match results (Milestone 7 spec §26) — property, score, and the exact
 * matched/missing-preferred criteria driving it, exactly as the
 * deterministic matching engine returns them. Not modified for UI
 * reasons — see docs/PERMISSIONS.md "Matching architecture."
 */
export function MatchResultsScreen({ route }: Props): React.JSX.Element {
  const { clientId, requirementId, requirementTitle } = route.params;
  const { currentWorkspace } = useAuth();
  const [results, setResults] = useState<PropertyMatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shortlistingId, setShortlistingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setError(null);
    try {
      const response = await getMatches(currentWorkspace.id, clientId, requirementId);
      setResults(response.items);
    } catch {
      setError('Could not load matches.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, clientId, requirementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onShortlist = async (propertyId: string) => {
    if (!currentWorkspace) return;
    setShortlistingId(propertyId);
    try {
      await addToShortlist(currentWorkspace.id, clientId, propertyId, { requirementId });
      Alert.alert('Added to shortlist');
    } catch (err) {
      Alert.alert('Could not add to shortlist', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setShortlistingId(null);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={results}
      keyExtractor={(item) => item.property.id}
      ListHeaderComponent={
        <Text style={[typography.h2, styles.header]}>Matches for &quot;{requirementTitle}&quot;</Text>
      }
      renderItem={({ item }) => (
        <MatchCard result={item} onShortlist={() => void onShortlist(item.property.id)} shortlisting={shortlistingId === item.property.id} />
      )}
      ListEmptyComponent={<EmptyState icon="🔍" title="No matching properties yet." />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: screenPadding, paddingBottom: 48 },
  header: { marginBottom: spacing.md },
  card: { marginBottom: spacing.smd },
  score: { color: colors.brand.primaryNavy, fontWeight: '700', fontSize: 15, marginBottom: spacing.xs },
  factsLine: { marginTop: spacing.xs, marginBottom: spacing.sm },
  matched: { color: colors.success, fontSize: 13, marginTop: 2 },
  missing: { color: colors.danger, fontSize: 13, marginTop: 2 },
  shortlistButton: { marginTop: spacing.smd, alignSelf: 'flex-start' },
});
