import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { createProperty } from '../../api/properties';
import { ApiError } from '../../api/client';
import { MapLocationPicker } from '../../location/MapLocationPicker';
import { toLocationDto, type LocationDraft } from '../../location/locationPayload';
import type { PropertiesStackParamList } from '../../navigation/PropertiesStack';

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
const FEATURE_KEYS = [
  'parking',
  'balcony',
  'elevator',
  'generator',
  'sea_view',
  'garden',
  'pool',
  'furnished',
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
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
        <TouchableOpacity
          key={option}
          style={[styles.chip, value === option && styles.chipActive]}
          onPress={() => onChange(option)}
        >
          <Text style={[styles.chipText, value === option && styles.chipTextActive]}>{option}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * A single scrollable form rather than a literal multi-step wizard —
 * every field the spec's step list asks for is present, grouped into
 * the same sections (type/purpose, basics, price, rooms/area, features,
 * location, owner, private notes) without the added state-machine
 * complexity of paginated steps. See docs/PRODUCT.md "Mobile property
 * flow" for this simplification.
 */
export function AddPropertyScreen({ navigation }: Props): React.JSX.Element {
  const { currentWorkspace } = useAuth();

  const [propertyType, setPropertyType] = useState('APARTMENT');
  const [listingPurpose, setListingPurpose] = useState('SALE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [features, setFeatures] = useState<Set<string>>(new Set());
  const [location, setLocation] = useState<LocationDraft | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFeature = (key: string) => {
    setFeatures((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const onSubmit = async () => {
    if (!currentWorkspace) return;
    setError(null);

    const parsedPrice = Number(price);
    if (!title.trim() || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Title and a valid price are required.');
      return;
    }

    setSubmitting(true);
    try {
      await createProperty(currentWorkspace.id, {
        propertyType,
        listingPurpose,
        title: title.trim(),
        description: description.trim() || undefined,
        price: parsedPrice,
        currency: currency.trim().toUpperCase(),
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        areaSqm: areaSqm ? Number(areaSqm) : undefined,
        featureKeys: [...features],
        location: location ? toLocationDto(location) : undefined,
        owners: ownerName.trim()
          ? [{ fullName: ownerName.trim(), phone: ownerPhone.trim() || undefined }]
          : undefined,
        privateDetails: internalNotes.trim() ? { internalNotes: internalNotes.trim() } : undefined,
      });
      navigation.navigate('PropertiesList');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this property.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Type & Purpose">
        <ChipPicker options={PROPERTY_TYPES} value={propertyType} onChange={setPropertyType} />
        <ChipPicker
          options={LISTING_PURPOSES}
          value={listingPurpose}
          onChange={setListingPurpose}
        />
      </Section>

      <Section title="Basic Information">
        <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
          multiline
        />
      </Section>

      <Section title="Price">
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Price"
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
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

      <Section title="Bedrooms / Bathrooms / Area">
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
      </Section>

      <Section title="Features">
        <View style={styles.chipRow}>
          {FEATURE_KEYS.map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.chip, features.has(key) && styles.chipActive]}
              onPress={() => toggleFeature(key)}
            >
              <Text style={[styles.chipText, features.has(key) && styles.chipTextActive]}>
                {key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      <Section title="Location">
        {location ? (
          <>
            <Text style={styles.locationSummary}>
              {(location.address ?? [location.area, location.city].filter(Boolean).join(', ')) ||
                'Pin placed'}
            </Text>
            <Text style={styles.hint}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          </>
        ) : (
          <Text style={styles.hint}>No location set yet.</Text>
        )}
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setMapVisible(true)}>
          <Text style={styles.secondaryButtonText}>
            {location ? 'Change Location' : 'Set Location'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          Exact property location is private and visible only to authorized professionals.
        </Text>
      </Section>

      <Section title="Owner Information">
        <TextInput
          style={styles.input}
          placeholder="Owner full name"
          value={ownerName}
          onChangeText={setOwnerName}
        />
        <TextInput
          style={styles.input}
          placeholder="Owner phone"
          value={ownerPhone}
          onChangeText={setOwnerPhone}
        />
      </Section>

      <Section title="Private Notes">
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Internal notes (not shown to clients)"
          value={internalNotes}
          onChangeText={setInternalNotes}
          multiline
        />
      </Section>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.buttonDisabled]}
        onPress={() => void onSubmit()}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Save Property</Text>
        )}
      </TouchableOpacity>

      <MapLocationPicker
        visible={mapVisible}
        initialDraft={location}
        onCancel={() => setMapVisible(false)}
        onSave={(draft) => {
          setLocation(draft);
          setMapVisible(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  currencyInput: { width: 80 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: '#1a73e8' },
  chipText: { color: '#333', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eef4ff',
    marginBottom: 8,
  },
  secondaryButtonText: { color: '#1a73e8', fontWeight: '600' },
  hint: { color: '#888', fontSize: 12 },
  locationSummary: { fontSize: 15, fontWeight: '500', color: '#333', marginBottom: 2 },
  submitButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c0392b', marginBottom: 12, textAlign: 'center' },
});
