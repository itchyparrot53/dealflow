# PROGRESS: dealflow-wd-p14-v1

STATUS: IN PROGRESS
Current: 0.2 · Last updated: 2026-11-10 01:15

## Phase base commits
- Phase 0: 427c4673a950cb0964601a44b257d43c686ff594

## Tasks
- [x] 0.1 Start Part 14: progress files, kit, baseline and environment
- [x] 0.2 Reuse map and design note
- [ ] 0.3 Phase 0 QA gate
- [ ] 1.1 Schema, migration and permission flags
- [ ] 1.2 Marketing status service and suppression
- [ ] 1.3 Double opt-in, unsubscribe pages and one-click
- [ ] 1.4 Form consent field and CSV import mapping
- [ ] 1.5 Contacts UI: marketing section, list column, filter field, bulk change
- [ ] 1.6 Phase 1 QA gate
- [ ] 2.1 Block schema, renderer, plain text and marketing sanitiser
- [ ] 2.2 Campaign images and the public asset route
- [ ] 2.3 Builder UI
- [ ] 2.4 Templates: starters, saved templates, test send
- [ ] 2.5 Phase 2 QA gate
- [ ] 3.1 Campaign list and the four-step editor
- [ ] 3.2 Settings › Campaigns: senders, address, consent, sending, domain check
- [ ] 3.3 Sending engine
- [ ] 3.4 Tracking routes, web version, timeline and click alerts
- [ ] 3.5 Bounce mailbox and the DSN parser
- [ ] 3.6 Phase 3 QA gate
- [ ] 4.1 Sequences: model, editor, scheduler, entries and exits
- [ ] 4.2 Campaign report and recipients export
- [ ] 4.3 Campaign insights with comparison and type filter
- [ ] 4.4 Phase 4 QA gate
- [ ] 5.1 Campaigns e2e spec, demo seed and gallery
- [ ] 5.2 Docs
- [ ] 5.3 End-to-end, integration suite and smoke
- [ ] 5.4 Independent review
- [ ] 5.5 Final checklist
- [ ] 5.6 Final report and completion

## QA log
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (16 warnings, 1 info) · build ok · unit 5486/5486 in 861 files · check:design 0 violations, 17 opt-outs

