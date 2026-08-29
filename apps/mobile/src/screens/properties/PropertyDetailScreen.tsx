import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import {
  archiveProperty,
  getMediaAccessUrl,
  getProperty,
  restoreProperty,
  updatePropertyLocation,
  uploadPropertyMedia,
} from '../../api/properties';
import {
  cancelPublicationSubmission,
  getPublication,
  republishListing,
  unpublishListing,
} from '../../api/publications';
import { ApiError } from '../../api/client';
import type { PropertyDetail, PublicationDetail } from '../../api/types';
import { MapLocationPicker } from '../../location/MapLocationPicker';
import {
  initialDraftFromSavedLocation,
  toLocationDto,
  type LocationDraft,
} from '../../location/locationPayload';
import type { PropertiesStackParamList } from '../../navigation/PropertiesStack';
import {
  BusinessStatusBadge,
  Button,
  Card,
  ErrorState,
  FilterChip,
  IconButton,
  LoadingState,
  PublicationStatusBadge,
  confirmDestructive,
} from '../../components/ui';
import { colors, priceText, radii, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<PropertiesStackParamList, 'PropertyDetail'>;
type Tab = 'details' | 'photos' | 'location' | 'private';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={typography.bodySmall}>{label}</Text>
      <Text style={[typography.body, styles.detailValue]}>{value}</Text>
    </View>
  );
}

/**
 * Property detail (Milestone 7 spec §15 — image-first header, business
 * status + publication status ALWAYS as two separate badges, then
 * Details | Photos | Location | Private tabs). The Private tab is only
 * ever rendered when the API actually included `owners`/`privateDetails`
 * — DTO omission, not client-side hiding, is what keeps it from a
 * caller who lacks the permission (see docs/PERMISSIONS.md "Property
 * DTO omission policy") — this UI just reflects that.
 */
