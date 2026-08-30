import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addFavorite, getMarketplaceListing, removeFavorite } from '../../api/marketplace';
import { ApiError } from '../../api/client';
import type { PublicPropertyDetail } from '../../api/types';
import type { MarketplaceDetailParamList } from '../../navigation/client/marketplaceDetailParams';
import { Button, ContactActions, ErrorState, IconButton, LoadingState } from '../../components/ui';
import { colors, priceText, radii, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<MarketplaceDetailParamList, 'MarketplaceDetail'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={typography.bodySmall}>{label}</Text>
      <Text style={[typography.body, styles.detailValue]}>{value}</Text>
    </View>
  );
}

/**
 * Public listing detail (Milestone 7 spec §22) — photography is the
 * hero. Every field rendered here comes from `PublicPropertyDetail`,
 * which is structurally incapable of carrying owner contacts,
 * commission, internal notes, or an exact pin unless the professional
 * explicitly chose PUBLIC_EXACT visibility — see docs/PERMISSIONS.md
 * "Public property DTO."
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
      Alert.alert('Could not update favorite', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setFavoritePending(false);
    }
  };

  /**
   * V1 deliberately has no in-app messaging (see docs/PRODUCT.md
   * "Contact-professional flow") — `ContactActions` renders real
   * `tel:`/`mailto:`/`wa.me` deep links into the device's own phone/
   * mail/WhatsApp apps, using only the workspace's explicit, opt-in
   * public contact info (never the private owner's contact — see
   * PublicListingIdentity).
   */
  const onNoContactFallback = () => {
    Alert.alert(
      "I'm Interested",
      'This professional has not added direct contact info yet. We saved this listing to your Favorites so you can find it and follow up.',
    );
    if (listing && !listing.isFavorited) {
      void toggleFavorite();
    }
  };

  if (loading) return <LoadingState />;
  if (error || !listing) return <ErrorState message={error ?? 'Listing not found.'} onRetry={() => void load()} />;

  const activeImage = listing.media[activeImageIndex] ?? listing.mainImage;
  const location = [listing.location.city, listing.location.area].filter(Boolean).join(', ');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {activeImage?.url ? (
        <Image source={{ uri: activeImage.url }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={typography.bodySmall}>No photo</Text>
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
          <Text style={typography.h1}>{listing.title}</Text>
          <Text style={priceText}>
            {listing.currency} {listing.price.toLocaleString()}
          </Text>
        </View>
        <IconButton
          icon={<Text style={listing.isFavorited ? styles.favoriteIconActive : styles.favoriteIcon}>{listing.isFavorited ? '♥' : '♡'}</Text>}
          onPress={() => void toggleFavorite()}
          accessibilityLabel={listing.isFavorited ? 'Remove from favorites' : 'Save to favorites'}
          variant="filled"
        />
      </View>

      <Text style={[typography.bodySmall, styles.status]}>
        {listing.propertyType} · {listing.listingPurpose === 'SALE' ? 'For Sale' : 'For Rent'}
      </Text>

      <View style={styles.section}>
        <Text style={typography.label}>Details</Text>
        <Row label="Bedrooms" value={listing.bedrooms?.toString() ?? '—'} />
        <Row label="Bathrooms" value={listing.bathrooms?.toString() ?? '—'} />
        <Row label="Area" value={listing.areaSqm ? `${listing.areaSqm} m²` : '—'} />
        {listing.description ? <Text style={[typography.body, styles.description]}>{listing.description}</Text> : null}
      </View>

      {listing.featureKeys.length > 0 && (
        <View style={styles.section}>
          <Text style={typography.label}>Features</Text>
          <View style={styles.chipRow}>
            {listing.featureKeys.map((key) => (
              <View key={key} style={styles.chip}>
                <Text style={styles.chipText}>{key.replaceAll('_', ' ')}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {location ? (
        <View style={styles.section}>
          <Text style={typography.label}>Location</Text>
          <Text style={[typography.body, styles.description]}>{location}</Text>
          {listing.location.exactLatitude !== undefined && (
            <Text style={styles.hint}>
              {listing.location.exactLatitude.toFixed(5)}, {listing.location.exactLongitude?.toFixed(5)}
            </Text>
          )}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={typography.label}>Listed By</Text>
        <Text style={[typography.body, styles.description]}>{listing.identity.displayName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={typography.label}>Contact</Text>
        {listing.identity.contactPhone || listing.identity.contactWhatsapp || listing.identity.contactEmail ? (
          <View style={styles.spacedTop}>
            <ContactActions
              phone={listing.identity.contactPhone ?? null}
              whatsapp={listing.identity.contactWhatsapp ?? null}
              email={listing.identity.contactEmail ?? null}
            />
          </View>
        ) : (
          <Button label="I'm Interested" onPress={onNoContactFallback} style={styles.spacedTop} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  image: { width: '100%', height: 240, borderRadius: radii.image, backgroundColor: colors.border },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbRow: { marginTop: spacing.sm },
  thumb: { width: 60, height: 60, borderRadius: radii.control, marginRight: spacing.sm, backgroundColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.lg, gap: spacing.sm },
  flex1: { flex: 1 },
  favoriteIcon: { fontSize: 20, color: colors.text.secondary },
  favoriteIconActive: { fontSize: 20, color: colors.danger },
  status: { marginTop: spacing.xs, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  detailValue: { fontWeight: '600' },
  description: { marginTop: spacing.xs },
  hint: { color: colors.text.secondary, fontSize: 12, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  chip: { paddingHorizontal: spacing.smd, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.text.primary, fontSize: 13 },
  spacedTop: { marginTop: spacing.sm },
});
