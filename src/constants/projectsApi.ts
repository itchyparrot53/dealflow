// Part 8: projects, the REST API, the recycle bin, CSV export and backups. One place for the
// limits the services, routes and UI all share.

// API tokens: the visible prefix plus 32 random bytes, hashed at rest.
export const API_TOKEN_PREFIX = "dfk_";
export const API_RATE_PER_MINUTE = 120;
export const API_PAGE_DEFAULT = 50;
export const API_PAGE_MAX = 200;
// A request body above this is refused before Zod sees it.
export const API_BODY_MAX_BYTES = 262_144;

// Recycle bin: items older than this are hard-deleted by the daily purge.
export const RECYCLE_RETENTION_DAYS = 30;

// A new project starts with these phases, in this order.
export const PROJECT_DEFAULT_PHASES = ["Kickoff", "Delivery", "Wrap-up"];

// A CSV export larger than this is refused rather than streamed for minutes.
export const EXPORT_MAX_ROWS = 50_000;
