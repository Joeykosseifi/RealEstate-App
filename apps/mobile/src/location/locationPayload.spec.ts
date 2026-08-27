import {
  draftFromCurrentLocation,
  draftFromManualPin,
  draftFromPlaceDetails,
  initialDraftFromSavedLocation,
  toLocationDto,
} from './locationPayload';
import type { PlaceDetails } from './googlePlaces';

const PLACE: PlaceDetails = {
  placeId: 'place-123',
  formattedAddress: '1 Example St, Beirut, Lebanon',
  latitude: 33.8938,
  longitude: 35.5018,
  country: 'Lebanon',
  region: 'Beirut Governorate',
  city: 'Beirut',
  area: 'Hamra',
};

describe('initialDraftFromSavedLocation', () => {
  it('reproduces the exact saved pin, not a re-derived one', () => {
    const draft = initialDraftFromSavedLocation({
      latitude: 33.1,
      longitude: 35.2,
      googlePlaceId: 'saved-place',
      address: '10 Saved Ave',
      country: 'Lebanon',
      region: 'Mount Lebanon',
      city: 'Jounieh',
      area: 'Kaslik',
      locationSource: 'MANUAL',
    });

    expect(draft).toEqual({
      latitude: 33.1,
      longitude: 35.2,
      googlePlaceId: 'saved-place',
      address: '10 Saved Ave',
      country: 'Lebanon',
      region: 'Mount Lebanon',
      city: 'Jounieh',
      area: 'Kaslik',
      locationSource: 'MANUAL',
    });
  });

  it('falls back to MANUAL for an unrecognized or missing source', () => {
    const draft = initialDraftFromSavedLocation({
      latitude: 1,
      longitude: 2,
      locationSource: 'SOMETHING_UNKNOWN',
    });
    expect(draft.locationSource).toBe('MANUAL');
  });
});

describe('draftFromPlaceDetails', () => {
  it('moves the pin to the selected search result and tags the source', () => {
    const draft = draftFromPlaceDetails(PLACE);
    expect(draft.latitude).toBe(PLACE.latitude);
    expect(draft.longitude).toBe(PLACE.longitude);
    expect(draft.googlePlaceId).toBe(PLACE.placeId);
    expect(draft.locationSource).toBe('GOOGLE_SEARCH');
  });
});

describe('draftFromManualPin', () => {
  it('records the dropped/dragged coordinates and clears the stale place tie', () => {
    const previous = draftFromPlaceDetails(PLACE);
    const moved = draftFromManualPin(previous, { latitude: 10, longitude: 20 });

    expect(moved.latitude).toBe(10);
    expect(moved.longitude).toBe(20);
    expect(moved.googlePlaceId).toBeUndefined();
    expect(moved.locationSource).toBe('MAP_PIN');
    // best-effort address context from the prior draft is preserved
    expect(moved.city).toBe(PLACE.city);
  });
});

describe('draftFromCurrentLocation', () => {
  it('records the device coordinates and tags the source', () => {
    const draft = draftFromCurrentLocation({ latitude: 5, longitude: 6 });
    expect(draft).toEqual({ latitude: 5, longitude: 6, locationSource: 'CURRENT_LOCATION' });
  });
});

describe('toLocationDto', () => {
  it('emits exactly the PropertyLocationDto-accepted keys — no ownership fields', () => {
    const draft = draftFromPlaceDetails(PLACE);
    const payload = toLocationDto(draft);

    expect(Object.keys(payload).sort()).toEqual(
      [
        'area',
        'city',
        'country',
        'googlePlaceId',
        'latitude',
        'locationSource',
        'longitude',
        'region',
        'address',
      ].sort(),
    );
    expect(payload).not.toHaveProperty('workspaceId');
    expect(payload).not.toHaveProperty('createdByUserId');
  });
});
