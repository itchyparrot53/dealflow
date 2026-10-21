# PROGRESS: dealflow-wd-p5-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: 2026-10-21 01:16

## Phase base commits
- Phase 0: ebbf7d2e3a2c5f3e42373785db224dc8f5d1bfbf

## Tasks
- [x] 0.1 Start Part 5: progress files, kit and baseline
- [ ] 0.2 Trusted client IP (test-first)
- [ ] 0.3 Automations schema and migration
- [ ] 0.4 Pure core: definition, trigger matching, IP ranges, signatures (test-first)
- [ ] 0.5 Phase 0 QA gate
- [ ] 1.1 Emit from recordChange (test-first)
- [ ] 1.2 Create and document events
- [ ] 1.3 Dispatcher, snapshot and retention (test-first)
- [ ] 1.4 Phase 1 QA gate
- [ ] 2.1 Runner, conditions and the capability (test-first)
- [ ] 2.2 Core actions
- [ ] 2.3 Email and AI actions
- [ ] 2.4 Phase 2 QA gate
- [ ] 3.1 Safe delivery (test-first)
- [ ] 3.2 Subscriptions service, test send and redeliver
- [ ] 3.3 Phase 3 QA gate
- [ ] 4.1 Automations list and editor
- [ ] 4.2 Run log
- [ ] 4.3 Describe it and the template gallery
- [ ] 4.4 Webhooks settings and delivery log
- [ ] 4.5 Demo seed and docs
- [ ] 4.6 Phase 4 QA gate
- [ ] 5.1 E2E automations spec and screenshots
- [ ] 5.2 Integration suite and smoke
- [ ] 5.3 Independent review and hardening
- [ ] 5.4 Final checklist
- [ ] 5.5 Final report and completion

## QA log
- Baseline: install ok · typecheck ok · lint ok (14 warnings) · build ok (a first attempt hit the known `ENOTEMPTY` race on `.next`; cleared and retried) · unit 5063/5063

## Decisions
- 0.1: section 4 starting point matches exactly: PROGRESS.md said `dealflow-wd-p4-v1` with `STATUS: COMPLETE`, and HEAD was `ebbf7d2e3a2c5f3e42373785db224dc8f5d1bfbf`, so this run starts fresh at Task 0.1 as section 0 rule 1 expects.
- 0.1: the kit arrived untracked as `dealflow-wd-part5-kit/` at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part5-kit` (matching the Part 1 to 4 layout), added the root `PLAN-PART5.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical; `PLAN_FILE` is now `PLAN-PART5.md`), per section 4's kit row.
- 0.1: no `dealflow-wd-part5-kit.zip` exists in the tree (the kit arrived as a folder), so `.git/info/exclude` needed no new entry; `/dealflow-wd-part2-kit.zip` remains the only zip entry there.
- 0.1: the next free migration number is 0083 (the last file is `0082_dealflow_document_notifications.sql`), so the automations migration keeps the planned name `0083_dealflow_automations`.
- 0.1: `grep -rl "recordChange(" src/features` lists 21 files, of which 2 are tests and 1 is `changeLog.ts` itself, so 18 real callers match section 4: the deal workspace edit paths (stage, owner, won/lost, participants, followers, merge, duplicate, delete, convert), `deals/{dealUpdate,dealUpdateChangeLog,dealMove,archiveDeal,deleteDeal}`, `contacts/merge`, `leads/leadConvert` and `products/dealTerms`.
- 0.1: creates do NOT call `recordChange`: `createDeal` (`dealActions.ts`), `createPerson` (`personsRepo.ts`), `createOrg` (`orgsRepo.ts`) and `createActivity` (`activities/repo.ts`) insert directly, so Task 1.2 will add `emitDomainEvent` to each create service and list those upstream edits in UPSTREAM.md.
- 0.1: saved-filter targets are `["deal", "person", "organization", "lead"]` (`SAVED_FILTER_TARGET_ENTITIES` in `src/features/saved-filters/schemas.ts`), so automation conditions are offered for deal, person and organization exactly as 6.7 says, never for lead.
- 0.1: the encryption helper to reuse for webhook secrets is `src/features/email/crypto.ts` (`encryptToken`/`decryptToken`, AES-256-GCM with `TOKEN_ENCRYPTION_KEY`, bytea output), the same one Part 2 uses for mail passwords.
- 0.1: pg-boss schedules live in `src/server/worker.ts` and queue names in `src/constants/jobNames.ts` (as Part 4 did for `documents.overdue`), so the dispatcher, rotting, retention and webhook jobs register from that worker.
- 0.1: pnpm 9.15.9 (from `/tmp/dealflow-tools`), Node 24.16.0 and Docker 24.0.5 are available, and the `subagent` tool is available, so the Task 5.3 review can use it.
- 0.1: baseline green: install `--frozen-lockfile` up to date, typecheck ok, lint ok (14 warnings, 0 errors), build ok (a first attempt hit the known `ENOTEMPTY` race on `.next`; cleared and retried), unit suite recorded in the QA log.

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
(written in Task 5.5)
