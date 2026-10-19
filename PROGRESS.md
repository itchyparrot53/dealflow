# PROGRESS: dealflow-wd-p1-v1

STATUS: IN PROGRESS
Current: 1.1 · Last updated: 2026-10-19 21:40

## Phase base commits
- Phase 0: ec6a018085d1f6048e4f7113e40332ca30bc7ff5
- Phase 1: 4644c0b91955cab11565ae97181ce0c4feaeefb4

## Tasks
- [x] 0.1 Repository, upstream remote and kit
- [x] 0.2 Toolchain, install and dev services
- [x] 0.3 Baseline fixes from the OSS export
- [x] 0.4 Baseline run and health report
- [x] 0.5 E2E harness and health click-through
- [x] 0.6 Purelymail probe
- [x] 0.7 Phase 0 QA gate
- [ ] 1.1 Dealflow name in the app
- [ ] 1.2 Package, docs, licence and MCP names
- [ ] 1.3 Telemetry and update check off by default
- [ ] 1.4 Compose without Caddy and reverse-proxy docs
- [ ] 1.5 CLAUDE.md fast profile and project notes
- [ ] 1.6 Phase 1 QA gate
- [ ] 2.1 Auth env, schema and error IDs
- [ ] 2.2 System mailer
- [ ] 2.3 Local auth services
- [ ] 2.4 Auth routes and safe dev-login
- [ ] 2.5 Login, magic-link and invite pages
- [ ] 2.6 Invite email, profile password and bootstrap link
- [ ] 2.7 Phase 2 QA gate
- [ ] 3.1 AI env, dependency and schema
- [ ] 3.2 Provider layer and JSON helper
- [ ] 3.3 Usage, caps and rate limit
- [ ] 3.4 AI router, Settings page and model check
- [ ] 3.5 Phase 3 QA gate
- [ ] 4.1 Deal context, summary and score
- [ ] 4.2 Deal AI card
- [ ] 4.3 Email draft in the composer
- [ ] 4.4 Notes to activities
- [ ] 4.5 Describe a filter
- [ ] 4.6 Phase 4 QA gate
- [ ] 5.1 Tool catalogue from the MCP registry
- [ ] 5.2 Assistant loop and pending actions
- [ ] 5.3 Assistant actions and reads
- [ ] 5.4 Assistant drawer
- [ ] 5.5 Phase 5 QA gate
- [ ] 6.1 E2E specs and screenshot gallery
- [ ] 6.2 Integration suite and container smoke
- [ ] 6.3 Independent review and hardening
- [ ] 6.4 Final checklist
- [ ] 6.5 Final report and completion

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 4889/4889

## Decisions
- 0.6: the probe prints its summary with `console.warn` (not `console.log`) because the repo's ESLint `no-console` rule allows only warn/error in `scripts/**/*.ts`.

