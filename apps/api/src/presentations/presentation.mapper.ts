import type {
  PropertyPresentation,
  PropertyPresentationItem,
} from '@prisma/client';
import type {
  PropertyPresentationDetail,
  PropertyPresentationItemDetail,
  PropertyPresentationSummary,
} from '@real-estate/types';
import {
  toPresentationSafeSnapshot,
  type PropertyForPresentationSnapshot,
} from '../properties/property.mapper';

export type PresentationWithCount = PropertyPresentation & {
  _count: { items: number };
};

export function toPropertyPresentationSummary(
  presentation: PresentationWithCount,
): PropertyPresentationSummary {
  return {
    id: presentation.id,
    workspaceId: presentation.workspaceId,
    clientId: presentation.clientId,
    requirementId: presentation.requirementId,
    createdByUserId: presentation.createdByUserId,
    title: presentation.title,
    status: presentation.status,
    itemCount: presentation._count.items,
    generatedAt: presentation.generatedAt?.toISOString() ?? null,
    createdAt: presentation.createdAt.toISOString(),
    updatedAt: presentation.updatedAt.toISOString(),
    archivedAt: presentation.archivedAt?.toISOString() ?? null,
  };
}

export type PresentationItemWithProperty = PropertyPresentationItem & {
  property: PropertyForPresentationSnapshot;
};

/**
 * `primaryImageUrls` is pre-resolved by the caller (a signed-URL lookup
 * per property is I/O) — this mapper stays a pure, synchronous function
 * like every other one in this codebase.
 */
export function toPropertyPresentationDetail(
  presentation: PresentationWithCount,
  items: PresentationItemWithProperty[],
  primaryImageUrls: ReadonlyMap<string, string | null>,
): PropertyPresentationDetail {
  const itemDetails: PropertyPresentationItemDetail[] = items
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      id: item.id,
      propertyId: item.propertyId,
      sortOrder: item.sortOrder,
      agentNote: item.agentNote,
      property: toPresentationSafeSnapshot(
        item.property,
        primaryImageUrls.get(item.propertyId) ?? null,
      ),
    }));

  return { ...toPropertyPresentationSummary(presentation), items: itemDetails };
}
