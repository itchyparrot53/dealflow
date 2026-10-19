# Running Dealflow behind your own reverse proxy

The default Docker stack has **no proxy**. Compose publishes the app, the WebSocket server and the
MinIO S3 API on loopback, and your own proxy terminates TLS and forwards three routes. This keeps
TLS, DNS and certificates in the tooling you already run, and means `docker compose up -d --build`
brings up only what Dealflow owns.

## The three routes

| Public URL | Upstream (compose default) | Notes |
|---|---|---|
| `https://crm.example.com` | `127.0.0.1:${APP_PORT:-3000}` | Everything the Next.js app serves, including `/api/*` and OAuth callbacks. |
| `https://crm.example.com/_ws*` | `127.0.0.1:${WS_HOST_PORT:-8080}` | WebSocket upgrade. The server routes on port only, so forward the path and query unchanged (the `?ticket=` is part of the handshake). |
| `https://s3.crm.example.com` | `127.0.0.1:${MINIO_PORT:-9000}` | Presigned uploads and downloads. The browser talks to MinIO directly, so this host must match `MINIO_ENDPOINT` exactly. |

A host `A`/`AAAA` record for `crm.example.com` and a second one for `s3.crm.example.com` are
required, because uploads are signed for the `s3.` host and a mismatched hostname fails the
presigned POST. `_ws` shares the app's certificate, so no extra DNS record is needed for realtime.

## Environment values

```dotenv
BASE_URL=https://crm.example.com
NEXT_PUBLIC_WS_URL=wss://crm.example.com/_ws
WS_PUBLIC_URL=ws://ws:8080
MINIO_ENDPOINT=https://s3.crm.example.com
APP_PORT=3000
WS_HOST_PORT=8080
MINIO_PORT=9000
```

`NEXT_PUBLIC_WS_URL` is inlined into the client bundle at build time, so changing it requires a
rebuild, not just a restart. The three bind variables (`APP_BIND`, `WS_BIND`, `MINIO_BIND`) default
to `127.0.0.1`. Set one to `0.0.0.0` or a LAN address only when the proxy runs on another machine.

## Headers that must stay on the s3. host

MinIO serves user-uploaded bytes from a sibling origin. The app's own security headers do not apply
there, so the proxy must add all three:

```caddyfile
Strict-Transport-Security "max-age=31536000; includeSubDomains"
X-Content-Type-Options "nosniff"
Content-Security-Policy "sandbox; default-src 'none'; frame-ancestors 'none'"
```

`nosniff` stops a mislabeled object being interpreted as HTML; the CSP sandbox makes anything that
does render inert (no scripts, no same-origin access); HSTS belongs at the TLS terminator because
only the proxy knows the response went out over HTTPS. The app's own headers (frame-ancestors,
X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) come from `next.config.ts` and apply
on the app host in every deploy, proxy or not.

## Body limits

Cap request bodies on the **app** host at 80 MB. That sits above Next's 64 MB server-action limit,
so Next's own check remains the binding one for legitimate traffic (the CSV importer) and the proxy
only stops the absurd case from being buffered. Do **not** cap bodies on the `s3.` host: presigned
uploads land there, and MinIO enforces the real ceiling (`MAX_FILE_BYTES`, default 24 MB) through
the presigned POST policy.

## Caddy example

[`Caddyfile.example`](reverse-proxy/Caddyfile.example) is a working two-vhost config with the
headers and limits above. Copy it, set `APP_DOMAIN`, `ACME_EMAIL` and (if needed) the upstream
variables, and run it:

```bash
APP_DOMAIN=crm.example.com ACME_EMAIL=you@example.com \
  caddy run --config docs/reverse-proxy/Caddyfile.example
```

The example reads four environment variables: `APP_DOMAIN`, `ACME_EMAIL`, and the optional upstream
overrides `APP_UPSTREAM` (default `localhost:3000`), `WS_UPSTREAM` (default `localhost:8080`) and
`S3_UPSTREAM` (default `localhost:9000`). Caddy provisions and renews the certificates for both
hosts automatically.

## Rate limiting depends on the proxy

The app identifies a caller by the last `X-Forwarded-For` entry, which is trustworthy only because
the proxy appends the true peer address. Keep the app port on loopback (the default), or firewalled
to the proxy, or every client can claim a fresh identity and the unauthenticated rate limits stop
enforcing anything. See `docs/deploy.md` for the full deploy walkthrough.
