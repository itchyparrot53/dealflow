// What the service worker does with a request. Kept pure and separate from sw.ts so the routing
// rules are unit-tested without a Browser, a Cache or a fetch.
export type SwDecision =
  | { kind: "bypass" }
  | { kind: "cache-first" }
  | { kind: "navigate-fallback" };

// Anything under these prefixes is authenticated, a public token route, or a streaming download:
// caching it would leak one user's data to the next, so it always goes to the network.
const BYPASS_PREFIXES = [
  "/api/",
  "/_ws",
  "/trpc",
  "/t/",
  "/d/",
  "/f/",
  "/book/",
  "/auth/",
  "/oauth/",
  "/export/",
] as const;

// The only paths that are safe to serve from a shared cache: immutable build assets, icons,
// brand artwork and fonts. HTML is never cached (the /offline shell is precached separately by
// install).
const CACHE_FIRST_PREFIXES = ["/_next/static/", "/icons/", "/brand/", "/fonts/"] as const;

const BYPASS: SwDecision = { kind: "bypass" };

export function decide(req: {
  url: string;
  method: string;
  mode: string;
  origin: string;
}): SwDecision {
  // Rule 1: only GET responses are cacheable; anything else is a mutation.
  if (req.method !== "GET") return BYPASS;

  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return BYPASS;
  }

  // Rule 2: never answer a request for another origin.
  if (url.origin !== req.origin) return BYPASS;

  const path = url.pathname;

  // Rule 3: private and token routes, including the CSV report export.
  if (BYPASS_PREFIXES.some((prefix) => path.startsWith(prefix))) return BYPASS;
  if (path.startsWith("/insights/reports/") && path.endsWith("/export.csv")) return BYPASS;

  // Rule 4: immutable static assets.
  if (
    CACHE_FIRST_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
    path === "/manifest.webmanifest"
  ) {
    return { kind: "cache-first" };
  }

  // Rule 5: a navigation is network-first with the static /offline page as the failure fallback.
  if (req.mode === "navigate") return { kind: "navigate-fallback" };

  // Rule 6: everything else (images, RSC payloads, unknown paths) stays on the network.
  return BYPASS;
}
