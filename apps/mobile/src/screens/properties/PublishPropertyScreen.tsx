import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { getMediaAccessUrl, getProperty } from '../../api/properties';
import { getPublication, savePublicationDraft, submitPublication } from '../../api/publications';
import { ApiError } from '../../api/client';
import type { PropertyDetail, PropertyLocationVisibility } from '../../api/types';
import type { PropertiesStackParamList } from '../../navigation/PropertiesStack';

type Props = NativeStackScreenProps<PropertiesStackParamList, 'PublishProperty'>;

const VISIBILITY_OPTIONS: { value: PropertyLocationVisibility; label: string }[] = [
  { value: 'PRIVATE', label: 'Hidden' },
  { value: 'WORKSPACE', label: 'Hidden' },
  { value: 'PUBLIC_APPROXIMATE', label: 'City & Area' },
  { value: 'PUBLIC_EXACT', label: 'Exact Pin' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

interface ImageOption {
  id: string;
  filename: string;
  url: string | null;
}

/**
 * A single scrollable form, matching the established simplification for
 * property forms on mobile (see AddPropertyScreen) — every field the
 * spec's "Prepare Public Listing" step list calls for is present, without
 * a literal paginated wizard. `propertyType`/`listingPurpose` are shown
 * read-only (mirrored from the actual property) rather than editable —
 * a listing should never claim to be a different type of property than
 * it actually is.
 */
export function PublishPropertyScreen({ route, navigation }: Props): React.JSX.Element {
  const { propertyId } = route.params;
  const { currentWorkspace } = useAuth();

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [images, setImages] = useState<ImageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [publicTitle, setPublicTitle] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [publicPrice, setPublicPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [featureKeys, setFeatureKeys] = useState<Set<string>>(new Set());
  const [locationVisibility, setLocationVisibility] =
    useState<PropertyLocationVisibility>('PRIVATE');
  const [publicCity, setPublicCity] = useState('');
  const [publicArea, setPublicArea] = useState('');
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [mainMediaId, setMainMediaId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setError(null);
    try {
      const [detail, publication] = await Promise.all([
        getProperty(currentWorkspace.id, propertyId),
        getPublication(currentWorkspace.id, propertyId),
      ]);
      setProperty(detail);

      const imageMedia = detail.media.filter((m) => m.mediaType === 'IMAGE');
      const resolved = await Promise.all(
        imageMedia.map(async (media) => {
          try {
            const { url } = await getMediaAccessUrl(currentWorkspace.id, propertyId, media.id);
            return { id: media.id, filename: media.originalFileName, url };
          } catch {
            return { id: media.id, filename: media.originalFileName, url: null };
          }
        }),
      );
      setImages(resolved);

      if (publication) {
        const snap = publication.snapshot;
        setPublicTitle(snap.publicTitle);
        setPublicDescription(snap.publicDescription ?? '');
        setPublicPrice(String(snap.publicPrice));
        setCurrency(snap.currency);
        setBedrooms(snap.bedrooms !== null ? String(snap.bedrooms) : '');
        setBathrooms(snap.bathrooms !== null ? String(snap.bathrooms) : '');
        setAreaSqm(snap.areaSqm !== null ? String(snap.areaSqm) : '');
        setFeatureKeys(new Set(snap.publicFeatureKeys));
        setLocationVisibility(snap.locationVisibility);
        setPublicCity(snap.publicCity ?? '');
        setPublicArea(snap.publicArea ?? '');
        const sortedMedia = [...snap.media].sort((a, b) => a.sortOrder - b.sortOrder);
        setSelectedMediaIds(sortedMedia.map((m) => m.propertyMediaId));
        setMainMediaId(sortedMedia.find((m) => m.isMain)?.propertyMediaId ?? null);
      } else {
        setPublicTitle(detail.title);
        setPublicDescription(detail.description ?? '');
        setPublicPrice(String(detail.price));
        setCurrency(detail.currency);
        setBedrooms(detail.bedrooms !== null ? String(detail.bedrooms) : '');
        setBathrooms(detail.bathrooms !== null ? String(detail.bathrooms) : '');
        setAreaSqm(detail.areaSqm !== null ? String(detail.areaSqm) : '');
        setFeatureKeys(new Set(detail.features.filter((f) => f.value).map((f) => f.featureKey)));
        setPublicCity(detail.location?.city ?? detail.city ?? '');
        setPublicArea(detail.location?.area ?? detail.area ?? '');
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

  const toggleFeature = (key: string) => {
    setFeatureKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleImage = (id: string) => {
    setSelectedMediaIds((current) => {
      if (current.includes(id)) {
        const next = current.filter((mediaId) => mediaId !== id);
        if (mainMediaId === id) setMainMediaId(next[0] ?? null);
        return next;
      }
      const next = [...current, id];
      if (!mainMediaId) setMainMediaId(id);
      return next;
    });
  };

  const buildDraftInput = () => ({
    publicTitle: publicTitle.trim(),
    publicDescription: publicDescription.trim() || undefined,
    publicPrice: Number(publicPrice),
    currency: currency.trim().toUpperCase(),
    propertyType: property!.propertyType,
    listingPurpose: property!.listingPurpose,
    bedrooms: bedrooms ? Number(bedrooms) : undefined,
    bathrooms: bathrooms ? Number(bathrooms) : undefined,
    areaSqm: areaSqm ? Number(areaSqm) : undefined,
    publicFeatureKeys: [...featureKeys],
    locationVisibility,
    publicCity: publicCity.trim() || undefined,
    publicArea: publicArea.trim() || undefined,
    media: selectedMediaIds.map((id) => ({ propertyMediaId: id, isMain: id === mainMediaId })),
  });

  const onSaveDraft = async () => {
    if (!currentWorkspace || !property) return;
    if (!publicTitle.trim() || !publicPrice) {
      Alert.alert('Missing information', 'A public title and price are required.');
      return;
    }
    setSaving(true);
    try {
      await savePublicationDraft(currentWorkspace.id, propertyId, buildDraftInput());
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        'Could not save draft',
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const onSubmitForReview = async () => {
    if (!currentWorkspace || !property) return;
    if (selectedMediaIds.length === 0) {
      Alert.alert('Add a photo', 'Select at least one public photo before submitting.');
      return;
    }
    setSaving(true);
    try {
      await savePublicationDraft(currentWorkspace.id, propertyId, buildDraftInput());
      await submitPublication(currentWorkspace.id, propertyId);
      Alert.alert('Submitted', 'Your listing has been sent for admin review.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not submit', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
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
      <Text style={styles.hint}>
        Owner contact info, private notes, commission, and internal reference numbers are never
        published — only what you fill in below is ever shown to clients.
      </Text>

      <Section title="Public Title & Description">
        <TextInput
          style={styles.input}
          placeholder="Public title"
          value={publicTitle}
          onChangeText={setPublicTitle}
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Public description"
          value={publicDescription}
          onChangeText={setPublicDescription}
          multiline
        />
      </Section>

      <Section title="Price">
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Price"
            keyboardType="numeric"
            value={publicPrice}
            onChangeText={setPublicPrice}
          />
          <TextInput
            style={[styles.input, styles.currencyInput]}
            placeholder="USD"
            autoCapitalize="characters"
            maxLength={3}
            value={currency}
            onChangeText={setCurrency}
          />
        </View>
      </Section>

      <Section title="Details">
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Bedrooms"
            keyboardType="numeric"
            value={bedrooms}
            onChangeText={setBedrooms}
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Bathrooms"
            keyboardType="numeric"
            value={bathrooms}
            onChangeText={setBathrooms}
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Area (sqm)"
            keyboardType="numeric"
            value={areaSqm}
            onChangeText={setAreaSqm}
          />
        </View>
        <Text style={styles.hint}>
          {property.propertyType} · {property.listingPurpose}
        </Text>
      </Section>

      <Section title="Public Features">
        <View style={styles.chipRow}>
          {property.features
            .filter((f) => f.value)
            .map((f) => (
              <TouchableOpacity
                key={f.featureKey}
                style={[styles.chip, featureKeys.has(f.featureKey) && styles.chipActive]}
                onPress={() => toggleFeature(f.featureKey)}
              >
                <Text
                  style={[styles.chipText, featureKeys.has(f.featureKey) && styles.chipTextActive]}
                >
                  {f.featureKey}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
      </Section>

      <Section title="Public Location">
        <View style={styles.chipRow}>
          {VISIBILITY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.chip, locationVisibility === option.value && styles.chipActive]}
              onPress={() => setLocationVisibility(option.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  locationVisibility === option.value && styles.chipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {(locationVisibility === 'PUBLIC_APPROXIMATE' || locationVisibility === 'PUBLIC_EXACT') && (
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.flex1]}
              placeholder="City"
              value={publicCity}
              onChangeText={setPublicCity}
            />
            <TextInput
              style={[styles.input, styles.flex1]}
              placeholder="Area"
              value={publicArea}
              onChangeText={setPublicArea}
            />
          </View>
        )}
        {locationVisibility === 'PUBLIC_EXACT' && !property.location && (
          <Text style={styles.warningText}>
            This property has no saved location — set one before choosing an exact pin.
          </Text>
        )}
      </Section>

      <Section title="Public Photos">
        {images.length === 0 ? (
          <Text style={styles.hint}>Upload at least one photo on the property first.</Text>
        ) : (
          <View style={styles.imageRow}>
            {images.map((image) => {
              const selected = selectedMediaIds.includes(image.id);
              return (
                <TouchableOpacity
                  key={image.id}
                  style={[styles.imageOption, selected && styles.imageOptionSelected]}
                  onPress={() => toggleImage(image.id)}
                >
                  {image.url ? (
                    <Image source={{ uri: image.url }} style={styles.imageThumb} />
                  ) : (
                    <View style={[styles.imageThumb, styles.imagePlaceholder]} />
                  )}
                  {selected && mainMediaId === image.id && (
                    <Text style={styles.mainBadge}>Main</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Section>

      <TouchableOpacity style={styles.secondaryButton} onPress={onSaveDraft} disabled={saving}>
        <Text style={styles.secondaryButtonText}>Save Draft</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.primaryButton} onPress={onSubmitForReview} disabled={saving}>
        <Text style={styles.primaryButtonText}>{saving ? 'Submitting…' : 'Submit for Review'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#c0392b' },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  hint: { color: '#888', fontSize: 12, marginBottom: 8 },
  warningText: { color: '#a15c00', fontSize: 12, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  currencyInput: { width: 80 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: '#1a73e8' },
  chipText: { color: '#333', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageOption: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageOptionSelected: { borderColor: '#1a73e8' },
  imageThumb: { width: 72, height: 72, backgroundColor: '#eee' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  mainBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: '#1a73e8',
    color: '#fff',
    fontSize: 9,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1a73e8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: { color: '#1a73e8', fontWeight: '600' },
  primaryButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
});
