import type { MetadataRoute } from "next";

// The installable app manifest. `start_url` carries `source=pwa` so later analytics can tell an
// installed app from a browser tab, and the scope stays "/" so every route opens in the app
// window. Colours come from the design tokens: background 0 0% 100% (#ffffff) and primary
// 222.2 47.4% 11.2% (#0f172a) in light mode, which is the brand's default.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dealflow",
    short_name: "Dealflow",
    description: "A self-hosted CRM for business development",
    start_url: "/deals?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
