import type {
  Company,
  PropertyMedia,
  PropertyPublication,
  PropertyPublicationMedia,
  PropertyPublicationVersion,
  User,
  Workspace,
} from '@prisma/client';
import type {
  MarketplaceFavoriteItem,
  PublicLocation,
  PublicMedia,
  PublicPropertyDetail,
  PublicPropertyListItem,
} from '@real-estate/types';

export type PublicationVersionWithMedia = PropertyPublicationVersion & {
  media: (PropertyPublicationMedia & { propertyMedia: PropertyMedia })[];
};

export type WorkspaceWithIdentity = Workspace & {
  personalOwner: Pick<User, 'firstName' | 'lastName'> | null;
  company: Pick<Company, 'name' | 'logoUrl'> | null;
};

export type PublishedListing = PropertyPublication & {
  publishedVersion: PublicationVersionWithMedia;
  workspace: WorkspaceWithIdentity;
};

/**
 * Reuses `PropertyLocationVisibility` — a location is only ever visible
 * publicly at all (city/area) when the professional chose
 * `PUBLIC_APPROXIMATE` or `PUBLIC_EXACT`; exact coordinates require
 * `PUBLIC_EXACT` specifically. `PRIVATE`/`WORKSPACE` yield an empty
 * location object. See docs/PERMISSIONS.md "Public location rules."
 */
export function toPublicLocation(
  version: PublicationVersionWithMedia,
): PublicLocation {
  if (
    version.locationVisibility === 'PRIVATE' ||
    version.locationVisibility === 'WORKSPACE'
  ) {
    return { country: null, city: null, area: null };
  }
  const base: PublicLocation = {
    country: version.publicCountry,
    city: version.publicCity,
    area: version.publicArea,
  };
  if (
    version.locationVisibility === 'PUBLIC_EXACT' &&
    version.publicLatitude !== null &&
    version.publicLongitude !== null
  ) {
    base.exactLatitude = Number(version.publicLatitude);
    base.exactLongitude = Number(version.publicLongitude);
  }
  return base;
}

export function toPublicMedia(
  media: PropertyPublicationMedia,
  url: string | null,
): PublicMedia {
  return {
    id: media.id,
    url,
    sortOrder: media.sortOrder,
    isMain: media.isMain,
  };
}

export function resolveWorkspaceIdentity(workspace: WorkspaceWithIdentity): {
  workspaceType: 'PERSONAL' | 'COMPANY';
  displayName: string;
  logoUrl: string | null;
} {
  if (workspace.type === 'COMPANY' && workspace.company) {
    return {
      workspaceType: 'COMPANY',
      displayName: workspace.company.name,
      logoUrl: workspace.company.logoUrl,
    };
  }
  if (workspace.personalOwner) {
    return {
      workspaceType: 'PERSONAL',
      displayName: `${workspace.personalOwner.firstName} ${workspace.personalOwner.lastName}`,
      logoUrl: null,
    };
  }
  return {
    workspaceType: 'PERSONAL',
    displayName: workspace.name,
    logoUrl: null,
  };
}

export function toPublicPropertyListItem(
  listing: PublishedListing,
  mediaUrls: ReadonlyMap<string, string | null>,
  isFavorited?: boolean,
): PublicPropertyListItem {
  const version = listing.publishedVersion;
  const media = version.media.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const main = media.find((m) => m.isMain) ?? media[0] ?? null;

  return {
    publicationId: listing.id,
    title: version.publicTitle,
    price: Number(version.publicPrice),
    currency: version.currency,
    propertyType: version.propertyType,
    listingPurpose: version.listingPurpose,
    bedrooms: version.bedrooms,
    bathrooms: version.bathrooms,
    areaSqm: version.areaSqm ? Number(version.areaSqm) : null,
    location: toPublicLocation(version),
    mainImage: main
      ? toPublicMedia(main, mediaUrls.get(main.propertyMediaId) ?? null)
      : null,
    identity: resolveWorkspaceIdentity(listing.workspace),
    publishedAt: (listing.publishedAt ?? listing.createdAt).toISOString(),
    ...(isFavorited !== undefined ? { isFavorited } : {}),
  };
}

export function toPublicPropertyDetail(
  listing: PublishedListing,
  mediaUrls: ReadonlyMap<string, string | null>,
  isFavorited?: boolean,
): PublicPropertyDetail {
  const version = listing.publishedVersion;
  const media = version.media
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => toPublicMedia(m, mediaUrls.get(m.propertyMediaId) ?? null));

  return {
    ...toPublicPropertyListItem(listing, mediaUrls, isFavorited),
    description: version.publicDescription,
    featureKeys: version.publicFeatureKeys,
    media,
  };
}

export function toMarketplaceFavoriteItem(
  favoriteId: string,
  createdAt: Date,
  publicationId: string,
  listing: PublicPropertyListItem | null,
): MarketplaceFavoriteItem {
  return {
    id: favoriteId,
    publicationId,
    createdAt: createdAt.toISOString(),
    listing,
  };
}
