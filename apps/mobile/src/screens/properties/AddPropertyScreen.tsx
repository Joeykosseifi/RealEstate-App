import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { createProperty, uploadPropertyMedia } from '../../api/properties';
import { PROPERTY_FEATURE_KEYS } from '../../properties/featureKeys';
import { ApiError } from '../../api/client';
import { MapLocationPicker } from '../../location/MapLocationPicker';
import { toLocationDto, type LocationDraft } from '../../location/locationPayload';
import type { PropertiesStackParamList } from '../../navigation/PropertiesStack';
import { AppScreen, Button, Card, FilterChip, TextField } from '../../components/ui';
import { colors, radii, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<PropertiesStackParamList, 'AddProperty'>;

const PROPERTY_TYPES = [
  'APARTMENT',
  'VILLA',
  'HOUSE',
  'LAND',
  'OFFICE',
  'SHOP',
  'COMMERCIAL',
  'WAREHOUSE',
  'BUILDING',
  'CHALET',
  'OTHER',
];
const LISTING_PURPOSES = ['SALE', 'RENT'];

const STEP_TITLES = ['Basic Information', 'Location', 'Details & Features', 'Photos & Private Info', 'Review & Save'];

interface PendingPhoto {
  uri: string;
  fileName: string;
  mimeType: string;
}

function ChipPicker({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <FilterChip key={option} label={option} selected={value === option} onPress={() => onChange(option)} />
      ))}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={typography.bodySmall}>{label}</Text>
      <Text style={[typography.body, styles.summaryValue]}>{value}</Text>
    </View>
  );
}

/**
 * The V1 "Add Property" workflow (Milestone 7 spec §16) — a 5-step
 * wizard replacing the earlier single scrollable form. Every field maps
 * to a real, already-existing `CreatePropertyDto` field (see
 * docs/API.md) — nothing here invents new backend capability. Saving
 * (step 5) always creates the property PRIVATELY (see docs/PRODUCT.md
 * "Saving is not publishing") — publication is a wholly separate flow
 * reached later from the property's own detail screen.
 */
