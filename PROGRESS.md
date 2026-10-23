# PROGRESS: dealflow-wd-p13-v1

STATUS: IN PROGRESS
Current: 2.2 · Last updated: 2026-10-23 13:18

## Phase base commits
- Phase 0: 7cb94503b3fc1ab2644d782fd4025c5799e1c382
- Phase 1: 8ec54f539191a19aee27033b698c00914e8f43c9
- Phase 2: 7da8993

## Tasks
- [x] 0.1 Start Part 13: progress files, kit, baseline and environment
- [x] 0.2 Outbound email inventory
- [x] 0.3 Phase 0 QA gate
- [x] 1.1 Variables and escaping
- [x] 1.2 The layout renderer
- [x] 1.3 Data model, design service, logo and the public route
- [x] 1.4 Registry, overrides and sendSystemEmail
- [x] 1.5 Phase 1 QA gate
- [x] 2.1 Product emails migrated
- [ ] 2.2 Customer email wrapping in the send path, automations and booking
- [ ] 2.3 Quote and invoice emails
- [ ] 2.4 Phase 2 QA gate
- [ ] 3.1 Settings › Email design: Branding tab
- [ ] 3.2 Templates tab and the template editor
- [ ] 3.3 Composer layout control and preview
- [ ] 3.4 Phase 3 QA gate
- [ ] 4.1 Email e2e spec and gallery
- [ ] 4.2 Docs
- [ ] 4.3 End-to-end, integration suite and smoke
- [ ] 4.4 Independent review
- [ ] 4.5 Final checklist
- [ ] 4.6 Final report and completion

