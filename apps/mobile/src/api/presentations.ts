import { apiRequest } from './client';
import type {
  PaginatedResponse,
  PropertyPresentationDetail,
  PropertyPresentationSummary,
} from './types';

export function listPresentations(
  workspaceId: string,
  clientId?: string,
): Promise<PaginatedResponse<PropertyPresentationSummary>> {
  const query = clientId ? `?clientId=${clientId}` : '';
  return apiRequest(`/workspaces/${workspaceId}/presentations${query}`);
}

export function getPresentation(
  workspaceId: string,
  presentationId: string,
): Promise<PropertyPresentationDetail> {
  return apiRequest(`/workspaces/${workspaceId}/presentations/${presentationId}`);
}

export interface PresentationItemInput {
  propertyId: string;
  agentNote?: string;
}

export function createPresentation(
  workspaceId: string,
  input: {
    title: string;
    clientId?: string;
    requirementId?: string;
    items: PresentationItemInput[];
  },
): Promise<PropertyPresentationDetail> {
  return apiRequest(`/workspaces/${workspaceId}/presentations`, { method: 'POST', body: input });
}

export function updatePresentation(
  workspaceId: string,
  presentationId: string,
  input: Partial<{
    title: string;
    clientId: string;
    requirementId: string;
    items: PresentationItemInput[];
  }>,
): Promise<PropertyPresentationDetail> {
  return apiRequest(`/workspaces/${workspaceId}/presentations/${presentationId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function generatePresentation(
  workspaceId: string,
  presentationId: string,
): Promise<PropertyPresentationDetail> {
  return apiRequest(`/workspaces/${workspaceId}/presentations/${presentationId}/generate`, {
    method: 'POST',
  });
}

export function getPresentationAccessUrl(
  workspaceId: string,
  presentationId: string,
): Promise<{ url: string }> {
  return apiRequest(`/workspaces/${workspaceId}/presentations/${presentationId}/access-url`);
}

export function archivePresentation(workspaceId: string, presentationId: string): Promise<void> {
  return apiRequest(`/workspaces/${workspaceId}/presentations/${presentationId}/archive`, {
    method: 'POST',
  });
}
