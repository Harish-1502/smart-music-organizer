import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.harish.smartmusicorganizer',
  appName: 'Smart Music Organizer',
  webDir: 'dist',
  // Android LAN development: use an HTTP WebView shell so the app can talk to
  // an HTTP FastAPI backend on the same trusted Wi-Fi without HTTPS yet.
  server: {
    androidScheme: 'http',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
