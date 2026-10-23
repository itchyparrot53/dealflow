# PROGRESS: dealflow-wd-p12-v1

STATUS: IN PROGRESS
Current: 0.3 · Last updated: 2026-10-23 01:47

## Phase base commits
- Phase 0: 3ef72635f7a31c2863c3e0a3b1f2e88e186769ac

## Tasks
- [ ] 0.1 Start Part 12: progress files, kit, baseline and environment
- [x] 0.2 Polish e2e spec and the two check-design rules
- [ ] 0.3 Phase 0 QA gate
- [ ] 1.1 Dialog, alert dialog and sheet anatomy, every dialog migrated (U1)
- [ ] 1.2 Scrolling Select, searchable Combobox, one trigger style (U2, U3, U9)
- [ ] 1.3 FormField and FormGrid on create dialogs and settings forms (U8)
- [ ] 1.4 Number and money formatting (U10)
- [ ] 1.5 Tables, empty states and the bell badge (U29, U30)
- [ ] 1.6 AI JSON reliability and the humane error (U7)
- [ ] 1.7 Phase 1 QA gate
- [ ] 2.1 Expandable rail with labels (U4)
- [ ] 2.2 Hide install, offline and push UI behind NEXT_PUBLIC_PWA_UI (U5)
- [ ] 2.3 One heading per page and the settings layout (U11, U12)
- [ ] 2.4 Contacts view switcher (U13)
- [ ] 2.5 Toolbar order and the Ask AI popover (U14, U15)
- [ ] 2.6 Phase 2 QA gate
- [ ] 3.1 Add deal dialog (U6)
- [ ] 3.2 Board column header and card score (U16, U17)
- [ ] 3.3 Forecast header and calendar (U18, U19)
- [ ] 3.4 Stage track, person and organization records (U20, U27)
- [ ] 3.5 Document editor (U21)
- [ ] 3.6 Inbox list and thread reader (U22, U23)
- [ ] 3.7 Leads, dashboard, Insights index and projects (U24, U25, U26, U28)
- [ ] 3.8 Phase 3 QA gate
- [ ] 4.1 User guide update and PDFs
- [ ] 4.2 End-to-end and gallery
- [ ] 4.3 Integration suite and smoke
- [ ] 4.4 Independent review
- [ ] 4.5 Final checklist
- [ ] 4.6 Final report and completion

## QA log
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (13 warnings, 1 info) · build ok · unit 5356/5356 in 843 files · check-design 0 violations, 12 opt-outs · after the two new 6.10 rules: 9 violations (dialog-anatomy 4, select-long-list 5), 12 opt-outs

## Decisions
- 0.1: starting point matches section 4: `PROGRESS.md` said `dealflow-wd-p11-v1` with `STATUS: COMPLETE` and the commits after it are `brand: 1..8`, `app: Docs button ...`, `docs: ...` (twice) and `website: ...`, so the run renames it to `PROGRESS-P11.md` and starts Part 12 at Task 0.1.
- 0.1: `docker compose ls` shows `dealflow-prod` running(5) and publishing 127.0.0.1:3001, 8080 and 9000; it was not touched.
- 0.1: ports 5433, 9100 and 9101 were free, so the dev stack keeps Postgres 5433 and runs MinIO on 9100 (console 9101); the recorded command is `DEV_PG_PORT=5433 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up`.
- 0.1: `scripts/e2e/e2e-env.mjs` reads `MINIO_PORT` and `DEV_PG_PORT` from the shell, so every e2e command is prefixed `MINIO_PORT=9100 DEV_PG_PORT=5433` (recorded in Environment).
- 0.1: Docker answers and `docker run --rm alpine df -h /` reports 17.6 GB available of 95.0 GB (81% used), above the 10 GB fatal threshold, so the baseline proceeds without pruning.
- 0.1: the kit arrived untracked at the repo root as `dealflow-wd-part12-kit`, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part12-kit` (the Part 2 to 11 layout), added the root `PLAN-PART12.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical, `PLAN_FILE` now `PLAN-PART12.md`).
- 0.1: `site/` is the untouched upstream landing page (its `site/public` build output is the owner's untracked work) and `website/` is the Dealflow site source; this part edits neither.
- 0.1: `src/components/ui/Combobox.tsx` exists (cmdk inside a Popover); Task 1.2 adds the max height and search if they are missing.
- 0.1: pnpm is 9.15.9 from `/tmp/dealflow-tools`, the Playwright browsers are in `/tmp/dealflow-pw-browsers` (chromium-1248), and the subagent tool is available in this harness.
- 0.2: the two 6.10 rules are file-level checks beside `page-title` (they need the whole file); a `design-ok` marker opts one out only when it sits within a few lines of the construct. The long-list matcher adds the local names the code actually uses (`codeOptions`, `rateOptions`, `TIMEZONES`, `zoneOptions`) to 6.10's examples, so the rule catches the five current long Selects. Baseline recorded in POLISH.md: 9 violations, `dialog-anatomy` 4, `select-long-list` 5, 12 opt-outs.
- 0.2: the `long list` test opens the quarter-hour booking time picker as its Select (`e2e/polish/routes.ts` LONG_LIST_SELECT): currency and time zone pickers become Comboboxes in Task 1.2, and the 96-entry time picker is the one long list that stays a Select, so it is what proves the new viewport scrolling.
- 0.2: `e2e/16-polish.spec.ts` identifies the dialog header, body and footer through `data-slot="dialog-header|body|footer"`, which Task 1.1 adds to the primitives (6.2 already uses `data-slot="start"` for the footer slot); the gallery captures both themes through the real appearance path, like spec 15.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; commands that load `.env` carry `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` until then.
- TODO(owner): rebuild the live install so it serves Part 12: `docker compose down && pnpm dev:up && pnpm dev` (Part 11's final report carries the same step for its stylesheet).
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
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211; every run is `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` (and `... pnpm exec playwright test ...`). Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312), with `COMPOSE_PARALLEL_LIMIT=1`.
- Docker 24.0.5 is up with 17.6 GB free in the VM (95.0 GB total) as of 2026-10-23 01:38; the dev stack provides Postgres on 5433 and MinIO on 9100/9101 (`pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left" after Task 0.1, record the step SKIPPED and end `COMPLETE WITH OPEN ISSUES` (section 10).
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report
(written in Task 4.5)
