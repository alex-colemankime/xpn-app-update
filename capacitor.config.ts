import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Bundle ID — change to whatever the station registers in App Store
  // Connect (e.g. org.xpn.mobileapp). Must match the App ID on the
  // Apple Developer account.
  appId: 'org.xpn.app',
  appName: 'WXPN',
  webDir: 'dist',
  backgroundColor: '#0D0B09',
  ios: {
    // Content extends into the notch/Dynamic Island; the app's own
    // safe-area-inset padding handles the rest (already in App.jsx).
    contentInset: 'never',
  },
};

export default config;
