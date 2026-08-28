/**
 * Minimal local mirror of the API's response shapes this admin surface
 * needs — same reasoning as `apps/mobile/src/api/types.ts`: not imported
 * from `@real-estate/types` since this workspace package resolution
 * hasn't been proven out for admin-web's Next.js build.
 */

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  accountType: string;
}

export interface Paginated<T> {
  items: T[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export type PropertyPublicationStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ADMIN_UNPUBLISHED'
  | 'OWNER_UNPUBLISHED'
  | 'ARCHIVED';

export interface PublicationReviewSummary {
  id: string;
  propertyId: string;
  workspaceId: string;
  workspaceName: string;
  status: PropertyPublicationStatus;
  latestVersionNumber: number;
  propertyType: string;
  listingPurpose: string;
  publicTitle: string;
  publicPrice: number;
  currency: string;
  submittedByUserId: string | null;
  submittedAt: string | null;
}

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
  propertyType: string;
  listingPurpose: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  publicFeatureKeys: string[];
  locationVisibility: string;
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
  status: string;
  submittedByUserId: string | null;
  submittedAt: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  createdAt: string;
}

export interface PublicationReviewDetail {
  id: string;
  propertyId: string;
  workspaceId: string;
  workspaceName: string;
  status: PropertyPublicationStatus;
  submittedByUserId: string | null;
  submittedByName: string | null;
  latestVersionNumber: number;
  latestVersionStatus: string;
  snapshot: PublicationSnapshot;
  history: PublicationHistoryEntry[];
}
