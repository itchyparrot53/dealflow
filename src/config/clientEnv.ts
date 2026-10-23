// Browser-safe public environment values.
// Only NEXT_PUBLIC_* variables belong here: Next.js inlines them at build time
// so they never require node:fs and are safe to import in "use client" modules.
// The server-only boundary (src/config/env.ts) must NOT be imported from client code.

export const clientEnv = {
  // WebSocket server URL visible to the browser. Set NEXT_PUBLIC_WS_URL in .env.
  WS_PUBLIC_URL: process.env.NEXT_PUBLIC_WS_URL ?? "",
  // Part 12, 6.4: install, offline and push mentions are hidden by default. The code, the service
  // worker, the routes and the tests all stay; only the user-facing surfaces are gated.
  PWA_UI: process.env.NEXT_PUBLIC_PWA_UI === "true",
} as const;
