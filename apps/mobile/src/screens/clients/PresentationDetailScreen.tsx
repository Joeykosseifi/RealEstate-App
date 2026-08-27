import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import {
  archivePresentation,
  generatePresentation,
  getPresentation,
  getPresentationAccessUrl,
} from '../../api/presentations';
import { ApiError } from '../../api/client';
import type { PropertyPresentationDetail } from '../../api/types';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';

type Props = NativeStackScreenProps<ClientsStackParamList, 'PresentationDetail'>;

export function PresentationDetailScreen({ route }: Props): React.JSX.Element {
  const { presentationId } = route.params;
  const { currentWorkspace } = useAuth();
  const [presentation, setPresentation] = useState<PropertyPresentationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setError(null);
    try {
      const detail = await getPresentation(currentWorkspace.id, presentationId);
      setPresentation(detail);
    } catch {
      setError('Could not load this presentation.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, presentationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onGenerate = async () => {
    if (!currentWorkspace) return;
    setBusy(true);
    try {
      await generatePresentation(currentWorkspace.id, presentationId);
      void load();
    } catch (err) {
      Alert.alert(
        'Could not generate',
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onViewOrShare = async (action: 'view' | 'share') => {
    if (!currentWorkspace) return;
    setBusy(true);
    try {
      const { url } = await getPresentationAccessUrl(currentWorkspace.id, presentationId);
      if (action === 'view') {
        await Linking.openURL(url);
      } else {
        // Native OS share sheet — the agent sends the PDF via WhatsApp/
        // email/etc. manually. No in-app messaging is built here.
        await Share.share({ message: url, url });
      }
    } catch (err) {
      Alert.alert(
        'Could not open PDF',
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onArchive = () => {
    if (!currentWorkspace) return;
    Alert.alert('Archive presentation?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          await archivePresentation(currentWorkspace.id, presentationId);
          void load();
        },
      },
    ]);
  };

  if (loading) {
    return <ActivityIndicator style={styles.center} />;
  }
  if (error || !presentation) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Presentation not found.'}</Text>
      </View>
    );
  }

  const hasArtifact = presentation.status !== 'DRAFT';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{presentation.title}</Text>
      <Text style={styles.status}>
        {presentation.status} · {presentation.itemCount} propert
        {presentation.itemCount === 1 ? 'y' : 'ies'}
      </Text>

      {presentation.items.map((item) => (
        <View key={item.id} style={styles.itemCard}>
          <Text style={styles.itemTitle}>{item.property.title}</Text>
          <Text style={styles.hint}>
            {item.property.currency} {item.property.price.toLocaleString()} ·{' '}
            {[item.property.area, item.property.city].filter(Boolean).join(', ')}
          </Text>
          {item.agentNote ? <Text style={styles.note}>{item.agentNote}</Text> : null}
        </View>
      ))}

      <TouchableOpacity
        style={[styles.button, styles.primaryButton]}
        onPress={() => void onGenerate()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>
            {hasArtifact ? 'Regenerate PDF' : 'Generate PDF'}
          </Text>
        )}
      </TouchableOpacity>

      {hasArtifact ? (
        <>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => void onViewOrShare('view')}
          >
            <Text style={styles.secondaryButtonText}>View PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => void onViewOrShare('share')}
          >
            <Text style={styles.secondaryButtonText}>Share</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {presentation.status !== 'ARCHIVED' ? (
        <TouchableOpacity style={styles.archiveButton} onPress={onArchive}>
          <Text style={styles.archiveButtonText}>Archive Presentation</Text>
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
  title: { fontSize: 20, fontWeight: '700' },
  status: { color: '#666', marginTop: 4, marginBottom: 16 },
  itemCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  hint: { color: '#888', fontSize: 13, marginTop: 2 },
  note: { color: '#1a73e8', fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  button: { borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  primaryButton: { backgroundColor: '#1a73e8' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#1a73e8' },
  secondaryButtonText: { color: '#1a73e8', fontWeight: '600' },
  archiveButton: {
    borderWidth: 1,
    borderColor: '#c0392b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  archiveButtonText: { color: '#c0392b', fontWeight: '600' },
});
