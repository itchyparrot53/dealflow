# Deploying Dealflow to a single box

Dealflow ships as a self-contained Docker Compose stack: the Next.js app, a WebSocket server, a
background worker, Postgres and MinIO object storage. There is **no reverse proxy in the stack**:
the app, ws and MinIO publish on loopback, and your own proxy terminates TLS for the app domain and
the `s3.` subdomain. One `docker compose up -d --build` brings up everything Dealflow owns.

## Prerequisites

- A Linux box with Docker and the Compose plugin.
- A domain name with an `A`/`AAAA` record pointing at the box's public IP.
- A second `A`/`AAAA` record for the `s3.` subdomain (e.g. `s3.crm.example.com`) also pointing at the
  box. The browser uploads files (CSV import, avatars, attachments) directly to MinIO through this
  host, so it needs its own hostname, cert, and `MINIO_ENDPOINT` value.
- A reverse proxy on the box (or reachable from it). [`docs/reverse-proxy.md`](reverse-proxy.md)
  documents the three routes, the required headers and a working Caddy example.
- Ports 80 and 443 open to your proxy, not to the app.
- Optionally a Google OAuth client (Workspace) with the redirect URI set to
  `https://<your-domain>/api/gmail/oauth/callback` and the app's sign-in callback. Dealflow also
  signs users in with an email link and a password, so Google is not required to boot.

## 1. Configure `.env`

```sh
cp .env.example .env   # or: pnpm env:sync
```

Fill it in. The deployment-specific values:

| Var | Value on the box |
| --- | --- |
| `BASE_URL` | `https://crm.example.com` |
| `NEXT_PUBLIC_WS_URL` | `wss://crm.example.com/_ws` (inlined at build time: rebuild when it changes) |
| `WS_PUBLIC_URL` | `ws://ws:8080` (internal compose address) |
| `MINIO_ENDPOINT` | `https://s3.crm.example.com` (public: the browser uploads directly here) |
| `DATABASE_URL` | `postgres://warpdrive:warpdrive@postgres:5432/warpdrive` |
| `SEED_ADMIN_EMAIL` | the first admin's email (required in production) |
| `ALLOW_FIRST_LOGIN_ADMIN` | `false` (the env boundary rejects `true` in production) |
| `APP_BIND` / `APP_PORT` | `127.0.0.1` / `3000` (loopback: the proxy connects from this box) |
| `WS_BIND` / `WS_HOST_PORT` | `127.0.0.1` / `8080` |
| `MINIO_BIND` / `MINIO_PORT` | `127.0.0.1` / `9000` |
| `DISABLE_TELEMETRY` | `true` (default; set `false` to opt in to PostHog) |
| `DISABLE_UPDATE_CHECK` | `true` (default; set `false` to opt in to the upstream release banner) |
| `MINIO_IMAGE` / `MC_IMAGE` | empty (compose defaults: `pgsty/minio`, `pgsty/mc`) |

Generate the secrets:

```sh
# 32-byte base64 key for token encryption
openssl rand -base64 32          # -> TOKEN_ENCRYPTION_KEY
# a long random string (>= 32 chars) for WS tickets
openssl rand -hex 32             # -> WS_TICKET_SECRET
# MinIO credentials
openssl rand -hex 16             # -> MINIO_ACCESS_KEY / MINIO_SECRET_KEY
```

