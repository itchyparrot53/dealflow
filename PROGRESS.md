# PROGRESS: dealflow-wd-p10-v1

STATUS: IN PROGRESS
Current: 0.4 · Last updated: 2026-10-22 01:10

## Phase base commits
- Phase 0: de06153cc5eea0e1bcfbe6609da262cd90107fe3

## Tasks
- [x] 0.1 Start Part 10: progress files, kit and baseline
- [x] 0.2 Schema, dependencies, env and scripts
- [x] 0.3 Pure core (test-first)
- [ ] 0.4 Phase 0 QA gate
- [ ] 1.1 Manifest, icons, metadata and install
- [ ] 1.2 Service worker, registration and update prompt
- [ ] 1.3 Offline records and the offline page
- [ ] 1.4 Phase 1 QA gate
- [ ] 2.1 Subscriptions, preferences and the worker push handler (test-first)
- [ ] 2.2 Delivery and settings UI (test-first)
- [ ] 2.3 Phase 2 QA gate
- [ ] 3.1 Mobile shell
- [ ] 3.2 Key screens on mobile
- [ ] 3.3 Create anywhere and activities search
- [ ] 3.4 Smoke seed, demo and docs
- [ ] 3.5 Phase 3 QA gate
- [ ] 4.1 E2E PWA and mobile spec and screenshots
- [ ] 4.2 Integration suite and smoke
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (15 warnings) · build ok · unit 5320/5320 in 828 files

## Decisions
- 0.1: section 4 starting point matches: `PROGRESS.md` said `dealflow-wd-p9-v1` with `STATUS: COMPLETE`, so the run renames it to `PROGRESS-P9.md` and starts Part 10 at Task 0.1.
- 0.1: Docker 24.0.5 answers and `docker run --rm alpine df -h /` reports 33.6 GB free of 95.0 GB (63% used), above the 10 GB fatal threshold, so the baseline proceeds without pruning.
- 0.1: the kit arrived untracked at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part10-kit` (the Part 2 to 9 layout), added the root `PLAN-PART10.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical, `PLAN_FILE` now `PLAN-PART10.md`).
- 0.1: the last migration is `0091_dealflow_activity_extras.sql`, so 0092 is the next free number and the planned `0092_dealflow_push` name holds.
- 0.1: `npm view web-push version` prints 3.6.7 and `@types/web-push` 3.6.4, so the planned pins hold; `esbuild` is already a dev dependency at `^0.28.1` and `build:sw` reuses it.
- 0.1: `src/app/icon.png` (512x512) and `src/app/apple-icon.png` (180x180) both exist, so Task 1.1 generates the PWA icons from `src/app/icon.png` with `sips` and no new dependency.
- 0.1: the notification producer is `src/features/notifications/produce.ts` (`createNotification`), called from `deliver()` in `src/features/notifications/wire.ts`; the email channel is decided in `src/features/notifications/emailDispatch.ts` through `resolveDelivery` in `preferences.ts` with the defaults in `src/constants/notificationDefaults.ts`. Task 2.2 hooks push into `deliver()` after the row commits.
- 0.1: the shell is `src/app/(app)/layout.tsx` with `src/components/shell/LeftNav.tsx`, `TopBar.tsx` and `UserMenu.tsx`; Task 3.1 adds the bottom navigation beside them and Task 1.1 mounts the install entry in the user menu and Settings > Profile.
- 0.2: `drizzle/0092_dealflow_push.sql` creates exactly `push_subscriptions` and `notification_push_prefs` (plus the user index) and is applied to the dev database (93 migration rows). `build:docker` and `e2e:build` also run `build:sw`, because the Docker image and the e2e production stack both serve the worker and neither runs the plain `build` script.
- 0.2: VAPID is all-or-nothing in `src/config/env.ts` (same rule as Google): one or two of the three set is a boot error, all empty is "push off". `PUSH_FAKE`/`PUSH_FAKE_DIR` are separate so capture mode works with no keys.
- 0.2: `public/sw.js` and `.push-capture/` are git-ignored and excluded from biome and eslint; the bundled worker is a build output and lint would otherwise try to type-check it outside the app tsconfig.
- 0.2: `e2e/fixtures/vapid.json` holds a generated test pair (public values only) and `scripts/e2e/e2e-env.mjs` reads it to set `VAPID_*`, `PUSH_FAKE=true` and `PUSH_FAKE_DIR=.push-capture`.
- 0.3: the 25 pure-core cases were written before their four modules; the first run failed with "Cannot find module" in all four test files, then the implementation passed. `decide` applies the six rules in order and exempts `/insights/reports/{id}/export.csv` while a report page itself is still a navigation fallback.
- 0.3: snapshot inputs list the fields that must not be stored (`note` on an activity, `notes` on a person) so the tests prove the body text is dropped; `toDealSnapshot` caps recent activities at 5 and all four builders take an injectable `now` for a deterministic `savedAt`.
- 0.3: `trimToNewest` dedupes by id keeping the newest `savedAt` (ties keep the later copy) and sorts newest first, so a re-saved record replaces its old copy.
- 0.3: `buildPushPayload` truncates the body to exactly 140 characters ending in "…" and only accepts links that start with `/` and not `//`; absolute, protocol-relative, `javascript:` and bare-relative links all become `/notifications`. The `PUSH` error domain (E_PUSH_001 to 004) is appended to the registry and its test allow-list.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; commands that load `.env` carry `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` until then.
- TODO(owner): rebuild the dev stack so its app image reads the new migrations: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2). Recreate it with `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` if `/tmp` was cleared.
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- `npm view` in this sandbox needs `--cache /tmp/npm-cache --logs-dir=/tmp/npm-logs` (writing `~/.npm/_logs` is blocked).
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once. Part 10 wraps this as `build:sw && ALLOW_FIRST_LOGIN_ADMIN=false next build`.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211. Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312), with `COMPOSE_PARALLEL_LIMIT=1`.
- Docker 24.0.5 is up with 33.6 GB free in the VM (95.0 GB total) as of 2026-10-22 00:36; the dev stack provides Postgres on 5433 and MinIO on 9000/9001 (`pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left" after Task 0.1, record the step SKIPPED and end `COMPLETE WITH OPEN ISSUES` (section 10).
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report
(written in Task 4.5)