## QA log
- Phase 1 gate: commands green · typecheck ok · lint ok (15 warnings) · build ok · unit 5480/5480 in 860 files · src/features/email-design/*.integration.test.ts 7/7
- Phase 0 gate: commands green · typecheck ok · lint ok (15 warnings, 1 info) · build ok · unit 5444/5444 in 855 files
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (15 warnings, 1 info) · build ok · unit 5444/5444 in 855 files · check:design 0 violations, 17 opt-outs

## Decisions
- 2.1: all five product senders now call `sendSystemEmail` with their registry key; `renderNotificationEmail` returns copy (`subject`, `line`, `cta`, `url`) instead of HTML, so the notification job passes `notification.*` variables and the layout owns the markup.
- 2.1: the notification CTA is derived per type (`notificationCta`): conversation for mentions, comments, email opens/clicks and deal email; activity for assignments/reminders; quote for document events; form; booking; deal for deal/automation/AI; `Open Dealflow` otherwise.
- 2.1: `mailer/templates.ts` and `mailer/branding.ts` (and their tests) are deleted; the logo constants live in `email-design/tokens.ts`. The old headers are gone, not merely unused.
- 2.1: changed tests: the notification job and visibility suites inject a `(to, variables, signal)` sender and assert `notification.subject`; the render suite asserts copy, URL and CTA labels; the brand test renders the registry default for the HTML check; the invite test mocks `sendSystemEmail`.
- 1.5: the error-id registry test's regex accepted only one-word domains; Part 13's required `E_EMAIL_DESIGN_NNN` ids are two words, so the test regex now allows underscore segments and `EMAIL_DESIGN` joins the domain list. This widens the registry contract for the new domain, not a weakened assertion.
- 1.5: `renderEmail` takes an optional `subject` for the `<title>` element: 6.2 asks the skeleton for the subject but its input interface omits it, so the field defaults to the display name.
- 1.3: `db:generate` produced `0093_smooth_harrier.sql`; it was renamed to `0093_dealflow_email_design.sql` with the journal tag updated, and the singleton `INSERT ... ON CONFLICT DO NOTHING` was appended, so the migration matches 6.3 and a fresh database always has the row.
- 1.3: there is no middleware or public allow-list in this codebase: the public routes are top-level `/d`, `/f` and `/book` outside the `(app)` group. The logo route therefore sits at top-level `/email-assets/logo/[file]`, which is public by construction; there was no list to edit.
- 1.3: the logo route reuses the `emailTracking` public limiter and, like the tracking pixel, still serves the stored bytes when the limit is hit, so an emailed logo can never render broken.
- 1.3: audit rows use `targetType: "settings"` because `audit_target_type` is a database enum with no email member; the plan fixes only the action names (`email_design.updated`, and later `email_template.updated`).
- 0.2: the inventory confirms the ten 6.1 keys and no sender outside them. `booking_cancelled` is the one listed customer email with no sender today: `scheduling/cancel.ts` soft-deletes the activity, emits `booking.cancelled` and notifies the host, but never emails the guest, so Task 2.2 sends it on that existing trigger and recipient. This implements a listed template, not a new email type.
- 0.2: the booking confirmation has no `.ics` attachment today; `buildIcs` is returned to the HTTP caller only. Task 2.2 attaches it through the `SystemMail.attachments` support 6.4 requires, so the template's "A calendar invite is attached." is true.
- 0.2: no HTML-to-text helper exists in the repository, so per section 10 Task 1.2 writes a small converter in `layout.ts` with tests and reuses it for the plain-text part.
- 0.2: every notification email currently says "Open in Dealflow"; Task 2.1 derives the per-type `notification.cta` label from 6.4 (Open deal, Open activity, Open quote, Open conversation, Open form, Open booking, or Open Dealflow) from the same `NotificationRow` switch.
- 0.2: the current backup and webhook emails interpolate the failure detail and `user.name` into HTML without escaping; moving their copy into the renderer in Task 2.1 escapes every variable, which closes that gap without changing either trigger.
- 0.2: the notification job sends one email per row and enqueues one job per row, so there is no digest and no `notification_digest` key.
- 0.2: document subjects and messages are code defaults today (`defaultSubject`/`defaultMessage`), not templates; Task 2.3 resolves `quote_sent` and `invoice_sent` from the registry and pre-fills the dialog.
- 0.1: starting point matches section 4: `PROGRESS.md` said `dealflow-wd-p12-v1` with `STATUS: COMPLETE` and the four commits after it start `frontend-2026:` (4fdcf08, 16243df, de5eb77, 7cb9450), so it is renamed to `PROGRESS-P12.md` and Part 13 starts here at Task 0.1.
- 0.1: the live `dealflow-prod` stack is running on 127.0.0.1:3001, 8080 and 9000 and was not touched; only read-only Docker inspection was used.
- 0.1: the dev stack answers on 5433 (Postgres), 9100 (MinIO S3) and 9101 (console), so `DEV_PG_PORT=5433 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up` is the recorded command.
- 0.1: the senders named in section 4 all exist (`magic-link/route.ts`, `identity/actions/invite.ts`, `scheduling/booking.ts`, `scheduling/cancel.ts`, `webhooks/deliver.ts`, `backups/backup.ts`, `notifications/email/job.ts`), and the customer path is `email/send.ts` plus `sendHelpers.ts`, with `documents/send.ts` and `automations/actions/sendEmail.ts` calling into the mailbox send.
- 0.1: the latest migration is `drizzle/0092_dealflow_push.sql`, so Part 13's migration takes `0093_dealflow_email_design.sql`.
- 0.1: the TipTap editor is `@tiptap/react` 3.27.1, already used by Settings › Email templates.
- 0.1: the kit arrived untracked at the repo root as `dealflow-wd-part13-kit`, so it moved to `PLAN AND EXECUTE/dealflow-wd-part13-kit` (the Part 2 to 12 layout), the root `PLAN-PART13.md` symlink was added, and the kit's `scripts/check-progress.mjs` was copied over the root copy byte for byte.
- 0.1: pnpm is 9.15.9 from `/tmp/dealflow-tools`, the Playwright browsers are in `/tmp/dealflow-pw-browsers`, the subagent tool is available, and Docker has 15.6 GB free of 95.0 GB (83% used), above the 10 GB fatal threshold.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; commands that load `.env` carry `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` until then.
- TODO(owner): rebuild the live install so it serves Part 13: `docker compose up -d --build` (no `-v`).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.
- TODO(owner): push is still off because `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are empty. Run `pnpm push:vapid`, add all three to `.env`, then restart the app and worker.

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2). Recreate it with `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` if `/tmp` was cleared.
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- `npm view` in this sandbox needs `--cache /tmp/npm-cache --logs-dir=/tmp/npm-logs` (writing `~/.npm/_logs` is blocked).
- Build: `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN= ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once. Part 10 wraps this as `build:sw && ALLOW_FIRST_LOGIN_ADMIN=false next build`.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- Dev stack: `DEV_PG_PORT=5433 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up` (Postgres 5433, MinIO S3 9100, MinIO console 9101). Never bind 3001, 8080 or 9000 (the owner's `dealflow-prod`) and never touch port 3333 or 3000.
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211; every run is `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` (and `... pnpm exec playwright test ...`). Smoke: `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312).
- Docker 24.0.5 is up with 15.6 GB free in the VM (95.0 GB total) as of 2026-10-23 12:33; the dev stack provides Postgres on 5433 and MinIO on 9100/9101 (`pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left" after Task 0.1, record the step SKIPPED and end `COMPLETE WITH OPEN ISSUES` (section 10).
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).
- Document PDFs: `DOCS_CHROME=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome pnpm docs:pdf` if the default browser path is not found.

## Final report
(written in Task 4.5)
