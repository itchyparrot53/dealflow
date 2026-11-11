<div align="center">

<img src="brand/svg/logo-horizontal/dealflow-logo-horizontal-colour.svg" width="300" alt="Dealflow" />

**A self-hosted CRM for one company's business development.**<br />
Pipeline, deals, contacts, two-way email, campaigns, projects and AI on your own server.

![License: MIT](https://img.shields.io/badge/license-MIT-2D8548?style=for-the-badge&labelColor=211C52)
![Self-hosted](https://img.shields.io/badge/self--hosted-single--tenant-2D8548?style=for-the-badge&labelColor=211C52)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white&labelColor=211C52)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white&labelColor=211C52)
![Postgres](https://img.shields.io/badge/Postgres-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white&labelColor=211C52)

<img src="docs/screenshots/pipeline-diorama.webp" alt="The Dealflow pipeline diorama: a 3D board with stage columns and the Dealflow logo" width="100%" />

</div>

> [!IMPORTANT]
> Dealflow is single-company by design: one install serves one company, and there is no hosted or
> multi-tenant mode. Back up the database and the file bucket, and deploy a pinned commit or tag.

<a name="what-is-dealflow"></a>
## What is Dealflow?

Dealflow is a self-hosted CRM that rebuilds the core business-development workflow of Pipedrive as
software you run yourself. Your box, your Postgres, your object storage, and sign-in that does not
depend on a vendor. The record store stays on your infrastructure, and there is no per-seat bill.
The only data that leaves is what you deliberately send to a service you turn on, such as an AI
prompt or a webhook.

The information architecture follows the tools BD teams already know, and the interface ships its
own visual layer on [shadcn/ui](https://ui.shadcn.com).

Dealflow is built on [warpdrive](https://github.com/sneg55/warpdrive) by Nikita Sawinyh (MIT),
extended in place.

Dealflow was planned with **Opus 5.5** and built with **DeepSeek v4.1 Flash 1017**.

<a name="why-dealflow"></a>
## Why Dealflow?

- **Your data stays on your hardware.** The only outbound calls are the ones you configure: your
  mail server, an OpenRouter key for AI, and any webhooks you add.
- **One stack, one database.** Docker Compose brings up the app, live updates, the worker, Postgres
  and MinIO. No Redis and no separate queue service, so there is no required cloud dependency.
- **One permission model.** Deals, contacts, email, campaigns, reports, the REST API and the AI
  tools all run through the same visibility and permission checks.
- **Email is part of the CRM.** Personal mailboxes, shared threads, transactional mail and marketing
  campaigns attach to the same people and deals.
- **AI is optional.** Use your own key and cap the spend, or run without it. Every other feature
  still works.
- **The boring parts ship too.** Backups with a restore CLI, a recycle bin, an audit log, a health
  endpoint and a container smoke test.

---

<a name="whats-inside"></a>
## What's inside

<img src="docs/screenshots/deal-workspace.png" alt="The Dealflow deal workspace" width="100%" />

- **Pipeline.** Drag and drop across custom stages and multiple pipelines, with weighted stage
  totals, rotting-deal flags, saved filters, and board, list and archive views.
- **Deals.** One workspace with a unified timeline for activities, notes, files, email and change
  history. Participants, followers, labels, lost reasons, close dates and a stage progress bar.
- **Contacts and leads.** People and organizations with custom fields, relationships, a shared
  timeline, duplicate finding and merge, bulk owners, marketing status, CSV import with undo, and
  export. A leads inbox converts a lead into a deal without re-typing it.
- **Email.** Gmail over OAuth or any IMAP/SMTP mailbox (Purelymail is a preset), a personal mailbox
  plus shared, deal- and contact-linked threads, templates, signatures, merge fields, scheduled send,
  open and click tracking, and branded system mail.
- **Campaigns.** A block builder with desktop and mobile preview, segments with live recipient
  counts, double opt-in and consent history, suppression, sequences, throttled sending, bounce
  handling, reports and a domain check.
- **Activities.** Calls, meetings and tasks, repeating activities, call outcomes, a week and month
  calendar you can drag to reschedule, and a filtered list with a column picker and bulk actions.
- **Products, quotes and forecast.** A product catalog and deal line items, quotes and invoices that
  snapshot their lines at creation, a public link for the customer, quote acceptance, recorded
  invoice payments, an overdue job, a forecast board grouped by expected close month, and converted
  totals in a base currency.
- **Insights.** A performance dashboard with funnel, deal and activity stats, reports over deals and
  activities, private or shared, dashboards, goals, CSV export, and an AI explanation of an
  aggregated result.
- **Projects.** Phases and tasks with a board, startable from a won deal; a linked project follows
  that deal's visibility.
- **Forms and booking.** Public forms that create people, organizations, leads or deals, and booking
  pages that respect availability, buffers and the visitor's time zone.
- **AI.** An assistant over your CRM data, deal summaries and scores, email drafts, notes to
  activities, plain-English filters, and report explanations. Optional and budgeted.
- **Automations and webhooks.** Domain-event triggers with actions and AI-assisted drafting, plus
  signed webhook deliveries with backoff, a delivery log, test send and redelivery.
- **Admin and platform.** Users, teams, permission sets and visibility groups, an audit log, a
  30-day recycle bin, backups, API tokens, a REST API, an optional MCP server, contact enrichment,
  notifications, realtime updates, a command palette and keyboard shortcuts. The PWA layer provides
  the manifest, offline snapshots and web push, with its UI shown when `NEXT_PUBLIC_PWA_UI` is on.
- **Sign-in.** Email and password, single-use email links, Google Workspace SSO when configured,
  invitations, and a first-admin bootstrap link.

<details>
<summary>More screenshots</summary>

<br />

**Pipeline:** custom stages, weighted totals and every deal in one board.

<img src="docs/screenshots/pipeline.png" alt="The Dealflow pipeline board" width="100%" />

**Inbox:** two-way mail with thread linking, follow-up labels and unread state.

<img src="docs/screenshots/inbox.png" alt="The Dealflow inbox" width="100%" />

**Campaigns:** the block builder, with desktop and mobile preview.

<img src="docs/screenshots/campaigns.png" alt="The Dealflow campaign builder" width="100%" />

**Contacts:** people and organizations with custom fields, saved views and AI filters.

<img src="docs/screenshots/contacts.png" alt="The Dealflow organizations list" width="100%" />

</details>

---

<a name="quick-start"></a>
## Quick start

### Docker

Docker Engine with the Compose plugin. The stack includes Postgres and MinIO, so nothing else is
required.

```bash
cp .env.example .env
```

Set these values in `.env` for a local box:

```dotenv
BASE_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:8080
WS_PUBLIC_URL=ws://ws:8080
DATABASE_URL=postgres://warpdrive:warpdrive@postgres:5432/warpdrive
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
TOKEN_ENCRYPTION_KEY=...
WS_TICKET_SECRET=...
SEED_ADMIN_EMAIL=you@example.com
```

Generate the secrets:

```bash
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY
openssl rand -hex 32      # WS_TICKET_SECRET
openssl rand -hex 16      # MINIO_ACCESS_KEY
openssl rand -hex 16      # MINIO_SECRET_KEY
```

Then build and start:

```bash
docker compose up -d --build
```

The one-shot `migrate` service applies the schema and `createbuckets` creates the private bucket
before the app starts. Open `http://localhost:3000`. There is no default password. With `SMTP_HOST`
empty, sign-in links print in `docker compose logs -f app`.

On a fresh box, mint the first admin setup link:

```bash
docker compose exec app node dist/bootstrap-link.mjs
```

For a public server, change `BASE_URL`, `NEXT_PUBLIC_WS_URL` and `MINIO_ENDPOINT` to their HTTPS
values and follow [docs/deploy.md](docs/deploy.md).

### Local development

Node 22 or newer, pnpm 9 and Docker.

```bash
pnpm install
pnpm env:sync          # creates .env with safe local values
pnpm dev:up            # Postgres and MinIO in Docker
pnpm db:migrate:dev    # apply migrations
pnpm db:seed:demo      # demo pipeline, deals, people and email
pnpm dev
```

Open `http://localhost:3000`. The dev login route skips email:

```text
http://localhost:3000/auth/dev-login?email=demo1@example.com
```

`pnpm dev` runs only the Next app. Realtime, mail sync, scheduled sends, campaigns and backups live
in two other processes, which the Docker stack runs as the `ws` and `worker` services. In
development, start them in two separate terminals:

```bash
# terminal 1
pnpm exec tsx --env-file=.env src/entrypoints/ws.ts

# terminal 2
pnpm exec tsx --env-file=.env src/entrypoints/worker.ts
```

<details id="configuration">
<summary><strong>Configuration</strong></summary>

<br />

Start from `.env.example`; every value is documented there. The essentials:

| Variable | Why it matters |
| --- | --- |
| `BASE_URL` | Public origin for links, cookies and OAuth. Local: `http://localhost:3000`. Production: `https://crm.example.com`. |
| `NEXT_PUBLIC_WS_URL` | Browser WebSocket URL. Local: `ws://localhost:8080`. Production: `wss://crm.example.com/_ws`. It is inlined at build time, so changing it needs a rebuild. |
| `WS_PUBLIC_URL` | Internal WebSocket address for the worker and relay: `ws://ws:8080`. |
| `DATABASE_URL` | Postgres connection. Compose: `postgres://warpdrive:warpdrive@postgres:5432/warpdrive`. |
| `MINIO_ENDPOINT` | Browser-reachable storage URL. Local: `http://localhost:9000`. Production: `https://s3.crm.example.com`. |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_BUCKET` | Storage credentials and bucket. The bucket defaults to `warpdrive`. |
| `TOKEN_ENCRYPTION_KEY` | 32-byte base64 key that encrypts mailbox credentials. |
| `WS_TICKET_SECRET` | Mints short-lived WebSocket tickets. At least 32 characters. |
| `SEED_ADMIN_EMAIL` | The first admin. Required in production. |
| `SMTP_*` | Sign-in links, invitations, notifications and quotes. With no host, links print to the server log. |
| `GOOGLE_OAUTH_*` | Google Workspace sign-in and Gmail. Set all three or leave all three empty. |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | Enables AI. The key is optional; the model defaults to `deepseek/deepseek-v4.1-flash`. |
| `MARKETING_SMTP_*` | A separate bulk account for campaigns. Falls back to `SMTP_*` when empty. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push. `pnpm push:vapid` prints a pair. |
| `AI_FAKE` / `MAIL_FAKE` / `PUSH_FAKE` | Deterministic adapters for tests and demos. Never enable them on a real install. |
| `NEXT_PUBLIC_PWA_UI` | Shows the install, offline and push UI. Off by default; the manifest, service worker and routes stay available. |

The sensitive values (`DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, `WS_TICKET_SECRET`, the Google client
secret and the MinIO secret) can also be supplied as `<VAR>_FILE` pointing at a file, which suits
Docker secrets. The full reference, including DKIM, bounce mailboxes, telemetry and the update
check, is in [docs/deploy.md](docs/deploy.md) and
[docs/dealflow/CAMPAIGNS.md](docs/dealflow/CAMPAIGNS.md).

</details>

<details id="architecture">
<summary><strong>Architecture</strong></summary>

<br />

```text
Browser
  Next.js 16 · React 19 · TypeScript · TanStack Query · Tailwind 4 · PWA
        │  HTTPS + WebSocket
        ▼
Dealflow app
  tRPC reads · server actions · Drizzle ORM · pg-boss jobs
        │
        ├── Postgres        records, mail index, jobs, audit, notifications
        ├── MinIO           attachments, avatars, imports, campaign images
        ├── ws              board, inbox, notifications, presence (LISTEN/NOTIFY)
        ├── worker          mail sync, scheduled sends, campaigns, backups
        └── outbound        Gmail/IMAP/SMTP · OpenRouter · webhooks
```

| Path | What lives there |
| --- | --- |
| `src/app/` | Routes, server actions, the REST API, MCP and public endpoints |
| `src/features/` | Feature code organized by domain, with tests next to it |
| `src/db/` | Drizzle schema and client |
| `src/server/` | tRPC root, actor hydration, rate limits |
| `drizzle/` | Numbered, forward-only SQL migrations |
| `e2e/` | Playwright specs, helpers and screenshot galleries |
| `docs/` | Deploy, API, user guide and feature notes |
| `scripts/` | Build, seed, mail probe, design lint and the smoke test |

The code is organized by feature, not by technical layer. Server code validates at the boundary with
Zod, reads the environment through one module, returns typed results instead of throwing for
operational failures, and passes an `AbortSignal` through anything that does I/O. See
[CLAUDE.md](CLAUDE.md) for the full conventions.

Dealflow tracks warpdrive as an upstream base.
[docs/dealflow/UPSTREAM.md](docs/dealflow/UPSTREAM.md) records the base commit, the migration naming
rule and every upstream file that changed, which is the conflict surface for a future cherry-pick.

</details>

<details id="development">
<summary><strong>Development and testing</strong></summary>

<br />

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next dev server on port 3000 |
| `pnpm build` | Production build, including the service worker |
| `pnpm typecheck` | Type-check the repository |
| `pnpm lint` | Biome, then type-aware ESLint |
| `pnpm test:unit` | Vitest unit lane, no containers |
| `pnpm test:integration` | Vitest against a disposable Postgres container |
| `pnpm e2e` | Production build plus Playwright on port 3210 |
| `pnpm check:design` | Design-system lint over `src/**/*.tsx` |
| `pnpm smoke` | Builds the real images, proves boot, health, restart and the seeded admin |
| `pnpm db:migrate:dev` | Apply migrations to the dev database |
| `pnpm db:seed:demo` | Demo pipeline, deals, people and email |
| `pnpm mail:live-check` | Prove the real IMAP and SMTP transports against the test mailbox |

Integration tests run against a real Postgres, never a mock, so migrations and queries are exercised
as they run in production. E2E uses a throwaway database and fake AI, mail and push adapters, so it
never touches your data. `pnpm check:design` enforces the token scale and the shadcn primitives that
the interface is built on.

GitHub Actions runs typecheck, lint, design, unit, integration and the Compose smoke test on pull
requests. Pushing a `v*` tag publishes the multi-arch container image.

</details>

---

<a name="email-and-campaigns"></a>
## Email and campaigns

Connect a mailbox under **Settings > Email sync** with an app password. Purelymail is a preset, and
any other IMAP/SMTP server can be entered by hand. Gmail stays available when Google is configured.
Inbound mail syncs into threads, the inbox and record timelines; replies thread with `In-Reply-To`
and `References`, and on IMAP mailboxes a copy of every sent message is appended to the Sent folder.
Details and limits are in [docs/dealflow/MAIL.md](docs/dealflow/MAIL.md).

Campaigns run on the same records but a separate transport. Consent is stored per person with a full
history, suppression is keyed by email hash, double opt-in is on by default, and every campaign
carries a mandatory footer with the postal address, unsubscribe link and web version. Sends go
through pg-boss in throttled batches, each recipient's status is re-checked at send time, and the
`List-Unsubscribe` pair is set. Opens, clicks, unsubscribes and bounces land on the person timeline,
and sequences can follow up automatically. See
[docs/dealflow/CAMPAIGNS.md](docs/dealflow/CAMPAIGNS.md).

<a name="ai"></a>
## AI

Dealflow talks to OpenRouter through the `openai` SDK. Set `OPENROUTER_API_KEY` and optionally
`OPENROUTER_MODEL`. With no key the AI surfaces are unavailable, and `AI_FAKE=true` gives
deterministic answers for tests and demos. Every call is logged, and admins set the company monthly
token cap and an optional per-user cap in **Settings > AI**.

The assistant answers from your CRM data through MCP tools and asks for confirmation before it
writes. The same layer powers deal summaries and scores, email drafts, notes to activities,
plain-English deal filters, report explanations and automation drafts. The MCP surface is documented
in [docs/mcp-server.md](docs/mcp-server.md).

<a name="self-hosting"></a>
## Self-hosting and upgrades

The default Compose topology ships the app, the WebSocket server, the worker, Postgres and MinIO.
Migrations and the private bucket are one-shot services that run before the app starts.

There is no reverse proxy in the stack. Point your own at three routes: the app, `/_ws` and the S3
host. [docs/reverse-proxy.md](docs/reverse-proxy.md) lists the routes, the headers the S3 host needs
and a worked Caddy example. [docs/deploy.md](docs/deploy.md) covers every environment variable,
first-admin setup and the hardening that is already on by default.

- **Update:** `git pull && docker compose up -d --build`. Migrations run automatically before the
  app restarts.
- **Back up:** the worker writes a daily archive with the database dump, stored files and a
  manifest. Restore from the CLI with the app stopped, as described in
  [docs/dealflow/BACKUPS.md](docs/dealflow/BACKUPS.md).
- **Check:** `curl -fsS https://your-host/api/health` returns `{"ok":true}`. `pnpm smoke` proves the
  same path against a throwaway stack.
- **Container image:** a `v*` tag publishes a multi-arch image to `ghcr.io/<owner>/dealflow`. Set
  the repository variable `NEXT_PUBLIC_WS_URL` before tagging; the workflow fails without it,
  because the value is compiled into the browser bundle at build time.
- **Keep the app port private.** The rate limiter trusts the proxy's `X-Forwarded-For`; publishing
  the app directly makes that header caller-written.
- **Use managed services:** point `DATABASE_URL` at a managed Postgres and `MINIO_ENDPOINT` at any
  S3-compatible store. The app, worker and WebSocket server still run as separate processes.

---

## Documentation

| Guide | What it covers |
| --- | --- |
| [User guide](docs/user-guide/index.md) | Task-by-task pages for sales staff and admins, with a PDF edition |
| [Deploy](docs/deploy.md) | Install, environment variables, first admin, hardening, upgrades |
| [Reverse proxy](docs/reverse-proxy.md) | The three routes, required headers and a Caddy example |
| [Self-hosting guide](docs/user-guide/self-hosting.md) | The short version for the person who runs the box |
| [REST API](docs/API.md) | Tokens, scopes, pagination, rate limits and errors |
| [MCP server](docs/mcp-server.md) | Connect an AI client, registration and consent |
| [Email](docs/dealflow/MAIL.md) | Mailbox sync, sending, attachments, fakes and the live check |
| [Campaigns](docs/dealflow/CAMPAIGNS.md) | Consent, builder, sending, tracking, sequences, deliverability |
| [Feature notes](docs/dealflow/) | Sales, documents, insights, forms, scheduling, projects, automations, webhooks, PWA and design |
| [Upstream](docs/dealflow/UPSTREAM.md) | Base commit, migration rule and every upstream file changed |

<a name="project-status"></a>
## Project status

Dealflow runs a real business-development workflow in production and is actively developed.
Everything described above is built and exercised by the unit, integration, end-to-end and design
suites.

The scope is deliberate: one company per install, depth on the core CRM, and no hosted multi-tenant
version. Projects, documents and campaigns are small surfaces next to the deal, not attempts to
replace the tools that do those jobs deeply.

<a name="contributing"></a>
## Contributing

Read [CLAUDE.md](CLAUDE.md) first. It records the conventions (feature folders, typed results, one
environment boundary, the design system) and the verification profile every change is expected to
pass: `pnpm typecheck`, `pnpm lint`, `pnpm build` and `pnpm test:unit`, with integration, end-to-end
and design checks before a larger change is called done.

New work goes in new feature folders and new numbered migrations so the upstream diff stays
reviewable. Never reuse or renumber an upstream migration.

<a name="license"></a>
## License

MIT. See [LICENSE](LICENSE). Dealflow builds on warpdrive, copyright Nikita Sawinyh, also MIT.

Dealflow is not affiliated with, endorsed by or connected to Pipedrive.
