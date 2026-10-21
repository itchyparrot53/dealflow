// The browser fires `beforeinstallprompt` once, early, and the event cannot be re-created. A
// module-level store captures it for the whole session so the menu and the settings card can
// offer install later without losing the prompt.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let capturing = false;

function notify(): void {
  for (const listener of listeners) listener();
}

export function startInstallPromptCapture(): void {
  if (capturing || typeof window === "undefined") return;
  capturing = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function getInstallPrompt(): InstallPromptEvent | null {
  return deferred;
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (event === null) return "unavailable";
  await event.prompt();
  const choice = await event.userChoice;
  deferred = null;
  notify();
  return choice.outcome;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari predates the display-mode media query in installed web apps.
  const legacy = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return legacy === true;
}

export function isIosBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports a Mac user agent; the touch-point count distinguishes it from a Mac.
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

// useSyncExternalStore sources for the two browser facts the install entry needs. Reading them
// during render (rather than in an effect) keeps the first client render correct and avoids a
// cascading setState; the server snapshot is always false so SSR never guesses.
export function subscribeStandalone(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", listener);
  window.addEventListener("appinstalled", listener);
  return () => {
    query.removeEventListener("change", listener);
    window.removeEventListener("appinstalled", listener);
  };
}

export function getStandaloneSnapshot(): boolean {
  return isStandalone();
}

export function getIosSnapshot(): boolean {
  return isIosBrowser();
}

export const noopSubscribe = (): (() => void) => () => {};
