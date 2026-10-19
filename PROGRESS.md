# PROGRESS: dealflow-wd-p1-v1

STATUS: IN PROGRESS
Current: 3.5 · Last updated: 2026-10-20 01:50

## Phase base commits
- Phase 0: ec6a018085d1f6048e4f7113e40332ca30bc7ff5
- Phase 1: 4644c0b91955cab11565ae97181ce0c4feaeefb4
- Phase 2: b6f0667
- Phase 3: 8d34928f96cad337b54e24529e7b7a6de0d34798

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
- [x] 1.4 Compose without Caddy and reverse-proxy docs
- [x] 1.5 CLAUDE.md fast profile and project notes
- [x] 1.6 Phase 1 QA gate
- [x] 2.1 Auth env, schema and error IDs
- [x] 2.2 System mailer
- [x] 2.3 Local auth services
- [x] 2.4 Auth routes and safe dev-login
- [x] 2.5 Login, magic-link and invite pages
- [x] 2.6 Invite email, profile password and bootstrap link
- [x] 2.7 Phase 2 QA gate
- [x] 3.1 AI env, dependency and schema
- [x] 3.2 Provider layer and JSON helper
- [x] 3.3 Usage, caps and rate limit
- [x] 3.4 AI router, Settings page and model check
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
- Phase 1 gate: commands green · typecheck ok · lint ok · build ok · unit 4902/4902
- Phase 2 gate: commands green · typecheck ok · lint ok · build ok · unit 4919/4919 · localAuth 10/10
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

