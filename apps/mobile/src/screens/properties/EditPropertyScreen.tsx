import { useCallback, useEffect, useState } from 'react';
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
import { getProperty, updateProperty } from '../../api/properties';
import { ApiError } from '../../api/client';
import type { PropertiesStackParamList } from '../../navigation/PropertiesStack';

type Props = NativeStackScreenProps<PropertiesStackParamList, 'EditProperty'>;

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
 * Edits an existing property's core/owner/private fields (see
 * docs/PRODUCT.md "Property workflow UX") — `updateProperty` (PATCH)
 * existed since Milestone 3 but had no screen calling it. Location has
 * its own dedicated "Edit Location" flow on PropertyDetailScreen and is
 * deliberately not duplicated here. Owner/private sections are shown
 * only when the property detail actually included them (i.e. the caller
 * holds `property.view_owner`/`property.view_private_notes`) — never
 * rendered blank just because the caller has `property.edit` alone.
 */
export function EditPropertyScreen({ route, navigation }: Props): React.JSX.Element {
  const { propertyId } = route.params;
  const { currentWorkspace, permissions } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [propertyType, setPropertyType] = useState('APARTMENT');
  const [listingPurpose, setListingPurpose] = useState('SALE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [hasOwnerSection, setHasOwnerSection] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [hasPrivateSection, setHasPrivateSection] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [commissionNotes, setCommissionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    setLoadError(null);
    try {
      const property = await getProperty(currentWorkspace.id, propertyId);
      setPropertyType(property.propertyType);
      setListingPurpose(property.listingPurpose);
      setTitle(property.title);
      setDescription(property.description ?? '');
      setPrice(String(property.price));
      setCurrency(property.currency);
      setBedrooms(property.bedrooms !== null ? String(property.bedrooms) : '');
      setBathrooms(property.bathrooms !== null ? String(property.bathrooms) : '');
      setAreaSqm(property.areaSqm !== null ? String(property.areaSqm) : '');
      if (property.owners) {
        setHasOwnerSection(true);
        const owner = property.owners[0];
        setOwnerName(owner?.fullName ?? '');
        setOwnerPhone(owner?.phone ?? '');
      }
      if (property.privateDetails) {
        setHasPrivateSection(true);
        setInternalNotes(property.privateDetails.internalNotes ?? '');
        setCommissionNotes(property.privateDetails.commissionNotes ?? '');
      }
    } catch {
      setLoadError('Could not load this property.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async () => {
    if (!currentWorkspace) return;
    setSubmitError(null);

    const parsedPrice = Number(price);
    if (!title.trim() || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setSubmitError('Title and a valid price are required.');
      return;
    }

    setSubmitting(true);
    try {
      await updateProperty(currentWorkspace.id, propertyId, {
        propertyType,
        listingPurpose,
        title: title.trim(),
        description: description.trim() || undefined,
        price: parsedPrice,
        currency: currency.trim().toUpperCase(),
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        areaSqm: areaSqm ? Number(areaSqm) : undefined,
        ...(hasOwnerSection && ownerName.trim()
          ? { owners: [{ fullName: ownerName.trim(), phone: ownerPhone.trim() || undefined }] }
          : {}),
        ...(hasPrivateSection
          ? {
              privateDetails: {
                internalNotes: internalNotes.trim() || undefined,
                ...(permissions.has('property.view_commission')
                  ? { commissionNotes: commissionNotes.trim() || undefined }
                  : {}),
              },
            }
          : {}),
      });
      navigation.goBack();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.center} />;
  }
  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{loadError}</Text>
      </View>
    );
  }

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

      {hasOwnerSection && (
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
      )}

      {hasPrivateSection && (
        <Section title="Private Notes">
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Internal notes (not shown to clients)"
            value={internalNotes}
            onChangeText={setInternalNotes}
            multiline
          />
          {permissions.has('property.view_commission') && (
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Commission notes"
              value={commissionNotes}
              onChangeText={setCommissionNotes}
              multiline
            />
          )}
        </Section>
      )}

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.buttonDisabled]}
        onPress={() => void onSubmit()}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
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
