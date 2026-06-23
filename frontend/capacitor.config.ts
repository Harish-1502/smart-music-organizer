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
  plugins: {
    CapacitorSQLite: {
      // Offline mobile metadata here is not storing secrets or audio blobs, so
      // we explicitly disable the plugin's Android encryption path. The plugin
      // defaults androidIsEncryption=true, which forces EncryptedSharedPreferences
      // during plugin startup and is what currently breaks DB initialization.
      androidIsEncryption: false,
      androidBiometric: {
        biometricAuth: false,
      },
    },
  },
};

export default config;
