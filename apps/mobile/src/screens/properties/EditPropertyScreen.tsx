import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { getProperty, updateProperty } from '../../api/properties';
import { ApiError } from '../../api/client';
import type { PropertiesStackParamList } from '../../navigation/PropertiesStack';
import { AppScreen, Button, ErrorState, FilterChip, LoadingState, TextField } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';

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

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />;

  return (
    <AppScreen>
      <Text style={typography.label}>Property Type</Text>
      <View style={styles.chipRow}>
        {PROPERTY_TYPES.map((option) => (
          <FilterChip key={option} label={option} selected={propertyType === option} onPress={() => setPropertyType(option)} />
        ))}
      </View>
      <Text style={typography.label}>Sale or Rent</Text>
      <View style={styles.chipRow}>
        {LISTING_PURPOSES.map((option) => (
          <FilterChip key={option} label={option} selected={listingPurpose === option} onPress={() => setListingPurpose(option)} />
        ))}
      </View>

      <TextField label="Title" value={title} onChangeText={setTitle} />
      <TextField label="Description" value={description} onChangeText={setDescription} multiline optional />

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
        <View style={styles.flex1}>
          <TextField label="Area (m²)" value={areaSqm} onChangeText={setAreaSqm} keyboardType="numeric" optional />
        </View>
      </View>

      {hasOwnerSection && (
        <>
          <Text style={typography.label}>Owner Information</Text>
          <TextField label="Owner name" value={ownerName} onChangeText={setOwnerName} optional />
          <TextField label="Owner phone" value={ownerPhone} onChangeText={setOwnerPhone} keyboardType="phone-pad" optional />
        </>
      )}

      {hasPrivateSection && (
        <>
          <Text style={styles.lockLabel}>🔒 Private Notes</Text>
          <TextField label="Internal notes" value={internalNotes} onChangeText={setInternalNotes} multiline optional />
          {permissions.has('property.view_commission') && (
            <TextField label="Commission notes" value={commissionNotes} onChangeText={setCommissionNotes} multiline optional />
          )}
        </>
      )}

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <Button label="Save Changes" onPress={() => void onSubmit()} loading={submitting} style={styles.submitButton} />
    </AppScreen>
  );
}

const styles = {
  chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, marginBottom: spacing.md },
  row: { flexDirection: 'row' as const, gap: spacing.sm },
  flex1: { flex: 1 },
  currencyField: { width: 96 },
  lockLabel: { fontWeight: '700' as const, color: colors.text.primary, marginBottom: spacing.sm, marginTop: spacing.xs },
  error: { color: colors.danger, marginBottom: spacing.sm, textAlign: 'center' as const },
  submitButton: { marginTop: spacing.md },
};
