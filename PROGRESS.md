# PROGRESS: dealflow-wd-p6-v1

STATUS: IN PROGRESS
Current: 0.2 · Last updated: 2026-10-21 03:41

## Phase base commits
- Phase 0: 935685bd476eb7d5c75d51b3439a8ffe7711aa4c

## Tasks
- [x] 0.1 Start Part 6: progress files, kit and baseline
- [ ] 0.2 Forms and booking schema and migrations
- [ ] 0.3 Pure core: time zones, slots, fields, spam token, ICS (test-first)
- [ ] 0.4 Phase 0 QA gate
- [ ] 1.1 Forms service and the capability
- [ ] 1.2 Public submit and events (test-first)
- [ ] 1.3 Phase 1 QA gate
- [ ] 2.1 Booking pages service and busy time
- [ ] 2.2 Slots, booking and cancel (test-first)
- [ ] 2.3 Phase 2 QA gate
- [ ] 3.1 Forms admin screens
- [ ] 3.2 Public form page
- [ ] 3.3 Booking admin screens
- [ ] 3.4 Public booking and cancel pages
- [ ] 3.5 Triggers in the editors, demo seed and docs
- [ ] 3.6 Phase 3 QA gate
- [ ] 4.1 E2E forms and booking spec and screenshots
- [ ] 4.2 Integration suite and smoke
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: install ok · typecheck ok · lint ok (14 warnings) · build ok (a first attempt hit the known `ENOTEMPTY` race on `.next`; cleared and retried) · unit 5124/5124

## Decisions
- 0.1: section 4 starting point matches exactly: PROGRESS.md said `dealflow-wd-p5-v1` with `STATUS: COMPLETE`, and HEAD was `935685bd476eb7d5c75d51b3439a8ffe7711aa4c`, so this run starts fresh at Task 0.1 as section 0 rule 1 expects.
- 0.1: the kit arrived untracked as `dealflow-wd-part6-kit/` at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part6-kit` (matching the Part 1 to 5 layout), added the root `PLAN-PART6.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical; `PLAN_FILE` is now `PLAN-PART6.md`). The untracked `dealflow-wd-part6-kit.zip` is added to `.git/info/exclude`, as `/dealflow-wd-part2-kit.zip` was.
- 0.1: the next free migration numbers are 0085 and 0086 (the last file is `0084_dealflow_automation_notifications.sql`), so the two Part 6 migrations keep the planned names `0085_dealflow_forms_booking` and `0086_dealflow_forms_booking_notifications`.
- 0.1: `src/db/schema/activities.ts` has `due_at`, `end_at`, `duration_minutes`, `done`, `assignee_id` and the all-day flag (`all_day`, commented next to `due_at`), so 6.6's busy rule maps directly: end = `end_at`, else `due_at + duration_minutes`, else 30 minutes, and `all_day` rows never block.
- 0.1: `leads.source_origin` is free text with no DB check (default `manually_created`); the closest web-form value is `web_form`, which already exists as a key in `src/constants/sourceChannels.ts`, so a lead created by a form sets `sourceOrigin = "web_form"` and `sourceChannel = "web_form"`.
- 0.1: there is no standalone person-by-email helper. The email-linking code (`src/features/email/linking.ts:63`, also `src/features/import/dedup.ts:33`) compares `${persons.primaryEmail} = ${email} and deleted_at is null`, and `primary_email` is `citext`, so that comparison is already case-insensitive; the submit and booking services reuse it and log it in their own tasks.
- 0.1: security headers are set by `next.config.ts` `headers()` (this project has no middleware by design), so 6.8's framing exception becomes a path-scoped entry for `/f/:path*` and `/book/:path*` carved out of the strict `frame-ancestors 'none'` entry, pinned by `next.config.test.ts`.
- 0.1: `SystemMail` (`src/features/mailer/types.ts`) is `{ to, subject, text, html }` with no attachments, so the booking confirmation carries the time, location and cancel link in the body only, and the `.ics` is offered solely as the confirmation page's "Add to calendar" data-URL download, per section 10.
- 0.1: pnpm 9.15.9 (from `/tmp/dealflow-tools`), Node 24.16.0 and Docker 24.0.5 are available, and the `subagent` tool is available, so the Task 4.3 review can use it.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on every command that loads `.env`.
- TODO(owner): rebuild the dev stack so it reads the Part 4 and Part 5 migrations and schema once `0083_dealflow_automations` is applied: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2).
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers`; ports 3210/3211. Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312).
- Docker 24.0.5 is up; the owner's `warpdrive-main` stack holds 5433/9000/9001. Never prune; if a build fails with "no space left", log `TODO(owner): free Docker disk space` and mark the step SKIPPED.
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report
(written in Task 4.5)
