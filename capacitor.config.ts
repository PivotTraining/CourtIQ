import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pivottraining.courtiq",
  appName: "Court IQ",
  webDir: "out",
  // server: {
  //   url: "https://courtiq-3f3sp77rf-pivot-trainings-projects.vercel.app",
  //   cleartext: true,
  // },
  ios: {
    scheme: "Court IQ",
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: true,
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