- 0.1: chose tag v1.2.0 over upstream/main because the step 3 probe tied exactly (upstream/main points at the same commit as v1.2.0) and the tag matches package.json version 1.2.0.
- 0.1: kept the kit where it arrived (`PLAN AND EXECUTE/dealflow-wd-part1-kit`) instead of moving it to the folder root, and added a root `PLAN-PART1.md` symlink plus a byte-identical copy of the kit's `scripts/check-progress.mjs` at the path contract 6.1 names, because the kit lives in a subfolder here while the plan assumes the root.
- 0.1: excluded the snapshot commit from the nested kit folder (the plan's exclusion pathspecs only match root kit paths) so the snapshot is greenfield warpdrive code and the kit arrives in the 0.1 commit, as section 0 intends.
- 0.1: excluded a stray `DEALFLOW/` folder that appeared in this workspace from the repository via `.git/info/exclude` because it is not part of the warpdrive export (it holds copies of old Dealflow kits) and is not ours to add.
- 0.1: ran pnpm 9.15.9 from `/tmp/dealflow-tools/node_modules/.bin` because `corepack enable pnpm` and `npm install -g pnpm@9.15.9` both fail with EPERM outside this folder under the harness file sandbox; every pnpm command in this run prefixes that PATH.
- 0.1: did not run the section 4 harness check (`./qa.sh "Reply exactly: QA READY"`) in this phase because the harness is only used in Task 6.3; it is recorded there with the section 4 fallback.

- 0.2: reused the already-running dev stack (compose project `warpdrive-main`, started from the repo's `docker-compose.local.yml` before this run) instead of creating the `dealflow` project: its containers hold 5433/9000/9001, quay.io MinIO pulls are unauthorized on this machine and rule 14 forbids touching containers this run did not create; the received `.env` already targets that stack.
- 0.2: host-side DB commands pass `DATABASE_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` on the command line because the received `.env` uses the compose host name `postgres`, which does not resolve on the host, and rule 17 forbids editing `.env`.
- 0.2: `pnpm env:sync` appended 0 keys because `.env` already carries every key `.env.example` declares.

- 0.3: deleted `deployWorkflow.test.ts`, trimmed `Dockerfile.test.ts` and recreated the missing `scripts/auditConfig.ts`, because the OSS export dropped `.github/workflows/deploy.yml`, which both tests read.
- 0.3: typed `auditConfig.SavedFilterRow.targetEntity` as `string` and narrowed it against `SAVED_FILTER_TARGET_ENTITIES`, because `SavedFilterSeed.target` is `string` and the plan's stricter signature failed the existing test's typecheck.
- 0.3: excluded a stray `DEALFLOW/` copy of the old app (with its own node_modules) from tsc, Biome, ESLint and vitest classification, because it sits inside this workspace and its foreign tests, React types and lint findings broke typecheck, lint and test collection.

- 0.4: ran verification with `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` because 13 untouched unit tests assert en-US formatting and UTC dates; under the machine default (Europe/London, en-GB) they fail by locale only, so the environment is set instead of editing tests (recorded in docs/dealflow/HEALTH-CHECK.md).
- 0.4: built with `ALLOW_FIRST_LOGIN_ADMIN=false` in the shell because next build runs NODE_ENV=production while the received `.env` keeps the dev value `true`, and rule 17 forbids editing `.env`.
- 0.4: seeded demo data into a fresh scratch database `warpdrive_baseline` in the dev Postgres because the pre-existing dev database holds leftover non-demo rows that abort `pnpm db:seed:demo` (`activities_deal_id_deals_id_fk`) and `DROP DATABASE warpdrive` is a guard hard limit.

- 0.5: moved the ws startup into an async `main()` in `src/entrypoints/ws.ts`, because tsx compiles a `.ts` file in a CommonJS package as CJS and the top-level await failed the e2e harness; the 6.14 spawn command is unchanged.
- 0.5: installed Chromium with `PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` because the default browser cache lives outside the harness file sandbox; every `pnpm e2e` run exports that path.
- 0.5: recorded `/pipeline` as 307 to `/pipeline/{id}` then 200: the spec asserts status below 400 and no `/login` redirect, exactly as 6.12 asks.

- 0.7: fixed three lint blockers the baseline exposed (DatePicker unused-variable error, Biome format of the generated probe JSON, ESLint default-project cap for the new `.mjs` tooling) instead of logging them as pre-existing, because a red `pnpm lint` fails the gate and none of the three changes behaviour.

- 0.6: the real probe run sent to an external `MAIL_PROBE_TO` and also exposed a script bug: nodemailer generates `info.messageId` for raw sends instead of reporting the Message-ID header that reached the wire, so the Sent/APPEND/MOVE searches looked for an id that never existed. The probe now searches its own header id and polls after APPEND (owner-driven fix, same task).

## Owner actions
- TODO(owner): put MAIL_PROBE_USER and MAIL_PROBE_PASS (a Purelymail test mailbox and its app password) in .env, run `pnpm mail:probe` and commit `docs/dealflow/mail-probe-result.json`; the probe currently records `skipped`.
- TODO(owner): install pnpm 9.15.9 on the PATH (`corepack enable pnpm` or `npm install -g pnpm@9.15.9`); this run used a temporary copy in /tmp because the harness sandbox blocks writes outside the project folder.

## Open issues
- PRE-EXISTING: `src/features/email/inboxDate.test.ts` (4 tests), `src/features/stats/ui/trendTooltip.test.ts` (3), `src/features/stats/ui/widgets.test.tsx` (2), `src/features/stats/ui/TrendWidget.test.tsx` (1), `src/features/deals/DealList.test.tsx` (1), `src/features/email/ThreadRow.test.tsx` (1), `src/features/activities/AddActivityModal.test.tsx` (1): locale/UTC-sensitive assertions in the untouched export; they pass with `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` (see docs/dealflow/HEALTH-CHECK.md).

## Final report
(written in Task 6.5)
