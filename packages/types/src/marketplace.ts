import type { ListingPurpose, PropertyType } from './property';

/**
 * Public-safe location — reuses the same visibility rule as the
 * professional record, but this type is structurally incapable of
 * carrying exact coordinates unless the professional explicitly chose
 * `PUBLIC_EXACT` (see PublicationsService). Never the raw
 * `PropertyLocationInternal`.
 */
export interface PublicLocation {
  country: string | null;
  city: string | null;
  area: string | null;
  exactLatitude?: number;
  exactLongitude?: number;
}

export interface PublicMedia {
  id: string;
  url: string | null;
  sortOrder: number;
  isMain: boolean;
}

/** How the listing's professional identity is publicly attributed — never the workspace's raw internal data. */
export interface PublicListingIdentity {
  workspaceType: 'PERSONAL' | 'COMPANY';
  displayName: string;
  logoUrl: string | null;
}

export interface PublicPropertyListItem {
  /** The marketplace-facing identifier — a `PropertyPublication` id, never the private `propertyId`. */
  publicationId: string;
  title: string;
  price: number;
  currency: string;
  propertyType: PropertyType;
  listingPurpose: ListingPurpose;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  location: PublicLocation;
  mainImage: PublicMedia | null;
  identity: PublicListingIdentity;
  publishedAt: string;
  isFavorited?: boolean;
}

export interface PublicPropertyDetail extends PublicPropertyListItem {
  description: string | null;
  featureKeys: string[];
  media: PublicMedia[];
}

export interface MarketplaceSearchQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  propertyType?: PropertyType;
  listingPurpose?: ListingPurpose;
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  bathroomsMin?: number;
  areaMin?: number;
  areaMax?: number;
  country?: string;
  city?: string;
  area?: string;
  features?: string[];
  sort?: 'newest' | 'price_asc' | 'price_desc';
}

export interface MarketplaceFavoriteItem {
  id: string;
  publicationId: string;
  createdAt: string;
  /** Null when the listing has since become unavailable — see docs/PERMISSIONS.md "Favorite of an unpublished listing." */
  listing: PublicPropertyListItem | null;
}