export function AddPropertyScreen({ navigation }: Props): React.JSX.Element {
  const { currentWorkspace } = useAuth();
  const [step, setStep] = useState(0);

  // Step 1 — Basic Information
  const [propertyType, setPropertyType] = useState('APARTMENT');
  const [listingPurpose, setListingPurpose] = useState('SALE');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [floor, setFloor] = useState('');
  const [description, setDescription] = useState('');

  // Step 2 — Location
  const [location, setLocation] = useState<LocationDraft | null>(null);
  const [mapVisible, setMapVisible] = useState(false);

  // Step 3 — Details & Features
  const [features, setFeatures] = useState<Set<string>>(new Set());
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [totalFloors, setTotalFloors] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');

  // Step 4 — Photos & Private Information
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [commissionNotes, setCommissionNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const toggleFeature = (key: string) => {
    setFeatures((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const validateStep1 = (): string | null => {
    const parsedPrice = Number(price);
    if (!title.trim()) return 'Title is required.';
    if (!price.trim() || Number.isNaN(parsedPrice) || parsedPrice < 0) return 'Enter a valid price.';
    if (currency.trim().length !== 3) return 'Currency must be a 3-letter code (e.g. USD).';
    return null;
  };

  const onNext = () => {
    if (step === 0) {
      const validationError = validateStep1();
      setStepError(validationError);
      if (validationError) return;
    }
    setStepError(null);
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  };

  const onBack = () => {
    if (step === 0) {
      navigation.goBack();
      return;
    }
    setStepError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const onPickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (result.canceled) return;
    setPendingPhotos((current) => [
      ...current,
      ...result.assets.map((asset) => ({
        uri: asset.uri,
        fileName: asset.fileName ?? `photo-${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
      })),
    ]);
  };

  const removePhoto = (index: number) =>
    setPendingPhotos((current) => current.filter((_, i) => i !== index));

  const movePhoto = (index: number, direction: -1 | 1) => {
    setPendingPhotos((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const onSave = async () => {
    if (!currentWorkspace) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await createProperty(currentWorkspace.id, {
        propertyType,
        listingPurpose,
        title: title.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        currency: currency.trim().toUpperCase(),
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        areaSqm: areaSqm ? Number(areaSqm) : undefined,
        floor: floor ? Number(floor) : undefined,
        totalFloors: totalFloors ? Number(totalFloors) : undefined,
        yearBuilt: yearBuilt ? Number(yearBuilt) : undefined,
        featureKeys: [...features],
        location: location ? toLocationDto(location) : undefined,
        owners: ownerName.trim()
          ? [
              {
                fullName: ownerName.trim(),
                phone: ownerPhone.trim() || undefined,
                email: ownerEmail.trim() || undefined,
              },
            ]
          : undefined,
        privateDetails:
          internalNotes.trim() || commissionNotes.trim()
            ? {
                internalNotes: internalNotes.trim() || undefined,
                commissionNotes: commissionNotes.trim() || undefined,
              }
            : undefined,
      });

      if (pendingPhotos.length > 0) {
        setUploadProgress({ done: 0, total: pendingPhotos.length });
        for (let i = 0; i < pendingPhotos.length; i++) {
          const photo = pendingPhotos[i];
          try {
            await uploadPropertyMedia(
              currentWorkspace.id,
              created.id,
              { uri: photo.uri, name: photo.fileName, type: photo.mimeType },
              'IMAGE',
            );
          } catch {
            // A single photo failing to upload shouldn't lose the saved
            // property — the agent can retry from Property Detail's
            // Photos tab, where the same upload action already exists.
          }
          setUploadProgress({ done: i + 1, total: pendingPhotos.length });
        }
      }

      navigation.replace('PropertyDetail', { propertyId: created.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this property.');
      setStep(4);
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const locationSummary = location
    ? (location.address ?? [location.area, location.city].filter(Boolean).join(', ')) || 'Pin placed'
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        {STEP_TITLES.map((label, index) => (
          <View key={label} style={styles.progressItem}>
            <View style={[styles.progressDot, index <= step && styles.progressDotActive]} />
            {index < STEP_TITLES.length - 1 ? (
              <View style={[styles.progressLine, index < step && styles.progressLineActive]} />
            ) : null}
          </View>
        ))}
      </View>
      <Text style={styles.stepLabel}>
        Step {step + 1} of {STEP_TITLES.length} · {STEP_TITLES[step]}
      </Text>

      <AppScreen>
        {step === 0 && (
          <>
            <Text style={typography.label}>Property Type</Text>
            <ChipPicker options={PROPERTY_TYPES} value={propertyType} onChange={setPropertyType} />
            <Text style={typography.label}>Sale or Rent</Text>
            <ChipPicker options={LISTING_PURPOSES} value={listingPurpose} onChange={setListingPurpose} />

            <TextField label="Title" value={title} onChangeText={setTitle} />
            <View style={styles.row}>
              <View style={styles.flex1}>
                <TextField label="Price" value={price} onChangeText={setPrice} keyboardType="numeric" />
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
            </View>
            <View style={styles.row}>
              <View style={styles.flex1}>
                <TextField label="Area (m²)" value={areaSqm} onChangeText={setAreaSqm} keyboardType="numeric" optional />
              </View>
              <View style={styles.flex1}>
                <TextField label="Floor" value={floor} onChangeText={setFloor} keyboardType="numeric" optional />
              </View>
            </View>
            <TextField label="Description" value={description} onChangeText={setDescription} multiline optional />
            {stepError ? <Text style={styles.error}>{stepError}</Text> : null}
          </>
        )}

        {step === 1 && (
          <>
            <Text style={[typography.body, styles.hint]}>
              Set the property's real location — this is saved privately to your workspace. You'll
              choose what (if anything) to show publicly later, in a separate publication step.
            </Text>
            <Card style={styles.locationCard}>
              {locationSummary ? (
                <>
                  <Text style={typography.h3}>{locationSummary}</Text>
                  <Text style={typography.bodySmall}>
                    {location!.latitude.toFixed(6)}, {location!.longitude.toFixed(6)}
                  </Text>
                </>
              ) : (
                <Text style={typography.bodySmall}>No location set yet.</Text>
              )}
              <Button
                label={location ? 'Change Location' : 'Set Location'}
                variant="secondary"
                size="sm"
                onPress={() => setMapVisible(true)}
                style={styles.locationButton}
              />
            </Card>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={typography.label}>Features & Amenities</Text>
            <View style={styles.chipRow}>
              {PROPERTY_FEATURE_KEYS.map((key) => (
                <FilterChip key={key} label={key.replaceAll('_', ' ')} selected={features.has(key)} onPress={() => toggleFeature(key)} />
              ))}
            </View>

            {!showMoreDetails ? (
              <TouchableOpacity onPress={() => setShowMoreDetails(true)} style={styles.moreDetailsLink}>
                <Text style={styles.moreDetailsText}>More details</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.row}>
                <View style={styles.flex1}>
                  <TextField label="Total floors" value={totalFloors} onChangeText={setTotalFloors} keyboardType="numeric" optional />
                </View>
                <View style={styles.flex1}>
                  <TextField label="Year built" value={yearBuilt} onChangeText={setYearBuilt} keyboardType="numeric" optional />
                </View>
              </View>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={typography.label}>Photos</Text>
            <View style={styles.photoGrid}>
              {pendingPhotos.map((photo, index) => (
                <View key={photo.uri} style={styles.photoTile}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                  {index === 0 ? (
                    <View style={styles.mainBadge}>
                      <Text style={styles.mainBadgeText}>Main</Text>
                    </View>
                  ) : null}
                  <View style={styles.photoActions}>
                    <TouchableOpacity onPress={() => movePhoto(index, -1)} disabled={index === 0} hitSlop={6}>
                      <Text style={[styles.photoActionText, index === 0 && styles.photoActionDisabled]}>◀</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removePhoto(index)} hitSlop={6}>
                      <Text style={styles.photoActionRemove}>✕</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => movePhoto(index, 1)} disabled={index === pendingPhotos.length - 1} hitSlop={6}>
                      <Text style={[styles.photoActionText, index === pendingPhotos.length - 1 && styles.photoActionDisabled]}>▶</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
            <Button label="+ Add Photos" variant="secondary" size="sm" onPress={() => void onPickPhotos()} style={styles.addPhotosButton} />

            <View style={styles.privateSection}>
              <Text style={styles.lockNotice}>🔒 Private Information</Text>
              <Text style={[typography.bodySmall, styles.lockHint]}>
                Only authorized workspace members can access this information.
              </Text>
              <TextField label="Owner name" value={ownerName} onChangeText={setOwnerName} optional />
              <TextField label="Owner phone" value={ownerPhone} onChangeText={setOwnerPhone} keyboardType="phone-pad" optional />
              <TextField label="Owner email" value={ownerEmail} onChangeText={setOwnerEmail} keyboardType="email-address" autoCapitalize="none" optional />
              <TextField label="Internal notes" value={internalNotes} onChangeText={setInternalNotes} multiline optional />
              <TextField label="Commission notes" value={commissionNotes} onChangeText={setCommissionNotes} multiline optional />
            </View>
          </>
        )}

        {step === 4 && (
          <>
            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeaderRow}>
                <Text style={typography.h3}>Basic Information</Text>
                <TouchableOpacity onPress={() => setStep(0)}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              <SummaryRow label="Type" value={`${propertyType} · ${listingPurpose}`} />
              <SummaryRow label="Title" value={title || '—'} />
              <SummaryRow label="Price" value={`${currency} ${price || '0'}`} />
              <SummaryRow label="Beds / Baths / Area" value={`${bedrooms || '—'} / ${bathrooms || '—'} / ${areaSqm || '—'} m²`} />
            </Card>

            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeaderRow}>
                <Text style={typography.h3}>Location</Text>
                <TouchableOpacity onPress={() => setStep(1)}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              <SummaryRow label="Location" value={locationSummary ?? 'Not set'} />
            </Card>

            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeaderRow}>
                <Text style={typography.h3}>Details & Features</Text>
                <TouchableOpacity onPress={() => setStep(2)}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              <SummaryRow label="Features" value={features.size > 0 ? [...features].join(', ') : 'None selected'} />
            </Card>

            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeaderRow}>
                <Text style={typography.h3}>Photos & Private Info</Text>
                <TouchableOpacity onPress={() => setStep(3)}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              <SummaryRow label="Photos" value={`${pendingPhotos.length} selected`} />
              <SummaryRow label="Owner" value={ownerName || 'Not set'} />
            </Card>

            <Card style={styles.lockedSummary}>
              <Text style={styles.lockNotice}>🔒 This property will be saved privately to your workspace.</Text>
            </Card>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {uploadProgress ? (
              <Text style={typography.bodySmall}>
                Uploading photos: {uploadProgress.done} / {uploadProgress.total}
              </Text>
            ) : null}
          </>
        )}
      </AppScreen>

      <View style={styles.footer}>
        <Button label={step === 0 ? 'Cancel' : 'Back'} variant="secondary" onPress={onBack} disabled={submitting} style={styles.footerButton} />
        {step < STEP_TITLES.length - 1 ? (
          <Button label="Next" onPress={onNext} style={styles.footerButton} />
        ) : (
          <Button label="Save Property" onPress={() => void onSave()} loading={submitting} style={styles.footerButton} />
        )}
      </View>

      <MapLocationPicker
        visible={mapVisible}
        initialDraft={location}
        onCancel={() => setMapVisible(false)}
        onSave={(draft) => {
          setLocation(draft);
          setMapVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  progressRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  progressItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  progressDotActive: { backgroundColor: colors.brand.primaryNavy },
  progressLine: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  progressLineActive: { backgroundColor: colors.brand.primaryNavy },
  stepLabel: { textAlign: 'center', color: colors.text.secondary, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  currencyField: { width: 96 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  hint: { color: colors.text.secondary, marginBottom: spacing.md },
  locationCard: { alignItems: 'flex-start' },
  locationButton: { marginTop: spacing.smd },
  moreDetailsLink: { marginBottom: spacing.md },
  moreDetailsText: { color: colors.brand.primaryNavy, fontWeight: '600', fontSize: 13 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.smd },
  photoTile: { width: 88 },
  photoThumb: { width: 88, height: 88, borderRadius: radii.control, backgroundColor: colors.border },
  mainBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: colors.brand.gold,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  mainBadgeText: { fontSize: 10, fontWeight: '700', color: colors.text.onGold },
  photoActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 4 },
  photoActionText: { fontSize: 12, color: colors.brand.primaryNavy },
  photoActionDisabled: { color: colors.border },
  photoActionRemove: { fontSize: 12, color: colors.danger, fontWeight: '700' },
  addPhotosButton: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  privateSection: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  lockNotice: { fontWeight: '700', color: colors.text.primary, marginBottom: spacing.xs },
  lockHint: { marginBottom: spacing.smd },
  summaryCard: { marginBottom: spacing.md },
  summaryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  editLink: { color: colors.brand.primaryNavy, fontWeight: '600', fontSize: 13 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  summaryValue: { fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  lockedSummary: { backgroundColor: colors.selectedTint, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.sm },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerButton: { flex: 1 },
});
