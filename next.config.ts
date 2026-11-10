import type { NextConfig } from "next";

// Security response headers, applied to every route.
//
// script-src is deliberately ABSENT. Locking it down under the App Router requires nonce
// injection from middleware, and this project has no middleware.ts by design (auth is enforced
// per route). The directives below are the ones that are correct without a nonce pipeline and
// that carry the actual exploit mitigations; adding script-src is a separate change that must
// land together with nonce plumbing, not a value tweak here.
//
// frame-ancestors is the load-bearing one. /oauth/authorize/consent renders a one-click
// "Allow access" form whose CSRF token is already baked into the action URL, so a submit from
// inside a frame satisfies every check in validateCsrf (token matches, Origin is ours,
// Sec-Fetch-Site reads same-origin). Framing plus an overlay therefore turns one stray click
// into an OAuth grant handing an attacker's client full MCP access to the CRM. CSRF tokens
// cannot see that attack; only refusing to be framed can.
export const CONSENT_PATH = "/oauth/authorize/consent";

// Public forms and booking pages are designed to be embedded on other sites, so these two path
// prefixes are the only routes that may be framed (PLAN-PART6 section 6.8). Like the consent
// carve-out, they must be removed from the strict entry rather than given a second header: a
// browser intersects two CSP headers, so a looser frame-ancestors would lose to 'none'.
export const PUBLIC_PATHS = "/(f|book)(/.*)?";

// Every route except the consent screen. Next applies every matching headers() entry and a browser
// intersects two Content-Security-Policy headers, so the consent screen cannot relax a directive by
// adding a second header: it has to be carved out of the strict entry. Pinned by next.config.test.
// The `/?` matters: without it the trailing-slash spelling slips past the carve-out and matches
// both entries, which is the two-header case described above.
const ALL_ROUTES_EXCEPT_CONSENT_AND_PUBLIC =
  "/((?!oauth/authorize/consent/?$|(?:f|book)(?:/|$)).*)";

const BASE_CSP = [
  "frame-ancestors 'none'",
  // Never legitimately needed here, and a classic injection escalation: a <base> tag rewrites
  // every relative URL on the page.
  "base-uri 'self'",
  "object-src 'none'",
  // The PWA registers /sw.js; without this a future default-src would silently break it.
  "worker-src 'self'",
];

// Keeps injected markup from retargeting a form at an attacker's collector. Deliberately absent on
// the consent screen: form-action is enforced against a form submission's ENTIRE redirect chain,
// and POST /oauth/authorize answers with a 302 to the OAuth client's registered redirect_uri, which
// is by definition not 'self'. With 'self' in force the browser drops that hop silently, so the
// server mints an auth code the client never receives and "Allow access" looks like a dead button.
// Little is given up: the directive's value is against injected markup, but script-src is absent
// (see above), so anything able to inject a form on that page can inject a script instead. The
// protections that actually carry the consent screen are unaffected: frame-ancestors still blocks
// the clickjacking path, and redirect_uri is still checked against the client's registered set in
// the route handler before any redirect is issued.
const FORM_ACTION = "form-action 'self'";

// Embeddable public pages: same hardening, except they may be framed by any site.
const PUBLIC_CSP = ["frame-ancestors *", "base-uri 'self'", "object-src 'none'"];

function securityHeaders(directives: string[]): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: directives.join("; ") },
    // Redundant with frame-ancestors on current browsers, kept for the pre-CSP-2 tail.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Full URLs leak record ids (/deals/<uuid>) and the consent query string, which carries the
    // CSRF token, into any cross-origin navigation.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // No app surface uses these; denying them shrinks what injected content could ask for.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ];
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "pg-boss"],
  // HSTS is set by Caddy, not here: it terminates TLS and so is the layer that knows the
  // response actually went out over HTTPS. See Caddyfile.
  headers() {
    return Promise.resolve([
      { source: CONSENT_PATH, headers: securityHeaders(BASE_CSP) },
      // Public pages drop X-Frame-Options entirely; DENY would override frame-ancestors * in
      // older browsers, and the CSP is the directive that matters on current ones.
      {
        source: PUBLIC_PATHS,
        headers: securityHeaders([...PUBLIC_CSP, FORM_ACTION]).filter(
          (header) => header.key !== "X-Frame-Options",
        ),
      },
      {
        source: ALL_ROUTES_EXCEPT_CONSENT_AND_PUBLIC,
        headers: securityHeaders([...BASE_CSP, FORM_ACTION]),
      },
      // A service worker must never be served from the browser's HTTP cache: a stale /sw.js keeps
      // the old worker alive for up to 24 hours. The scope header is what allows /sw.js (served
      // from the root) to claim the whole site.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // The campaign web version (Part 14) is public and token-addressed, so it must never be
      // indexed. Pages cannot set response headers themselves; the metadata only emits a meta tag.
      {
        source: "/v/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        source: "/c/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        source: "/u/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ]);
  },
  // "x-powered-by: Next.js" hands a scanner the framework for free.
  poweredByHeader: false,
  // Auto-memoizes components and hooks, replacing hand-written useMemo/useCallback. Safe only
  // because the rules of hooks are now enforced: eslint-plugin-react-hooks runs clean across src.
  // The compiler assumes purity and correct dependencies, and silently bails out of any component
  // it cannot prove pure, so it is enabled only after that lint pass, never before.
  // Top-level, not experimental: Next 16 promoted the key.
  reactCompiler: true,
  experimental: {
    // Icons are imported from the lucide-react barrel in ~13 files. Without this, any chunk that
    // touches one icon pulls the whole barrel; Next rewrites them to direct module paths instead.
    optimizePackageImports: ["lucide-react"],
    // The CSV importer POSTs the entire parsed rows array through the createBatchAction
    // server action, whose JSON encoding runs ~2.2x the raw file bytes. Next defaults this
    // to ~1 MB, so any CSV over a few hundred KB passes the 25 MB client cap
    // (MAX_IMPORT_CSV_BYTES) then fails at the server. Raise it to cover that cap's JSON
    // expansion. Stopgap: the storage-backed import overhaul moves the bytes off the request
    // path entirely, making this irrelevant. Tied to the client cap by next.config.test.ts.
    serverActions: { bodySizeLimit: "64mb" },
  },
};

export default nextConfig;
