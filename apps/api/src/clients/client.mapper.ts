import type {
  ClientPropertyShortlist,
  ClientRecord,
  ClientRequirement,
  Property,
  PropertyLocation,
} from '@prisma/client';
import type {
  ClientDetail,
  ClientListItem,
  ClientPropertyShortlistItem,
  ClientRequirementDetail,
} from '@real-estate/types';

export type ClientRecordWithCount = ClientRecord & {
  _count: { requirements: number };
};

export function toClientListItem(
  client: ClientRecordWithCount,
): ClientListItem {
  return {
    id: client.id,
    workspaceId: client.workspaceId,
    createdByUserId: client.createdByUserId,
    assignedToUserId: client.assignedToUserId,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    whatsappPhone: client.whatsappPhone,
    email: client.email,
    preferredContactMethod: client.preferredContactMethod,
    source: client.source,
    status: client.status,
    activeRequirementCount: client._count.requirements,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    archivedAt: client.archivedAt?.toISOString() ?? null,
  };
}

export function toClientRequirementDetail(
  requirement: ClientRequirement,
): ClientRequirementDetail {
  return {
    id: requirement.id,
    clientId: requirement.clientId,
    workspaceId: requirement.workspaceId,
    createdByUserId: requirement.createdByUserId,
    title: requirement.title,
    listingPurpose: requirement.listingPurpose,
    propertyTypes: requirement.propertyTypes,
    minPrice: requirement.minPrice ? Number(requirement.minPrice) : null,
    maxPrice: requirement.maxPrice ? Number(requirement.maxPrice) : null,
    currency: requirement.currency,
    minBedrooms: requirement.minBedrooms,
    maxBedrooms: requirement.maxBedrooms,
    minBathrooms: requirement.minBathrooms,
    minAreaSqm: requirement.minAreaSqm ? Number(requirement.minAreaSqm) : null,
    maxAreaSqm: requirement.maxAreaSqm ? Number(requirement.maxAreaSqm) : null,
    countries: requirement.countries,
    cities: requirement.cities,
    areas: requirement.areas,
    requiredFeatures: requirement.requiredFeatures,
    preferredFeatures: requirement.preferredFeatures,
    notes: requirement.notes,
    status: requirement.status,
    createdAt: requirement.createdAt.toISOString(),
    updatedAt: requirement.updatedAt.toISOString(),
    archivedAt: requirement.archivedAt?.toISOString() ?? null,
  };
}

export type ShortlistItemWithProperty = ClientPropertyShortlist & {
  property: Property & {
    location: Pick<PropertyLocation, 'city' | 'area'> | null;
  };
};

export function toClientPropertyShortlistItem(
  item: ShortlistItemWithProperty,
): ClientPropertyShortlistItem {
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    clientId: item.clientId,
    requirementId: item.requirementId,
    propertyId: item.propertyId,
    addedByUserId: item.addedByUserId,
    note: item.note,
    createdAt: item.createdAt.toISOString(),
    property: {
      id: item.property.id,
      title: item.property.title,
      propertyType: item.property.propertyType,
      listingPurpose: item.property.listingPurpose,
      price: Number(item.property.price),
      currency: item.property.currency,
      bedrooms: item.property.bedrooms,
      bathrooms: item.property.bathrooms,
      areaSqm: item.property.areaSqm ? Number(item.property.areaSqm) : null,
      city: item.property.location?.city ?? null,
      area: item.property.location?.area ?? null,
      propertyStatus: item.property.propertyStatus,
    },
  };
}

export function toClientDetail(
  client: ClientRecordWithCount,
  requirements: ClientRequirement[],
  shortlist: ShortlistItemWithProperty[],
  presentationCount: number,
): ClientDetail {
  return {
    ...toClientListItem(client),
    notes: client.notes,
    requirements: requirements.map(toClientRequirementDetail),
    shortlist: shortlist.map(toClientPropertyShortlistItem),
    presentationCount,
  };
}
