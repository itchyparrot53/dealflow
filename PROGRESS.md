# PROGRESS: dealflow-wd-p2-v1

STATUS: IN PROGRESS
Current: 0.6 · Last updated: 2026-10-20 02:50

## Phase base commits
- Phase 0: 64363ce446a92308919921e7bcaa77ddf6ba2844

## Tasks
- [x] 0.1 Start Part 2: progress files, kit and baseline
- [x] 0.2 Independent audit of Part 1
- [x] 0.3 Assistant confirm race and AI timeouts
- [x] 0.4 Password reset after email-link sign-in and atomic lockout
- [x] 0.5 Scripts, release tests and audit leftovers
- [ ] 0.6 Phase 0 QA gate
- [ ] 1.1 Rename the Gmail columns
- [ ] 1.2 Mail tables
- [ ] 1.3 MailProvider interface and Gmail adapter
- [ ] 1.4 Send path on MailProvider
- [ ] 1.5 Sync, attachments and trash on MailProvider; neutral inbound store
- [ ] 1.6 Message-ID domain and notification emails via the system mailer
- [ ] 1.7 Phase 1 QA gate
- [ ] 2.1 Parser, Message-IDs, subjects and Bcc stripping
- [ ] 2.2 Transport interfaces and real transports
- [ ] 2.3 Filesystem fake transport
- [ ] 2.4 Credentials and the connect service
- [ ] 2.5 Email sync settings: connect form and Gmail option
- [ ] 2.6 Phase 2 QA gate
- [ ] 3.1 Folders, cursors and locations
- [ ] 3.2 Inbound apply and threading
- [ ] 3.3 Incremental sync and UIDVALIDITY reset
- [ ] 3.4 Initial window and background backfill
- [ ] 3.5 IDLE manager and sync cadence
- [ ] 3.6 Sync integration tests
- [ ] 3.7 Phase 3 QA gate
- [ ] 4.1 SMTP send and the Sent APPEND
- [ ] 4.2 Reply headers, thread ids and reconcile for IMAP
- [ ] 4.3 Send throttle
- [ ] 4.4 Attachments on demand and trash MOVE
- [ ] 4.5 Send integration tests
- [ ] 4.6 Phase 4 QA gate
- [ ] 5.1 E2E mail spec and screenshots
- [ ] 5.2 Live Purelymail check
- [ ] 5.3 Integration suite, smoke and docs
- [ ] 5.4 Independent review and hardening
- [ ] 5.5 Final checklist
- [ ] 5.6 Final report and completion

## QA log
- Audit P1: subagent (fresh context) · QA RESULT PASS · 0/0/0
- Baseline: typecheck ok · lint ok · build ok (a first attempt hit an `ENOTEMPTY` race on `.next`; the retry after the tree settled passed) · unit 4945/4945 · integration 1788/1790 (the 2 `src/features/release/router.test.ts` failures are R4, fixed in Task 0.5)

