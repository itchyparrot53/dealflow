// Shared PWA and web-push limits. Kept in one place so the service worker, the offline store and
// the delivery job cannot drift apart on retention or timing.
export const OFFLINE_KEEP_PER_TYPE = 50;
export const OFFLINE_DB_PREFIX = "dealflow-offline-";
export const CACHE_PREFIX = "dealflow-";
// A day: a push that the service cannot deliver by then is stale news, so drop it rather than
// deliver it after the user has already seen the change in the app.
export const PUSH_TTL_SECONDS = 86_400;
// Consecutive failures before a subscription is considered dead and removed (404/410 remove it
// immediately; other errors may be transient).
export const PUSH_MAX_FAILURES = 5;
export const MOBILE_BREAKPOINT_PX = 768;
