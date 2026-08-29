import type { ExpoConfig } from 'expo/config';

/**
 * app.config.ts instead of a static app.json — Milestone 3 needs the
 * Google Maps native API keys read from environment variables at build
 * time (see docs/API.md "Google Maps setup"). Never hard-code a key
 * here; unset env vars simply omit the corresponding config field
 * (Maps then fails to render at runtime with Google's own error UI
 * rather than the app crashing at build time).
 */
const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;

const config: ExpoConfig = {
  name: 'mobile',
  slug: 'mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    config: iosGoogleMapsApiKey ? { googleMapsApiKey: iosGoogleMapsApiKey } : undefined,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    config: androidGoogleMapsApiKey
      ? { googleMaps: { apiKey: androidGoogleMapsApiKey } }
      : undefined,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Used only when you tap "Use my current location" while placing a property pin.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Used only when you choose a property photo to upload.',
        cameraPermission: 'Used only when you take a property photo to upload.',
      },
    ],
  ],
};

export default config;
