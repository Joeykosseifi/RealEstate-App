import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { MapPressEvent, MarkerDragStartEndEvent, Region } from 'react-native-maps';
import { getPlaceDetails, searchPlaces, type PlaceSuggestion } from './googlePlaces';
import { useCurrentLocation } from './useCurrentLocation';
import {
  draftFromCurrentLocation,
  draftFromManualPin,
  draftFromPlaceDetails,
  type LocationDraft,
} from './locationPayload';

/** Arbitrary starting view when nothing has been picked yet — the user must
 * still search, tap, or use their current location to actually place a pin. */
const DEFAULT_REGION: Region = {
  latitude: 25.2048,
  longitude: 55.2708,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};
const PIN_ZOOM_DELTA = 0.01;

interface Props {
  visible: boolean;
  /** The saved/previous draft, or null when adding a location for the first time. */
  initialDraft: LocationDraft | null;
  onCancel: () => void;
  onSave: (draft: LocationDraft) => void;
}

/**
 * The full interactive location experience: search/autocomplete, tap or
 * drag to place a pin, "use my current location", and the required
 * privacy notice. Rendered as a full-screen modal so it can be opened
 * from both "Add Property" and an existing property's "Edit Location"
 * action without adding new navigation stack routes.
 *
 * Never requests device location permission on its own — only
 * `onUseCurrentLocation` (via `useCurrentLocation`) does that, and only
 * when the user explicitly taps the button.
 */
export function MapLocationPicker({
  visible,
  initialDraft,
  onCancel,
  onSave,
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState<LocationDraft | null>(initialDraft);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { requestCurrentLocation, loading: locating } = useCurrentLocation();
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(initialDraft);
      setQuery(initialDraft?.address ?? '');
      setSuggestions([]);
      setSearchError(null);
    }
  }, [visible, initialDraft]);

  const moveTo = (latitude: number, longitude: number) => {
    mapRef.current?.animateToRegion(
      { latitude, longitude, latitudeDelta: PIN_ZOOM_DELTA, longitudeDelta: PIN_ZOOM_DELTA },
      300,
    );
  };

  const onSearchChange = async (text: string) => {
    setQuery(text);
    setSearchError(null);
    if (text.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      setSuggestions(await searchPlaces(text));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed.');
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  const onSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    setSearching(true);
    setSearchError(null);
    try {
      const place = await getPlaceDetails(suggestion.placeId);
      const next = draftFromPlaceDetails(place);
      setDraft(next);
      setQuery(suggestion.description);
      setSuggestions([]);
      moveTo(next.latitude, next.longitude);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Could not load that place.');
    } finally {
      setSearching(false);
    }
  };

  const onMapPress = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setDraft((current) => draftFromManualPin(current ?? undefined, { latitude, longitude }));
  };

  const onMarkerDragEnd = (event: MarkerDragStartEndEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setDraft((current) => draftFromManualPin(current ?? undefined, { latitude, longitude }));
  };

  const onUseCurrentLocation = async () => {
    const coordinates = await requestCurrentLocation();
    if (coordinates) {
      const next = draftFromCurrentLocation(coordinates);
      setDraft(next);
      setQuery('');
      moveTo(next.latitude, next.longitude);
    }
  };

  const initialRegion: Region = initialDraft
    ? {
        latitude: initialDraft.latitude,
        longitude: initialDraft.longitude,
        latitudeDelta: PIN_ZOOM_DELTA,
        longitudeDelta: PIN_ZOOM_DELTA,
      }
    : DEFAULT_REGION;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for an address or place"
            value={query}
            onChangeText={(text) => void onSearchChange(text)}
          />
          {searching ? <ActivityIndicator style={styles.searchSpinner} /> : null}
        </View>
        {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
        {suggestions.length > 0 ? (
          <FlatList
            style={styles.suggestions}
            keyboardShouldPersistTaps="handled"
            data={suggestions}
            keyExtractor={(item) => item.placeId}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionRow}
                onPress={() => void onSelectSuggestion(item)}
              >
                <Text style={styles.suggestionText}>{item.description}</Text>
              </TouchableOpacity>
            )}
          />
        ) : null}

        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={initialRegion}
          onPress={onMapPress}
        >
          {draft ? (
            <Marker
              coordinate={{ latitude: draft.latitude, longitude: draft.longitude }}
              draggable
              onDragEnd={onMarkerDragEnd}
            />
          ) : null}
        </MapView>

        <View style={styles.footer}>
          <Text style={styles.privacyText}>
            Exact property location is private and visible only to authorized professionals.
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => void onUseCurrentLocation()}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.secondaryButtonText}>Use my current location</Text>
            )}
          </TouchableOpacity>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, !draft && styles.buttonDisabled]}
              onPress={() => draft && onSave(draft)}
              disabled={!draft}
            >
              <Text style={styles.saveButtonText}>Save Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  searchSpinner: { marginLeft: 4 },
  error: { color: '#c0392b', paddingHorizontal: 12, paddingBottom: 4 },
  suggestions: {
    maxHeight: 200,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  suggestionRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  suggestionText: { fontSize: 14, color: '#333' },
  map: { flex: 1 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  privacyText: { color: '#888', fontSize: 12, marginBottom: 10 },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eef4ff',
    marginBottom: 12,
  },
  secondaryButtonText: { color: '#1a73e8', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    alignItems: 'center',
  },
  cancelButtonText: { color: '#333', fontWeight: '600' },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontWeight: '600' },
});
