import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import { getPublicationStatusLabel } from '../../publications/publicationStatus';
import { ApiError } from '../../api/client';
import type { PropertyDetail, PublicationDetail } from '../../api/types';
import { MapLocationPicker } from '../../location/MapLocationPicker';
import {
  initialDraftFromSavedLocation,
  toLocationDto,
  type LocationDraft,
} from '../../location/locationPayload';
import type { PropertiesStackParamList } from '../../navigation/PropertiesStack';

type Props = NativeStackScreenProps<PropertiesStackParamList, 'PropertyDetail'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function PropertyDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { propertyId } = route.params;
  const { currentWorkspace, permissions } = useAuth();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [publication, setPublication] = useState<PublicationDetail | null>(null);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      if (detail.primaryMedia) {
        const { url } = await getMediaAccessUrl(
          currentWorkspace.id,
          propertyId,
          detail.primaryMedia.id,
        );
        setPrimaryImageUrl(url);
      }
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
      const updated = await updatePropertyLocation(
        currentWorkspace.id,
        propertyId,
        toLocationDto(draft),
      );
      setProperty(updated);
      setMapVisible(false);
    } catch (err) {
      Alert.alert(
        'Could not save location',
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setSavingLocation(false);
    }
  };

  const onArchive = () => {
    if (!currentWorkspace) return;
    Alert.alert('Archive property', 'This can be restored later. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await archiveProperty(currentWorkspace.id, propertyId);
            navigation.goBack();
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
      Alert.alert(
        'Photo access needed',
        'Allow photo library access in Settings to add property photos.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      await uploadPropertyMedia(
        currentWorkspace.id,
        propertyId,
        {
          uri: asset.uri,
          name: asset.fileName ?? `photo-${Date.now()}.jpg`,
          type: asset.mimeType ?? 'image/jpeg',
        },
        'IMAGE',
      );
      await load();
    } catch (err) {
      Alert.alert(
        'Could not upload photo',
        err instanceof ApiError ? err.message : 'Please try again.',
      );
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

  const onCancelSubmission = () =>
    runPublicationAction(cancelPublicationSubmission, 'Could not cancel submission');

  const onUnpublish = () =>
    Alert.alert('Unpublish listing', 'This removes it from the public marketplace. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unpublish',
        style: 'destructive',
        onPress: () => runPublicationAction(unpublishListing, 'Could not unpublish'),
      },
    ]);

  const onRepublish = () => runPublicationAction(republishListing, 'Could not republish');

  if (loading) {
    return <ActivityIndicator style={styles.center} />;
  }
  if (error || !property) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Property not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {primaryImageUrl ? (
        <Image source={{ uri: primaryImageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>No photo yet</Text>
        </View>
      )}

      <View style={styles.titleRow}>
        <Text style={styles.title}>{property.title}</Text>
        {permissions.has('property.edit') && property.propertyStatus !== 'ARCHIVED' && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProperty', { propertyId })}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.price}>
        {property.currency} {property.price.toLocaleString()}
      </Text>
      <Text style={styles.status}>
        {property.propertyStatus} · {property.propertyType} · {property.listingPurpose}
      </Text>
      {property.propertyStatus === 'ARCHIVED' && (
        <View style={styles.archivedBanner}>
          <Text style={styles.archivedBannerText}>
            This property is archived — it no longer appears in your active list.
          </Text>
        </View>
      )}

      <View style={[styles.section, styles.publicationSection]}>
        <Text style={styles.sectionTitle}>
          Marketplace Listing · {getPublicationStatusLabel(publication?.status ?? null)}
        </Text>
        {!publication && (
          <>
            <Text style={styles.hint}>Private — not prepared for the marketplace yet.</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('PublishProperty', { propertyId })}
            >
              <Text style={styles.secondaryButtonText}>Prepare Listing</Text>
            </TouchableOpacity>
          </>
        )}
        {publication?.status === 'DRAFT' && (
          <>
            <Text style={styles.hint}>Draft — not yet submitted for review.</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('PublishProperty', { propertyId })}
            >
              <Text style={styles.secondaryButtonText}>Edit Public Listing</Text>
            </TouchableOpacity>
          </>
        )}
        {publication?.status === 'PENDING_REVIEW' && (
          <>
            <Text style={styles.hint}>Under review by the platform team.</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onCancelSubmission}
              disabled={publicationActionPending}
            >
              <Text style={styles.secondaryButtonText}>Cancel Submission</Text>
            </TouchableOpacity>
          </>
        )}
        {publication?.status === 'CHANGES_REQUESTED' && (
          <>
            <Text style={styles.warningText}>
              Changes requested: {publication.changesRequestedReason}
            </Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('PublishProperty', { propertyId })}
            >
              <Text style={styles.secondaryButtonText}>Edit & Resubmit</Text>
            </TouchableOpacity>
          </>
        )}
        {publication?.status === 'REJECTED' && (
          <>
            <Text style={styles.warningText}>Rejected: {publication.rejectionReason}</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('PublishProperty', { propertyId })}
            >
              <Text style={styles.secondaryButtonText}>Edit & Resubmit</Text>
            </TouchableOpacity>
          </>
        )}
        {publication?.status === 'PUBLISHED' && (
          <>
            <Text style={styles.hint}>Live on the public marketplace.</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('PublishProperty', { propertyId })}
            >
              <Text style={styles.secondaryButtonText}>Edit Listing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.archiveButton}
              onPress={onUnpublish}
              disabled={publicationActionPending}
            >
              <Text style={styles.archiveButtonText}>Unpublish</Text>
            </TouchableOpacity>
          </>
        )}
        {publication?.status === 'ADMIN_UNPUBLISHED' && (
          <Text style={styles.warningText}>
            Removed by the platform team: {publication.unpublishReason}
          </Text>
        )}
        {publication?.status === 'OWNER_UNPUBLISHED' && (
          <>
            <Text style={styles.hint}>Unpublished by you — property stays in your database.</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onRepublish}
              disabled={publicationActionPending}
            >
              <Text style={styles.secondaryButtonText}>Republish</Text>
            </TouchableOpacity>
          </>
        )}
        {publication?.status === 'ARCHIVED' && (
          <Text style={styles.hint}>Archived — no longer eligible for the marketplace.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <Row label="Bedrooms" value={property.bedrooms?.toString() ?? '—'} />
        <Row label="Bathrooms" value={property.bathrooms?.toString() ?? '—'} />
        <Row label="Area" value={property.areaSqm ? `${property.areaSqm} sqm` : '—'} />
        {property.description ? (
          <Text style={styles.description}>{property.description}</Text>
        ) : null}
      </View>

      {property.propertyStatus !== 'ARCHIVED' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          {property.media.filter((m) => m.mediaType === 'IMAGE').length === 0 ? (
            <Text style={styles.hint}>No photos yet.</Text>
          ) : (
            <View style={styles.photoRow}>
              {property.media
                .filter((m) => m.mediaType === 'IMAGE')
                .map((media) =>
                  photoUrls[media.id] ? (
                    <Image
                      key={media.id}
                      source={{ uri: photoUrls[media.id] }}
                      style={styles.photoThumb}
                    />
                  ) : (
                    <View key={media.id} style={[styles.photoThumb, styles.imagePlaceholder]} />
                  ),
                )}
            </View>
          )}
          {permissions.has('property.edit') && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => void onAddPhoto()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator color="#1a73e8" />
              ) : (
                <Text style={styles.secondaryButtonText}>Add Photo</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {property.features.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.chipRow}>
            {property.features
              .filter((feature) => feature.value)
              .map((feature) => (
                <View key={feature.featureKey} style={styles.chip}>
                  <Text style={styles.chipText}>{feature.featureKey}</Text>
                </View>
              ))}
          </View>
        </View>
      )}

      {/* Present only when the API included it — see docs/PERMISSIONS.md
          "Property DTO omission policy". No placeholder is shown for a
          section the caller isn't authorized to see, by design. */}
      {property.location && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <Row label="City" value={property.location.city ?? '—'} />
          <Row label="Area" value={property.location.area ?? '—'} />
          <Row
            label="Coordinates"
            value={`${property.location.latitude.toFixed(6)}, ${property.location.longitude.toFixed(6)}`}
          />
          <Text style={styles.hint}>
            Exact location — private, visible only to authorized professionals.
          </Text>
          <TouchableOpacity style={styles.editLocationButton} onPress={() => setMapVisible(true)}>
            <Text style={styles.editLocationButtonText}>Edit Location</Text>
          </TouchableOpacity>
        </View>
      )}

      {property.owners && property.owners.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Owner</Text>
          {property.owners.map((owner) => (
            <View key={owner.id} style={styles.ownerBlock}>
              <Text style={styles.detailValue}>{owner.fullName}</Text>
              {owner.phone ? <Text style={styles.detailLabel}>{owner.phone}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {property.privateDetails && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Private Notes</Text>
          {property.privateDetails.internalNotes ? (
            <Text style={styles.description}>{property.privateDetails.internalNotes}</Text>
          ) : null}
          {property.privateDetails.commissionNotes !== undefined && (
            <>
              <Text style={[styles.sectionTitle, styles.commissionTitle]}>Commission</Text>
              <Text style={styles.description}>
                {property.privateDetails.commissionNotes ?? '—'}
              </Text>
            </>
          )}
        </View>
      )}

      {permissions.has('property.archive') &&
        (property.propertyStatus === 'ARCHIVED' ? (
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={() => void onRestore()}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.restoreButtonText}>Restore Property</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.archiveButton} onPress={onArchive}>
            <Text style={styles.archiveButtonText}>Archive Property</Text>
          </TouchableOpacity>
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
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#c0392b' },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#eee',
  },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: '#999' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '700', flexShrink: 1 },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eef4ff',
  },
  editButtonText: { color: '#1a73e8', fontWeight: '600', fontSize: 13 },
  price: { fontSize: 20, fontWeight: '600', color: '#1a73e8', marginTop: 4 },
  status: { color: '#666', marginTop: 4, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  commissionTitle: { marginTop: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  detailLabel: { color: '#888' },
  detailValue: { fontWeight: '500' },
  description: { color: '#333', marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0' },
  chipText: { color: '#333', fontSize: 13 },
  ownerBlock: { marginBottom: 8 },
  hint: { color: '#888', fontSize: 12, marginTop: 4 },
  publicationSection: {
    backgroundColor: '#f7f9fc',
    padding: 12,
    borderRadius: 10,
  },
  warningText: { color: '#a15c00', fontSize: 13, marginBottom: 4 },
  secondaryButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eef4ff',
  },
  secondaryButtonText: { color: '#1a73e8', fontWeight: '600' },
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
  archivedBanner: {
    backgroundColor: '#fdf1e7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  archivedBannerText: { color: '#a15c00', fontSize: 13 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  photoThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#eee' },
  editLocationButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eef4ff',
  },
  editLocationButtonText: { color: '#1a73e8', fontWeight: '600' },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