## Decisions
- 0.1: starting point matches section 4. `PROGRESS.md` said `dealflow-wd-p13-v1` with `STATUS: COMPLETE`, so it is renamed to `PROGRESS-P13.md` and Part 14 starts at Task 0.1 from base `427c467`.
- 0.1: the owner's live stack `dealflow-prod` is running on 127.0.0.1:3001, 8080 and 9000 (its Postgres publishes 5433). It was inspected read-only with `docker ps` and never stopped, recreated or called.
- 0.1: port 5433 is held by the owner's live stack, so the dev stack runs with `DEV_PG_PORT=5434 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up` (Postgres 5434, MinIO S3 9100, console 9101). Every host database command and every e2e or integration run uses `DEV_PG_PORT=5434`; this is Part 13's documented fallback when a port is held.
- 0.1: the saved-filter schema already lists `person` (`SAVED_FILTER_TARGET_ENTITIES` in `saved-filters/schemas.ts`), but `filterAst.ts` and `filterAstSql.ts` compile deals only (`d.` alias and the deal field allow-list), so the person segment adapter that section 4 allows for is added with the campaign segment work.
- 0.1: the Part 13 renderer is present as section 4 expects (`email-design/{tokens,variables,layout,design,registry,sendSystemEmail}.ts`, `getEmailDesign` in `design.ts`, `sendSystemEmail` in `sendSystemEmail.ts`), so campaigns reuse it without an API change.
- 0.1: one-to-one tracking lives at `src/app/t/open/[token]` and `src/app/t/click/[token]`; Part 14 adds campaign routes under `src/app/t/c/*` and never changes these.
- 0.1: automations register handlers with `registerActionHandler` (`src/features/automations/actions/registry.ts`), so `enroll_in_sequence` plugs in there.
- 0.1: the latest migration is `drizzle/0093_dealflow_email_design.sql`, so the campaigns migration takes `0094_dealflow_campaigns.sql`.
- 0.1: the e2e harness already runs the pg-boss worker (`scripts/e2e/e2e-server.mjs` spawns `src/entrypoints/worker.ts`), so campaign jobs need no in-process e2e fallback.
- 0.1: pnpm 9.15.9 in `/tmp/dealflow-tools` had been partly garbage collected (the `pnpm` symlink pointed at a missing package), so it was reinstalled with the documented `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` command. The global pnpm is 8.9.2 and is never used.
- 0.1: Docker is up (24.0.5) but the VM has 8.2 GB free of 95.0 GB (91% used). That is below the 10 GB comfort threshold Part 13 recorded, so builds and the smoke run are watched for "no space left" and never pruned (section 0 rule 14).
- 0.1: `.env` had its three `GOOGLE_*` values blanked in the previous session (they were two placeholders plus an empty domain, which the all-or-nothing rule rejects), so env validation now passes. The Environment `GOOGLE_*=` command prefixes are kept but are redundant; `.env` is not edited again by this run (rule 17).
- 0.2: person segments compile with the contacts engine (`contacts/contactFilter.ts compileContactFilter` plus `PERSON_FILTER_CONFIG` and `PERSON_COLUMN_SQL`); `filterAst.ts`/`filterAstSql.ts` are the deal-only compiler, so no entity adapter is added there (section 4 allows this fallback).
- 0.2: people visibility has no SQL clause; `listPeople` filters candidate rows with `canSee` in process, so the segment preview and the send-time snapshot do the same, hydrating the campaign creator with `hydrateActor` instead of inventing a person visibility clause.
- 0.2: `GLOBAL_FLAGS` and the `GlobalAction` union are two hand-maintained lists in different files, so each of the four campaign flags is added to both and the permission tests cover both.
- 0.2: the outbound email registry is a closed union, so `marketing_double_opt_in` and `campaign_sender_verification` are appended to `EMAIL_TEMPLATE_KEYS` and `EMAIL_TEMPLATES`, and the brand test gains their pinned copy.
- 0.2: campaign timeline entries use the existing change log (`recordChange`) rendered as `HistoryItem.event` by `contactTimeline`, not a new feed table.
- 0.2: campaign mail gets its own transport module reading `MARKETING_SMTP_*` then `SMTP_*`, and reuses the `MAIL_FAKE` capture store so tests read the wire copy; one-to-one `renderEmail` is not reused for campaign layout, only its tokens, variables and `htmlToText`.
- 0.2: public routes are top-level app folders with no middleware allow-list to edit, so `/c`, `/u`, `/v` and `/t/c/...` need none; all reuse the public fail-open `emailTracking` limiter.
- 0.2: new jobs register in `registerAllJobs` (`src/server/worker.ts`) with queue names in `src/constants/jobNames.ts` and producers through `getBoss()`; the e2e harness already runs that worker.

## Owner actions
- TODO(owner): set all three `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and `GOOGLE_WORKSPACE_DOMAIN` values in `.env` if you want Google sign-in; they are blank now so the app runs without Google SSO.
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.
- TODO(owner): push is still off because `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are empty. Run `pnpm push:vapid`, add all three to `.env`, then restart the app and worker.

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2). Recreate it with `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` if `/tmp` was cleared.
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) carry `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` as a habit; `.env` has all three blank now, so they are redundant but harmless. Check emptiness only, never print values.
- `npm view` in this sandbox needs `--cache /tmp/npm-cache --logs-dir=/tmp/npm-logs` (writing `~/.npm/_logs` is blocked).
- Build: `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN= ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5434/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- Dev stack: `DEV_PG_PORT=5434 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up` (Postgres 5434, MinIO S3 9100, MinIO console 9101). Never bind 3001, 8080, 9000 or 5433 (the owner's `dealflow-prod`) and never touch port 3333 or 3000.
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211; every run is `MINIO_PORT=9100 DEV_PG_PORT=5434 pnpm e2e` (and `... pnpm exec playwright test ...`). Smoke: `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312).
- Docker 24.0.5 is up with 8.2 GB free in the VM (95.0 GB total) as of 2026-11-10 00:57; the dev stack provides Postgres on 5434 and MinIO on 9100/9101 (`pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left" after Task 0.1, record the step SKIPPED and end `COMPLETE WITH OPEN ISSUES` (section 10).
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).
- Document PDFs: `DOCS_CHROME=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome pnpm docs:pdf` if the default browser path is not found.

## Final report
(written in Tasks 5.5 and 5.6)
