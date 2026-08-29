/**
 * Minimal local mirror of the API's response shapes for the screens this
 * milestone builds. Deliberately NOT imported from `@real-estate/types`
 * — Metro (the Expo/React Native bundler) resolving a sibling workspace
 * package hasn't been proven out in this monorepo yet, and getting that
 * wrong would risk breaking the whole app's bundling in an environment
 * where it can't be interactively verified. Revisit once a mobile build
 * has been run end-to-end at least once.
 */

export type AccountType = 'CLIENT' | 'AGENT' | 'COMPANY';
export type AccountStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accountType: AccountType;
  accountStatus: AccountStatus;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
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

/** `GET /workspaces/:id` — the one workspace endpoint that also returns the caller's resolved permission set. */
export interface WorkspaceDetail extends WorkspaceSummary {
  permissions: string[];
  /** Explicit, opt-in public contact info shown on this workspace's published listings — never a private login email/phone. */
  publicContactPhone: string | null;
  publicContactEmail: string | null;
  publicContactWhatsapp: string | null;
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

// ---------------------------------------------------------------------------
// Milestone 4 — Client CRM, requirements, matching, shortlist, presentations
// ---------------------------------------------------------------------------

export type ClientRecordStatus =
  | 'LEAD'
  | 'ACTIVE'
  | 'QUALIFIED'
  | 'VIEWING'
  | 'NEGOTIATING'
  | 'WON'
  | 'LOST'
  | 'INACTIVE'
  | 'ARCHIVED';

export type ClientSource =
  | 'REFERRAL'
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'WEBSITE'
  | 'PHONE'
  | 'WALK_IN'
  | 'PROPERTY_INQUIRY'
  | 'OTHER';

export type PreferredContactMethod = 'PHONE' | 'WHATSAPP' | 'EMAIL' | 'OTHER';

export interface ClientListItem {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  assignedToUserId: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  whatsappPhone: string | null;
  email: string | null;
  preferredContactMethod: PreferredContactMethod | null;
  source: ClientSource | null;
  status: ClientRecordStatus;
  activeRequirementCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type ClientRequirementStatus = 'ACTIVE' | 'PAUSED' | 'FULFILLED' | 'ARCHIVED';

export interface ClientRequirementDetail {
  id: string;
  clientId: string;
  workspaceId: string;
  createdByUserId: string;
  title: string;
  listingPurpose: ListingPurpose;
  propertyTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
  minBedrooms: number | null;
  maxBedrooms: number | null;
  minBathrooms: number | null;
  minAreaSqm: number | null;
  maxAreaSqm: number | null;
  countries: string[];
  cities: string[];
  areas: string[];
  requiredFeatures: string[];
  preferredFeatures: string[];
  notes: string | null;
  status: ClientRequirementStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ClientPropertyShortlistItem {
  id: string;
  workspaceId: string;
  clientId: string;
  requirementId: string | null;
  propertyId: string;
  addedByUserId: string;
  note: string | null;
  createdAt: string;
  property: {
    id: string;
    title: string;
    propertyType: PropertyType;
    listingPurpose: ListingPurpose;
    price: number;
    currency: string;
    bedrooms: number | null;
    bathrooms: number | null;
    areaSqm: number | null;
    city: string | null;
    area: string | null;
    propertyStatus: PropertyBusinessStatus;
  };
}

export interface ClientDetail extends ClientListItem {
  notes: string | null;
  requirements: ClientRequirementDetail[];
  shortlist: ClientPropertyShortlistItem[];
  presentationCount: number;
}

/** A property summary shape with no owner/commission/private-notes/exact-coordinate fields at all — used by matching and presentations. */
export interface PresentationSafePropertySnapshot {
  id: string;
  title: string;
  description: string | null;
  propertyType: string;
  listingPurpose: ListingPurpose;
  price: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  propertyStatus: string;
  city: string | null;
  area: string | null;
  country: string | null;
  featureKeys: string[];
  primaryImageUrl: string | null;
}

export interface MatchExplanation {
  matchedCriteria: string[];
  missingPreferredCriteria: string[];
}

export interface PropertyMatchResult {
  property: PresentationSafePropertySnapshot;
  score: number;
  explanation: MatchExplanation;
}

export type PresentationStatus = 'DRAFT' | 'GENERATED' | 'ARCHIVED';

export interface PropertyPresentationItemDetail {
  id: string;
  propertyId: string;
  sortOrder: number;
  agentNote: string | null;
  property: PresentationSafePropertySnapshot;
}

export interface PropertyPresentationSummary {
  id: string;
  workspaceId: string;
  clientId: string | null;
  requirementId: string | null;
  createdByUserId: string;
  title: string;
  status: PresentationStatus;
  itemCount: number;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PropertyPresentationDetail extends PropertyPresentationSummary {
  items: PropertyPresentationItemDetail[];
}

// ---------------------------------------------------------------------------
// Milestone 5 — Publication workflow & client marketplace
// ---------------------------------------------------------------------------

export type PropertyPublicationStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ADMIN_UNPUBLISHED'
  | 'OWNER_UNPUBLISHED'
  | 'ARCHIVED';

export type PropertyPublicationVersionStatus =
  'DRAFT' | 'PENDING_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';

export type PropertyLocationVisibility =
  'PRIVATE' | 'WORKSPACE' | 'PUBLIC_APPROXIMATE' | 'PUBLIC_EXACT';

export interface PublicationMediaSelection {
  id: string;
  propertyMediaId: string;
  sortOrder: number;
  isMain: boolean;
  url: string | null;
}

export interface PublicationSnapshot {
  publicTitle: string;
  publicDescription: string | null;
  publicPrice: number;
  currency: string;
  propertyType: PropertyType;
  listingPurpose: ListingPurpose;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  publicFeatureKeys: string[];
  locationVisibility: PropertyLocationVisibility;
  publicCountry: string | null;
  publicCity: string | null;
  publicArea: string | null;
  publicLatitude: number | null;
  publicLongitude: number | null;
  media: PublicationMediaSelection[];
}

export interface PublicationHistoryEntry {
  id: string;
  versionNumber: number;
  status: PropertyPublicationVersionStatus;
  submittedByUserId: string | null;
  submittedAt: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  createdAt: string;
}

export interface PublicationDetail {
  id: string;
  propertyId: string;
  workspaceId: string;
  status: PropertyPublicationStatus;
  latestVersionNumber: number;
  latestVersionStatus: PropertyPublicationVersionStatus;
  snapshot: PublicationSnapshot;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  changesRequestedAt: string | null;
  changesRequestedReason: string | null;
  publishedAt: string | null;
  unpublishedAt: string | null;
  unpublishReason: string | null;
  history: PublicationHistoryEntry[];
}

export interface PublicationReviewSummary {
  id: string;
  propertyId: string;
  workspaceId: string;
  workspaceName: string;
  status: PropertyPublicationStatus;
  latestVersionNumber: number;
  propertyType: PropertyType;
  listingPurpose: ListingPurpose;
  publicTitle: string;
  publicPrice: number;
  currency: string;
  submittedByUserId: string | null;
  submittedAt: string | null;
}

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

export interface PublicListingIdentity {
  workspaceType: 'PERSONAL' | 'COMPANY';
  displayName: string;
  logoUrl: string | null;
  contactPhone?: string;
  contactEmail?: string;
  contactWhatsapp?: string;
}

export interface PublicPropertyListItem {
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

export interface MarketplaceFavoriteItem {
  id: string;
  publicationId: string;
  createdAt: string;
  listing: PublicPropertyListItem | null;
}

// ---------------------------------------------------------------------------
// Milestone 6 — Professional dashboard
// ---------------------------------------------------------------------------

export interface PropertyDashboardSummary {
  total: number;
  byBusinessStatus: Record<PropertyBusinessStatus, number>;
  private: number;
  published: number;
  pendingReview: number;
  recent: PropertyListItem[];
}

export interface ClientDashboardSummary {
  total: number;
  activeRequirements: number;
  recent: ClientListItem[];
}

/** A section is present only when the caller holds the matching view permission — never a zeroed-out placeholder. */
export interface WorkspaceDashboard {
  properties?: PropertyDashboardSummary;
  clients?: ClientDashboardSummary;
}
