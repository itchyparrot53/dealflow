# ROADMAP: Dealflow on warpdrive

> Roadmap ID: dealflow-wd-roadmap-v1 · Written: 2026-10-19 · Planner: Claude (planforexec v2.2, fast verification profile) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`, headless) · Target folder: `/Users/cxt22/Downloads/warpdrive-main`

This file is context for the owner and for every part's builder. It is not a task list. Each part gets its own `PLAN-PART<N>.md` and kit, written by the planner after the previous part's PROGRESS.md comes back.

## 1. Direction (fixed)

- The codebase is warpdrive (MIT, Next.js App Router + React 19, Drizzle on Postgres 16, tRPC reads + server-action mutations, shadcn/Radix + Tailwind 4, pg-boss worker, own WebSocket server, MinIO). We extend it in place and keep its architecture and conventions (`CLAUDE.md`).
- The old Dealflow app (`/Users/cxt22/Downloads/DEALFLOW`, Fastify + SQLite) is a feature reference only. Its plans and code tell us what a feature does (rules, fields, edge cases, prompts, fake modes). Nothing is copied from it; every feature is re-implemented the warpdrive way.
- Product name in UI, metadata, docs and package: **Dealflow**. The MIT LICENSE keeps the original copyright line and gains ours.
- Single company per install. No super-admin, no tenants (Dealflow's multi-company layer is deliberately not rebuilt).
- Upstream: remote `upstream` = `https://github.com/sneg55/warpdrive.git`, our branch `main`. New work lives in new feature folders and new schema files where possible so upstream fixes can be cherry-picked. Our migrations are named `00NN_dealflow_<topic>`; when cherry-picking an upstream migration, regenerate it with the next free number and log it.

## 2. Parts at a glance

| Part | Name | Builds | Depends on | Status |
|---|---|---|---|---|
| 1 | Foundation and AI layer | git + upstream, health check, Purelymail probe, rename to Dealflow, compose without Caddy, telemetry and update check off, password + magic-link sign-in, invites by email, safe bootstrap, AI provider/fake/usage caps, deal summary + score, email drafting, notes to activities, AI filter (deals), assistant with confirm-before-write | none | **Done (2026-10-20, `64363ce`)** |
| 2 | Mail provider and IMAP/SMTP | `MailProvider` interface replacing `GmailClient`, IMAP/SMTP provider (default, Purelymail), Gmail as optional provider, provider-neutral columns, own threading, folder cursors, IDLE + polling, outbox throttle, fake IMAP/SMTP, notification emails via the system mailer | 1 | **Planned: `PLAN-PART2.md`** |
| 3 | Products, multi-currency, forecast | product catalog, deal line items (qty, price, discount, tax) driving deal value, per-deal currency, rates table and converted totals, forecast board by close month with drag to re-date | 1 | Later |
| 4 | Quotes and invoicing | document templates, quotes with public accept/decline page, invoices from deals/products with numbering, tax, print-to-PDF, email to client, statuses draft/sent/paid/overdue, manual payments | 2, 3 | Later |
| 5 | Automations, webhooks, templates | event bus, automation engine (triggers, conditions via saved-filter AST, actions incl. AI note), "describe it" drafting, run log, loop guard, rotting trigger, signed webhooks with SSRF-safe delivery and retries, templates usable by automations | 1, 4 | Later |
| 6 | Web forms and scheduler | public forms creating leads/deals with honeypot + rate limit, booking pages with slot engine from availability and activities, form/booking automation triggers and notifications | 5 | Later |
| 7 | Insights | report builder (measures, grouping, segments, date ranges, filters), charts incl. funnel, dashboards, goals extended, AI report insight, score badge on cards, converted totals in reports | 3 | Later |
| 8 | Projects and remaining parity | projects with phases and tasks, create from won deal, recycle bin UI with restore/purge, backups and restore (pg_dump + MinIO), API tokens + REST API + docs, CSV export everywhere, palette commands, undo toasts, shortcut help sheet, recurring activities, call logging, audit log page, duplicate finder, AI filter on people/orgs/leads | 1, 5 | Later |
| 9 | PWA | manifest + icons, service worker (Serwist), offline shell and offline page, read-only cache of recent records, mobile-first key screens, web push (VAPID) | 1 to 8 | Later |
| 10 | Design pass | brief, tokens, screen-by-screen specs with numbers on the shadcn system, our own identity, accessibility floor, light + dark, design lint, one screenshot review | 1 to 9 | Later |

