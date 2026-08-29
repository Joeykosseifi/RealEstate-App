import { apiRequest } from './client';
import type { WorkspaceDashboard } from './types';

export function getDashboard(workspaceId: string): Promise<WorkspaceDashboard> {
  return apiRequest(`/workspaces/${workspaceId}/dashboard`);
}
