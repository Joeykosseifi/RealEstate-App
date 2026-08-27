/**
 * Minimal local mirror of the API's response shapes for the screens this
 * milestone builds. Deliberately NOT imported from `@real-estate/types`
 * — Metro (the Expo/React Native bundler) resolving a sibling workspace
 * package hasn't been proven out in this monorepo yet, and getting that
 * wrong would risk breaking the whole app's bundling in an environment
 * where it can't be interactively verified. Revisit once a mobile build
 * has been run end-to-end at least once.
 */

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accountType: 'CLIENT' | 'AGENT' | 'COMPANY';
  accountStatus: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface WorkspaceSummary {
  id: string;
  type: 'PERSONAL' | 'COMPANY';
  name: string;
  membershipType: string;
  roleKey: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

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
  'AVAILABLE' | 'RESERVED' | 'SOLD' | 'RENTED' | 'OFF_MARKET' | 'ARCHIVED';

export interface PropertyMediaSummary {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  originalFileName: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface PropertyListItem {
  id: string;
  workspaceId: string;
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
}

export interface PropertyLocation {
  country: string | null;
  region: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  googlePlaceId: string | null;
  locationSource: string;
  locationVisibility: string;
}

export interface PropertyOwnerDetail {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  whatsappPhone: string | null;
  notes: string | null;
}

export interface PropertyPrivateDetail {
  internalNotes: string | null;
  commissionNotes?: string | null;
  acquisitionSource: string | null;
  internalReference: string | null;
  privateStatusNotes: string | null;
}

export interface PropertyDetail extends PropertyListItem {
  description: string | null;
  floor: number | null;
  totalFloors: number | null;
  yearBuilt: number | null;
  features: { featureKey: string; value: boolean }[];
  media: PropertyMediaSummary[];
  // Present only when the caller holds the corresponding permission —
  // see docs/PERMISSIONS.md "Property DTO omission policy".
  location?: PropertyLocation;
  owners?: PropertyOwnerDetail[];
  privateDetails?: PropertyPrivateDetail;
}
