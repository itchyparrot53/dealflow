import type { MetadataRoute } from "next";

// The installable app manifest. `start_url` carries `source=pwa` so later analytics can tell an
// installed app from a browser tab, and the scope stays "/" so every route opens in the app
// window. Colours come from the Dealflow brand kit: white install background and indigo chrome
// (#211C52), matching --rail. The four icons are the kit's PNG app exports.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dealflow",
    short_name: "Dealflow",
    description: "A self-hosted CRM for business development",
    start_url: "/deals?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#211C52",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
