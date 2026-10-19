# PROGRESS: dealflow-wd-p1-v1

STATUS: IN PROGRESS
Current: 1.4 · Last updated: 2026-10-19 22:25

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
- [x] 1.1 Dealflow name in the app
- [x] 1.2 Package, docs, licence and MCP names
- [x] 1.3 Telemetry and update check off by default
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
- Phase 0, no independent review by design (fast profile, section 0 rule 9.4).

## Decisions
- 0.1: chose tag v1.2.0 over upstream/main because the section 4 probe tied exactly (`upstream/main` points at the same commit as `v1.2.0`) and the tag matches `package.json` version 1.2.0.
- 0.1: kept the kit where it arrived (`PLAN AND EXECUTE/dealflow-wd-part1-kit`) instead of moving it to the folder root, and added a root `PLAN-PART1.md` symlink plus a byte-identical copy of the kit's `scripts/check-progress.mjs` at the path contract 6.1 names, because the kit lives in a subfolder here while the plan assumes the root.
- 0.1: excluded the nested kit folder from the snapshot commit (the plan's exclusion pathspecs only match root kit paths), so the snapshot is greenfield warpdrive code and the kit arrives in the 0.1 commit, as section 0 intends.
- 0.1: excluded a stray `DEALFLOW/` folder that sits in this workspace from the repository via `.git/info/exclude` because it is not part of the warpdrive export (it holds copies of old Dealflow kits) and is not ours to add.
- 0.1: ran pnpm 9.15.9 from `/tmp/dealflow-tools/node_modules/.bin` because `corepack enable pnpm` and `npm install -g pnpm@9.15.9` both fail with EPERM outside this folder under the harness file sandbox; every pnpm command in this run prefixes that PATH.
- 0.1: did not run the section 4 harness check (`./qa.sh "Reply exactly: QA READY"`) in this phase because the harness is only used in Task 6.3; it is recorded there with the section 4 fallback.
- 0.2: reused the already-running dev stack (compose project `warpdrive-main`, started from the repo's `docker-compose.local.yml` before this run) instead of creating the `dealflow` project: its containers hold 5433/9000/9001, quay.io MinIO pulls are unauthorized on this machine and rule 14 forbids touching containers this run did not create; the received `.env` already targets that stack.
- 0.2: host-side DB commands pass `DATABASE_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` on the command line because the received `.env` uses the compose host name `postgres`, which does not resolve on the host, and rule 17 forbids editing `.env`.
- 0.2: `pnpm env:sync` appended 0 keys because `.env` already carries every key `.env.example` declares.
- 0.3: deleted `deployWorkflow.test.ts`, trimmed `Dockerfile.test.ts` and recreated the missing `scripts/auditConfig.ts`, because the OSS export dropped `.github/workflows/deploy.yml`, which both tests read.
- 0.3: typed `auditConfig.SavedFilterRow.targetEntity` as `string` and narrowed it against `SAVED_FILTER_TARGET_ENTITIES`, because `SavedFilterSeed.target` is `string` and the plan's stricter signature failed the existing test's typecheck.
- 0.3: excluded a stray `DEALFLOW/` copy of the old app (with its own node_modules) from tsc, Biome, ESLint and vitest classification, because it sits inside this workspace and its foreign tests, React types and lint findings broke typecheck, lint and test collection.
- 0.4: ran verification with `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` because 13 untouched unit tests assert en-US formatting and UTC dates; under the machine default (Europe/London, en-GB) they fail by locale only, so the environment is set instead of editing tests (recorded in `docs/dealflow/HEALTH-CHECK.md`).
- 0.4: built with `ALLOW_FIRST_LOGIN_ADMIN=false` in the shell because `next build` runs `NODE_ENV=production` while the received `.env` keeps the dev value `true`, and rule 17 forbids editing `.env`.
- 0.4: seeded demo data into a fresh scratch database `warpdrive_baseline` in the dev Postgres because the pre-existing dev database holds leftover non-demo rows that abort `pnpm db:seed:demo` (`activities_deal_id_deals_id_fk`) and `DROP DATABASE warpdrive` is a guard hard limit.
- 0.5: moved the ws startup into an async `main()` in `src/entrypoints/ws.ts`, because tsx compiles a `.ts` file in a CommonJS package as CJS and the top-level await failed the e2e harness; the 6.14 spawn command is unchanged.
- 0.5: installed Chromium with `PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` because the default browser cache lives outside the harness file sandbox; every `pnpm e2e` run exports that path.
- 0.5: recorded `/pipeline` as 307 to `/pipeline/{id}` then 200: the spec asserts status below 400 and no `/login` redirect, exactly as 6.12 asks.
- 0.6: the probe prints its summary with `console.warn` (not `console.log`) because the repo's ESLint `no-console` rule allows only warn/error in `scripts/**/*.ts`.
- 0.6: the first live probe run (owner credentials, sent to an external `MAIL_PROBE_TO`) exposed a script bug: nodemailer generates `info.messageId` for raw sends instead of reporting the Message-ID header that reached the wire, so the Sent/APPEND/MOVE searches looked for an id that never existed. The probe now searches its own header id and polls after APPEND.
- 0.6: the probe verifies the Sent folder with `STATUS` counts and the APPEND response instead of SEARCH, because a live run proved Purelymail's search index lags APPEND by more than five seconds and a search-based verdict reported a false failure. The committed result is `status: ok`.
- 0.6: owner-driven changes made during the probe: the probe was re-run self-addressed (no `MAIL_PROBE_TO`) and the result committed, and `docs/dealflow/HEALTH-CHECK.md` was updated with the real host facts.
- 0.7: fixed three lint blockers the baseline exposed (DatePicker unused-variable error, Biome format of the generated probe JSON, ESLint default-project cap for the new `.mjs` tooling) instead of logging them as pre-existing, because a red `pnpm lint` fails the gate and none of the three changes behaviour.

- 1.1: updated the two tests that asserted the old visible text: `src/features/release/ui/VersionBanner.test.tsx` (new copy "A new upstream release ({latest}) is available") and `src/features/enrichment/prospects/ProspectResultRow.test.tsx` ("Already in Dealflow"). No assertion was weakened; only the expected copy changed.
- 1.1: also renamed the user-visible crash-adjacent copy in `src/features/email/composer/sendFailure.ts` ("Dealflow was updated while this page was open"), which the task's file list does not name but the step 4 grep requires, because it is a visible string rather than an allowed internal identifier.
- 1.1: left `src/features/mcp/server.ts`, `src/app/api/mcp/route.ts` and every internal identifier (storage keys, event names, `Symbol.for` keys, `RELEASE_REPO`, `warpdrive.invalid`, `DOCS_SITE_URL`, the MinIO bucket default) on the old name; the two MCP names are renamed by Task 1.2.

- 1.2: no MCP test asserted the old server name, so the rename touched only `src/features/mcp/server.ts` and `src/app/api/mcp/route.ts`; README was rewritten for Dealflow (comparison table dropped, screenshots kept with Dealflow alt text), `docs/mcp-server.md` renamed, and the MIT notice keeps Nikita Sawinyh's line above the new Dealflow contributors line.

- 1.3: updated the tests that assumed opt-out defaults: `src/config/env.test.ts` now expects `DISABLE_TELEMETRY`/`DISABLE_UPDATE_CHECK` true by default and gains an explicit opt-in case, and `src/server/worker.test.ts` no longer expects the release-check queue when the flag is unset (its opt-in path stays covered by `src/features/release/job.test.ts`).

## Owner actions
- TODO(owner): install pnpm 9.15.9 on the PATH (`corepack enable pnpm` or `npm install -g pnpm@9.15.9`); this run used a temporary copy in `/tmp/dealflow-tools` because the harness sandbox blocks writes outside the project folder. Not blocking: every command in this run worked through that copy.
- TODO(owner, optional): delete the probe artifacts in the Purelymail mailbox (`Dealflow mail probe ...` messages in `\Sent` and `\Trash`, plus one `append diagnostic` message from the APPEND check). They contain no secrets.
- Done by owner in Phase 0: `MAIL_PROBE_USER` and `MAIL_PROBE_PASS` are in `.env` and the probe has run successfully. No action left for mail until Part 2.

## Open issues
- PRE-EXISTING: `src/features/email/inboxDate.test.ts` (4 tests), `src/features/stats/ui/trendTooltip.test.ts` (3), `src/features/stats/ui/widgets.test.tsx` (2), `src/features/stats/ui/TrendWidget.test.tsx` (1), `src/features/deals/DealList.test.tsx` (1), `src/features/email/ThreadRow.test.tsx` (1), `src/features/activities/AddActivityModal.test.tsx` (1): locale/UTC-sensitive assertions in the untouched export; they pass with `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` (see `docs/dealflow/HEALTH-CHECK.md`). Not fixed on purpose: the plan forbids editing tests for pre-existing failures.
- Environmental, not fixed: the dev compose project `dealflow` cannot start while the owner's `warpdrive-main` stack holds ports 5433/9000/9001, and quay.io MinIO images are unauthorized here (`docker-compose.local.yml` uses `pgsty/*` mirrors). Task 1.4 must re-run `pnpm dev:up` against the updated compose files; if the ports are still held, use `DEV_PG_PORT`/`MINIO_PORT`/`MINIO_CONSOLE_PORT` and log it.

## Phase 0 hand-off (planner summary)

### Commits
- `ec6a018` snapshot of the received warpdrive export (base: tag `v1.2.0`, `upstream` = `https://github.com/sneg55/warpdrive.git`)
- `5e4fb9d` 0.1, `5a1c5a1` 0.2, `98a168c` 0.3, `c1db59f` 0.4, `a68828b` 0.5, `6e542cd` + `ec5dc99` + `39db424` + `2ec9840` 0.6, `4644c0b` 0.7
- Phase 1 starts from `4644c0b`; `pnpm check:progress` reports `PROGRESS CHECK OK: 7/41 tasks ticked, all with commits`.

### Baseline of the untouched app (`docs/dealflow/HEALTH-CHECK.md`)
| Step | Result | Count | Duration |
|---|---|---|---|
| `pnpm install --frozen-lockfile` | pass | 1,398 packages | 27s |
| `pnpm typecheck` | pass | 0 errors | 16s |
| `pnpm lint` | pass after environment fixes | Biome 2,672 files / 12 warnings, ESLint 0 | 54s |
| `pnpm test:unit` (TZ=UTC, en-US) | pass | 4,889 tests / 783 files | 100s |
| `pnpm test:integration` | pass | 1,758 tests / 381 files | 204s |
| `pnpm build` (`ALLOW_FIRST_LOGIN_ADMIN=false`) | pass | all routes | 38 to 58s |
| `pnpm db:seed:demo` (fresh DB) | pass | 50 orgs, 100 people, 50 deals, 411 activities | 16s |
| `pnpm e2e` (`00-health`) | pass | 9/9 pages, 9 screenshots | 51s |

Pre-existing failures: only the 13 locale/UTC-sensitive unit tests above, unchanged and listed in Open issues.

### Real mail host facts (`docs/dealflow/mail-probe-result.json`, `status: ok`)
This is the Part 2 input the plan asked for:
- SMTP send works: `250 2.6.0 Message received`.
- IMAP IDLE works, but push latency measured 8.3s and 11.1s. Do not assume sub-second delivery.
- The host does **not** auto-save SMTP-sent messages into `\Sent` (`autoSaved: false` twice). The app must `APPEND`.
- `APPEND` works and returns a uid; `MOVE` INBOX to `\Trash` works.
- The IMAP SEARCH index lags APPEND by more than five seconds. Verify appends with a `STATUS` count or the APPEND uid, never an immediate SEARCH.
- Capabilities: `IMAP4rev1 IDLE QRESYNC CONDSTORE MOVE UIDPLUS ESEARCH SORT ESORT SEARCHRES NAMESPACE CHILDREN COMPRESS=DEFLATE LITERAL+ SASL-IR ENABLE WITHIN AUTH=PLAIN I18NLEVEL=1 RIGHTS= ANNOTATION`; QRESYNC and CONDSTORE enabled on the session.
- Special-use folders present: `INBOX`, `Sent`, `Drafts`, `Archive`, `Junk`, `Trash`. Empty mailboxes report `HIGHESTMODSEQ 0`, `UIDNEXT 1`.

### Environment quirks the next session must reuse
These are not in the plan and were all needed to get Phase 0 green:
- pnpm 9.15.9 lives at `/tmp/dealflow-tools/node_modules/.bin`. Prefix every command:
  `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH` and `export npm_config_store_dir=/tmp/dealflow-pnpm-store`.
  If `/tmp` was wiped: `npm_config_cache=/tmp/npm-cache npm install --prefix /tmp/dealflow-tools --no-save pnpm@9.15.9`.
- Tests: `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`.
- Host-side DB commands: `DATABASE_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` (the dev stack is the owner's already-running `warpdrive-main` compose project).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers`; `pnpm e2e` builds and starts its own server, recreates `dealflow_e2e`, and writes `.e2e/`; screenshots land in `e2e/screenshots/` (git-ignored).
- Port 3000 is held by an unrelated container, so `docker-compose.local.yml` publishes the app on 3001; do not start a competing `dealflow` project while that stack runs.

### Deviations from the plan's assumptions
- The kit arrived nested in `PLAN AND EXECUTE/dealflow-wd-part1-kit`, not at the folder root (handled with the symlink and the copied `check-progress.mjs`).
- pnpm 9 was not on PATH and could not be installed globally (sandbox EPERM).
- quay.io MinIO images are unavailable here; the export ships `docker-compose.local.yml` with `pgsty/*` mirrors and port 3001 for the app.
- The received `.env` targets the container network (`postgres:5432`), so host-run scripts need the `DATABASE_URL` override.
- The machine defaults to en-GB/Europe-London, which the untouched test suite does not tolerate.
- `src/entrypoints/ws.ts` needed a `main()` wrapper for tsx (CommonJS package).
- A stray `DEALFLOW/` copy of the old app sits in this workspace; it is ignored by git and by every toolchain.

### Next session
Start at **Task 1.1** (`Dealflow name in the app`). Phase 1 base commit is `4644c0b`. Nothing in Phase 0 is blocking; the only outstanding owner action is the optional global pnpm install.

## Final report
(written in Task 6.5)
