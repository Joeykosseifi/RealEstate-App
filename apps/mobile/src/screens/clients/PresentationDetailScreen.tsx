import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Share, Text } from 'react-native';
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
import { AppScreen, Button, Card, ErrorState, LoadingState, confirmDestructive } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'PresentationDetail'>;

/** Presentation detail (Milestone 7 spec §27) — Generate/Regenerate PDF is the obvious primary action; behavior is unchanged from Milestone 4. */
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
      Alert.alert('Could not generate', err instanceof ApiError ? err.message : 'Please try again.');
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
        await Share.share({ message: url, url });
      }
    } catch (err) {
      Alert.alert('Could not open PDF', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onArchive = () =>
    confirmDestructive('Archive presentation?', undefined, 'Archive', async () => {
      if (!currentWorkspace) return;
      await archivePresentation(currentWorkspace.id, presentationId);
      void load();
    });

  if (loading) return <LoadingState />;
  if (error || !presentation) return <ErrorState message={error ?? 'Presentation not found.'} onRetry={() => void load()} />;

  const hasArtifact = presentation.status !== 'DRAFT';

  return (
    <AppScreen>
      <Text style={typography.h1}>{presentation.title}</Text>
      <Text style={[typography.bodySmall, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        {presentation.status} · {presentation.itemCount} propert{presentation.itemCount === 1 ? 'y' : 'ies'}
      </Text>

      {presentation.items.map((item) => (
        <Card key={item.id} style={{ marginBottom: spacing.sm }}>
          <Text style={typography.h3}>{item.property.title}</Text>
          <Text style={typography.bodySmall}>
            {item.property.currency} {item.property.price.toLocaleString()} · {[item.property.area, item.property.city].filter(Boolean).join(', ')}
          </Text>
          {item.agentNote ? <Text style={{ color: colors.brand.primaryNavy, fontSize: 13, marginTop: spacing.xs, fontStyle: 'italic' }}>{item.agentNote}</Text> : null}
        </Card>
      ))}

      <Button label={hasArtifact ? 'Regenerate PDF' : 'Generate PDF'} onPress={() => void onGenerate()} loading={busy} style={{ marginTop: spacing.md }} />

      {hasArtifact ? (
        <>
          <Button label="View PDF" variant="secondary" onPress={() => void onViewOrShare('view')} disabled={busy} style={{ marginTop: spacing.sm }} />
          <Button label="Share" variant="secondary" onPress={() => void onViewOrShare('share')} disabled={busy} style={{ marginTop: spacing.sm }} />
        </>
      ) : null}

      {presentation.status !== 'ARCHIVED' ? (
        <Button label="Archive Presentation" variant="destructive" onPress={onArchive} style={{ marginTop: spacing.lg }} />
      ) : null}
    </AppScreen>
  );
}
