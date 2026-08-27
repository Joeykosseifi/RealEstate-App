/**
 * Thin fetch-based wrapper around Google's Places Autocomplete + Place
 * Details HTTP APIs — deliberately not a third-party autocomplete
 * package, to keep this on the same "reviewable, no hidden native code"
 * footing as the rest of the app. Contains no React Native imports so it
 * can be unit-tested under plain Node (see apps/mobile/jest.config.js).
 *
 * Requires the Places API to be enabled on the Google Cloud project that
 * issues EXPO_PUBLIC_GOOGLE_PLACES_API_KEY — see docs/API.md "Google
 * Maps setup".
 */

const PLACES_API_BASE = 'https://maps.googleapis.com/maps/api/place';

export interface PlaceSuggestion {
  placeId: string;
  description: string;
}

export interface PlaceDetails {
  placeId: string;
  formattedAddress: string | null;
  latitude: number;
  longitude: number;
  country: string | null;
  region: string | null;
  city: string | null;
  area: string | null;
}

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set — search is unavailable. Drop a pin on the map or use your current location instead.',
    );
  }
  return key;
}

interface AutocompletePrediction {
  place_id: string;
  description: string;
}

interface AutocompleteResponse {
  status: string;
  predictions?: AutocompletePrediction[];
  error_message?: string;
}

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }

  const params = new URLSearchParams({
    input: trimmed,
    key: getApiKey(),
  });
  const response = await fetch(`${PLACES_API_BASE}/autocomplete/json?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Places autocomplete request failed with status ${response.status}`);
  }
  const data = (await response.json()) as AutocompleteResponse;
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message ?? `Places autocomplete returned status ${data.status}`);
  }

  return (data.predictions ?? []).map((prediction) => ({
    placeId: prediction.place_id,
    description: prediction.description,
  }));
}

interface AddressComponent {
  long_name: string;
  types: string[];
}

interface PlaceDetailsResult {
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  address_components?: AddressComponent[];
}

interface PlaceDetailsResponse {
  status: string;
  result?: PlaceDetailsResult;
  error_message?: string;
}

function findComponent(components: AddressComponent[], type: string): string | null {
  return components.find((component) => component.types.includes(type))?.long_name ?? null;
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const params = new URLSearchParams({
    place_id: placeId,
    key: getApiKey(),
    fields: 'formatted_address,geometry,address_component',
  });
  const response = await fetch(`${PLACES_API_BASE}/details/json?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Place details request failed with status ${response.status}`);
  }
  const data = (await response.json()) as PlaceDetailsResponse;
  if (data.status !== 'OK' || !data.result?.geometry?.location) {
    throw new Error(data.error_message ?? `Place details returned status ${data.status}`);
  }

  const components = data.result.address_components ?? [];
  return {
    placeId,
    formattedAddress: data.result.formatted_address ?? null,
    latitude: data.result.geometry.location.lat,
    longitude: data.result.geometry.location.lng,
    country: findComponent(components, 'country'),
    region: findComponent(components, 'administrative_area_level_1'),
    city: findComponent(components, 'locality') ?? findComponent(components, 'postal_town'),
    area: findComponent(components, 'sublocality') ?? findComponent(components, 'neighborhood'),
  };
}
