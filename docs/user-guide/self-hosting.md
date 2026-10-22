# Self-hosting and install

This page is for the person who runs the Dealflow server. Dealflow is self-hosted and single-company: one install serves one company, and your data stays on your own machine.

The full technical references are [`docs/deploy.md`](../deploy.md) and [`docs/reverse-proxy.md`](../reverse-proxy.md) in the repository. This page is the short version.

## What you need

- A Linux server with Docker and the Docker Compose plugin.
- A domain for the app (for example `crm.example.com`) and a second one for file storage (for example `s3.crm.example.com`), both pointing at the server.
- A reverse proxy that handles HTTPS (for example Caddy or nginx). Dealflow does not include one.
- An SMTP account for the emails Dealflow sends (sign-in links, invites, notifications, quotes).
- Optionally, an OpenRouter API key for the AI features.

## What runs

| Service | What it does |
|---|---|
| `app` | The Dealflow web app |
| `ws` | Live updates in the browser |
| `worker` | Background jobs: mail sync, scheduled email, automations, reminders, backups |
| `postgres` | The database |
| `minio` | File storage (attachments, imports, photos) |
| `migrate` | Runs once on each start to update the database |

## How to install

1. Get the code onto the server and copy the example settings:

   ```sh
   cp .env.example .env
   ```

2. Fill in `.env`. The values that matter most:

   | Setting | What to put |
   |---|---|
   | `BASE_URL` | Your app address, for example `https://crm.example.com` |
   | `NEXT_PUBLIC_WS_URL` | `wss://crm.example.com/_ws` |
   | `MINIO_ENDPOINT` | Your storage address, for example `https://s3.crm.example.com` |
   | `SEED_ADMIN_EMAIL` | The email of the first admin |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Your outgoing mail account |
   | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Your AI key and model (leave the key empty to run without AI) |
   | `BASE_CURRENCY` | Your company currency, for example `GBP` |

3. Generate the secrets:

   ```sh
   openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY
   openssl rand -hex 32      # WS_TICKET_SECRET
   openssl rand -hex 16      # MINIO_ACCESS_KEY and MINIO_SECRET_KEY
   ```

4. Start everything:

   ```sh
   docker compose up -d --build
   ```

5. Point your reverse proxy at the three routes below, then check the app is healthy:

   ```sh
   curl -fsS https://crm.example.com/api/health
   ```

   **Result:** `{"ok":true}`.

## Reverse proxy routes

| Public address | Send to | Notes |
|---|---|---|
| `https://crm.example.com` | `127.0.0.1:3000` | The app, including `/api/*` |
| `https://crm.example.com/_ws` | `127.0.0.1:8080` | Live updates (WebSocket). Forward the path and query unchanged. |
| `https://s3.crm.example.com` | `127.0.0.1:9000` | File uploads and downloads. Must match `MINIO_ENDPOINT` exactly. |

Keep the app, ws and storage ports bound to `127.0.0.1` so only your proxy can reach them. A working Caddy example is in `docs/reverse-proxy.md`.

## How to sign in the first time

1. Go to your app address, choose **Email link**, and enter the `SEED_ADMIN_EMAIL` address.
2. Open the link in the email and set a password.

If email is not working yet, create a one-time admin link on the server instead:

```sh
docker compose exec app node dist/bootstrap-link.mjs
```

Then invite everyone else from **Settings › Users** (see [Admin](admin.md)).

## How to update

```sh
git pull
docker compose up -d --build
```

Database changes are applied automatically before the app restarts.

## Backups and restore

Dealflow makes a daily backup of the database and a copy of stored files, kept for a set number of days. Settings: `BACKUP_ENABLED`, `BACKUP_DIR` and `BACKUP_KEEP`. Admins can see the status and run an extra backup in **Settings › Backups**.

To restore, on the server, with the app stopped:

```sh
docker compose stop app worker ws
docker compose run --rm -v ./backups:/restore worker \
  node dist/backup-restore.mjs /restore/{backup file name}.tar.gz --files --yes
docker compose start app worker ws
```

Without `--files` only the database is restored. Copy the backup folder somewhere off the server too, so a disk failure cannot take both.

## Logs

```sh
docker compose logs -f app      # or ws, worker
```

## Privacy defaults

Usage telemetry and the update check are off by default (`DISABLE_TELEMETRY=true`, `DISABLE_UPDATE_CHECK=true`). Nothing is sent anywhere unless you turn it on, apart from the services you configure: your mail server, your AI provider, and any enrichment provider an admin enables.
