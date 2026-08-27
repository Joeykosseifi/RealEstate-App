import { getPlaceDetails, searchPlaces } from './googlePlaces';

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const ORIGINAL_FETCH = global.fetch;

function mockFetchOnce(body: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

afterEach(() => {
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = ORIGINAL_ENV;
  global.fetch = ORIGINAL_FETCH;
  jest.restoreAllMocks();
});

describe('searchPlaces', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-key';
  });

  it('returns no results without calling the API for a too-short query', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    const results = await searchPlaces('ab');
    expect(results).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps autocomplete predictions to suggestions', async () => {
    mockFetchOnce({
      status: 'OK',
      predictions: [{ place_id: 'p1', description: 'Beirut, Lebanon' }],
    });

    const results = await searchPlaces('Beirut');
    expect(results).toEqual([{ placeId: 'p1', description: 'Beirut, Lebanon' }]);
  });

  it('throws when the API key is not configured', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    await expect(searchPlaces('Beirut')).rejects.toThrow(/GOOGLE_PLACES_API_KEY/);
  });
});

describe('getPlaceDetails', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'test-key';
  });

  it('extracts coordinates and address components into region/city/area', async () => {
    mockFetchOnce({
      status: 'OK',
      result: {
        formatted_address: 'Hamra, Beirut, Lebanon',
        geometry: { location: { lat: 33.8938, lng: 35.5018 } },
        address_components: [
          { long_name: 'Lebanon', types: ['country'] },
          { long_name: 'Beirut Governorate', types: ['administrative_area_level_1'] },
          { long_name: 'Beirut', types: ['locality'] },
          { long_name: 'Hamra', types: ['sublocality'] },
        ],
      },
    });

    const details = await getPlaceDetails('place-123');
    expect(details).toEqual({
      placeId: 'place-123',
      formattedAddress: 'Hamra, Beirut, Lebanon',
      latitude: 33.8938,
      longitude: 35.5018,
      country: 'Lebanon',
      region: 'Beirut Governorate',
      city: 'Beirut',
      area: 'Hamra',
    });
  });

  it('throws when Google reports a non-OK status', async () => {
    mockFetchOnce({ status: 'NOT_FOUND' });
    await expect(getPlaceDetails('missing')).rejects.toThrow(/NOT_FOUND/);
  });
});
