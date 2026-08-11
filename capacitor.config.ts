import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Android package ID. The existing App Store record has the legacy iOS-only
  // ID com.ChrisDavis-courtiq, which is intentionally set in Xcode.
  appId: "com.pivottraining.courtiq",
  appName: "Court IQ",
  webDir: "out",
  // server: {
  //   url: "https://courtiq-3f3sp77rf-pivot-trainings-projects.vercel.app",
  //   cleartext: true,
  // },
  ios: {
    scheme: "App",
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#FF6B35",
      showSpinner: false,
    },
  },
};

export default config;
