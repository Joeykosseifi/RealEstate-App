export type ClientRecordStatus =
  | 'LEAD'
  | 'ACTIVE'
  | 'QUALIFIED'
  | 'VIEWING'
  | 'NEGOTIATING'
  | 'WON'
  | 'LOST'
  | 'INACTIVE'
  | 'ARCHIVED';

export type ClientSource =
  | 'REFERRAL'
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'WEBSITE'
  | 'PHONE'
  | 'WALK_IN'
  | 'PROPERTY_INQUIRY'
  | 'OTHER';

export type PreferredContactMethod = 'PHONE' | 'WHATSAPP' | 'EMAIL' | 'OTHER';

export type ClientRequirementStatus = 'ACTIVE' | 'PAUSED' | 'FULFILLED' | 'ARCHIVED';

/** Returned by the paginated client list endpoint. */
export interface ClientListItem {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  assignedToUserId: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  whatsappPhone: string | null;
  email: string | null;
  preferredContactMethod: PreferredContactMethod | null;
  source: ClientSource | null;
  status: ClientRecordStatus;
  activeRequirementCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

/** A single stored property requirement for a client — never restricted to one per client. */
export interface ClientRequirementDetail {
  id: string;
  clientId: string;
  workspaceId: string;
  createdByUserId: string;
  title: string;
  listingPurpose: 'SALE' | 'RENT';
  propertyTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
  minBedrooms: number | null;
  maxBedrooms: number | null;
  minBathrooms: number | null;
  minAreaSqm: number | null;
  maxAreaSqm: number | null;
  countries: string[];
  cities: string[];
  areas: string[];
  requiredFeatures: string[];
  preferredFeatures: string[];
  notes: string | null;
  status: ClientRequirementStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

/** A property saved/shortlisted for a client. */
export interface ClientPropertyShortlistItem {
  id: string;
  workspaceId: string;
  clientId: string;
  requirementId: string | null;
  propertyId: string;
  addedByUserId: string;
  note: string | null;
  createdAt: string;
  property: {
    id: string;
    title: string;
    propertyType: string;
    listingPurpose: 'SALE' | 'RENT';
    price: number;
    currency: string;
    bedrooms: number | null;
    bathrooms: number | null;
    areaSqm: number | null;
    city: string | null;
    area: string | null;
    propertyStatus: string;
  };
}

/** Returned by the client detail endpoint. Never includes a linked platform account's authentication secrets. */
export interface ClientDetail extends ClientListItem {
  notes: string | null;
  requirements: ClientRequirementDetail[];
  shortlist: ClientPropertyShortlistItem[];
  presentationCount: number;
}
