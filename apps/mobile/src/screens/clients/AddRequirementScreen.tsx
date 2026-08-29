import { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { createRequirement } from '../../api/clients';
import { ApiError } from '../../api/client';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';
import { AppScreen, Button, FilterChip, TextField } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'AddRequirement'>;

const LISTING_PURPOSES = ['SALE', 'RENT'];
const PROPERTY_TYPES = ['APARTMENT', 'VILLA', 'HOUSE', 'LAND', 'OFFICE', 'SHOP', 'COMMERCIAL', 'WAREHOUSE', 'BUILDING', 'CHALET', 'OTHER'];
const FEATURE_KEYS = ['parking', 'balcony', 'elevator', 'generator', 'sea_view', 'garden', 'pool', 'furnished'];

function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={typography.label}>{title}</Text>
      {hint ? <Text style={typography.caption}>{hint}</Text> : null}
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
  const isActive = (option: string) => (multi ? (value as Set<string>).has(option) : value === option);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
      {options.map((option) => (
        <FilterChip key={option} label={option} selected={isActive(option)} onPress={() => onChange(option)} />
      ))}
    </View>
  );
}

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/**
 * "Must Have" (hard) vs. "Preferred" (soft) is the single most important
 * distinction in this form — see docs/PERMISSIONS.md "Matching hard vs.
 * soft criteria." Budget/bedrooms/bathrooms/area/location/required
 * features exclude a property from matching entirely when unmet;
 * preferred features only raise a match's score. Restyled Milestone 7 —
 * the matching engine and criteria semantics are unchanged.
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
    value.split(',').map((entry) => entry.trim()).filter(Boolean);

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
    <AppScreen>
      <TextField label="Title" placeholder="e.g. Apartment to buy" value={title} onChangeText={setTitle} />

      <SectionLabel title="Buy or Rent" />
      <ChipPicker options={LISTING_PURPOSES} value={listingPurpose} onChange={setListingPurpose} />

      <SectionLabel title="Property Type" hint="Must Have — leave empty to accept any type" />
      <ChipPicker options={PROPERTY_TYPES} value={propertyTypes} onChange={(key) => setPropertyTypes((current) => toggle(current, key))} multi />

      <SectionLabel title="Budget" hint="Must Have" />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField label="Min" value={minPrice} onChangeText={setMinPrice} keyboardType="numeric" optional />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Max" value={maxPrice} onChangeText={setMaxPrice} keyboardType="numeric" optional />
        </View>
        <View style={{ width: 96 }}>
          <TextField label="Currency" value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} />
        </View>
      </View>

      <SectionLabel title="Bedrooms / Bathrooms" hint="Must Have — minimums" />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField label="Min bedrooms" value={minBedrooms} onChangeText={setMinBedrooms} keyboardType="numeric" optional />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Min bathrooms" value={minBathrooms} onChangeText={setMinBathrooms} keyboardType="numeric" optional />
        </View>
      </View>

      <SectionLabel title="Area (m²)" hint="Must Have" />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField label="Min" value={minAreaSqm} onChangeText={setMinAreaSqm} keyboardType="numeric" optional />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Max" value={maxAreaSqm} onChangeText={setMaxAreaSqm} keyboardType="numeric" optional />
        </View>
      </View>

      <SectionLabel title="Accepted Locations" hint="Must Have — comma-separated, matches any one" />
      <TextField label="Cities" placeholder="e.g. Jounieh, Kaslik" value={cities} onChangeText={setCities} optional />
      <TextField label="Areas / neighborhoods" value={areas} onChangeText={setAreas} optional />

      <SectionLabel title="Must Have Features" />
      <ChipPicker options={FEATURE_KEYS} value={requiredFeatures} onChange={(key) => setRequiredFeatures((current) => toggle(current, key))} multi />

      <SectionLabel title="Preferred Features" hint="Nice to have — raises match score, never excludes" />
      <ChipPicker options={FEATURE_KEYS} value={preferredFeatures} onChange={(key) => setPreferredFeatures((current) => toggle(current, key))} multi />

      <TextField label="Notes" placeholder="Anything else about what they're looking for" value={notes} onChangeText={setNotes} multiline optional />

      {error ? <Text style={{ color: colors.danger, marginBottom: spacing.sm, textAlign: 'center' }}>{error}</Text> : null}

      <Button label="Save Requirement" onPress={() => void onSubmit()} loading={submitting} style={{ marginTop: spacing.sm }} />
    </AppScreen>
  );
}
