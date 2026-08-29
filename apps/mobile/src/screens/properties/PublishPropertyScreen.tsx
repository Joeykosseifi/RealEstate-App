import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { getMediaAccessUrl, getProperty } from '../../api/properties';
import { getPublication, savePublicationDraft, submitPublication } from '../../api/publications';
import { ApiError } from '../../api/client';
import type { PropertyDetail, PropertyLocationVisibility } from '../../api/types';
import type { PropertiesStackParamList } from '../../navigation/PropertiesStack';
import { AppScreen, Button, Card, ErrorState, FilterChip, LoadingState, TextField } from '../../components/ui';
import { colors, priceText, radii, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<PropertiesStackParamList, 'PublishProperty'>;

const VISIBILITY_OPTIONS: { value: PropertyLocationVisibility; label: string }[] = [
  { value: 'PRIVATE', label: 'Hidden' },
  { value: 'WORKSPACE', label: 'Hidden' },
  { value: 'PUBLIC_APPROXIMATE', label: 'City & Area' },
  { value: 'PUBLIC_EXACT', label: 'Exact Pin' },
];

interface ImageOption {
  id: string;
  filename: string;
  url: string | null;
}

/**
 * "Prepare for Publication" (Milestone 7 spec §18) — a single scrollable
 * form, matching the established simplification for property forms on
 * mobile (see AddPropertyScreen). Only publication-related decisions the
 * backend already supports appear here; private fields (owner, private
 * notes, commission) never become publication fields — this screen has
 * no code path that can even read them. `propertyType`/`listingPurpose`
 * are shown read-only, mirrored from the actual property.
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
  const [locationVisibility, setLocationVisibility] = useState<PropertyLocationVisibility>('PRIVATE');
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
      Alert.alert('Could not save draft', err instanceof ApiError ? err.message : 'Please try again.');
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

  if (loading) return <LoadingState />;
  if (error || !property) return <ErrorState message={error ?? 'Property not found.'} onRetry={() => void load()} />;

  const mainImageUrl = images.find((i) => i.id === mainMediaId)?.url ?? null;

  return (
    <AppScreen>
      <Text style={[typography.bodySmall, styles.disclaimer]}>
        Owner contact info, private notes, commission, and internal reference numbers are never
        published — only what you fill in below is ever shown to clients.
      </Text>

      <Text style={typography.label}>Preview</Text>
      <Card style={styles.previewCard}>
        <View style={styles.previewRow}>
          {mainImageUrl ? (
            <Image source={{ uri: mainImageUrl }} style={styles.previewImage} />
          ) : (
            <View style={[styles.previewImage, styles.previewImagePlaceholder]} />
          )}
          <View style={styles.previewText}>
            <Text style={typography.h3} numberOfLines={1}>
              {publicTitle || 'Untitled listing'}
            </Text>
            <Text style={priceText}>
              {currency} {publicPrice || '0'}
            </Text>
            <Text style={typography.caption}>{[publicArea, publicCity].filter(Boolean).join(', ') || 'No public location'}</Text>
          </View>
        </View>
      </Card>

      <Text style={typography.label}>Public Title & Description</Text>
      <TextField label="Title" value={publicTitle} onChangeText={setPublicTitle} />
      <TextField label="Description" value={publicDescription} onChangeText={setPublicDescription} multiline optional />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <TextField label="Price" value={publicPrice} onChangeText={setPublicPrice} keyboardType="numeric" />
        </View>
        <View style={styles.currencyField}>
          <TextField label="Currency" value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.flex1}>
          <TextField label="Bedrooms" value={bedrooms} onChangeText={setBedrooms} keyboardType="numeric" optional />
        </View>
        <View style={styles.flex1}>
          <TextField label="Bathrooms" value={bathrooms} onChangeText={setBathrooms} keyboardType="numeric" optional />
        </View>
        <View style={styles.flex1}>
          <TextField label="Area (m²)" value={areaSqm} onChangeText={setAreaSqm} keyboardType="numeric" optional />
        </View>
      </View>
      <Text style={[typography.bodySmall, styles.typeHint]}>
        {property.propertyType} · {property.listingPurpose}
      </Text>

      <Text style={typography.label}>Public Features</Text>
      <View style={styles.chipRow}>
        {property.features
          .filter((f) => f.value)
          .map((f) => (
            <FilterChip key={f.featureKey} label={f.featureKey.replaceAll('_', ' ')} selected={featureKeys.has(f.featureKey)} onPress={() => toggleFeature(f.featureKey)} />
          ))}
      </View>

      <Text style={typography.label}>Public Location</Text>
      <View style={styles.chipRow}>
        {VISIBILITY_OPTIONS.map((option) => (
          <FilterChip key={option.value} label={option.label} selected={locationVisibility === option.value} onPress={() => setLocationVisibility(option.value)} />
        ))}
      </View>
      {(locationVisibility === 'PUBLIC_APPROXIMATE' || locationVisibility === 'PUBLIC_EXACT') && (
        <View style={styles.row}>
          <View style={styles.flex1}>
            <TextField label="City" value={publicCity} onChangeText={setPublicCity} />
          </View>
          <View style={styles.flex1}>
            <TextField label="Area" value={publicArea} onChangeText={setPublicArea} />
          </View>
        </View>
      )}
      {locationVisibility === 'PUBLIC_EXACT' && !property.location && (
        <Text style={styles.warningText}>This property has no saved location — set one before choosing an exact pin.</Text>
      )}

      <Text style={typography.label}>Public Photos</Text>
      {images.length === 0 ? (
        <Text style={[typography.bodySmall, styles.spacedBelow]}>Upload at least one photo on the property first.</Text>
      ) : (
        <View style={styles.imageRow}>
          {images.map((image) => {
            const selected = selectedMediaIds.includes(image.id);
            return (
              <TouchableOpacity key={image.id} style={[styles.imageOption, selected && styles.imageOptionSelected]} onPress={() => toggleImage(image.id)}>
                {image.url ? (
                  <Image source={{ uri: image.url }} style={styles.imageThumb} />
                ) : (
                  <View style={[styles.imageThumb, styles.previewImagePlaceholder]} />
                )}
                {selected && mainMediaId === image.id ? (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainBadgeText}>Main</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Button label="Save Draft" variant="secondary" onPress={() => void onSaveDraft()} disabled={saving} style={styles.actionButton} />
      <Button label="Submit for Review" onPress={() => void onSubmitForReview()} loading={saving} style={styles.actionButton} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  disclaimer: { marginBottom: spacing.md },
  previewCard: { marginBottom: spacing.lg },
  previewRow: { flexDirection: 'row', gap: spacing.smd },
  previewImage: { width: 72, height: 72, borderRadius: radii.control, backgroundColor: colors.border },
  previewImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  previewText: { flex: 1, justifyContent: 'center', gap: 2 },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  currencyField: { width: 96 },
  typeHint: { marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  warningText: { color: colors.status.pending.fg, fontSize: 12, marginTop: spacing.xs, marginBottom: spacing.sm },
  spacedBelow: { marginBottom: spacing.md },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  imageOption: { borderWidth: 2, borderColor: 'transparent', borderRadius: radii.control, overflow: 'hidden' },
  imageOptionSelected: { borderColor: colors.brand.primaryNavy },
  imageThumb: { width: 72, height: 72, backgroundColor: colors.border },
  mainBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: colors.brand.gold,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  mainBadgeText: { color: colors.text.onGold, fontSize: 9, fontWeight: '700' },
  actionButton: { marginTop: spacing.sm },
});
