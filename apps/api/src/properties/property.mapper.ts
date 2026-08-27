import type {
  Property,
  PropertyFeature,
  PropertyLocation,
  PropertyMedia,
  PropertyOwner,
  PropertyPrivateDetails,
} from '@prisma/client';
import type {
  PropertyFeatureSummary,
  PropertyLocationInternal,
  PropertyListItem,
  PropertyMediaSummary,
  PropertyOwnerDetail,
  PropertyPrivateDetail,
  PropertyProfessionalDetail,
  PropertyPublicDetail,
} from '@real-estate/types';
import { PERMISSIONS } from '../authorization/permissions.catalog';

export type PropertyWithRelations = Property & {
  location: PropertyLocation | null;
  features: PropertyFeature[];
  media: PropertyMedia[];
  owners: PropertyOwner[];
  privateDetails: PropertyPrivateDetails | null;
};

/**
 * Narrower projection for the list endpoint — deliberately does not
 * require `owners`/`features`/`privateDetails` to be fetched at all for
 * a paginated roster, both for bandwidth and as defense-in-depth (data
 * the list mapper never receives can't leak from it). A full
 * `PropertyWithRelations` also satisfies this shape, so the same
 * `toPropertyListItem` is reused by the detail mapper.
 */
export type PropertyForList = Property & {
  location: Pick<PropertyLocation, 'city' | 'area'> | null;
  media: Pick<
    PropertyMedia,
    | 'id'
    | 'mediaType'
    | 'originalFileName'
    | 'mimeType'
    | 'fileSize'
    | 'sortOrder'
    | 'isPrimary'
    | 'createdAt'
  >[];
};

type MinimalMedia = PropertyForList['media'][number];

function primaryMediaOf(media: MinimalMedia[]): PropertyMediaSummary | null {
  if (media.length === 0) {
    return null;
  }
  const primary = media.find((item) => item.isPrimary);
  const chosen =
    primary ?? [...media].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return toPropertyMediaSummary(chosen);
}

export function toPropertyMediaSummary(
  media: MinimalMedia,
): PropertyMediaSummary {
  return {
    id: media.id,
    mediaType: media.mediaType,
    originalFileName: media.originalFileName,
    mimeType: media.mimeType,
    fileSize: media.fileSize,
    sortOrder: media.sortOrder,
    isPrimary: media.isPrimary,
    createdAt: media.createdAt.toISOString(),
  };
}

export function toPropertyFeatureSummary(
  feature: PropertyFeature,
): PropertyFeatureSummary {
  return { featureKey: feature.featureKey, value: feature.value };
}

export function toPropertyOwnerDetail(
  owner: PropertyOwner,
): PropertyOwnerDetail {
  return {
    id: owner.id,
    fullName: owner.fullName,
    phone: owner.phone,
    email: owner.email,
    whatsappPhone: owner.whatsappPhone,
    notes: owner.notes,
  };
}

export function toPropertyLocationInternal(
  location: PropertyLocation,
): PropertyLocationInternal {
  return {
    country: location.country,
    region: location.region,
    city: location.city,
    area: location.area,
    address: location.address,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    googlePlaceId: location.googlePlaceId,
    locationSource: location.locationSource,
    locationVisibility: location.locationVisibility,
  };
}

/** `canViewCommission` controls only the `commissionNotes` key — the rest of the object is returned whenever the caller has `property.view_private_notes` at all. */
export function toPropertyPrivateDetail(
  details: PropertyPrivateDetails,
  canViewCommission: boolean,
): PropertyPrivateDetail {
  return {
    internalNotes: details.internalNotes,
    ...(canViewCommission ? { commissionNotes: details.commissionNotes } : {}),
    acquisitionSource: details.acquisitionSource,
    internalReference: details.internalReference,
    privateStatusNotes: details.privateStatusNotes,
  };
}

export function toPropertyListItem(
  property: PropertyForList,
): PropertyListItem {
  return {
    id: property.id,
    workspaceId: property.workspaceId,
    createdByUserId: property.createdByUserId,
    propertyType: property.propertyType,
    listingPurpose: property.listingPurpose,
    title: property.title,
    price: Number(property.price),
    currency: property.currency,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    areaSqm: property.areaSqm ? Number(property.areaSqm) : null,
    propertyStatus: property.propertyStatus,
    city: property.location?.city ?? null,
    area: property.location?.area ?? null,
    primaryMedia: primaryMediaOf(property.media),
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  };
}

/**
 * `permissions` is the caller's already-resolved workspace permission
 * set for the property's workspace — `location`/`owners`/`privateDetails`
 * are each present as a key on the returned object ONLY when the
 * corresponding permission is held, never returned as `null`. See
 * docs/PERMISSIONS.md "Property DTO omission policy" and
 * `apps/api/test/property-sensitive-fields.e2e-spec.ts`.
 */
export function toPropertyProfessionalDetail(
  property: PropertyWithRelations,
  permissions: Set<string>,
): PropertyProfessionalDetail {
  const detail: PropertyProfessionalDetail = {
    ...toPropertyListItem(property),
    description: property.description,
    floor: property.floor,
    totalFloors: property.totalFloors,
    yearBuilt: property.yearBuilt,
    archivedAt: property.archivedAt?.toISOString() ?? null,
    features: property.features.map(toPropertyFeatureSummary),
    media: property.media
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toPropertyMediaSummary),
  };

  if (
    property.location &&
    permissions.has(PERMISSIONS.PROPERTY_VIEW_EXACT_LOCATION.key)
  ) {
    detail.location = toPropertyLocationInternal(property.location);
  }

  if (
    property.owners.length > 0 &&
    permissions.has(PERMISSIONS.PROPERTY_VIEW_OWNER.key)
  ) {
    detail.owners = property.owners.map(toPropertyOwnerDetail);
  }

  if (
    property.privateDetails &&
    permissions.has(PERMISSIONS.PROPERTY_VIEW_PRIVATE_NOTES.key)
  ) {
    detail.privateDetails = toPropertyPrivateDetail(
      property.privateDetails,
      permissions.has(PERMISSIONS.PROPERTY_VIEW_COMMISSION.key),
    );
  }

  return detail;
}

/**
 * Foundation only (Milestone 3) — not wired to any controller yet; the
 * public/client marketplace is Milestone 5/6. Exists now so the
 * omission guarantee is enforced by the type system and this function's
 * shape, not invented later under time pressure: it is structurally
 * impossible for this function to return owner/private/commission
 * fields or exact coordinates, because it never reads
 * `property.owners`/`property.privateDetails` and only ever reads
 * `location.city`/`location.area` off `PropertyLocation`, never
 * `latitude`/`longitude`. See
 * `apps/api/test/property-sensitive-fields.e2e-spec.ts` (test 18).
 */
export function toPropertyPublicDetail(
  property: PropertyWithRelations,
): PropertyPublicDetail {
  return {
    id: property.id,
    propertyType: property.propertyType,
    listingPurpose: property.listingPurpose,
    title: property.title,
    price: Number(property.price),
    currency: property.currency,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    areaSqm: property.areaSqm ? Number(property.areaSqm) : null,
    location: property.location
      ? { city: property.location.city, area: property.location.area }
      : null,
    primaryMedia: primaryMediaOf(property.media),
  };
}
