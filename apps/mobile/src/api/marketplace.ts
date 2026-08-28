import { apiRequest } from './client';
import type {
  MarketplaceFavoriteItem,
  PaginatedResponse,
  PublicPropertyDetail,
  PublicPropertyListItem,
} from './types';

export interface MarketplaceSearchFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  propertyType?: string;
  listingPurpose?: string;
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  bathroomsMin?: number;
  city?: string;
  area?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc';
}

function toQueryString(filters: MarketplaceSearchFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function searchMarketplace(
  filters: MarketplaceSearchFilters = {},
): Promise<PaginatedResponse<PublicPropertyListItem>> {
  return apiRequest(`/marketplace/properties${toQueryString(filters)}`);
}

export function getMarketplaceListing(publicationId: string): Promise<PublicPropertyDetail> {
  return apiRequest(`/marketplace/properties/${publicationId}`);
}

export function addFavorite(publicationId: string): Promise<void> {
  return apiRequest(`/marketplace/properties/${publicationId}/favorite`, { method: 'POST' });
}

export function removeFavorite(publicationId: string): Promise<void> {
  return apiRequest(`/marketplace/properties/${publicationId}/favorite`, { method: 'DELETE' });
}

export function listFavorites(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<MarketplaceFavoriteItem>> {
  return apiRequest(`/marketplace/favorites?page=${page}&pageSize=${pageSize}`);
}
