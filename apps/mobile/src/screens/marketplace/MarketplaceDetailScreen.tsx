import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addFavorite, getMarketplaceListing, removeFavorite } from '../../api/marketplace';
import { ApiError } from '../../api/client';
import type { PublicPropertyDetail } from '../../api/types';
import type { MarketplaceDetailParamList } from '../../navigation/client/marketplaceDetailParams';

type Props = NativeStackScreenProps<MarketplaceDetailParamList, 'MarketplaceDetail'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/**
 * Public listing detail. Every field rendered here comes from
 * `PublicPropertyDetail`, which is structurally incapable of carrying
 * owner contacts, commission, internal notes, or an exact pin unless the
 * professional explicitly chose PUBLIC_EXACT visibility — see
 * docs/PERMISSIONS.md "Public property DTO."
 */
export function MarketplaceDetailScreen({ route }: Props): React.JSX.Element {
  const { publicationId } = route.params;
  const [listing, setListing] = useState<PublicPropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoritePending, setFavoritePending] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const detail = await getMarketplaceListing(publicationId);
      setListing(detail);
    } catch {
      setError('This listing is no longer available.');
    } finally {
      setLoading(false);
    }
  }, [publicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFavorite = async () => {
    if (!listing) return;
    setFavoritePending(true);
    try {
      if (listing.isFavorited) {
        await removeFavorite(publicationId);
        setListing({ ...listing, isFavorited: false });
      } else {
        await addFavorite(publicationId);
        setListing({ ...listing, isFavorited: true });
      }
    } catch (err) {
      Alert.alert(
        'Could not update favorite',
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setFavoritePending(false);
    }
  };

  /**
   * V1 deliberately has no in-app messaging (see docs/PRODUCT.md
   * "Contact-professional flow") — these are real `tel:`/`mailto:`/
   * `wa.me` deep links into the device's own phone/mail/WhatsApp apps,
   * using only the workspace's explicit, opt-in public contact info
   * (never the private owner's contact — see PublicListingIdentity).
   */
  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open', 'Please try again.');
    }
  };

  const onCall = () => {
    if (listing?.identity.contactPhone) void openLink(`tel:${listing.identity.contactPhone}`);
  };
  const onEmail = () => {
    if (listing?.identity.contactEmail) void openLink(`mailto:${listing.identity.contactEmail}`);
  };
  const onWhatsApp = () => {
    if (!listing?.identity.contactWhatsapp) return;
    const digits = listing.identity.contactWhatsapp.replace(/[^\d]/g, '');
    void openLink(`https://wa.me/${digits}`);
  };

  const onNoContactFallback = () => {
    Alert.alert(
      "I'm Interested",
      'This professional has not added direct contact info yet. We saved this listing to your Favorites so you can find it and follow up.',
    );
    if (listing && !listing.isFavorited) {
      void toggleFavorite();
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.center} />;
  }
  if (error || !listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Listing not found.'}</Text>
      </View>
    );
  }

  const activeImage = listing.media[activeImageIndex] ?? listing.mainImage;
  const location = [listing.location.city, listing.location.area].filter(Boolean).join(', ');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {activeImage?.url ? (
        <Image source={{ uri: activeImage.url }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>No photo</Text>
        </View>
      )}
      {listing.media.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
          {listing.media.map((media, index) => (
            <TouchableOpacity key={media.id} onPress={() => setActiveImageIndex(index)}>
              {media.url ? (
                <Image source={{ uri: media.url }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.imagePlaceholder]} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.titleRow}>
        <View style={styles.flex1}>
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.price}>
            {listing.currency} {listing.price.toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.favoriteButton, listing.isFavorited && styles.favoriteButtonActive]}
          onPress={toggleFavorite}
          disabled={favoritePending}
        >
          <Text style={listing.isFavorited ? styles.favoriteTextActive : styles.favoriteText}>
            {listing.isFavorited ? '♥ Saved' : '♡ Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.status}>
        {listing.propertyType} · {listing.listingPurpose === 'SALE' ? 'For Sale' : 'For Rent'}
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <Row label="Bedrooms" value={listing.bedrooms?.toString() ?? '—'} />
        <Row label="Bathrooms" value={listing.bathrooms?.toString() ?? '—'} />
        <Row label="Area" value={listing.areaSqm ? `${listing.areaSqm} sqm` : '—'} />
        {listing.description ? <Text style={styles.description}>{listing.description}</Text> : null}
      </View>

      {listing.featureKeys.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.chipRow}>
            {listing.featureKeys.map((key) => (
              <View key={key} style={styles.chip}>
                <Text style={styles.chipText}>{key}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {location ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <Text style={styles.description}>{location}</Text>
          {listing.location.exactLatitude !== undefined && (
            <Text style={styles.hint}>
              {listing.location.exactLatitude.toFixed(5)},{' '}
              {listing.location.exactLongitude?.toFixed(5)}
            </Text>
          )}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Listed By</Text>
        <Text style={styles.description}>{listing.identity.displayName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact</Text>
        {listing.identity.contactPhone ||
        listing.identity.contactWhatsapp ||
        listing.identity.contactEmail ? (
          <View style={styles.contactRow}>
            {listing.identity.contactPhone && (
              <TouchableOpacity style={styles.contactButton} onPress={onCall}>
                <Text style={styles.contactButtonText}>Call</Text>
              </TouchableOpacity>
            )}
            {listing.identity.contactWhatsapp && (
              <TouchableOpacity style={styles.contactButton} onPress={onWhatsApp}>
                <Text style={styles.contactButtonText}>WhatsApp</Text>
              </TouchableOpacity>
            )}
            {listing.identity.contactEmail && (
              <TouchableOpacity style={styles.contactButton} onPress={onEmail}>
                <Text style={styles.contactButtonText}>Email</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.primaryButton} onPress={onNoContactFallback}>
            <Text style={styles.primaryButtonText}>I'm Interested</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#c0392b' },
  image: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#eee' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: '#999' },
  thumbRow: { marginTop: 8 },
  thumb: { width: 56, height: 56, borderRadius: 8, marginRight: 8, backgroundColor: '#eee' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 },
  flex1: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  price: { fontSize: 18, fontWeight: '600', color: '#1a73e8', marginTop: 2 },
  favoriteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  favoriteButtonActive: { backgroundColor: '#ffe5ea' },
  favoriteText: { color: '#666', fontWeight: '600' },
  favoriteTextActive: { color: '#d81159', fontWeight: '600' },
  status: { color: '#666', marginTop: 4, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  detailLabel: { color: '#888' },
  detailValue: { fontWeight: '500' },
  description: { color: '#333', marginTop: 4 },
  hint: { color: '#888', fontSize: 12, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0' },
  chipText: { color: '#333', fontSize: 13 },
  primaryButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  contactRow: { flexDirection: 'row', gap: 8 },
  contactButton: {
    flex: 1,
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  contactButtonText: { color: '#fff', fontWeight: '700' },
});
