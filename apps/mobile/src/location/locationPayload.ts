import type { PlaceDetails } from './googlePlaces';

/**
 * Pure location business logic — no React Native imports, so this is
 * unit-testable under plain Node (see apps/mobile/jest.config.js).
 * `MapLocationPicker` and the screens that use it hold state as a
 * `LocationDraft` and only ever produce a wire payload through
 * `toLocationDto`, which is an explicit allowlist: it can only ever
 * emit the fields `PropertyLocationDto` accepts, so a stray extra field
 * on the draft (or anything ownership-related) can never leak into the
 * save request.
 */

export type LocationSource = 'GOOGLE_SEARCH' | 'MAP_PIN' | 'CURRENT_LOCATION' | 'MANUAL';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationDraft {
  latitude: number;
  longitude: number;
  googlePlaceId?: string;
  address?: string;
  country?: string;
  region?: string;
  city?: string;
  area?: string;
  locationSource: LocationSource;
}

/** Shape of a previously saved location as returned by the API. */
export interface SavedLocation {
  latitude: number;
  longitude: number;
  googlePlaceId?: string | null;
  address?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  area?: string | null;
  locationSource?: string | null;
}

const KNOWN_SOURCES: readonly LocationSource[] = [
  'GOOGLE_SEARCH',
  'MAP_PIN',
  'CURRENT_LOCATION',
  'MANUAL',
];

function normalizeSource(source: string | null | undefined): LocationSource {
  return (KNOWN_SOURCES as readonly string[]).includes(source ?? '')
    ? (source as LocationSource)
    : 'MANUAL';
}

/**
 * Reopening a saved property's location must show the exact saved pin —
 * never re-geocode or re-center on a default.
 */
export function initialDraftFromSavedLocation(saved: SavedLocation): LocationDraft {
  return {
    latitude: saved.latitude,
    longitude: saved.longitude,
    googlePlaceId: saved.googlePlaceId ?? undefined,
    address: saved.address ?? undefined,
    country: saved.country ?? undefined,
    region: saved.region ?? undefined,
    city: saved.city ?? undefined,
    area: saved.area ?? undefined,
    locationSource: normalizeSource(saved.locationSource),
  };
}

/** Selecting a search result auto-moves the pin to that place. */
export function draftFromPlaceDetails(place: PlaceDetails): LocationDraft {
  return {
    latitude: place.latitude,
    longitude: place.longitude,
    googlePlaceId: place.placeId,
    address: place.formattedAddress ?? undefined,
    country: place.country ?? undefined,
    region: place.region ?? undefined,
    city: place.city ?? undefined,
    area: place.area ?? undefined,
    locationSource: 'GOOGLE_SEARCH',
  };
}

/**
 * Manually dropping or dragging the pin moves it off whatever place it
 * was tied to, so the previous `googlePlaceId` no longer applies — the
 * new coordinates are the source of truth from here on, per the
 * "saved lat/lng are the source of truth, Place ID is supplementary"
 * requirement. Best-effort address context from the prior draft is kept
 * so a manual nudge near a searched result doesn't blank the form.
 */
export function draftFromManualPin(
  current: LocationDraft | undefined,
  coordinates: Coordinates,
): LocationDraft {
  return {
    address: current?.address,
    country: current?.country,
    region: current?.region,
    city: current?.city,
    area: current?.area,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    googlePlaceId: undefined,
    locationSource: 'MAP_PIN',
  };
}

/** "Use my current location" — the one action that may request device permission. */
export function draftFromCurrentLocation(coordinates: Coordinates): LocationDraft {
  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    locationSource: 'CURRENT_LOCATION',
  };
}

/** The exact set of keys `PropertyLocationDto` accepts — nothing more, nothing less. */
export interface PropertyLocationPayload {
  latitude: number;
  longitude: number;
  googlePlaceId?: string;
  address?: string;
  country?: string;
  region?: string;
  city?: string;
  area?: string;
  locationSource: LocationSource;
}

export function toLocationDto(draft: LocationDraft): PropertyLocationPayload {
  return {
    latitude: draft.latitude,
    longitude: draft.longitude,
    googlePlaceId: draft.googlePlaceId,
    address: draft.address,
    country: draft.country,
    region: draft.region,
    city: draft.city,
    area: draft.area,
    locationSource: draft.locationSource,
  };
}
