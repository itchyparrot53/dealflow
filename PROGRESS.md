# PROGRESS: dealflow-wd-p4-v1

STATUS: IN PROGRESS
Current: 0.3 · Last updated: 2026-10-20 23:07

## Phase base commits
- Phase 0: e214c9a8e17342315ee36e23e0f65588843c1e58

## Tasks
- [x] 0.1 Start Part 4: progress files, kit and baseline
- [x] 0.2 Documents schema and migration
- [ ] 0.3 Markdown-lite, variables, transitions, numbering (test-first)
- [ ] 0.4 Phase 0 QA gate
- [ ] 1.1 Settings, templates and the capability
- [ ] 1.2 Create, edit, refresh, duplicate, delete (test-first)
- [ ] 1.3 Issue, numbering and void
- [ ] 1.4 Payments and the overdue job
- [ ] 1.5 Sending through the mailbox
- [ ] 1.6 Phase 1 QA gate
- [ ] 2.1 Public reads, accept and decline (test-first)
- [ ] 2.2 Owner notifications
- [ ] 2.3 Phase 2 QA gate
- [ ] 3.1 Settings → Documents
- [ ] 3.2 Deal section, document page, view and public actions
- [ ] 3.3 Documents list and navigation
- [ ] 3.4 Print stylesheet and preview
- [ ] 3.5 Demo seed and docs
- [ ] 3.6 Phase 3 QA gate
- [ ] 4.1 E2E documents spec and screenshots
- [ ] 4.2 Integration suite and smoke
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: typecheck ok · lint ok (14 warnings) · build ok (a first attempt hit the known `ENOTEMPTY` race on `.next`; cleared and retried) · unit 5004/5004

## Decisions
- 0.1: section 4 starting point matches exactly: PROGRESS-P3.md (formerly PROGRESS.md) said `dealflow-wd-p3-v1` with `STATUS: COMPLETE`, and HEAD is `e214c9a8e17342315ee36e23e0f65588843c1e58`, so this run starts fresh at Task 0.1 as section 0 rule 1 expects.
- 0.1: the kit arrived untracked as `dealflow-wd-part4-kit/` at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part4-kit` (matching the Part 1 to 3 layout), added the root `PLAN-PART4.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical; `PLAN_FILE` is now `PLAN-PART4.md`), per section 4's kit row.
- 0.1: no `dealflow-wd-part4-kit.zip` exists in the tree (the kit arrived as a folder), so `.git/info/exclude` needed no new entry; `/dealflow-wd-part2-kit.zip` remains the only zip entry there.
- 0.1: the next free migration number is 0081 (the last file is `0080_dealflow_sales.sql`), so the documents migration keeps the planned name `0081_dealflow_documents`.
- 0.1: there is no auth proxy or middleware allowlist in this codebase. `src/app/(app)/layout.tsx` is the session gate (`createContext` then `redirect("/login")`), and a route is public by living OUTSIDE that route group: `/t/click` sits at `src/app/t/click/[token]/route.ts` with no middleware. Part 4's `/d/[publicId]` and `/api/public/...` are public the same way, so there is no allowlist file to edit.
- 0.1: pg-boss schedules are registered in `src/server/worker.ts` (`registerReleaseCheckJob` from `src/features/release/job.ts`, queue name in `src/constants/jobNames.ts`), so `documents.overdue` will be registered from that worker.
- 0.1: the notifications kind list is the typed `NOTIFICATION_TYPES` tuple in `src/constants/notificationTypes.ts`, so the three document kinds are appended there.
- 0.1: pnpm 9.15.9 (from `/tmp/dealflow-tools`), Node 24.16.0 and Docker 24.0.5 are available; the `subagent` tool is available, so the Task 4.3 review can use it.
- 0.2: the self-referencing `documents.source_quote_id` needs the `AnyPgColumn` return annotation on its `references` thunk; a bare `() => documents.id` makes the table type circular (TS7022/TS2577), so the documented escape is used.
- 0.2: `document_lines` and `document_counters` carry the same positive/bounded checks Part 3's line table has (`quantity > 0`, `item_price >= 0`, percents 0 to 100, `last_number >= 1`) even though 6.4 names checks only for the other tables; a negative quantity or counter is a programmer error that the database now refuses.
- 0.2: `drizzle-kit generate` produced `0081_dealflow_documents.sql` creating exactly the six tables of 6.4 (document_settings, document_templates, document_counters, documents, document_lines, document_payments), and `pnpm db:migrate:dev` applied it to the host dev database; all six tables were confirmed present.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on every command that loads `.env`.
- TODO(owner): rebuild the dev stack so it reads the Part 3 and Part 4 migrations and schema once `0081_dealflow_documents` is applied: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
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
