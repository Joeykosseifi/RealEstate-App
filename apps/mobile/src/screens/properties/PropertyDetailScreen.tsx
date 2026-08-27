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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import {
  archiveProperty,
  getMediaAccessUrl,
  getProperty,
  updatePropertyLocation,
} from '../../api/properties';
import { ApiError } from '../../api/client';
import type { PropertyDetail } from '../../api/types';
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
  const { currentWorkspace } = useAuth();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setError(null);
    try {
      const detail = await getProperty(currentWorkspace.id, propertyId);
      setProperty(detail);
      if (detail.primaryMedia) {
        const { url } = await getMediaAccessUrl(
          currentWorkspace.id,
          propertyId,
          detail.primaryMedia.id,
        );
        setPrimaryImageUrl(url);
      }
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
          await archiveProperty(currentWorkspace.id, propertyId);
          navigation.goBack();
        },
      },
    ]);
  };

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

      <Text style={styles.title}>{property.title}</Text>
      <Text style={styles.price}>
        {property.currency} {property.price.toLocaleString()}
      </Text>
      <Text style={styles.status}>
        {property.propertyStatus} · {property.propertyType} · {property.listingPurpose}
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <Row label="Bedrooms" value={property.bedrooms?.toString() ?? '—'} />
        <Row label="Bathrooms" value={property.bathrooms?.toString() ?? '—'} />
        <Row label="Area" value={property.areaSqm ? `${property.areaSqm} sqm` : '—'} />
        {property.description ? (
          <Text style={styles.description}>{property.description}</Text>
        ) : null}
      </View>

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

      <TouchableOpacity style={styles.archiveButton} onPress={onArchive}>
        <Text style={styles.archiveButtonText}>Archive Property</Text>
      </TouchableOpacity>

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
  title: { fontSize: 22, fontWeight: '700' },
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
  archiveButton: {
    borderWidth: 1,
    borderColor: '#c0392b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  archiveButtonText: { color: '#c0392b', fontWeight: '600' },
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
