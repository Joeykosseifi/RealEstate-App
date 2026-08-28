import type { ListingPurpose, PropertyLocationVisibility, PropertyType } from './property';

/**
 * PRIVATE is never a stored/returned value from the API — it is
 * represented by the ABSENCE of a publication object entirely (see
 * `ClientPublicationStatus` usage in mobile: "no publication" == private).
 * Every other value below is a real, returned status.
 */
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

export interface PublicationMediaSelection {
  id: string;
  propertyMediaId: string;
  sortOrder: number;
  isMain: boolean;
  /** Resolved short-lived signed URL for previewing the selected image. */
  url: string | null;
}

/**
 * The public-safe snapshot fields of one submission — the exact shape
 * every reviewer (professional preview, admin review, public marketplace
 * once approved) renders from. Never derived from the professional
 * `PropertyProfessionalDetail` by deleting fields — an explicit
 * allowlist. See docs/PERMISSIONS.md "Publication snapshot."
 */
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
  /** Only populated when `locationVisibility === 'PUBLIC_EXACT'`. */
  publicLatitude: number | null;
  publicLongitude: number | null;
  media: PublicationMediaSelection[];
}

/** One immutable-once-submitted version, as shown in review history. */
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

/**
 * The professional-facing view of their own property's publication —
 * returned by the draft/submit/unpublish endpoints and the property
 * detail's embedded publication summary.
 */
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

/** Admin queue row — deliberately lighter than the review detail. */
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

/**
 * Full admin review payload — the snapshot plus enough submitter/
 * workspace identity to moderate responsibly, WITHOUT unrestricted
 * access to owner/commission/private-note data. See
 * docs/PERMISSIONS.md "Admin moderation boundary."
 */
export interface PublicationReviewDetail {
  id: string;
  propertyId: string;
  workspaceId: string;
  workspaceName: string;
  status: PropertyPublicationStatus;
  submittedByUserId: string | null;
  submittedByName: string | null;
  latestVersionNumber: number;
  latestVersionStatus: PropertyPublicationVersionStatus;
  snapshot: PublicationSnapshot;
  history: PublicationHistoryEntry[];
}