## Decisions
- 0.1: moved the kit from the root folder to `PLAN AND EXECUTE/dealflow-wd-part2-kit` and committed it there, matching Part 1's layout, because section 4 allows a subfolder and the root already carries the Part 1 symlink; added the root `PLAN-PART2.md` symlink and copied the kit's `scripts/check-progress.mjs` (byte-identical) over the Part 1 copy at the path contract 6.2 names.
- 0.1: added the arriving `dealflow-wd-part2-kit.zip` to `.git/info/exclude` (local only) instead of committing or deleting it, because it is the transport container, not source.
- 0.1: ran the unit and integration baselines WITHOUT the `GOOGLE_*=` overrides, because `vitest.setup.ts` supplies its own Google test values and shell overrides shadow them (4 tests failed that way); only commands that load `.env` itself (`pnpm build`, `db:migrate:dev`) take the overrides.
- CONTRACT CHANGE: 0.5 keeps Part 1's AMENDMENT A1 on `docker-compose.yml` (no `name: dealflow`): adding it now would rename the compose project and orphan the owner's running `warpdrive-main` volumes, so the dev stack keeps the folder-derived project name while the smoke test keeps its dedicated `dealflow-smoke` project. Audit finding A1.
- 0.5: scripts follow 6.2 (`test:unit` and `test:integration` bake the UTC/en-US environment, `build` sets `ALLOW_FIRST_LOGIN_ADMIN=false`, `mail:live-check` is added now and its script file arrives in Task 5.2).
- 0.5: R4 updated `release/router.test.ts` to the new default (`disabled: true`) and moved the cached-release assertions onto `computeStatus(..., false)` so the enabled path is still covered with every original assertion.
- 0.5: A2 extended `docs/dealflow/UPSTREAM.md`; A3 (226-line AssistantSheet) and A4 (paid-check process note) are ACCEPTED with reasons; R6 stays DEFERRED to Task 1.6; AUDIT-P1.md has no finding left without a status.
- 0.4: extracted the password change into `src/features/auth/passwordChange.ts`, not `passwordActions.ts`, because a `"use server"` module may export only server actions and the integration test must call the logic directly; the action keeps CSRF, the session and the Zod parse.
- 0.4: `PasswordCard` takes both `hasPassword` and `requiresCurrent` instead of the single `requiresCurrent` the plan names, so the "you signed in with an email link" note cannot appear for an account that has no password yet; the field is hidden whenever `requiresCurrent` is false, as specified.
- 0.4: the 15-minute link window is a SQL `now() - interval '15 minutes'` comparison on `session_auth_events.authenticated_at`; migration `0077_dealflow_session_auth` creates the table (next free number after 0076) and is applied to the dev database.
- 0.4: verified both new tests fail against the old code before committing: the lockout test leaves `locked_until` null, and the magic-link reset returns `E_AUTH_013`.
- 0.3: the R1 test warms two pool connections before the concurrent confirms, because with a cold pool the first confirm finishes before the second one's connection is established and the race never happens; with warm connections the old code produced two ok results and two notes, and the claim-first code leaves exactly one of each.
- 0.3: `confirmAiAction` claims with one `UPDATE ... WHERE status='pending' RETURNING *` and writes the result in a second update; a failed write downgrades the claimed row to `failed` (E_AI_010 stays in the tool result), and `rejectAiAction` uses the same claim.
- 0.3: the assistant actions already had a 90 s budget, so R2 only touched the five `chatJson` actions plus the OpenRouter client (`timeout: 55_000, maxRetries: 1`); the tRPC reads keep `SIG()` because they are database-only.
- 0.2: the fresh-context audit passed with 0 blockers, 0 majors and 0 minors; its four non-blocking observations are A1 to A4 in AUDIT-P1.md. A1 (compose `name`) stays as Part 1's AMENDMENT A1 and becomes a `CONTRACT CHANGE:` decision in 0.5; A2 (UPSTREAM list) is fixed in 0.5; A3 (226-line sheet) is a style deviation, accepted unless 0.5 touches the file; A4 is a process note with no code change.
- 0.2: R7 is the finding that Part 1's review fell back to a self-review; this audit satisfies it, and the row is closed in 0.5 with the other findings.
- 0.1: added `mailparser@3.10.0` and `@types/mailparser@3.9.0` with pnpm 9.15.9 from `/tmp/dealflow-tools`; the peer-dependency warning about `eslint-plugin-import` needing eslint <= 9 predates this task and changes nothing.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on every command that loads `.env`.
- TODO(owner): the running dev stack (`warpdrive-main`) still serves the Part 1 build and the Part 1 column names. Rebuild it after Phase 1 lands: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2).
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before tests (13 upstream tests assume UTC and en-US).
- Commands that load `.env` need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config.
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host database commands: `DATABASE_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers`; ports 3210/3211.
- Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (the sandbox blocks buildx refs under `~/.docker/buildx`); ports 3310/3311/3312.
- Docker 24.0.5 is up; the owner's `warpdrive-main` stack holds 5433/9000/9001.

## Final report
(written in Task 5.6)
