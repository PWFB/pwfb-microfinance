import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pwfb.microfinance",
  appName: "PWFB Microfinance",
  webDir: "www",
  server: {
    url: "https://pwfb-microfinance-965u.onrender.com",
    cleartext: false,
    allowNavigation: [
      "pwfb-microfinance-965u.onrender.com",
      "pwfb-backend-1.onrender.com"
    ]
  },
  android: {
    allowMixedContent: false
  }
};

export default config;