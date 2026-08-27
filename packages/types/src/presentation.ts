import type { PresentationSafePropertySnapshot } from './matching';

export type PresentationStatus = 'DRAFT' | 'GENERATED' | 'ARCHIVED';

export interface PropertyPresentationItemDetail {
  id: string;
  propertyId: string;
  sortOrder: number;
  agentNote: string | null;
  property: PresentationSafePropertySnapshot;
}

/** Returned by the presentation list endpoint. */
export interface PropertyPresentationSummary {
  id: string;
  workspaceId: string;
  clientId: string | null;
  requirementId: string | null;
  createdByUserId: string;
  title: string;
  status: PresentationStatus;
  itemCount: number;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

/**
 * Returned by the presentation detail endpoint. `storageKey` is
 * deliberately never included here — access to the generated PDF is
 * only ever through a short-lived signed URL (see
 * `GET .../presentations/:id/access-url`), never a stored key or
 * permanent path.
 */
export interface PropertyPresentationDetail extends PropertyPresentationSummary {
  items: PropertyPresentationItemDetail[];
}
