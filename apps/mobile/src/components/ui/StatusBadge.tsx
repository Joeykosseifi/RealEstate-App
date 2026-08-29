import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, type StatusColorKey } from '../../theme';
import type { PropertyBusinessStatus, PropertyPublicationStatus } from '../../api/types';

interface StatusBadgeProps {
  label: string;
  tone: StatusColorKey;
  icon?: string;
}

/**
 * A single small pill — the only way status is ever shown. Business
 * status and publication status are ALWAYS two separate `StatusBadge`s,
 * never merged into one ambiguous label (see docs/PRODUCT.md "Property
 * status — two separate badges, always" and docs/DESIGN_SYSTEM.md
 * "Semantic status colors"). Color is paired with text, never the only
 * signal, for accessibility.
 */
export function StatusBadge({ label, tone, icon }: StatusBadgeProps): React.JSX.Element {
  const palette = colors.status[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.label, { color: palette.fg }]}>
        {icon ? `${icon} ` : ''}
        {label}
      </Text>
    </View>
  );
}

const BUSINESS_STATUS_MAP: Record<PropertyBusinessStatus, { label: string; tone: StatusColorKey }> = {
  AVAILABLE: { label: 'Available', tone: 'available' },
  RESERVED: { label: 'Reserved', tone: 'reserved' },
  SOLD: { label: 'Sold', tone: 'sold' },
  RENTED: { label: 'Rented', tone: 'rented' },
  OFF_MARKET: { label: 'Off Market', tone: 'archived' },
  ARCHIVED: { label: 'Archived', tone: 'archived' },
};

export function BusinessStatusBadge({ status }: { status: PropertyBusinessStatus }): React.JSX.Element {
  const meta = BUSINESS_STATUS_MAP[status];
  return <StatusBadge label={meta.label} tone={meta.tone} />;
}

const PUBLICATION_STATUS_MAP: Record<
  PropertyPublicationStatus,
  { label: string; tone: StatusColorKey; icon?: string }
> = {
  DRAFT: { label: 'Draft', tone: 'private' },
  PENDING_REVIEW: { label: 'Pending Review', tone: 'pending' },
  CHANGES_REQUESTED: { label: 'Changes Requested', tone: 'changesRequested' },
  PUBLISHED: { label: 'Published', tone: 'published' },
  REJECTED: { label: 'Rejected', tone: 'rejected' },
  ADMIN_UNPUBLISHED: { label: 'Unpublished', tone: 'archived' },
  OWNER_UNPUBLISHED: { label: 'Unpublished', tone: 'archived' },
  ARCHIVED: { label: 'Archived', tone: 'archived' },
};

/** No publication yet (no `PropertyPublication` row) reads as "Private," never a zero/blank state. */
export function PublicationStatusBadge({
  status,
}: {
  status: PropertyPublicationStatus | null;
}): React.JSX.Element {
  if (!status) {
    return <StatusBadge label="Private" tone="private" icon="🔒" />;
  }
  const meta = PUBLICATION_STATUS_MAP[status];
  return <StatusBadge label={meta.label} tone={meta.tone} icon={meta.icon} />;
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: { fontSize: 12, fontWeight: '700' },
});
