# PROGRESS: dealflow-wd-p9-v1

STATUS: IN PROGRESS
Current: 0.4 · Last updated: 2026-10-21 17:39

## Phase base commits
- Phase 0: 086de8ab14904cc0daee69b2d1fc4d03d48fd3c6

## Tasks
- [x] 0.1 Start Part 9: progress files, kit and baseline
- [x] 0.2 Prove Part 8
- [x] 0.3 Schema, migration and audit redaction
- [ ] 0.4 Pure core (test-first)
- [ ] 0.5 Phase 0 QA gate
- [ ] 1.1 Recurrence service and the completion hook (test-first)
- [ ] 1.2 Call logging (test-first)
- [ ] 1.3 Recurrence field and calendar drag
- [ ] 1.4 Activities list: columns, URL filters, bulk actions
- [ ] 1.5 Phase 1 QA gate
- [ ] 2.1 Duplicate finder (test-first)
- [ ] 2.2 People and organizations bulk actions
- [ ] 2.3 AI filters on people, organizations and leads
- [ ] 2.4 Organization parent-loop guard
- [ ] 2.5 Phase 2 QA gate
- [ ] 3.1 Toaster and undo
- [ ] 3.2 Palette commands
- [ ] 3.3 Shortcut sequences and the help sheet
- [ ] 3.4 Demo seed and docs
- [ ] 3.5 Phase 3 QA gate
- [ ] 4.1 E2E productivity spec and screenshots
- [ ] 4.2 Integration suite and smoke
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (15 warnings) · build ok · unit 5269/5269 in 821 files
- Part 8 proof: integration 2046/2046 (405 files) · e2e 22/22 (specs 00 to 12) · smoke PASS · backup round trip ok (0 deals) · no dealflow-smoke container or volume left

## Decisions
- 0.1: section 4 starting point matches: PROGRESS.md said `dealflow-wd-p8-v1` with `STATUS: COMPLETE WITH OPEN ISSUES`, so section 0 rule 1 starts this run fresh at Task 0.1.
- 0.1: the first Docker-disk check failed section 4's fatal row (254.9 MB free of 58.4 GB), so the run started with `STATUS: BLOCKED` and only the progress-file work was committed. The owner raised the Docker Desktop disk limit; the re-check at 17:24 reports 35.0 GB free of 95.0 GB (61% used) and `docker info` answers with 24.0.5, so the fatal row is cleared and the run resumes at Task 0.1.
- 0.1: the kit arrived untracked as `dealflow-wd-part9-kit/` at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part9-kit` (the Part 2 to 8 layout), added the root `PLAN-PART9.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical, `PLAN_FILE` now `PLAN-PART9.md`).
- 0.1: the last migration is `0090_dealflow_projects_notifications.sql`, so 0091 is the next free number and the planned `0091_dealflow_activity_extras` name holds.
- 0.1: the calendar does not support drag to reschedule: `src/app/(app)/activities/calendar/` (`WeekAgendaGrid.tsx`, `MonthView.tsx`, `CalendarClient.tsx`) has no dnd-kit, draggable or drop handlers, so Task 1.3 adds it per 6.6.
- 0.1: organizations have no parent column. Org-to-org links are `organization_relations` (`source_org_id`, `target_org_id`, free-text `relation_type`) in `src/db/schema/organizationRelations.ts`, written by `src/features/contacts/orgRelations.ts`; self-relation is refused (app check plus DB check) but there is no ancestor/cycle guard, so Task 2.4 adds the recursive CTE guard and `E_ORGREL_001`.
- 0.1: the palette is `src/features/search/ui/CommandPalette.tsx` (installed `cmdk`, opened by `useSearchHotkey.ts` and the `warpdrive:open-search` event in `events.ts`); the shortcut registry is `src/features/shortcuts/` (`GlobalShortcuts.tsx`, `navShortcut.ts`, `shortcutTarget.ts`). Tasks 3.2 and 3.3 extend those files.
- 0.1: merge has no route: `src/features/contacts/MergeDialog.tsx` handles one current record plus a candidate on the detail page, `BulkMergeDialog.tsx` handles two selected records, and `merge.ts` is the service behind the list merge actions. The duplicate finder (Task 2.1) opens `BulkMergeDialog` with both ids preselected.
- 0.1: Part 1's deal AI filter is `src/features/ai/aiFilter.ts` (schema, `describeFilter`) behind `src/features/ai/actions/filterActions.ts` (CSRF, rate limit via `checkAiRateLimit`), so Task 2.3 generalises it by target and keeps the action's checks.
- 0.1: `/tmp/dealflow-tools` holds pnpm 9.15.9 and `/tmp/dealflow-pnpm-store` exists, so no reinstall is needed; the `subagent` tool is available for Task 4.3.
- 0.2: the full integration suite (405 files, 2046 tests) and e2e (22/22, specs 00 to 12) were green on the current tree with no code change; the dev database was up to date (`pnpm db:migrate:dev` printed "migrations applied", 91 migration rows).
- 0.2: the first real smoke run caught a Part 8 restore bug the disk block hid: `restoreBackup` called `pg_restore` without `--dbname`, so pg_restore wrote SQL to stdout instead of connecting (`PGDATABASE` only supplies connection defaults). It now passes `--dbname` with the database name (never the URL) so the password stays in the child env, and the smoke's `run()` appends captured stdout/stderr when a captured step fails, which is how the failure was diagnosed. The round trip compares 0 deals because the smoke seed creates only an admin.
- 0.3: `drizzle/0091_dealflow_activity_extras.sql` creates exactly `activity_recurrence`, `activity_calls` and `duplicate_dismissals` (no other table changed) and is applied to the dev database (92 migration rows). Redaction moved to `src/features/audit/redact.ts`: `recordAudit` runs `redactRecord` before insert and `listAuditEvents` still runs `redact`, so both the writer and rows from older writers are covered; the new integration case stores `password` and a nested `apiKey` as `[redacted]`.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; commands that load `.env` carry `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` until then.
- TODO(owner): rebuild the dev stack so it reads migrations 0089 and 0090 (and 0091 once Part 9 applies it): `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.

## Open issues
- None yet. The Docker-disk blocker was cleared by the owner before the Task 0.1 baseline (35.0 GB free).

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2). Recreate it with `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` if `/tmp` was cleared.
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211. Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312), with `COMPOSE_PARALLEL_LIMIT=1`.
- Docker 24.0.5 is up with 35.0 GB free in the VM (95.0 GB total) as of 2026-10-21 17:24; the dev stack provides Postgres on 5433 and MinIO on 9000/9001 (`pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left" after Task 0.1, record the step SKIPPED and end `COMPLETE WITH OPEN ISSUES` (section 10).
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report
(written in Task 4.5)
