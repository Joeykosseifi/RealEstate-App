import { apiRequest } from './client';
import type { PaginatedResponse, PropertyDetail, PropertyListItem } from './types';

export interface PropertyListFilters {
  page?: number;
  search?: string;
  propertyStatus?: string;
  propertyType?: string;
  listingPurpose?: string;
}

function toQueryString(filters: PropertyListFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.search) params.set('search', filters.search);
  if (filters.propertyStatus) params.set('propertyStatus', filters.propertyStatus);
  if (filters.propertyType) params.set('propertyType', filters.propertyType);
  if (filters.listingPurpose) params.set('listingPurpose', filters.listingPurpose);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function listProperties(
  workspaceId: string,
  filters: PropertyListFilters = {},
): Promise<PaginatedResponse<PropertyListItem>> {
  return apiRequest(`/workspaces/${workspaceId}/properties${toQueryString(filters)}`);
}

export function getProperty(workspaceId: string, propertyId: string): Promise<PropertyDetail> {
  return apiRequest(`/workspaces/${workspaceId}/properties/${propertyId}`);
}

export interface CreatePropertyInput {
  propertyType: string;
  listingPurpose: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number;
  featureKeys?: string[];
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    area?: string;
    address?: string;
    locationSource?: string;
  };
  owners?: { fullName: string; phone?: string; email?: string; notes?: string }[];
  privateDetails?: { internalNotes?: string; commissionNotes?: string };
}

export function createProperty(
  workspaceId: string,
  input: CreatePropertyInput,
): Promise<PropertyDetail> {
  return apiRequest(`/workspaces/${workspaceId}/properties`, { method: 'POST', body: input });
}

export function updateProperty(
  workspaceId: string,
  propertyId: string,
  input: Partial<CreatePropertyInput>,
): Promise<PropertyDetail> {
  return apiRequest(`/workspaces/${workspaceId}/properties/${propertyId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function archiveProperty(workspaceId: string, propertyId: string): Promise<void> {
  return apiRequest(`/workspaces/${workspaceId}/properties/${propertyId}/archive`, {
    method: 'POST',
  });
}

export function changePropertyStatus(
  workspaceId: string,
  propertyId: string,
  propertyStatus: string,
): Promise<void> {
  return apiRequest(`/workspaces/${workspaceId}/properties/${propertyId}/status`, {
    method: 'POST',
    body: { propertyStatus },
  });
}

export function getMediaAccessUrl(
  workspaceId: string,
  propertyId: string,
  mediaId: string,
): Promise<{ url: string }> {
  return apiRequest(
    `/workspaces/${workspaceId}/properties/${propertyId}/media/${mediaId}/access-url`,
  );
}

export function uploadPropertyMedia(
  workspaceId: string,
  propertyId: string,
  file: { uri: string; name: string; type: string },
  mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT',
): Promise<PropertyDetail['media'][number]> {
  const formData = new FormData();
  formData.append('mediaType', mediaType);
  // React Native's FormData accepts this { uri, name, type } shape
  // directly — see Expo's image-picker/document-picker docs for SDK 57.
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);

  return apiRequest(`/workspaces/${workspaceId}/properties/${propertyId}/media`, {
    method: 'POST',
    formData,
  });
}
