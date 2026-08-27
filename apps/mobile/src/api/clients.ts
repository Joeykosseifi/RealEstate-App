import { apiRequest } from './client';
import type {
  ClientDetail,
  ClientListItem,
  ClientPropertyShortlistItem,
  ClientRequirementDetail,
  PaginatedResponse,
  PropertyMatchResult,
} from './types';

export interface ClientListFilters {
  page?: number;
  search?: string;
  status?: string;
  source?: string;
  assignedToUserId?: string;
  includeArchived?: boolean;
}

function toQueryString(params: ClientListFilters): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [
    string,
    string | number | boolean | undefined,
  ][]) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function listClients(
  workspaceId: string,
  filters: ClientListFilters = {},
): Promise<PaginatedResponse<ClientListItem>> {
  return apiRequest(`/workspaces/${workspaceId}/clients${toQueryString(filters)}`);
}

export function getClient(workspaceId: string, clientId: string): Promise<ClientDetail> {
  return apiRequest(`/workspaces/${workspaceId}/clients/${clientId}`);
}

export interface CreateClientInput {
  firstName: string;
  lastName: string;
  phone: string;
  whatsappPhone?: string;
  email?: string;
  preferredContactMethod?: string;
  source?: string;
  notes?: string;
  assignedToUserId?: string;
}

export function createClient(
  workspaceId: string,
  input: CreateClientInput,
): Promise<ClientListItem> {
  return apiRequest(`/workspaces/${workspaceId}/clients`, { method: 'POST', body: input });
}

export function updateClient(
  workspaceId: string,
  clientId: string,
  input: Partial<CreateClientInput> & { status?: string },
): Promise<ClientListItem> {
  return apiRequest(`/workspaces/${workspaceId}/clients/${clientId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function assignClient(
  workspaceId: string,
  clientId: string,
  assignedToUserId: string | null,
): Promise<ClientListItem> {
  return apiRequest(`/workspaces/${workspaceId}/clients/${clientId}/assign`, {
    method: 'POST',
    body: { assignedToUserId },
  });
}

export function archiveClient(workspaceId: string, clientId: string): Promise<void> {
  return apiRequest(`/workspaces/${workspaceId}/clients/${clientId}/archive`, { method: 'POST' });
}

export function restoreClient(workspaceId: string, clientId: string): Promise<void> {
  return apiRequest(`/workspaces/${workspaceId}/clients/${clientId}/restore`, { method: 'POST' });
}

export interface CreateRequirementInput {
  title: string;
  listingPurpose: 'SALE' | 'RENT';
  propertyTypes?: string[];
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  minAreaSqm?: number;
  maxAreaSqm?: number;
  countries?: string[];
  cities?: string[];
  areas?: string[];
  requiredFeatures?: string[];
  preferredFeatures?: string[];
  notes?: string;
}

export function listRequirements(
  workspaceId: string,
  clientId: string,
): Promise<ClientRequirementDetail[]> {
  return apiRequest(`/workspaces/${workspaceId}/clients/${clientId}/requirements`);
}

export function createRequirement(
  workspaceId: string,
  clientId: string,
  input: CreateRequirementInput,
): Promise<ClientRequirementDetail> {
  return apiRequest(`/workspaces/${workspaceId}/clients/${clientId}/requirements`, {
    method: 'POST',
    body: input,
  });
}

export function archiveRequirement(
  workspaceId: string,
  clientId: string,
  requirementId: string,
): Promise<void> {
  return apiRequest(
    `/workspaces/${workspaceId}/clients/${clientId}/requirements/${requirementId}/archive`,
    { method: 'POST' },
  );
}

export function getMatches(
  workspaceId: string,
  clientId: string,
  requirementId: string,
  page = 1,
): Promise<PaginatedResponse<PropertyMatchResult>> {
  return apiRequest(
    `/workspaces/${workspaceId}/clients/${clientId}/requirements/${requirementId}/matches?page=${page}`,
  );
}

export function listShortlist(
  workspaceId: string,
  clientId: string,
): Promise<ClientPropertyShortlistItem[]> {
  return apiRequest(`/workspaces/${workspaceId}/clients/${clientId}/shortlist`);
}

export function addToShortlist(
  workspaceId: string,
  clientId: string,
  propertyId: string,
  options: { requirementId?: string; note?: string } = {},
): Promise<ClientPropertyShortlistItem> {
  return apiRequest(`/workspaces/${workspaceId}/clients/${clientId}/shortlist`, {
    method: 'POST',
    body: { propertyId, ...options },
  });
}

export function removeFromShortlist(
  workspaceId: string,
  clientId: string,
  shortlistId: string,
): Promise<void> {
  return apiRequest(`/workspaces/${workspaceId}/clients/${clientId}/shortlist/${shortlistId}`, {
    method: 'DELETE',
  });
}
