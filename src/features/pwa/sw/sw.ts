import { CACHE_PREFIX } from "@/constants/pwa";
import { decide } from "./routes";

declare const __SW_BUILD_ID__: string;

// The service worker is bundled by esbuild (scripts/dealflow/build-sw.mjs), so it is typed with the
// small surface it actually uses rather than pulling the webworker lib into the app's tsconfig.
const CACHE_NAME = `${CACHE_PREFIX}static-${__SW_BUILD_ID__}`;
const OFFLINE_URL = "/offline";
// Only the offline shell and the app icons are precached. No HTML beyond /offline is ever cached:
// every other page is private to a session.
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/manifest.webmanifest",
] as const;
const FETCH_TIMEOUT_MS = 30_000;

type ExtendableEvent = { waitUntil: (promise: Promise<unknown>) => void };
type FetchEvent = ExtendableEvent & {
  request: Request;
  respondWith: (response: Promise<Response>) => void;
};
type MessageEvent = ExtendableEvent & { data: unknown };
type PushEvent = ExtendableEvent & {
  data: { json: () => unknown } | null;
};
type NotificationClickEvent = ExtendableEvent & {
  notification: { close: () => void; data?: unknown };
};
type WindowClient = {
  url: string;
  focus: () => Promise<unknown>;
  navigate: (url: string) => Promise<unknown>;
};
type WorkerGlobal = {
  addEventListener: <T>(type: string, listener: (event: T) => void) => void;
  skipWaiting: () => Promise<void>;
  clients: {
    claim: () => Promise<void>;
    matchAll: (options: { type: string; includeUncontrolled: boolean }) => Promise<WindowClient[]>;
    openWindow: (url: string) => Promise<unknown>;
  };
  registration: {
    showNotification: (title: string, options: Record<string, unknown>) => Promise<void>;
  };
};

const worker = globalThis as unknown as WorkerGlobal;
const origin = globalThis.location.origin;

// The offline page is a client page, so its HTML alone is not enough: its CSS and JS chunks must be
// in the cache too or the offline navigation renders unstyled and never hydrates. They are static
// build assets, so caching them follows the same rule as the icons.
const STATIC_ASSET = /\/_next\/static\/[^"'\s]+?\.(?:css|js)/g;

async function precache(): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  // allSettled: one unavailable icon must not abort the install and leave the app without the
  // offline page.
  await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
  try {
    const html = await (
      await fetch(OFFLINE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    ).text();
    const assets = [...new Set([...html.matchAll(STATIC_ASSET)].map((match) => match[0]))];
    await Promise.allSettled(assets.map((url) => cache.add(url)));
  } catch {
    // Without the shell the rest of the worker still works; the browser cache covers a retry.
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached !== undefined) return cached;
  const response = await fetch(request, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

// Navigations are network-first and never cached. Only a failed navigation falls back to the
// precached /offline shell, which rebuilds the record list from IndexedDB in the page.
async function navigateFallback(request: Request): Promise<Response> {
  try {
    return await fetch(request, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    const cached = await caches.match(OFFLINE_URL);
    if (cached !== undefined) return cached;
    return new Response("You are offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

function isPushPayload(value: unknown): value is {
  title: string;
  body: string;
  url: string;
  tag: string;
} {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.title === "string" &&
    typeof record.body === "string" &&
    typeof record.url === "string" &&
    typeof record.tag === "string"
  );
}

function readPushPayload(event: PushEvent): {
  title: string;
  body: string;
  url: string;
  tag: string;
} {
  try {
    const parsed: unknown = event.data?.json();
    if (isPushPayload(parsed)) return parsed;
  } catch {
    // A payload that is not JSON still deserves a generic notification.
  }
  return {
    title: "Dealflow",
    body: "Open the app to see what changed.",
    url: "/notifications",
    tag: "dealflow",
  };
}

function notificationUrl(data: unknown): string {
  if (data !== null && typeof data === "object") {
    const url = (data as { url?: unknown }).url;
    if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) return url;
  }
  return "/notifications";
}

worker.addEventListener<ExtendableEvent>("install", (event) => {
  event.waitUntil(precache());
});

worker.addEventListener<ExtendableEvent>("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await worker.clients.claim();
    })(),
  );
});

worker.addEventListener<FetchEvent>("fetch", (event) => {
  const decision = decide({
    url: event.request.url,
    method: event.request.method,
    mode: event.request.mode,
    origin,
  });
  switch (decision.kind) {
    case "bypass":
      return;
    case "cache-first":
      event.respondWith(cacheFirst(event.request));
      return;
    case "navigate-fallback":
      event.respondWith(navigateFallback(event.request));
      return;
  }
});

worker.addEventListener<MessageEvent>("message", (event) => {
  const data: unknown = event.data;
  if (
    data !== null &&
    typeof data === "object" &&
    (data as { type?: unknown }).type === "SKIP_WAITING"
  ) {
    event.waitUntil(worker.skipWaiting());
  }
});

worker.addEventListener<PushEvent>("push", (event) => {
  event.waitUntil(
    (async () => {
      const payload = readPushPayload(event);
      await worker.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: payload.tag,
        data: { url: payload.url },
      });
    })(),
  );
});

worker.addEventListener<NotificationClickEvent>("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(notificationUrl(event.notification.data), origin).href;
  event.waitUntil(
    (async () => {
      const clients = await worker.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if (client.url.startsWith(origin)) {
          await client.focus();
          await client.navigate(url);
          return;
        }
      }
      await worker.clients.openWindow(url);
    })(),
  );
});
