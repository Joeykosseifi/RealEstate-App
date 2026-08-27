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
import { createRequirement } from '../../api/clients';
import { ApiError } from '../../api/client';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';

type Props = NativeStackScreenProps<ClientsStackParamList, 'AddRequirement'>;

const LISTING_PURPOSES = ['SALE', 'RENT'];
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

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function ChipPicker({
  options,
  value,
  onChange,
  multi,
}: {
  options: string[];
  value: string | Set<string>;
  onChange: (value: string) => void;
  multi?: boolean;
}) {
  const isActive = (option: string) =>
    multi ? (value as Set<string>).has(option) : value === option;
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          style={[styles.chip, isActive(option) && styles.chipActive]}
          onPress={() => onChange(option)}
        >
          <Text style={[styles.chipText, isActive(option) && styles.chipTextActive]}>{option}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

/**
 * "Must Have" (hard) vs. "Preferred" (soft) is the single most important
 * distinction in this form — see docs/PERMISSIONS.md "Matching hard vs.
 * soft criteria." Budget/bedrooms/bathrooms/area/location/required
 * features exclude a property from matching entirely when unmet;
 * preferred features only raise a match's score.
 */
export function AddRequirementScreen({ route, navigation }: Props): React.JSX.Element {
  const { clientId } = route.params;
  const { currentWorkspace } = useAuth();

  const [title, setTitle] = useState('');
  const [listingPurpose, setListingPurpose] = useState('SALE');
  const [propertyTypes, setPropertyTypes] = useState<Set<string>>(new Set());
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [minBedrooms, setMinBedrooms] = useState('');
  const [minBathrooms, setMinBathrooms] = useState('');
  const [minAreaSqm, setMinAreaSqm] = useState('');
  const [maxAreaSqm, setMaxAreaSqm] = useState('');
  const [cities, setCities] = useState('');
  const [areas, setAreas] = useState('');
  const [requiredFeatures, setRequiredFeatures] = useState<Set<string>>(new Set());
  const [preferredFeatures, setPreferredFeatures] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const splitList = (value: string) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

  const onSubmit = async () => {
    if (!currentWorkspace) return;
    setError(null);
    if (!title.trim()) {
      setError('A title is required.');
      return;
    }
    const hasPriceBound = minPrice.trim() !== '' || maxPrice.trim() !== '';
    if (hasPriceBound && !currency.trim()) {
      setError('Currency is required when a budget is set.');
      return;
    }

    setSubmitting(true);
    try {
      await createRequirement(currentWorkspace.id, clientId, {
        title: title.trim(),
        listingPurpose: listingPurpose as 'SALE' | 'RENT',
        propertyTypes: [...propertyTypes],
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        currency: hasPriceBound ? currency.trim().toUpperCase() : undefined,
        minBedrooms: minBedrooms ? Number(minBedrooms) : undefined,
        minBathrooms: minBathrooms ? Number(minBathrooms) : undefined,
        minAreaSqm: minAreaSqm ? Number(minAreaSqm) : undefined,
        maxAreaSqm: maxAreaSqm ? Number(maxAreaSqm) : undefined,
        cities: splitList(cities),
        areas: splitList(areas),
        requiredFeatures: [...requiredFeatures],
        preferredFeatures: [...preferredFeatures],
        notes: notes.trim() || undefined,
      });
      navigation.navigate('ClientDetail', { clientId });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this requirement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Title">
        <TextInput
          style={styles.input}
          placeholder="e.g. Apartment to buy"
          value={title}
          onChangeText={setTitle}
        />
      </Section>

      <Section title="Buy or Rent">
        <ChipPicker
          options={LISTING_PURPOSES}
          value={listingPurpose}
          onChange={setListingPurpose}
        />
      </Section>

      <Section title="Property Type" hint="Must Have — leave empty to accept any type">
        <ChipPicker
          options={PROPERTY_TYPES}
          value={propertyTypes}
          onChange={(key) => setPropertyTypes((current) => toggle(current, key))}
          multi
        />
      </Section>

      <Section title="Budget" hint="Must Have">
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Min"
            keyboardType="numeric"
            value={minPrice}
            onChangeText={setMinPrice}
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Max"
            keyboardType="numeric"
            value={maxPrice}
            onChangeText={setMaxPrice}
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

      <Section title="Bedrooms / Bathrooms" hint="Must Have — minimums">
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Min bedrooms"
            keyboardType="numeric"
            value={minBedrooms}
            onChangeText={setMinBedrooms}
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Min bathrooms"
            keyboardType="numeric"
            value={minBathrooms}
            onChangeText={setMinBathrooms}
          />
        </View>
      </Section>

      <Section title="Area (sqm)" hint="Must Have">
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Min"
            keyboardType="numeric"
            value={minAreaSqm}
            onChangeText={setMinAreaSqm}
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Max"
            keyboardType="numeric"
            value={maxAreaSqm}
            onChangeText={setMaxAreaSqm}
          />
        </View>
      </Section>

      <Section title="Accepted Locations" hint="Must Have — comma-separated, matches any one">
        <TextInput
          style={styles.input}
          placeholder="Cities (e.g. Jounieh, Kaslik)"
          value={cities}
          onChangeText={setCities}
        />
        <TextInput
          style={styles.input}
          placeholder="Areas / neighborhoods"
          value={areas}
          onChangeText={setAreas}
        />
      </Section>

      <Section title="Must Have Features">
        <ChipPicker
          options={FEATURE_KEYS}
          value={requiredFeatures}
          onChange={(key) => setRequiredFeatures((current) => toggle(current, key))}
          multi
        />
      </Section>

      <Section title="Preferred Features" hint="Nice to have — raises match score, never excludes">
        <ChipPicker
          options={FEATURE_KEYS}
          value={preferredFeatures}
          onChange={(key) => setPreferredFeatures((current) => toggle(current, key))}
          multi
        />
      </Section>

      <Section title="Notes">
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Anything else about what they're looking for"
          value={notes}
          onChangeText={setNotes}
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
          <Text style={styles.submitButtonText}>Save Requirement</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#555', textTransform: 'uppercase' },
  sectionHint: { fontSize: 12, color: '#888', marginBottom: 8, marginTop: 2 },
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: '#1a73e8' },
  chipText: { color: '#333', fontSize: 13 },
  chipTextActive: { color: '#fff' },
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
