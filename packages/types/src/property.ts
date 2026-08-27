export type PropertyType =
  | 'APARTMENT'
  | 'VILLA'
  | 'HOUSE'
  | 'LAND'
  | 'OFFICE'
  | 'SHOP'
  | 'COMMERCIAL'
  | 'WAREHOUSE'
  | 'BUILDING'
  | 'CHALET'
  | 'OTHER';

export type ListingPurpose = 'SALE' | 'RENT';

export type PropertyBusinessStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'SOLD'
  | 'RENTED'
  | 'OFF_MARKET'
  | 'ARCHIVED';

export type PropertyLocationSource = 'GOOGLE_SEARCH' | 'MAP_PIN' | 'CURRENT_LOCATION' | 'MANUAL';

export type PropertyLocationVisibility =
  | 'PRIVATE'
  | 'WORKSPACE'
  | 'PUBLIC_APPROXIMATE'
  | 'PUBLIC_EXACT';

export type PropertyMediaType = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export interface PropertyFeatureSummary {
  featureKey: string;
  value: boolean;
}

/**
 * Professional-side location view — includes exact coordinates. Gated
 * by `property.view_exact_location`; omitted entirely (not present as a
 * key) on the detail DTO when the caller lacks it. See
 * docs/PERMISSIONS.md "Exact location security."
 */
export interface PropertyLocationInternal {
  country: string | null;
  region: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  googlePlaceId: string | null;
  locationSource: PropertyLocationSource;
  locationVisibility: PropertyLocationVisibility;
}

/**
 * Foundation only — not returned by any endpoint in Milestone 3. Shape
 * for the future public/marketplace DTO (Milestone 5/6): city/area only,
 * plus an approximate (rounded/jittered) coordinate when
 * `locationVisibility` allows it. Never the exact saved coordinates.
 */
export interface PropertyLocationPublic {
  city: string | null;
  area: string | null;
  approximateLatitude?: number;
  approximateLongitude?: number;
}

export interface PropertyMediaSummary {
  id: string;
  mediaType: PropertyMediaType;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
}

/** Private professional data. Requires `property.view_owner`. */
export interface PropertyOwnerDetail {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  whatsappPhone: string | null;
  notes: string | null;
}

/**
 * `commissionNotes` requires `property.view_commission` in addition to
 * `property.view_private_notes` — omitted (not present as a key) when
 * the caller lacks it even though the rest of this object is returned.
 */
export interface PropertyPrivateDetail {
  internalNotes: string | null;
  commissionNotes?: string | null;
  acquisitionSource: string | null;
  internalReference: string | null;
  privateStatusNotes: string | null;
}

/** Returned by the paginated list endpoint — deliberately lighter than the detail DTO. */
export interface PropertyListItem {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  propertyType: PropertyType;
  listingPurpose: ListingPurpose;
  title: string;
  price: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  propertyStatus: PropertyBusinessStatus;
  city: string | null;
  area: string | null;
  primaryMedia: PropertyMediaSummary | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Returned by the detail endpoint. `location`, `owners`, and
 * `privateDetails` are each present ONLY when the caller holds the
 * corresponding permission (`property.view_exact_location`,
 * `property.view_owner`, `property.view_private_notes`) — omitted
 * entirely otherwise, never returned as `null`. See
 * docs/PERMISSIONS.md "Property DTO omission policy."
 */
export interface PropertyProfessionalDetail extends PropertyListItem {
  description: string | null;
  floor: number | null;
  totalFloors: number | null;
  yearBuilt: number | null;
  archivedAt: string | null;
  features: PropertyFeatureSummary[];
  media: PropertyMediaSummary[];
  location?: PropertyLocationInternal;
  owners?: PropertyOwnerDetail[];
  privateDetails?: PropertyPrivateDetail;
}

/**
 * Foundation only — not returned by any endpoint in Milestone 3
 * (publication/public marketplace is Milestone 5/6). Never carries
 * owner/private/commission fields or exact coordinates by construction.
 */
export interface PropertyPublicDetail {
  id: string;
  propertyType: PropertyType;
  listingPurpose: ListingPurpose;
  title: string;
  price: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  location: PropertyLocationPublic | null;
  primaryMedia: PropertyMediaSummary | null;
}