Order check against the code: products and currency must precede quotes/invoices (line items and money); mail must precede invoices (send from the user's mailbox into the deal thread); automations come after quotes so quote/invoice events exist, and forms/scheduler come after automations so they only add triggers; Insights needs products and converted money; the PWA and design passes need every screen to exist. The suggested order holds.

## 3. Parity matrix

Legend: **WD** = warpdrive already has it (keep warpdrive's version; only the listed gap is added). **New** = neither app has it. **DF** = Dealflow reference (plan section or file under `/Users/cxt22/Downloads/DEALFLOW`).

| # | Feature | Warpdrive today | Dealflow reference | Part | Gap / note |
|---|---|---|---|---|---|
| 1 | Pipeline board, multiple pipelines, custom stages, drag and drop | WD | PLAN.md Task 4.3 | 1 (regression check) | none; health-check e2e covers it |
| 2 | Rotting deals, per-stage totals | WD | PLAN.md 6.10 | 5 | rotting becomes an automation trigger |
| 3 | Deal list and archive views | WD | PLAN.md Task 4.4 | none | keep |
| 4 | Deal workspace: timeline, notes, files, history, followers, labels, lost reasons, stage chevrons | WD | PLAN.md Task 4.5, P3 6.7 | none | keep |
| 5 | Deal participants | WD | P3 6.10 | none | keep |
| 6 | Duplicate deal, merge deals | WD | P3 Task 5.5 | none | keep |
| 7 | People and organizations, custom fields (JSONB) | WD | PLAN.md 6.3 | none | keep |
| 8 | Organization relations (parent/daughter/related) | WD | P3 6.10 | 8 | verify the parent-loop guard; add if missing |
| 9 | Leads inbox, convert to deal | WD | PLAN.md Task 6.2 | none | keep |
| 10 | Labels, lost reasons, activity types settings | WD | PLAN.md Task 2.1, 6.1 | none | keep |
| 11 | Saved filters and filter builder (deals, people, orgs, leads) | WD | P2 6.3 | none | keep |
| 12 | Column pickers on lists | WD (contacts, leads) | P2 6.4 | 8 | add to deal list and activities list if missing |
| 13 | Bulk actions | WD (deals: archive, stage; leads: bulk edit) | P2 6.4 | 8 | bulk edit/delete for people, orgs, activities |
| 14 | Global search, Cmd/Ctrl+K palette | WD (record search) | P2 6.5 | 8 | add palette commands (create X, go to Y) |
| 15 | Keyboard shortcuts | WD (number-row nav) | P3 6.9, `src/shared/shortcuts.ts` | 8 | `?` help sheet, `n`/`g` sequences |
| 16 | Quick add menu | WD | P3 6.9 | none | keep |
| 17 | CSV import with undo | WD | P2 6.6 | none | keep warpdrive's importer |
| 18 | CSV export | WD (leads only) | P2 6.6, `src/server/services/exports.ts` | 8 | deals, people, orgs, activities, products, invoices with current filter + columns; gated by `data.export` |
| 19 | Duplicate finder for people/orgs | WD has merge only | P2 Task 2.4/2.6 | 8 | detection page feeding warpdrive's merge |
| 20 | Notifications bell, mentions | WD | P2 6.7 | 4, 6 | new types: quote accepted, invoice paid/overdue, form submitted, booking created |
| 21 | Files on records | WD (MinIO) | P2 Task 3.3 | none | keep |
| 22 | Activities list, calendar week/month | WD | P2 Task 3.5 | 8 | verify drag-to-reschedule; add if missing |
| 23 | Activity reminders | WD (pg-boss) | `src/server/jobs/reminders.ts` | none | keep |
| 24 | Recurring activities | missing | P3 6.11, `src/shared/recurrence.ts` | 8 | completing one creates the next |
| 25 | Call logging with outcomes | missing | P3 6.11 | 8 | "Log call" composer tab + outcome chips |
| 26 | Teams, team manager visibility | WD | P3 Task 5.4 | 7 | team grouping in reports and owner filter in Insights |
| 27 | Goals | WD | P2 Task 4.2/4.4 | 7 | goals widgets on dashboards |
| 28 | Basic stats dashboard (funnel, performance, win rate, lost reasons) | WD | P2 6.9 | 7 | Insights report builder extends it; keep existing stats |
| 29 | Permission sets, visibility groups | WD | PLAN.md 6.9 | every part | new features gate on these flags |
| 30 | Audit events (recorded) | WD | P2 Task 7.2 | 8 | audit log page for admins |
| 31 | Realtime board/inbox/presence over WebSocket | WD only | none | none | keep; `WS_PORT` made configurable in Part 1 |
| 32 | Enrichment (Apollo, RocketReach, GetProspect) | WD only | none | none | keep |
| 33 | MCP server with OAuth | WD only | none | 1 | keep, rename; the assistant reuses its tool registry |
| 34 | Two-way email | WD (Gmail API only) | PLAN.md Task 7.1 (SMTP send only) | 2 | `MailProvider`; IMAP/SMTP default, Gmail optional |
| 35 | Email tracking, templates, signatures, scheduled send, outbox | WD | P2 Task 5.4 | 2, 5 | made provider-neutral in 2; templates used by automations in 5 |
| 36 | Notification emails | WD (sent through a user's Gmail) | PLAN.md Task 1.4 (mailer) | 2 | switch to the Part 1 system mailer |
| 37 | Sign-in | WD (Google Workspace only, dev-login) | PLAN.md Task 1.3 to 1.5 | 1 | email + password, magic link over SMTP, Google optional, safe bootstrap |
| 38 | User invites | WD (placeholder for Google only, no email) | PLAN.md Task 1.6 | 1 | invite email with set-password link |
| 39 | Multi-company, super-admin, "open company" | n/a | PLAN.md 6.8, P3 6.13 | none | not built: single company per install |
| 40 | Products and deal line items | missing | PLAN.md Task 6.3/6.6 | 3 | line items drive deal value when present |
| 41 | Multi-currency with rates, converted totals | missing (one `BASE_CURRENCY`) | P2 Task 4.1, P3 Task 1.1 | 3 | per-deal currency, rates table, "not included" tooltip for missing rates |
| 42 | Forecast view | missing | P2 Task 3.6 | 3 | board by expected close month, drag re-dates |
| 43 | Quotes/proposals, document templates, public accept page | missing | P3 6.12 | 4 | `/d/{publicId}`, print-to-PDF, history events |
| 44 | Invoicing | missing | none (new) | 4 | numbering, tax, PDF, email, statuses, manual payments, overdue job |
| 45 | Workflow automations | missing | P2 6.10, Task 5.1/5.2 | 5 | triggers, conditions, actions, run log, loop guard |
| 46 | AI automation actions and "describe it" drafting | missing | P2 6.12 (`automation designer`, `internal CRM notes`) | 5 | uses the Part 1 AI layer |
| 47 | Signed webhooks with SSRF-safe delivery | missing | P2 6.11, `src/server/lib/safe-http.ts` | 5 | HMAC signature, retries, auto-disable, private-address block, pinned address, no redirects |
| 48 | Web forms | missing | P2 6.13 | 6 | `/f/{publicId}`, honeypot, rate limit, de-duplication |
| 49 | Meeting scheduler and booking pages | missing | P2 6.13 | 6 | `/book/{publicId}`, slot engine, meeting activity |
| 50 | Insights: reports, charts, funnel, dashboards | WD basic stats | P2 6.9 | 7 | report engine over warpdrive's visibility rules |
| 51 | AI report insight | missing | P2 6.12 (`report analyst`) | 7 | |
| 52 | AI assistant with tool calls and confirm-before-write | missing (MCP for external clients) | PLAN.md 6.11, Task 7.4/7.6 | 1 | tools come from warpdrive's MCP registry |
| 53 | AI deal summary | missing | PLAN.md Task 7.3 | 1 | |
| 54 | AI deal scoring | missing | P2 6.12 (`score sales deals`) | 1 (workspace), 7 (card badge, bulk scoring) | |
| 55 | AI email drafting | missing | PLAN.md Task 7.3 | 1 | inside warpdrive's composer |
| 56 | AI notes to activities | missing | PLAN.md Task 7.3 | 1 | deal notes in Part 1 |
| 57 | AI filters ("describe a filter") | missing | P2 6.12 (`filter builder`) | 1 (deals UI), 8 (other lists) | server supports all four entities in Part 1 |
| 58 | AI usage limits and logging | missing | PLAN.md 6.11 (`usage.ts`) | 1 | company cap + optional per-user cap, Settings → AI |
| 59 | Projects with tasks | missing | P3 6.14 | 8 | create from won deal, `create_project` automation action |
| 60 | Recycle bin | soft-delete columns exist, no UI | P2 6.14, Task 7.1 | 8 | restore within 30 days, purge job |
| 61 | Backups and restore | missing | P2 Task 7.3 | 8 | pg_dump + MinIO mirror archive, admin page, daily job, keep N |
| 62 | API tokens, REST API, API docs | missing (MCP OAuth only) | P2 Task 7.4, `docs/API.md` | 8 | read/write scopes; in-app API docs page replaces the upstream docs link |
| 63 | Undo toasts (stage move, delete) | missing | P3 6.9 | 8 | |
| 64 | Demo seed | WD (`pnpm db:seed:demo`) | `scripts/seed-live-demo.mjs` | every part | each part extends the demo seed with its entities |
| 65 | Docker deploy | WD (compose with Caddy) | Dockerfile | 1 | Caddy removed from default compose, example kept in docs |
| 66 | Telemetry (PostHog) and update check | WD (on when keys set / on) | none | 1 | off by default |
| 67 | PWA, offline, web push | missing | none | 9 | |
| 68 | Mobile layouts for key screens | partial | P3 Task 4.5 | 9, 10 | |
| 69 | Design system and identity | WD (shadcn, Pipedrive-like) | P3 6.3 (reference only) | 10 | our own identity, not Pipedrive's |
| 70 | Shared CC/BCC "copy the CRM" address | missing | none | 2 (optional, last phase) | uses Purelymail catch-all / +tag routing |

## 4. Part notes

### Part 1: Foundation and AI layer (done)
See `PLAN-PART1.md` and `PROGRESS-P1.md`. Phase 0 records the warpdrive health check in `docs/dealflow/HEALTH-CHECK.md` and the Purelymail probe in `docs/dealflow/mail-probe-result.json`. Part 2 reads both.

### Part 2: Mail provider and IMAP/SMTP (planned: `PLAN-PART2.md`)
- Planned after the Part 1 review; Phase 0 also fixes review findings R1 to R6 (assistant confirm race, AI timeouts, password reset after a link sign-in, lockout race, a release test, Message-ID domain) and runs an independent audit of Part 1.
- Probe facts that shaped it: IDLE latency 8 to 11 s, no Sent auto-save (APPEND required), SEARCH index lags APPEND by more than 5 s (UID listing by FETCH), empty mailboxes report HIGHESTMODSEQ 0.
- Deviation from the sketch below: an account is IMAP when it has a `mail_account_credentials` row (no new column on `email_accounts`); threading headers live in `email_message_headers` and folder positions in `mail_message_locations`.
- `src/features/mail/provider/` with `MailProvider` (methods mirror today's 9-method `GmailClient` but in neutral terms: `listChanges(cursor)`, `getMessage`, `getThread`, `send`, `findByMessageId`, `getAttachment`, `listMessages`, `getCursor`, `trashThread`), implementations `imapSmtp`, `gmail` (wraps the existing client) and `fake`.
- Migration renames `gmail_thread_id`, `gmail_message_id`, `last_history_id` to `provider_thread_id`, `provider_message_id`, `sync_cursor`; adds `email_accounts.provider` (`imap` | `gmail`), encrypted IMAP/SMTP credentials (existing `TOKEN_ENCRYPTION_KEY`), and `mail_folder_cursors (account_id, folder, uid_validity, last_uid, highest_modseq)`.
- Sync: per-folder QRESYNC/CONDSTORE cursors with a UID-range fallback (and the HIGHESTMODSEQ 0 empty-mailbox bug handled as "no modseq"), IDLE on INBOX in the worker plus polling Sent/Archive/Trash/Junk, 90-day initial window then background backfill.
- Threading: Message-ID / In-Reply-To / References, fallback normalised subject + participant set within 30 days.
- Send: SMTP then APPEND to Sent unless the probe showed the server saves Sent itself; outbox throttle under ~3,000/day and 300 per burst (env-configurable).
- Notification emails move to the Part 1 system mailer.
- Optional last phase: shared CC/BCC capture address.

### Part 3: Products, multi-currency, forecast
- Check first whether warpdrive stages carry a probability (the board shows weighted totals); forecast weighting must use the same source.
- Deal value stays `numeric(14,2)`; add `deals_currency` side table or column (decide at planning; prefer a side table to keep `deals.ts` untouched), `currency_rates (code, rate_to_base, updated_at)`, converted totals on board/list/forecast with an "excluded" list.

### Part 4: Quotes and invoicing
- Quotes per Dealflow P3 6.12 (markdown-lite templates with variables and a products table, public accept page `/d/{publicId}`).
- Invoices: number series `INV-{YYYY}-{NNNN}` (configurable prefix), tax per line, totals in deal currency, print stylesheet + browser print-to-PDF (no server PDF engine), email via the user's mailbox (Part 2), statuses draft/sent/paid/overdue (daily overdue job), payments recorded by hand. No Stripe, no accounting sync.

### Part 5: Automations, webhooks, templates
- Engine runs in the worker off a domain-event outbox table written in the same transaction as the change; conditions reuse the saved-filter AST; loop guard (depth 3, same automation once per record per event chain); run log per execution.
- Webhooks: HMAC-SHA256 `X-Dealflow-Signature`, retries with backoff, auto-disable after 10 consecutive failures, DNS-pinned delivery, private/loopback/link-local blocked unless `WEBHOOK_ALLOW_PRIVATE=true` (e2e only), no redirects.

### Part 6: Web forms and scheduler
- Public routes outside `(app)`; rate limit via the existing limiter; booking slots exclude existing activities and respect working hours per user; "Powered by Dealflow" footer.

### Part 7: Insights
- Report engine compiles definitions to SQL with warpdrive's visibility predicates; charts with the existing `recharts` + `chart.tsx` wrapper; dashboards; AI insight via the Part 1 layer; deal score badge on board cards and bulk scoring.

### Part 8: Projects and remaining parity
- Rows 8, 12 to 15, 18, 19, 22, 24, 25, 30, 57, 59 to 63 of the matrix.
- REST API under `/api/v1` with bearer tokens (hashed, scoped read/write), documented on an in-app page and in `docs/API.md`.

### Part 9: PWA
- Serwist (`@serwist/turbopack`, verify Next 16 support at planning), offline route, IndexedDB read-only cache of the last 50 viewed deals/people/orgs, web push via `web-push` with VAPID env vars and a `PUSH_FAKE` capture mode. Push is practical: Chrome, Edge, Firefox and installed iOS PWAs (16.4+) support it.

### Part 10: Design pass
- Uses planforexec `design-pass.md` and the frontend-design skill; brief, tokens (light + dark), per-screen specs with numbers, `check-design` lint, axe on every main screen, screenshots at 1440 and 375 px, one owner review.

## 5. Cross-cutting rules for every part

- **Verification profile (fast):** per task typecheck; phase gates run typecheck, lint, build and unit tests; integration tests (Docker) once per part; new tests only for risky server logic (money, dates, state machines, permissions, public routes, mail sync, threading); Playwright e2e and a screenshot gallery once at the end of each part; one independent `qa` review per part. `CLAUDE.md` says the same since Part 1.
- **Fakes:** every external service has a deterministic fake: `AI_FAKE` (Part 1), `MAIL_FAKE` system mailer capture (Part 1), fake IMAP/SMTP provider (Part 2), webhook receiver + `WEBHOOK_ALLOW_PRIVATE` (Part 5), `PUSH_FAKE` (Part 9). Owner actions list one short real-service smoke test per part.
- **Ports:** app 3000, ws 8080 (`WS_PORT`), dev Postgres 5433, MinIO 9000/9001, e2e app 3210, e2e ws 3211, container smoke 3310/3311.
- **Compose project:** the dev stack keeps its folder-derived name (owner's `warpdrive-main`); smoke tests use project `dealflow-smoke` (Part 1 amendment A1).
- **Error ID domains added:** `AUTH` (extended), `MAIL`, `AI` in Part 1; each later part appends its domain to `src/constants/errorIds.ts` and the domain list in `errorIds.test.ts`.
- **Screenshots:** `e2e/screenshots/p{N}-{name}.png`; every part's final report lists every screen with its route.
- **Demo data:** `pnpm db:seed:demo` keeps working and grows with each part.

## 6. Roadmap decisions

- D1: Dealflow's multi-company and super-admin layer is not rebuilt (single company per install).
- D2: AI model default `deepseek/deepseek-v4.1-flash` (live on OpenRouter 2026-10-19 with tools and JSON mode); the dated snapshot `deepseek/deepseek-v4.1-flash-1017` also exists and can be pinned through `OPENROUTER_MODEL`.
- D3: The assistant's tools are warpdrive's MCP tools (same permission checks for internal and external AI), with every write held for confirmation.
- D4: New tables go in new schema files (`src/db/schema/dealflow*.ts`, `ai.ts`, `authLocal.ts`) and side tables instead of new columns on upstream tables wherever practical.
- D5: Web push is in scope for Part 9.
- D6: Print-to-PDF uses print stylesheets and the browser; no server-side PDF engine.

## 7. Risks

- Harness maturity: DeepSeek Harness is a release candidate (0.2.1-rc.2 at planning time). Each part's kit pins the overlay rows it uses; `dsh-setup.sh` re-validates them before a run.

- Upstream drift: cherry-picks touching renamed email columns (Part 2) need manual porting. Mitigation: provider-neutral renames happen once, in one migration, and are listed in `docs/dealflow/UPSTREAM.md` (created in Part 1).
- Purelymail quirks (HIGHESTMODSEQ 0, Sent auto-save unknown): the Part 1 probe records reality before Part 2 is written.
- Builder context: warpdrive is about 112k lines. Plans point to exact files and functions; builders must read before they edit.
- Test suite runtime: integration tests need Docker and take minutes; they run once per part plus the Part 1 baseline.