- AMENDMENT A1: Task 1.4 follows the amendment rather than PLAN-PART1.md 6.11: no `name: dealflow`, `dev:up` drops `-p dealflow`, MinIO images default through `MINIO_IMAGE`/`MC_IMAGE`, `docker-compose.local.yml` is updated in the same task, and `pnpm dev:up` was not run (the owner's `warpdrive-main` stack must not be touched). All three compose combinations validate with `docker compose config --quiet`, none lists caddy, and the base file binds app/ws/MinIO to 127.0.0.1.
- AMENDMENT A5: host-run commands in this and later phases keep the `DATABASE_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` override (Node's `--env-file` never overrides an already-set variable), tests keep `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`, and `pnpm build` keeps `ALLOW_FIRST_LOGIN_ADMIN=false`.
- 1.4: the proxy example keeps every security header and its pinned tests, but its upstreams are now `{$APP_UPSTREAM:localhost:3000}`, `{$WS_UPSTREAM:localhost:8080}` and `{$S3_UPSTREAM:localhost:9000}` so the file works outside compose; `docs/deploy.md` documents the loopback binds as a rate-limit precondition rather than a Caddy-only claim.
- 1.4: `docs/dealflow/UPSTREAM.md` now records the ROADMAP supersession: the dev stack uses the folder's compose project name, and only the smoke test uses `dealflow-smoke`.

- 1.5: CLAUDE.md now describes the fast verification profile and the Dealflow conventions; the test-first section it replaced was already contradicted by PLAN-PART1.md section 0 rule 8, so this removes the contradiction without changing any lint or engineering rule.

- 2.1: Google SSO is now optional (all three `GOOGLE_*` set, or all three empty, enforced by superRefine), and production additionally requires at least one sign-in method; unit tests cover the partial-Google, all-empty, every-method-off and password-only production cases.
- 2.1: the owner's `.env` holds a Google client id and secret but the workspace-domain line was the env-sync placeholder, so after `env:sync -- --migrate` blanked it the file is half-configured. Rule 17 forbids editing `.env`, so this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on the command line for anything that loads `.env` (build, host DB commands, the bootstrap CLI), and the owner decides below whether to finish the Google setup or clear the two values.
- 2.1: `env:sync` appended 26 keys to `.env` (AUTH_*, SMTP_*, MAIL_*, Docker host ports, MinIO images and the probe host defaults), including `APP_PORT=3000`; the owner action below asks for `3001` on this machine.

- 2.2: wrote the system mailer exactly as 6.6, with `captureMailer(dir = env.MAIL_CAPTURE_DIR)` taking an optional directory so the unwritable-directory test does not need to mutate the frozen env object; templates return `MailContent` (the mail without a recipient) because 6.6 gives them only the URL.
- 2.3: argon2 hashing, token mint/peek/consume, credentials, password login with lockout, bootstrap, magic links, invites and session revocation are in place; `localAuth.integration.test.ts` covers all nine required cases (10 tests) against the real Postgres test database and passes.
- 2.3: `mintAuthToken` retires the user's open `invite` tokens only, exactly as 6.5 says; `admin_setup` links are single-use but a new one does not invalidate an older one (the invite page accepts both kinds).

- 2.4: `/auth/start` answers 404 before the rate limiter when Google is unconfigured, and `devLoginCore` now requires development/test, the first-login flag, and a loopback Host header (a missing Host counts as non-loopback); the route passes the Host header through.
- 2.4: added `loginReturnTarget` to `loginReturn.ts` so password, magic-link and invite sign-in default to `/pipeline` while the existing Google flow keeps `/`, both through `safeLoginReturnPath`.
- 2.4: `sessionCookies.ts` is the single place that sets the `wd_sid` + `wd_csrf` cookie pair for the four new routes, so their options cannot drift from the OAuth callback.
- 2.4: the invite route narrows form fields to strings with a helper instead of `String(form.get(...))`, because ESLint's `no-base-to-string` correctly refuses to stringify a possible `File`.

- 2.5: no `Label` primitive existed and no `@radix-ui/react-label` was installed, so the standard shadcn `Label` wrapper (`src/components/ui/Label.tsx`) was added over the new dependency, as Task 2.5 step 5 allows; the login, magic-link and invite cards use `Tabs`, `Input`, `Label`, `Button` from the design system and plain HTML forms only.
- 2.5: the login page renders the card with `w-full max-w-[400px] rounded-lg border bg-background p-6`; the magic-link and invite cards reuse it. `next` is sanitised with `safeLoginReturnPath` on both sign-in pages and every form posts it as a hidden field.

- 2.6: `inviteUserAction` now returns `{ userId, inviteUrl, emailSent }`; it mints an `invite` link, sends `inviteMail` through the system mailer, and reports `emailSent` false in log mode so the form says mail is not set up. The form shows the copyable link under `data-testid="invite-link"` in both states, and the old "no email is sent automatically" notice is gone.
- 2.6: tests updated for the new invite result and copy: `src/app/(app)/settings/users/InviteUserForm.test.tsx` (both mail states, link contents, clipboard) still passes; no assertion was weakened.
- 2.6: `changePasswordAction` verifies the current password only when a hash exists (E_AUTH_013 otherwise), enforces the policy, then revokes every other session while keeping the current one. The profile page passes `hasPassword` from `getCredentials` and mounts the card below the existing profile form.
- 2.6: `pnpm auth:bootstrap-link` ran against the dev database with the A5 overrides and printed an `Admin setup link (valid 24 hours, single use): {BASE_URL}/login/invite?token=...` line; the token itself was never pasted into PROGRESS.md.

- 2.7: gate fixes: biome export order in `src/db/schema/index.ts` (round 1); the two new auth pages had to use the `text-display` type token or `src/typeScale.test.ts` failed, the invite action test needed mocks for the new link/mailer calls, and ESLint rejected an async-without-await log mailer plus an unnecessary cast in `systemMailer.ts` (round 2). No assertion was weakened.
- 2.7: QA focus verified: auth tokens are stored as sha256 base64url only, `consumeAuthToken` is one UPDATE ... RETURNING, the magic-link route always answers `sent=1` and the password route always answers `invalid_credentials`, and `devLoginCore` is unreachable unless development/test, the flag is on, and the Host is loopback.

- 3.1: `openai@7.39.0` added; `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL` and `AI_FAKE` land in the env boundary with the key also in `SECRET_FILE_VARS`, and `.env.example` documents the dated-snapshot form `deepseek/deepseek-v4.1-flash-1017`.
- 3.1: `ai_settings`, `ai_usage`, `ai_conversations`, `ai_messages`, `ai_actions` and `deal_ai_insights` created in migration `0076`, with the singleton settings seed inserted by hand after generation; the migration applied to the dev database.
- 3.1: `pnpm env:sync` appended the four AI keys to `.env` with the key empty, so the app boots with AI unavailable until the owner adds a key.

- 3.2: provider selection is override, then `AI_FAKE` (one warn), then OpenRouter when a key exists, else null; the OpenRouter adapter casts the hand-built message array once at the SDK boundary instead of using `any`.
- 3.2: `chatJson` takes its limit and usage dependencies as a required `deps` argument in this task so the unit tests run without a database; Task 3.3 turns them into defaults, which keeps both commits honest.
- 3.2: `fakeProvider` matches the documented table by joined system text, first match wins, and only emits a tool call while the `/fake-tool` user message is the last one, so the assistant loop terminates after the tool result.

- 3.3: `assertAiAllowed` checks provider, settings, company cap then the optional per-user cap in exactly that order; `chatJson` now uses `assertAiAllowed` and `recordAiUsage` as its default deps, so later features get limits and logging with no extra wiring.
- 3.3: `getUsage` sums prompt + completion tokens since the UTC month start, grouped by feature and by user (inner join on users, so future system rows with a null user do not appear).
- 3.3: per-user request limiter is 20/minute on `Symbol.for("dealflow.aiRateLimiter")`; the integration suite covers the provider-null, disabled, company-cap, per-user-cap, previous-month and aggregation cases (7 tests).

- 3.4: `pnpm ai:check-model` reached the public OpenRouter list: `deepseek/deepseek-v4.1-flash` is `CONFIGURED MODEL LISTED` with `tools=yes` and `response_format=yes` (prompt 0.000000028, completion 0.00000008 per token); the dated snapshot `deepseek/deepseek-v4.1-flash-1017` (0.00000015 / 0.0000006) and the `:batch` variant are also listed. No `--chat` request was made.
- 3.4: `ai.status` maps a scripted test provider to `fake` because the public contract exposes three kinds only; the Settings page is admin-gated with `notFound()` and reads `ai.overview` through `createCaller`, then re-renders with `router.refresh()` after a save.
- 3.4: the OpenRouter request now relies on the SDK accepting our message union directly (no cast) and uses `req.tools !== undefined` / `req.json === true` so the lint rule about nullable booleans is satisfied without changing behaviour.

## Owner actions
- TODO(owner): add `OPENROUTER_API_KEY` to the server `.env`, set `AI_FAKE=false`, then run `pnpm ai:check-model --chat` and try a deal summary, an email draft and the assistant once Phase 4 and 5 land. The AI features stay unavailable until the key is present.
- TODO(owner): `env:sync` appended `APP_PORT=3000` to `.env` in Task 2.1; change it to `APP_PORT=3001` (port 3000 is taken on this machine), then recreate the dev stack with `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d` (no `-v`; the volumes are kept).
- TODO(owner): decide the Google SSO config in `.env`. It currently has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set but `GOOGLE_WORKSPACE_DOMAIN` empty, which the new all-or-nothing rule rejects. Either set `GOOGLE_WORKSPACE_DOMAIN` to the Workspace domain (Google on) or blank the client id and secret (Google off). Until then, anything that loads `.env` needs `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on the command line, as this run does.
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

### Next session at the time of writing
Phase 0 handed over at **Task 1.1**; Phase 1 is now complete (see the Phase 1 hand-off below).

## Phase 2 hand-off (planner summary)

### Commits
- `9fd0756` 2.1, `df02e58` 2.2, `19be649` 2.3, `98c0e77` + `c3ca5e3` 2.4, `61f3b96` 2.5,
  `687cd7f` 2.6, `5d216de` + `f74c7e5` 2.7 fixes, gate commit below. `pnpm check:progress` is green.

### What changed
- **Env, schema, IDs (2.1):** Google is all-or-nothing and optional, production requires one sign-in
  method, `AUTH_*`/`SMTP_*`/`MAIL_*` keys added, error ids `E_AUTH_007..014` and `E_MAIL_001/002`,
  rate limits for password/link/token, `auth_tokens` + `user_credentials` schema and migration `0075`.
- **System mailer (2.2):** SMTP, log and capture modes behind `getSystemMailer()`, cached on
  globalThis; magic-link and invite templates with escaped HTML; capture tests.
- **Auth services (2.3):** argon2id passwords with lockout, hashed single-use tokens (one-statement
  consume), credentials, bootstrap with the shared advisory lock, magic links, invites, session
  revocation. `localAuth.integration.test.ts` covers all nine required cases (10 tests).
- **Routes (2.4):** POST `/auth/password`, `/auth/magic-link`, `/auth/magic/verify`,
  `/auth/invite/accept`; `/auth/start` 404s without Google; dev-login requires dev/test + flag +
  loopback Host.
- **Pages (2.5):** login tabs (password / email link, Google only when configured), magic-link
  confirm card, invite set-password card, all on the design system (standard `Label` wrapper added).
- **Invites, profile password, bootstrap CLI (2.6):** invite emails a set-password link or shows it,
  profile password card changes the password and signs out other sessions, `pnpm auth:bootstrap-link`
  prints an admin setup link.

### Gate evidence
typecheck ok · lint ok · build ok · unit 4919/4919 · localAuth 10/10 · `check:progress` green.

### Carried forward for Phase 3
- `.env` is still half-configured for Google (client id and secret set, domain empty). Anything that
  loads `.env` needs the three `GOOGLE_*=` empty overrides on the command line: `pnpm build`, host
  DB commands, `pnpm auth:bootstrap-link`. The owner action below resolves it.
- The 13 locale/UTC-sensitive tests still need `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
- The dev stack still needs `APP_PORT=3001` before it is recreated.

## Phase 1 hand-off (planner summary)

### Commits
- `655d95d` 1.1 brand copy, `2909ef9` 1.2 package/docs/licence/MCP, `d7b395d` 1.3 defaults,
  `db9ad7e` 1.4 compose/proxy docs, `3c6754e` 1.5 CLAUDE.md, `50cc9d4` 1.6 fixes round 1,
  `4a00bf1` 1.6 gate. Phase 2 starts from `4a00bf1`.
- `pnpm check:progress` reports `12/41 tasks ticked, all with commits`.

### What changed
- **Brand (1.1):** every user-visible string says Dealflow (login and crash titles, connected apps,
  consent heading, email-sync intro, notification subjects and link, lead source-origin sentence,
  video call base now `https://meet.jit.si/dealflow-`). `src/features/branding/brand.test.ts` pins
  `STRINGS.app.name`, the mention email, and that the ten copy files keep the old name only in
  comments or the allowed internal identifiers. Two tests were updated for the new copy (Decision).
- **Package, docs, licence, MCP (1.2):** package name `dealflow`, description, contributors line;
  README rewritten (comparison table dropped, screenshots kept); LICENSE keeps Nikita Sawinyh and
  adds Dealflow contributors; MCP server names are `dealflow`.
- **Defaults (1.3):** `DISABLE_TELEMETRY` and `DISABLE_UPDATE_CHECK` default `true`, `.env.example`
  matches, and the worker no longer creates the release-check queue unless a deploy opts in.
- **Deploy shape (1.4, AMENDMENT A1):** default compose has no proxy service, app/ws/MinIO publish
  on `127.0.0.1` with configurable ports, MinIO images are configurable, `env_file` is
  `$DEALFLOW_ENV_FILE`, `Caddyfile` moved to `docs/reverse-proxy/Caddyfile.example` with upstream
  variables, `docs/reverse-proxy.md` added, `docs/deploy.md` rewritten, `docker-compose.local.yml`
  updated. No compose project name is forced, so the owner's stack is reused.
- **Instructions (1.5):** CLAUDE.md now describes the fast verification profile and Dealflow
  conventions; the test-first section is gone.
- **Gate:** typecheck, lint (one formatting fix round), build and unit all green; unit 4902/4902.

### New owner action
`APP_PORT=3001` in `.env` and a stack recreate (no `-v`), because the base compose now publishes the
app on `127.0.0.1:${APP_PORT:-3000}` and 3000 is taken. Everything else from Phase 0 stands.

### Carried forward
The 13 locale/UTC-sensitive unit tests still need `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`; the
container smoke (Task 6.2, A2) and the subagent review (Task 6.3, A3) carry their amendments.

## Final report
(written in Task 6.5)
