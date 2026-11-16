import { ExpoConfig, ConfigContext } from 'expo/config';

// Release builds (eas.json "production" profile sets APP_ENV=production) must use HTTPS only.
const IS_PRODUCTION = process.env.APP_ENV === 'production';

// Production builds must point at a real HTTPS API. EXPO_PUBLIC_API_URL comes from the EAS
// "production" environment (`eas env:create`); fail the build rather than ship a dead URL.
if (IS_PRODUCTION) {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
  if (!/^https:\/\/[^/\s]+/.test(apiUrl) || /yourdomain|localhost|ngrok/i.test(apiUrl)) {
    throw new Error(
      `EXPO_PUBLIC_API_URL must be your public HTTPS API for production builds (got "${apiUrl}"). ` +
        'Set it with: eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.<your-domain> --visibility plaintext'
    );
  }
}

// "1234-abc.apps.googleusercontent.com" -> "com.googleusercontent.apps.1234-abc"
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const GOOGLE_IOS_URL_SCHEME = GOOGLE_IOS_CLIENT_ID
  ? `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.replace(/\.apps\.googleusercontent\.com$/, '')}`
  : undefined;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FarmKart',
  slug: 'farmkart',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'farmkart',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.vignesh.farmkart',
    supportsTablet: false,
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.vignesh.farmkart',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // The app never records audio; expo-image-picker adds this permission by default
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  web: {
    output: 'server',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-image',
    'expo-web-browser',
    [
      '@sentry/react-native',
      {
        // Upload source maps for production builds when SENTRY_AUTH_TOKEN is set in EAS secrets
        disableAutoUpload: !IS_PRODUCTION || !process.env.SENTRY_AUTH_TOKEN,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'FarmKart uses your location to show nearby farms and calculate delivery distance.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'FarmKart needs access to your photos so you can add pictures of your produce.',
        cameraPermission: 'FarmKart needs the camera so you can photograph your produce.',
        microphonePermission: false,
      },
    ],
    'expo-notifications',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-secure-store',
    // Native Google Sign-In. iOS needs the reversed iOS client ID as a URL scheme; Android needs no options.
    ...(GOOGLE_IOS_URL_SCHEME
      ? [['@react-native-google-signin/google-signin', { iosUrlScheme: GOOGLE_IOS_URL_SCHEME }] as [string, any]]
      : []),
    [
      'expo-build-properties',
      {
        android: {
          // Cleartext HTTP is only allowed for development/preview builds talking to a LAN API
          usesCleartextTraffic: !IS_PRODUCTION,
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          extraProguardRules:
            '-keep class androidx.work.impl.WorkDatabase { *; }\n-keep class androidx.work.impl.WorkDatabase_Impl { *; }\n-keep class * extends androidx.room.RoomDatabase { *; }\n-keep class androidx.work.** { *; }\n-dontwarn androidx.work.**',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {
      asyncRoutes: {
        web: true,
      },
    },
    eas: {
      projectId: '0b4b7566-66ae-43d9-9f9d-e256d2699afc',
    },
  },
});
