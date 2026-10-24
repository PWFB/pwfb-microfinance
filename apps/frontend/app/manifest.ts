import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LAB MICROFINANCE",
    short_name: "LAB",
    description: "LAB MICROFINANCE Management System",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f5f8f6",
    theme_color: "#075d2a",
    lang: "en-NG",
    icons: [
      {
        src: "/pwfb-app-icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/pwfb-app-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