Hardening: any of `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, `WS_TICKET_SECRET`,
`GOOGLE_OAUTH_CLIENT_SECRET`, `MINIO_SECRET_KEY` may instead be supplied as `<VAR>_FILE` pointing
at a file path (Docker secret), and the app reads the file contents at boot.

The official MinIO images were withdrawn from Docker Hub and quay.io. The compose defaults are the
community builds `pgsty/minio` and `pgsty/mc`; point `MINIO_IMAGE` / `MC_IMAGE` at another
S3-compatible server and client if you run one.

## 2. Bring it up

```sh
docker compose up -d --build
```

Order is handled automatically: Postgres becomes healthy, `migrate` applies the schema and
`createbuckets` provisions the MinIO bucket, then `app`, `ws` and `worker` start. Then start your
proxy (see [`docs/reverse-proxy.md`](reverse-proxy.md)).

Check status:

```sh
docker compose ps
curl -fsS https://<APP_DOMAIN>/api/health   # -> {"ok":true}
```

## 3. First admin login

`SEED_ADMIN_EMAIL` is bootstrapped as the initial admin. Before any other account exists, that
address can request a sign-in link (`/login`, "Email link"), or the owner can mint a one-time admin
setup link on the box:

```sh
docker compose exec app node dist/bootstrap-link.mjs   # prints a /login/invite?token=... URL
```

Google SSO is optional: set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and
`GOOGLE_WORKSPACE_DOMAIN` together to enable it, or leave all three empty. `ALLOW_FIRST_LOGIN_ADMIN`
stays `false` in production (the env boundary enforces this).

## Operating the box

- **Update to a new version:** `git pull && docker compose up -d --build`. Migrations run
  automatically via the one-shot `migrate` service before the app restarts.
- **Logs:** `docker compose logs -f app` (or `ws` / `worker`). The proxy is not a compose service,
  so its logs live wherever you run it.
- **Backups:** the database lives in the `pgdata` volume. Take a dump on a schedule, e.g.
  `docker compose exec -T postgres pg_dump -U warpdrive warpdrive | gzip > backup-$(date +%F).sql.gz`.
  Uploaded files live in the `miniodata` volume; back that up too.
- **Reaching Postgres:** it is intentionally not published to the host in production. Use
  `docker compose exec postgres psql -U warpdrive`. MinIO's S3 API is published on loopback for the
  proxy; its admin console stays internal, so temporarily forward a port to reach that.

## What protects the public surface

Everything below is on by default. It is written down because most of it is invisible until it is
missing, and because one item is a load-bearing assumption rather than a setting.

- **Response headers.** `next.config.ts` sets `Content-Security-Policy: frame-ancestors 'none'`
  (plus `base-uri`, `form-action`, `object-src`), `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy` and `Permissions-Policy` on every route; your proxy adds HSTS, since only the
  TLS terminator knows the response really went out over HTTPS. Refusing to be framed is what
  stops the OAuth consent screen from being clickjacked into granting an attacker's client full CRM
  access. `script-src` is deliberately not set: it needs nonce injection from middleware, which
  this app does not have.
- **Rate limits.** The unauthenticated endpoints (`/oauth/register`, `/oauth/token`, `/auth/start`,
  `/api/health`, and the email tracking pixel and click redirect) are capped per client address;
  see `src/constants/rateLimits.ts`. The tracking endpoints never fail a request when over the
  limit, they only skip the recording, so a real recipient's click still reaches the real
  destination.
- **This depends on the app port staying private.** The limiter identifies a caller from the last
  `X-Forwarded-For` entry, which is trustworthy only because the proxy appends the true peer
  address. Compose binds the app to `127.0.0.1` for exactly that reason. Publishing it on a public
  interface (or setting `APP_BIND=0.0.0.0` without a firewall) makes that header caller-written, at
  which point every request can claim a fresh identity and the limits enforce nothing.
- **WebSocket bounds.** A socket that connects without authenticating is closed after 10s, frames
  are capped at 64 KB, and total connections at 1000 (`src/constants/wsLimits.ts`).
- **Postgres credentials.** `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` are overridable
  and fall back to `warpdrive`. Postgres applies the password at initdb only, so pick it on a fresh
  deploy and keep it identical to the password in `DATABASE_URL`; setting it against an existing
  `pgdata` volume does not rotate anything and only breaks the connection string.
- **MCP client registration.** Open by default so MCP clients can self-onboard. See
  [mcp-server.md](mcp-server.md) for why you may want `OAUTH_REGISTRATION=disabled` once your
  clients are connected.

### One-time effect when upgrading past the session-hashing change

Session cookies are now stored as a sha256 digest rather than in the clear, which means existing
session rows cannot be carried forward (the pre-image is by construction unrecoverable). The
migration deletes them. Everyone signed in is signed out once and logs back in. Nothing else is
affected.

## Local development against this stack

The base compose file publishes app, ws and MinIO on loopback. For a local run, merge the dev
overrides to expose the Postgres and MinIO console ports:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Then the app is at `http://localhost:3000`, MinIO console at `http://localhost:9001`, and Postgres
at `localhost:5433`. Set `BASE_URL=http://localhost:3000` and `NEXT_PUBLIC_WS_URL=ws://localhost:8080`
in `.env` for this mode. `pnpm dev:up` starts only Postgres, MinIO and the bucket for app
development.

If you need machine-specific overrides, create a `docker-compose.local.yml` next to the base file
and pass it with `-f`. It is gitignored and not part of the documented topology.
