import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { PublicPropertyListItem } from '../../api/types';

/**
 * Shared marketplace card — reused by Home, Search, and Favorites so the
 * public-safe fields shown to a client stay identical everywhere (see
 * docs/PERMISSIONS.md "Marketplace property card"). Never renders owner
 * info, commission, internal notes, or exact private location — it
 * simply has no such fields to read from `PublicPropertyListItem`.
 */
export function ListingCard({
  listing,
  onPress,
  style,
}: {
  listing: PublicPropertyListItem;
  onPress: () => void;
  style?: object;
}) {
  const location = [listing.location.city, listing.location.area].filter(Boolean).join(', ');
  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress}>
      {listing.mainImage?.url ? (
        <Image source={{ uri: listing.mainImage.url }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>No photo</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.price}>
          {listing.currency} {listing.price.toLocaleString()}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {listing.propertyType} · {listing.listingPurpose === 'SALE' ? 'For Sale' : 'For Rent'}
        </Text>
        {location ? (
          <Text style={styles.location} numberOfLines={1}>
            {location}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {listing.bedrooms !== null ? `${listing.bedrooms} bd` : ''}
          {listing.bathrooms !== null ? ` · ${listing.bathrooms} ba` : ''}
          {listing.areaSqm !== null ? ` · ${listing.areaSqm} sqm` : ''}
        </Text>
        <Text style={styles.identity} numberOfLines={1}>
          {listing.identity.displayName}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  image: { width: '100%', height: 130, backgroundColor: '#eee' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: '#999', fontSize: 12 },
  body: { padding: 10, gap: 2 },
  price: { fontSize: 16, fontWeight: '700', color: '#1a73e8' },
  title: { fontSize: 14, fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#666' },
  location: { fontSize: 12, color: '#888' },
  meta: { fontSize: 12, color: '#888' },
  identity: { fontSize: 11, color: '#aaa', marginTop: 4 },
});