export function PropertyDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { propertyId } = route.params;
  const { currentWorkspace, permissions } = useAuth();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [publication, setPublication] = useState<PublicationDetail | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('details');
  const [mapVisible, setMapVisible] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [publicationActionPending, setPublicationActionPending] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setError(null);
    try {
      const [detail, pub] = await Promise.all([
        getProperty(currentWorkspace.id, propertyId),
        getPublication(currentWorkspace.id, propertyId),
      ]);
      setProperty(detail);
      setPublication(pub);
      const images = detail.media.filter((m) => m.mediaType === 'IMAGE');
      const resolved = await Promise.all(
        images.map(async (media) => {
          try {
            const { url } = await getMediaAccessUrl(currentWorkspace.id, propertyId, media.id);
            return [media.id, url] as const;
          } catch {
            return null;
          }
        }),
      );
      setPhotoUrls(
        Object.fromEntries(resolved.filter((entry): entry is [string, string] => entry !== null)),
      );
    } catch {
      setError('Could not load this property.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaveLocation = async (draft: LocationDraft) => {
    if (!currentWorkspace) return;
    setSavingLocation(true);
    try {
      const updated = await updatePropertyLocation(currentWorkspace.id, propertyId, toLocationDto(draft));
      setProperty(updated);
      setMapVisible(false);
    } catch (err) {
      Alert.alert('Could not save location', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setSavingLocation(false);
    }
  };

  const onArchive = () =>
    confirmDestructive('Archive property', 'This can be restored later. Continue?', 'Archive', async () => {
      if (!currentWorkspace) return;
      try {
        await archiveProperty(currentWorkspace.id, propertyId);
        navigation.goBack();
      } catch (err) {
        Alert.alert('Could not archive', err instanceof ApiError ? err.message : 'Please try again.');
      }
    });

  const onRestore = async () => {
    if (!currentWorkspace) return;
    setRestoring(true);
    try {
      await restoreProperty(currentWorkspace.id, propertyId);
      await load();
    } catch (err) {
      Alert.alert('Could not restore', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const onAddPhoto = async () => {
    if (!currentWorkspace) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access in Settings to add property photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      await uploadPropertyMedia(
        currentWorkspace.id,
        propertyId,
        { uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' },
        'IMAGE',
      );
      await load();
    } catch (err) {
      Alert.alert('Could not upload photo', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const runPublicationAction = async (
    action: (workspaceId: string, propertyId: string) => Promise<PublicationDetail>,
    failureMessage: string,
  ) => {
    if (!currentWorkspace) return;
    setPublicationActionPending(true);
    try {
      const updated = await action(currentWorkspace.id, propertyId);
      setPublication(updated);
    } catch (err) {
      Alert.alert(failureMessage, err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setPublicationActionPending(false);
    }
  };

  const onCancelSubmission = () => runPublicationAction(cancelPublicationSubmission, 'Could not cancel submission');
  const onUnpublish = () =>
    confirmDestructive('Unpublish listing', 'This removes it from the public marketplace. Continue?', 'Unpublish', () =>
      runPublicationAction(unpublishListing, 'Could not unpublish'),
    );
  const onRepublish = () => runPublicationAction(republishListing, 'Could not republish');

  if (loading) return <LoadingState />;
  if (error || !property) {
    return <ErrorState message={error ?? 'Property not found.'} onRetry={() => void load()} />;
  }

  const images = property.media.filter((m) => m.mediaType === 'IMAGE');
  const heroUrl = property.primaryMedia ? photoUrls[property.primaryMedia.id] : undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroWrap}>
        {heroUrl ? (
          <Image source={{ uri: heroUrl }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]}>
            <Text style={typography.bodySmall}>No photo yet</Text>
          </View>
        )}
        {images.length > 0 ? (
          <View style={styles.photoCountBadge}>
            <Text style={styles.photoCountText}>📷 {images.length}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.titleRow}>
        <Text style={[typography.h1, styles.titleText]}>{property.title}</Text>
        {permissions.has('property.edit') && property.propertyStatus !== 'ARCHIVED' && (
          <IconButton
            icon={<Text style={styles.editIcon}>✎</Text>}
            onPress={() => navigation.navigate('EditProperty', { propertyId })}
            accessibilityLabel="Edit property"
            variant="filled"
          />
        )}
      </View>
      <Text style={priceText}>
        {property.currency} {property.price.toLocaleString()}
      </Text>
      {(property.city || property.area) && (
        <Text style={typography.bodySmall}>{[property.area, property.city].filter(Boolean).join(', ')}</Text>
      )}

      <View style={styles.badgeRow}>
        <BusinessStatusBadge status={property.propertyStatus} />
        <PublicationStatusBadge status={publication?.status ?? null} />
      </View>

      {property.propertyStatus === 'ARCHIVED' && (
        <Card style={styles.archivedBanner}>
          <Text style={styles.archivedBannerText}>This property is archived — it no longer appears in your active list.</Text>
        </Card>
      )}

      <Card style={styles.publicationCard}>
        <Text style={typography.label}>Marketplace Listing</Text>
        {!publication && (
          <>
            <Text style={styles.hint}>Private — not prepared for the marketplace yet.</Text>
            <Button label="Prepare Listing" size="sm" variant="secondary" onPress={() => navigation.navigate('PublishProperty', { propertyId })} style={styles.pubButton} />
          </>
        )}
        {publication?.status === 'DRAFT' && (
          <>
            <Text style={styles.hint}>Draft — not yet submitted for review.</Text>
            <Button label="Edit Public Listing" size="sm" variant="secondary" onPress={() => navigation.navigate('PublishProperty', { propertyId })} style={styles.pubButton} />
          </>
        )}
        {publication?.status === 'PENDING_REVIEW' && (
          <>
            <Text style={styles.hint}>Under review by the platform team.</Text>
            <Button label="Cancel Submission" size="sm" variant="secondary" onPress={onCancelSubmission} disabled={publicationActionPending} style={styles.pubButton} />
          </>
        )}
        {publication?.status === 'CHANGES_REQUESTED' && (
          <>
            <Text style={styles.warningText}>Changes requested: {publication.changesRequestedReason}</Text>
            <Button label="Edit & Resubmit" size="sm" variant="secondary" onPress={() => navigation.navigate('PublishProperty', { propertyId })} style={styles.pubButton} />
          </>
        )}
        {publication?.status === 'REJECTED' && (
          <>
            <Text style={styles.warningText}>Rejected: {publication.rejectionReason}</Text>
            <Button label="Edit & Resubmit" size="sm" variant="secondary" onPress={() => navigation.navigate('PublishProperty', { propertyId })} style={styles.pubButton} />
          </>
        )}
        {publication?.status === 'PUBLISHED' && (
          <>
            <Text style={styles.hint}>Live on the public marketplace.</Text>
            <View style={styles.pubButtonRow}>
              <Button label="Edit Listing" size="sm" variant="secondary" onPress={() => navigation.navigate('PublishProperty', { propertyId })} />
              <Button label="Unpublish" size="sm" variant="destructive" onPress={onUnpublish} disabled={publicationActionPending} />
            </View>
          </>
        )}
        {publication?.status === 'ADMIN_UNPUBLISHED' && (
          <Text style={styles.warningText}>Removed by the platform team: {publication.unpublishReason}</Text>
        )}
        {publication?.status === 'OWNER_UNPUBLISHED' && (
          <>
            <Text style={styles.hint}>Unpublished by you — property stays in your database.</Text>
            <Button label="Republish" size="sm" variant="secondary" onPress={onRepublish} disabled={publicationActionPending} style={styles.pubButton} />
          </>
        )}
        {publication?.status === 'ARCHIVED' && <Text style={styles.hint}>Archived — no longer eligible for the marketplace.</Text>}
      </Card>

      <View style={styles.tabsRow}>
        <FilterChip label="Details" selected={tab === 'details'} onPress={() => setTab('details')} />
        <FilterChip label="Photos" selected={tab === 'photos'} onPress={() => setTab('photos')} />
        {property.location ? (
          <FilterChip label="Location" selected={tab === 'location'} onPress={() => setTab('location')} />
        ) : null}
        {(property.owners || property.privateDetails) ? (
          <FilterChip label="🔒 Private" selected={tab === 'private'} onPress={() => setTab('private')} />
        ) : null}
      </View>

      {tab === 'details' && (
        <Card style={styles.tabCard}>
          <Row label="Bedrooms" value={property.bedrooms?.toString() ?? '—'} />
          <Row label="Bathrooms" value={property.bathrooms?.toString() ?? '—'} />
          <Row label="Area" value={property.areaSqm ? `${property.areaSqm} m²` : '—'} />
          <Row label="Type" value={property.propertyType} />
          <Row label="Purpose" value={property.listingPurpose} />
          {property.description ? <Text style={[typography.body, styles.description]}>{property.description}</Text> : null}
          {property.features.filter((f) => f.value).length > 0 && (
            <View style={styles.chipRow}>
              {property.features
                .filter((f) => f.value)
                .map((feature) => (
                  <View key={feature.featureKey} style={styles.featureChip}>
                    <Text style={styles.featureChipText}>{feature.featureKey}</Text>
                  </View>
                ))}
            </View>
          )}
        </Card>
      )}

      {tab === 'photos' && property.propertyStatus !== 'ARCHIVED' && (
        <Card style={styles.tabCard}>
          {images.length === 0 ? (
            <Text style={styles.hint}>No photos yet.</Text>
          ) : (
            <View style={styles.photoGrid}>
              {images.map((media) =>
                photoUrls[media.id] ? (
                  <Image key={media.id} source={{ uri: photoUrls[media.id] }} style={styles.photoThumb} />
                ) : (
                  <View key={media.id} style={[styles.photoThumb, styles.heroPlaceholder]} />
                ),
              )}
            </View>
          )}
          {permissions.has('property.edit') && (
            <Button label="Add Photo" size="sm" variant="secondary" onPress={() => void onAddPhoto()} loading={uploadingPhoto} style={styles.pubButton} />
          )}
        </Card>
      )}

      {tab === 'location' && property.location && (
        <Card style={styles.tabCard}>
          <Row label="City" value={property.location.city ?? '—'} />
          <Row label="Area" value={property.location.area ?? '—'} />
          <Row label="Coordinates" value={`${property.location.latitude.toFixed(6)}, ${property.location.longitude.toFixed(6)}`} />
          <Text style={styles.hint}>Exact location — private, visible only to authorized professionals.</Text>
          <Button label="Edit Location" size="sm" variant="secondary" onPress={() => setMapVisible(true)} style={styles.pubButton} />
        </Card>
      )}

      {tab === 'private' && (
        <Card style={styles.tabCard}>
          <Text style={styles.lockNotice}>🔒 Only authorized workspace members can see this section.</Text>
          {property.owners && property.owners.length > 0 && (
            <View style={styles.privateBlock}>
              <Text style={typography.label}>Owner</Text>
              {property.owners.map((owner) => (
                <View key={owner.id} style={styles.ownerBlock}>
                  <Text style={typography.body}>{owner.fullName}</Text>
                  {owner.phone ? <Text style={typography.bodySmall}>{owner.phone}</Text> : null}
                </View>
              ))}
            </View>
          )}
          {property.privateDetails && (
            <View style={styles.privateBlock}>
              <Text style={typography.label}>Internal Notes</Text>
              <Text style={[typography.body, styles.description]}>
                {property.privateDetails.internalNotes ?? '—'}
              </Text>
              {property.privateDetails.commissionNotes !== undefined && (
                <>
                  <Text style={[typography.label, styles.commissionTitle]}>Commission</Text>
                  <Text style={[typography.body, styles.description]}>
                    {property.privateDetails.commissionNotes ?? '—'}
                  </Text>
                </>
              )}
            </View>
          )}
        </Card>
      )}

      {permissions.has('property.archive') &&
        (property.propertyStatus === 'ARCHIVED' ? (
          <Button label="Restore Property" onPress={() => void onRestore()} loading={restoring} style={styles.bottomAction} />
        ) : (
          <Button label="Archive Property" variant="destructive" onPress={onArchive} style={styles.bottomAction} />
        ))}

      {property.location && (
        <MapLocationPicker
          visible={mapVisible}
          initialDraft={initialDraftFromSavedLocation(property.location)}
          onCancel={() => setMapVisible(false)}
          onSave={(draft) => void onSaveLocation(draft)}
        />
      )}
      {savingLocation && (
        <View style={styles.savingOverlay}>
          <LoadingState />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  heroWrap: { marginBottom: spacing.md },
  hero: { width: '100%', height: 220, borderRadius: radii.image, backgroundColor: colors.border },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoCountBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: 'rgba(15,31,51,0.7)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  photoCountText: { color: colors.text.inverse, fontSize: 12, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  titleText: { flexShrink: 1 },
  editIcon: { fontSize: 16, color: colors.brand.primaryNavy },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md },
  archivedBanner: { backgroundColor: colors.status.pending.bg, marginBottom: spacing.md },
  archivedBannerText: { color: colors.status.pending.fg, fontSize: 13 },
  publicationCard: { marginBottom: spacing.lg },
  hint: { color: colors.text.secondary, fontSize: 12, marginTop: spacing.xs },
  warningText: { color: colors.status.pending.fg, fontSize: 13, marginTop: spacing.xs },
  pubButton: { alignSelf: 'flex-start', marginTop: spacing.sm },
  pubButtonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  tabsRow: { flexDirection: 'row', marginBottom: spacing.md },
  tabCard: { marginBottom: spacing.lg },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  detailValue: { fontWeight: '600' },
  description: { marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  featureChip: { paddingHorizontal: spacing.smd, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.background },
  featureChipText: { color: colors.text.primary, fontSize: 13 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoThumb: { width: 84, height: 84, borderRadius: radii.control, backgroundColor: colors.border },
  lockNotice: { color: colors.text.secondary, fontSize: 12, marginBottom: spacing.sm },
  privateBlock: { marginBottom: spacing.md },
  ownerBlock: { marginBottom: spacing.sm, marginTop: spacing.xs },
  commissionTitle: { marginTop: spacing.smd },
  bottomAction: { marginTop: spacing.sm },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
