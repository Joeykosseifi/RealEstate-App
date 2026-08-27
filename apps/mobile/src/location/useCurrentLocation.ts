import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

export interface PickedCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * "Use current location" — the ONLY moment this app requests location
 * permission (see docs/PERMISSIONS.md "Location privacy in UI": never
 * request permission merely to view a saved pin). Requesting a full
 * interactive map/search/drop-pin experience is Milestone 3's
 * documented follow-up (`react-native-maps` + a configured Google Maps
 * API key) — this hook is the seam a future `<MapLocationPicker>` slots
 * into without changing any screen that calls it, matching the
 * "provider boundary built cleanly" allowance in the milestone spec
 * when full Maps SDK credentials aren't available in this environment.
 */
export function useCurrentLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCurrentLocation = useCallback(async (): Promise<PickedCoordinates | null> => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission was not granted.');
        return null;
      }
      const position = await Location.getCurrentPositionAsync({});
      return { latitude: position.coords.latitude, longitude: position.coords.longitude };
    } catch {
      setError('Could not determine current location.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { requestCurrentLocation, loading, error };
}
