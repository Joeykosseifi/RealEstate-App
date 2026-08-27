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
import { addToShortlist, getMatches } from '../../api/clients';
import { ApiError } from '../../api/client';
import type { PropertyMatchResult } from '../../api/types';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';

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
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.score}>{score}% Match</Text>
      </View>
      <Text style={styles.title}>{property.title}</Text>
      <Text style={styles.price}>
        {property.currency} {property.price.toLocaleString()}
      </Text>
      <Text style={styles.subtitle}>
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

      <TouchableOpacity
        style={styles.shortlistButton}
        onPress={onShortlist}
        disabled={shortlisting}
      >
        {shortlisting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.shortlistButtonText}>Add to Shortlist</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

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
      Alert.alert(
        'Could not add to shortlist',
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setShortlistingId(null);
    }
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
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={results}
      keyExtractor={(item) => item.property.id}
      ListHeaderComponent={<Text style={styles.header}>Matches for "{requirementTitle}"</Text>}
      renderItem={({ item }) => (
        <MatchCard
          result={item}
          onShortlist={() => void onShortlist(item.property.id)}
          shortlisting={shortlistingId === item.property.id}
        />
      )}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text>No matching properties yet.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#c0392b' },
  header: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
  card: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { marginBottom: 4 },
  score: { color: '#1a73e8', fontWeight: '700', fontSize: 16 },
  title: { fontSize: 17, fontWeight: '600' },
  price: { fontSize: 16, fontWeight: '600', color: '#1a73e8', marginTop: 2 },
  subtitle: { color: '#666', fontSize: 13, marginTop: 2, marginBottom: 8 },
  matched: { color: '#2e7d32', fontSize: 13, marginTop: 2 },
  missing: { color: '#c0392b', fontSize: 13, marginTop: 2 },
  shortlistButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  shortlistButtonText: { color: '#fff', fontWeight: '600' },
});
