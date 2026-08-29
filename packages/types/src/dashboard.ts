import type { ClientListItem } from './client';
import type { PropertyBusinessStatus, PropertyListItem } from './property';

export interface PropertyDashboardSummary {
  total: number;
  byBusinessStatus: Record<PropertyBusinessStatus, number>;
  private: number;
  published: number;
  pendingReview: number;
  recent: PropertyListItem[];
}

export interface ClientDashboardSummary {
  total: number;
  activeRequirements: number;
  recent: ClientListItem[];
}

/**
 * Real-data-only workspace dashboard aggregate — see
 * docs/PRODUCT.md "Professional dashboard". Each section is present
 * only when the caller holds the corresponding view permission (same
 * DTO-omission policy as the property/client detail endpoints) —
 * never a zeroed-out placeholder for a section the caller can't see.
 */
export interface WorkspaceDashboard {
  properties?: PropertyDashboardSummary;
  clients?: ClientDashboardSummary;
}
