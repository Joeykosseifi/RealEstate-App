import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { PublicPropertyListItem } from '../../api/types';
import { Card } from '../../components/ui';
import { colors, priceText, radii, spacing, typography } from '../../theme';

/**
 * Shared marketplace card — reused by Home, Search, and Favorites so the
 * public-safe fields shown to a client stay identical everywhere (see
 * docs/PERMISSIONS.md "Marketplace property card"). Never renders owner
 * info, commission, internal notes, or exact private location — it
 * simply has no such fields to read from `PublicPropertyListItem`.
 * Photography carries more visual weight here than on the professional
 * database's compact `PropertyCard` (Milestone 7 spec §20).
 */
export function ListingCard({
  listing,
  onPress,
  style,
}: {
  listing: PublicPropertyListItem;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const location = [listing.location.city, listing.location.area].filter(Boolean).join(', ');
  return (
    <Card onPress={onPress} style={[styles.card, style]} padded={false}>
      {listing.mainImage?.url ? (
        <Image source={{ uri: listing.mainImage.url }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>No photo</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={priceText}>
          {listing.currency} {listing.price.toLocaleString()}
        </Text>
        <Text style={typography.h3} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={typography.bodySmall} numberOfLines={1}>
          {listing.propertyType} · {listing.listingPurpose === 'SALE' ? 'For Sale' : 'For Rent'}
        </Text>
        {location ? (
          <Text style={typography.caption} numberOfLines={1}>
            {location}
          </Text>
        ) : null}
        <Text style={typography.caption}>
          {listing.bedrooms !== null ? `${listing.bedrooms} bd` : ''}
          {listing.bathrooms !== null ? ` · ${listing.bathrooms} ba` : ''}
          {listing.areaSqm !== null ? ` · ${listing.areaSqm} m²` : ''}
        </Text>
        <Text style={styles.identity} numberOfLines={1}>
          {listing.identity.displayName}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: 230, borderRadius: radii.cardLarge, overflow: 'hidden' },
  image: { width: '100%', height: 150, backgroundColor: colors.border },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: colors.text.secondary, fontSize: 12 },
  body: { padding: spacing.smd, gap: 2 },
  identity: { fontSize: 11, color: colors.text.secondary, marginTop: spacing.xs },
});
