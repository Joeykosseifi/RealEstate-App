import { apiRequest } from './client';
import type { PropertyLocationVisibility, PublicationDetail } from './types';

export interface SavePublicationDraftInput {
  publicTitle: string;
  publicDescription?: string;
  publicPrice: number;
  currency: string;
  propertyType: string;
  listingPurpose: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number;
  publicFeatureKeys?: string[];
  locationVisibility?: PropertyLocationVisibility;
  publicCountry?: string;
  publicCity?: string;
  publicArea?: string;
  media?: { propertyMediaId: string; isMain?: boolean }[];
}

export function getPublication(
  workspaceId: string,
  propertyId: string,
): Promise<PublicationDetail | null> {
  return apiRequest(`/workspaces/${workspaceId}/properties/${propertyId}/publication`);
}

export function savePublicationDraft(
  workspaceId: string,
  propertyId: string,
  input: SavePublicationDraftInput,
): Promise<PublicationDetail> {
  return apiRequest(`/workspaces/${workspaceId}/properties/${propertyId}/publication`, {
    method: 'PUT',
    body: input,
  });
}

export function submitPublication(
  workspaceId: string,
  propertyId: string,
): Promise<PublicationDetail> {
  return apiRequest(`/workspaces/${workspaceId}/properties/${propertyId}/publication/submit`, {
    method: 'POST',
  });
}

export function cancelPublicationSubmission(
  workspaceId: string,
  propertyId: string,
): Promise<PublicationDetail> {
  return apiRequest(`/workspaces/${workspaceId}/properties/${propertyId}/publication/cancel`, {
    method: 'POST',
  });
}

export function unpublishListing(
  workspaceId: string,
  propertyId: string,
): Promise<PublicationDetail> {
  return apiRequest(`/workspaces/${workspaceId}/properties/${propertyId}/publication/unpublish`, {
    method: 'POST',
  });
}

export function republishListing(
  workspaceId: string,
  propertyId: string,
): Promise<PublicationDetail> {
  return apiRequest(`/workspaces/${workspaceId}/properties/${propertyId}/publication/republish`, {
    method: 'POST',
  });
}
