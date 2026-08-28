import type {
  PropertyMedia,
  PropertyPublication,
  PropertyPublicationMedia,
  PropertyPublicationVersion,
} from '@prisma/client';
import type {
  PublicationDetail,
  PublicationHistoryEntry,
  PublicationMediaSelection,
  PublicationReviewDetail,
  PublicationReviewSummary,
  PublicationSnapshot,
} from '@real-estate/types';

export type PublicationMediaWithMedia = PropertyPublicationMedia & {
  propertyMedia: PropertyMedia;
};

export type VersionWithMedia = PropertyPublicationVersion & {
  media: PublicationMediaWithMedia[];
};

export type PublicationWithVersions = PropertyPublication & {
  latestVersion: VersionWithMedia | null;
  publishedVersion: VersionWithMedia | null;
  versions: PropertyPublicationVersion[];
};

export type PublicationWithWorkspaceName = PublicationWithVersions & {
  workspace: { name: string };
};

function toMediaSelection(
  media: PublicationMediaWithMedia,
  url: string | null,
): PublicationMediaSelection {
  return {
    id: media.id,
    propertyMediaId: media.propertyMediaId,
    sortOrder: media.sortOrder,
    isMain: media.isMain,
    url,
  };
}

/**
 * The explicit public-safe allowlist — reads ONLY fields that exist on
 * `PropertyPublicationVersion`, never the professional `Property`. See
 * docs/PERMISSIONS.md "Publication snapshot."
 */
export function toPublicationSnapshot(
  version: VersionWithMedia,
  mediaUrls: ReadonlyMap<string, string | null>,
): PublicationSnapshot {
  return {
    publicTitle: version.publicTitle,
    publicDescription: version.publicDescription,
    publicPrice: Number(version.publicPrice),
    currency: version.currency,
    propertyType: version.propertyType,
    listingPurpose: version.listingPurpose,
    bedrooms: version.bedrooms,
    bathrooms: version.bathrooms,
    areaSqm: version.areaSqm ? Number(version.areaSqm) : null,
    publicFeatureKeys: version.publicFeatureKeys,
    locationVisibility: version.locationVisibility,
    publicCountry: version.publicCountry,
    publicCity: version.publicCity,
    publicArea: version.publicArea,
    publicLatitude: version.publicLatitude
      ? Number(version.publicLatitude)
      : null,
    publicLongitude: version.publicLongitude
      ? Number(version.publicLongitude)
      : null,
    media: version.media
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) =>
        toMediaSelection(m, mediaUrls.get(m.propertyMediaId) ?? null),
      ),
  };
}

export function toPublicationHistoryEntry(
  version: PropertyPublicationVersion,
): PublicationHistoryEntry {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    status: version.status,
    submittedByUserId: version.submittedByUserId,
    submittedAt: version.submittedAt?.toISOString() ?? null,
    reviewedByUserId: version.reviewedByUserId,
    reviewedAt: version.reviewedAt?.toISOString() ?? null,
    reviewReason: version.reviewReason,
    createdAt: version.createdAt.toISOString(),
  };
}

/**
 * Professional-facing view — `snapshot` always reflects `latestVersion`
 * (the version currently being drafted/reviewed/most-recently-decided),
 * never `publishedVersion` — a professional editing after
 * CHANGES_REQUESTED should see their in-progress draft, not the stale
 * published content. See docs/PERMISSIONS.md "Publication versioning."
 */
export function toPublicationDetail(
  publication: PublicationWithVersions,
  mediaUrls: ReadonlyMap<string, string | null>,
): PublicationDetail {
  if (!publication.latestVersion) {
    throw new Error(
      'PropertyPublication is missing its latestVersion — invariant violation.',
    );
  }
  return {
    id: publication.id,
    propertyId: publication.propertyId,
    workspaceId: publication.workspaceId,
    status: publication.status,
    latestVersionNumber: publication.latestVersion.versionNumber,
    latestVersionStatus: publication.latestVersion.status,
    snapshot: toPublicationSnapshot(publication.latestVersion, mediaUrls),
    submittedAt: publication.submittedAt?.toISOString() ?? null,
    approvedAt: publication.approvedAt?.toISOString() ?? null,
    rejectedAt: publication.rejectedAt?.toISOString() ?? null,
    rejectionReason: publication.rejectionReason,
    changesRequestedAt: publication.changesRequestedAt?.toISOString() ?? null,
    changesRequestedReason: publication.changesRequestedReason,
    publishedAt: publication.publishedAt?.toISOString() ?? null,
    unpublishedAt: publication.unpublishedAt?.toISOString() ?? null,
    unpublishReason: publication.unpublishReason,
    history: publication.versions
      .slice()
      .sort((a, b) => a.versionNumber - b.versionNumber)
      .map(toPublicationHistoryEntry),
  };
}

export type PublicationForReviewSummary = PropertyPublication & {
  latestVersion: PropertyPublicationVersion | null;
  workspace: { name: string };
};

export function toPublicationReviewSummary(
  publication: PublicationForReviewSummary,
): PublicationReviewSummary {
  const version = publication.latestVersion;
  if (!version) {
    throw new Error(
      'PropertyPublication is missing its latestVersion — invariant violation.',
    );
  }
  return {
    id: publication.id,
    propertyId: publication.propertyId,
    workspaceId: publication.workspaceId,
    workspaceName: publication.workspace.name,
    status: publication.status,
    latestVersionNumber: version.versionNumber,
    propertyType: version.propertyType,
    listingPurpose: version.listingPurpose,
    publicTitle: version.publicTitle,
    publicPrice: Number(version.publicPrice),
    currency: version.currency,
    submittedByUserId: publication.submittedByUserId,
    submittedAt: publication.submittedAt?.toISOString() ?? null,
  };
}

export function toPublicationReviewDetail(
  publication: PublicationWithWorkspaceName,
  submitterName: string | null,
  mediaUrls: ReadonlyMap<string, string | null>,
): PublicationReviewDetail {
  const version = publication.latestVersion;
  if (!version) {
    throw new Error(
      'PropertyPublication is missing its latestVersion — invariant violation.',
    );
  }
  return {
    id: publication.id,
    propertyId: publication.propertyId,
    workspaceId: publication.workspaceId,
    workspaceName: publication.workspace.name,
    status: publication.status,
    submittedByUserId: publication.submittedByUserId,
    submittedByName: submitterName,
    latestVersionNumber: version.versionNumber,
    latestVersionStatus: version.status,
    snapshot: toPublicationSnapshot(version, mediaUrls),
    history: publication.versions
      .slice()
      .sort((a, b) => a.versionNumber - b.versionNumber)
      .map(toPublicationHistoryEntry),
  };
}
