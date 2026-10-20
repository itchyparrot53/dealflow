# PROGRESS: dealflow-wd-p3-v1

STATUS: IN PROGRESS
Current: 0.2 · Last updated: 2026-10-20 20:14

## Phase base commits
- Phase 0: 15ff072bad756d4e64d00cbfd89521ba472ca651

## Tasks
- [x] 0.1 Start Part 3: progress files, kit and baseline
- [ ] 0.2 Sales schema and migration
- [ ] 0.3 Money and totals (test-first)
- [ ] 0.4 Phase 0 QA gate
- [ ] 1.1 Rates, base currency and permissions
- [ ] 1.2 Product catalog service
- [ ] 1.3 Deal lines and the value sync (test-first)
- [ ] 1.4 Deal terms and stage probabilities
- [ ] 1.5 Phase 1 QA gate
- [ ] 2.1 Settings → Currencies
- [ ] 2.2 Settings → Products
- [ ] 2.3 Deal Products section and terms fields
- [ ] 2.4 Stage probability in the stage editor
- [ ] 2.5 Converted and weighted totals on the board and list
- [ ] 2.6 Phase 2 QA gate
- [ ] 3.1 Forecast service (test-first)
- [ ] 3.2 Forecast page and navigation
- [ ] 3.3 Demo seed and docs
- [ ] 3.4 Phase 3 QA gate
- [ ] 4.1 E2E sales spec and screenshots
- [ ] 4.2 Integration suite and smoke
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: typecheck ok · lint ok (14 warnings, 0 errors) · build ok (a first attempt hit the known `ENOTEMPTY` race on `.next`; cleared and retried) · unit 4979/4979

## Decisions
- 0.1: starting point is `15ff072` (`5.6: Final report and completion`, Part 2) and the previous PROGRESS.md said `dealflow-wd-p2-v1` with `STATUS: COMPLETE`, so this run starts fresh at Task 0.1 as section 4 expects.
- 0.1: the kit arrived untracked as `dealflow-wd-part3-kit/` at the repo root; moved it to `PLAN AND EXECUTE/dealflow-wd-part3-kit` to match the Part 1 and Part 2 layout, added the root `PLAN-PART3.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical, `PLAN_FILE` now `PLAN-PART3.md`), per section 4's "kit in a subfolder" row.
- 0.1: the next free migration number is 0080 (the last file is `0079_dealflow_mail_tables.sql`), so the sales schema migration keeps the planned name.
- 0.1: `src/db/schema/stages.ts` has no probability column, so `stage_probabilities` is used as section 6.4 specifies.
- 0.1: the won timestamp is `deals.wonTime` (`won_time` timestamptz), so forecast won months use it.
- 0.1: pnpm 9.15.9 from `/tmp/dealflow-tools`, Node 24.16.0 and Docker 24.0.5 are available; `.env` still has a partial Google configuration (client id and secret set, workspace domain empty), so commands that load `.env` keep the three overrides.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on every command that loads `.env`.
- TODO(owner): rebuild the dev stack so it reads the Part 2 migrations and the Part 3 schema once migration 0080 is applied: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).

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
