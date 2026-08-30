import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, priceText, radii, spacing, typography } from '../../theme';
import { BusinessStatusBadge, PublicationStatusBadge } from './StatusBadge';
import { Card } from './Card';
import type { PropertyListItem } from '../../api/types';

interface PropertyCardProps {
  property: PropertyListItem;
  publicationStatus: PropertyPublicationStatusForCard;
  onPress: () => void;
  imageUrl?: string | null;
}

// Kept as its own type alias so callers can pass `null` for "no publication yet."
type PropertyPublicationStatusForCard = Parameters<typeof PublicationStatusBadge>[0]['status'];

function factsLine(property: PropertyListItem): string {
  const parts: string[] = [];
  if (property.bedrooms != null) parts.push(`${property.bedrooms} Beds`);
  if (property.bathrooms != null) parts.push(`${property.bathrooms} Baths`);
  if (property.areaSqm != null) parts.push(`${property.areaSqm} m²`);
  return parts.join(' · ');
}

/**
 * The compact professional-database property card (Milestone 7 spec
 * §14) — agents scan inventory quickly, so this stays small: a thumbnail,
 * title, price, location, a one-line facts summary, and the two status
 * badges (business + publication) ALWAYS shown separately, never merged
 * into one ambiguous label.
 */
export function PropertyCard({
  property,
  publicationStatus,
  onPress,
  imageUrl,
}: PropertyCardProps): React.JSX.Element {
  const facts = factsLine(property);
  const location = [property.area, property.city].filter(Boolean).join(', ');

  return (
    <Card onPress={onPress} style={styles.card} padded={false}>
      <View style={styles.row}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>No photo</Text>
          </View>
        )}
        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <BusinessStatusBadge status={property.propertyStatus} />
            <PublicationStatusBadge status={publicationStatus} />
          </View>
          <Text style={typography.h3} numberOfLines={1}>
            {property.title}
          </Text>
          <Text style={priceText}>
            {property.currency} {property.price.toLocaleString()}
          </Text>
          {facts ? <Text style={typography.bodySmall}>{facts}</Text> : null}
          {location ? <Text style={typography.caption}>{location}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.smd, padding: spacing.smd },
  row: { flexDirection: 'row' },
  image: { width: 84, height: 84, borderRadius: radii.control, backgroundColor: colors.background },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { fontSize: 11, color: colors.text.secondary },
  body: { flex: 1, marginLeft: spacing.smd, gap: 2 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
});
