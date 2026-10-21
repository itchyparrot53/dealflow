# PROGRESS: dealflow-wd-p8-v1

STATUS: IN PROGRESS
Current: 0.2 · Last updated: 2026-10-21 14:30

## Phase base commits
- Phase 0: 908ed5b4df85ad41aa63f197171a74f0a87463df

## Tasks
- [x] 0.1 Start Part 8: progress files, kit and baseline
- [ ] 0.2 Schema, migrations, env and image
- [ ] 0.3 Pure core (test-first)
- [ ] 0.4 Phase 0 QA gate
- [ ] 1.1 Projects services, events and notifications (test-first)
- [ ] 1.2 From a won deal and the automation action
- [ ] 1.3 Projects list and board
- [ ] 1.4 Deal projects section
- [ ] 1.5 Phase 1 QA gate
- [ ] 2.1 Tokens service and settings tab
- [ ] 2.2 Registry, handler and resources (test-first)
- [ ] 2.3 API docs
- [ ] 2.4 Phase 2 QA gate
- [ ] 3.1 Recycle bin service and purge (test-first)
- [ ] 3.2 Recycle bin page
- [ ] 3.3 CSV export everywhere (test-first)
- [ ] 3.4 Audit log page
- [ ] 3.5 Backups (test-first)
- [ ] 3.6 Backups page, demo seed and docs
- [ ] 4.1 E2E projects and data spec and screenshots
- [ ] 4.2 Integration suite and smoke with the backup round trip
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (14 warnings) · build ok · unit 5237/5237 in 813 files

## Decisions
- 0.1: section 4 starting point matches: PROGRESS.md said `dealflow-wd-p7-v1` with `STATUS: COMPLETE`, so section 0 rule 1 starts this run fresh at Task 0.1.
- 0.1: Docker answers (`docker info` returns 24.0.5), so the fatal row does not apply. The owner's dev stack is left untouched; later checks bring up only what they need.
- 0.1: the kit arrived untracked as `dealflow-wd-part8-kit/` at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part8-kit` (matching the Part 2 to 7 layout), added the root `PLAN-PART8.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical; `PLAN_FILE` is now `PLAN-PART8.md`).
- 0.1: the last migration is `0088_dealflow_insights_notifications.sql`, so the next free numbers are 0089 and 0090 and Part 8 keeps the planned names `0089_dealflow_projects_api` and `0090_dealflow_projects_notifications`.
- 0.1: the audit table is `audit_events` in `src/db/schema/system.ts` with `id`, `actor_id`, `target_type` (`audit_target` enum), `target_id`, `action`, `before`, `after`, `correlation_id`, `created_at`; the audit page reads that table.
- 0.1: soft delete (`deleted_at`) exists on deals, persons, organizations, activities and leads, plus notes and goals. Section 6.8's entity list is therefore exactly the five task-relevant tables; the recycle bin uses that list.
- 0.1: the leads list exports through `src/features/leads/inbox/exportCsv.ts` (`leadRowsToCsv`, `escapeCsv` from `src/features/import/csvSafe.ts`) with `exportQuery.ts` decoding the list's filter params and `columns`; the new shared CSV writer follows that pattern.
- 0.1: MCP tools in `src/features/mcp/tools/` call domain services (`writes.ts`, `writes-deals.ts`, `writes-contacts.ts`, `writes-activities.ts`, `reads.ts`), so the API resources reuse the same service layer.
- 0.1: `Dockerfile` runtime stage is `base` = `node:22-alpine`, matching `docker-compose.yml`'s `postgres:16-alpine`, so Task 0.2 installs `postgresql16-client`.
- 0.1: `/tmp/dealflow-tools` still holds pnpm 9.15.9 and `/tmp/dealflow-pnpm-store` exists, so no reinstall is needed. The `subagent` tool is available for Task 4.3.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on every command that loads `.env`.
- TODO(owner): rebuild the dev stack so it reads migrations 0089 and 0090 once they are applied: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2). Recreate it with `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` if `/tmp` was cleared.
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211. Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312), with `COMPOSE_PARALLEL_LIMIT=1`.
- Docker 24.0.5 is up; the dev stack provides Postgres on 5433 and MinIO on 9000/9001 (`pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left", log `TODO(owner): free Docker disk space` and mark the step SKIPPED.
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report
(written in Task 4.5)
