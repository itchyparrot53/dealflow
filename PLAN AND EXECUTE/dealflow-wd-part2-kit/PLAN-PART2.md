# PLAN: Dealflow on warpdrive, Part 2: Mail provider and IMAP/SMTP

> Plan ID: dealflow-wd-p2-v1 · Written: 2026-10-20 · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 5, fast verification profile, no human in the loop · Type: change to existing project

Part 1 (`PLAN-PART1.md`, plan ID `dealflow-wd-p1-v1`, finished 2026-10-20 at commit `64363ce`) turned warpdrive into Dealflow: product name, compose without Caddy, telemetry and update check off, email + password and magic-link sign-in, invites, a system mailer, and the AI layer with an assistant. At the end of Part 1 there were 4,945 unit tests, 1,790 integration tests and e2e specs `00` to `05`, all passing (two release tests excepted, see 6.1). Part 2 first fixes what the planner's review of Part 1 found. It then replaces warpdrive's Gmail-only `GmailClient` with a provider-neutral `MailProvider` layer, renames the Gmail-specific columns, and adds an IMAP/SMTP provider (the default, built for Purelymail) with its own threading, folder cursors, IDLE, a 90-day initial sync plus background backfill, a Sent-folder APPEND, a send throttle and a fake transport for tests and e2e. Gmail stays as an optional provider with unchanged behaviour. `ROADMAP.md` has the full picture; `docs/dealflow/mail-probe-result.json` and `docs/dealflow/HEALTH-CHECK.md` hold the facts about our mail host.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 5** in fresh-context sessions, one phase per session. Part 1 (`PLAN-PART1.md`) is finished; its code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, live Purelymail check, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART2.md` in full, the sections of `PLAN-PART1.md` it points to, and PROGRESS.md. If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p2-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 1's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 5.6, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 0.1 and Task 5.3.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.6, 1.7, 2.6, 3.7, 4.6):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). Independent reviews happen in Task 0.2 (audit of Part 1) and Task 5.4 (review of Part 2).
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (the column rename, the provider refactor), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs, the public OpenRouter model list, and `pnpm mail:live-check` (Task 5.2), which uses the owner's Purelymail test mailbox from `MAIL_PROBE_USER`/`MAIL_PROBE_PASS` in `.env` and only sends mail from that mailbox to itself.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove or recreate the owner's running Compose project `warpdrive-main`, never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack 3001/5433/8080/9000/9001 (owner's). Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 1's file to `PROGRESS-P1.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p2-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 2: progress files, kit and baseline
(every task through 5.6, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 4950/4950 · aiAuthFixes 6/6

## Decisions
- 0.3: chose … over … because …

## Owner actions
- TODO(owner): …

## Open issues
- None

## Environment
(copy the section 4 "Known environment" commands that this machine needs, and keep them current)

## Final report
(written in Task 5.6)
```

## 1. Goal

Make email work with any IMAP/SMTP mailbox, starting with our Purelymail accounts, without losing warpdrive's Gmail support. Inbound mail syncs into the same threads, inbox and record timelines as before. Replies thread correctly. Sent mail lands in the mailbox's Sent folder. Users connect their own mailbox with an app password in Settings. Along the way, close the security and reliability gaps the review of Part 1 found.

## 2. Definition of done

1. `AUDIT-P1.md` lists every finding of an independent audit of Part 1 plus the planner's findings R1 to R6 (6.1). Every blocker and major is FIXED with a named test, or ACCEPTED with a reason.
2. Confirming an assistant action twice at the same time runs its write once. AI record actions allow 60 seconds for the provider. A user signed in by an email link can set a new password without the current one for 15 minutes. Concurrent wrong passwords still lock the account at 10.
3. The Gmail-specific columns are renamed to `provider_thread_id`, `provider_message_id`, `provider_attachment_id` and `sync_cursor` by one migration. No `gmail_*_id` or `last_history_id` remains in `src/` or `scripts/` outside the Gmail adapter's own API types.
4. Every send, sync, attachment, reconcile and trash path goes through `MailProvider`. The Gmail adapter keeps today's behaviour, proved by the existing (renamed) email tests.
5. Message-IDs use the sending mailbox's domain. Notification emails go through the system mailer (SMTP), not a user's mailbox.
6. A user connects an IMAP/SMTP mailbox in Settings → Email sync with an app password (Purelymail preset or custom servers). The credentials are tested before saving and stored encrypted. Gmail remains available when Google is configured.
7. IMAP sync covers INBOX, Sent, Archive, Junk and Trash, with per-folder cursors (UIDVALIDITY, last UID, HIGHESTMODSEQ, where 0 means unknown). It starts with the last 90 days, backfills older mail in the background up to 365 days, and resets cleanly on a UIDVALIDITY change.
8. Threads are built from Message-ID / In-Reply-To / References, with a normalised-subject + participant fallback within 30 days. A message seen in several folders is stored once. A thread whose messages all sit in Trash or Junk is marked trashed.
9. The worker keeps one IDLE connection per IMAP mailbox and enqueues a sync on new mail. Every mailbox is also polled on the configurable cadence (default 90 s).
10. Sending over SMTP strips Bcc from the wire copy, APPENDs the full message to Sent (retried until it lands), threads replies with In-Reply-To/References, and obeys the daily recipient limit (deferring, not failing) and the per-message recipient limit.
11. Attachments download on demand from IMAP. Deleting a thread in the CRM MOVEs its messages to the mailbox's Trash.
12. A filesystem fake transport (`MAIL_PROVIDER_FAKE_DIR`) drives integration tests and e2e. `pnpm mail:live-check` proves the real transports, parser and thread keys against Purelymail.
13. Gates: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit` green. `pnpm test:integration` green, or every failure logged with its cause. `pnpm e2e` passes specs `00` to `06`. Every screenshot in 6.13 exists. `pnpm smoke` passes. `pnpm check:progress --final` passes.

## 3. Decisions already made

| Area | Decision |
|---|---|
| Codebase | Dealflow (warpdrive extended) at the end of Part 1; extend in place; new mail code in `src/features/mail/`, existing `src/features/email/` keeps its files |
| Stack | Unchanged from Part 1 (Next 16, React 19, Drizzle 0.45 on Postgres 16, tRPC reads, server actions for mutations, pg-boss 12, shadcn/Radix, Vitest 4, Playwright 1.64) |
| New dependencies | `mailparser@3.10.0` (+ dev `@types/mailparser@3.9.0`); `imapflow@2.5.7` and `nodemailer@10.1.7` are already installed (Part 1) |
| Provider model | `MailProvider` interface (6.6) replaces `GmailClient` in every send, sync, attachment, reconcile and trash path. Gmail adapter wraps the existing client and the existing Gmail sync code unchanged. IMAP/SMTP provider is new. An account is IMAP when it has a `mail_account_credentials` row, otherwise Gmail |
| Columns | Renamed, not duplicated: `gmail_thread_id → provider_thread_id`, `gmail_message_id → provider_message_id` (messages and send attempts), `gmail_attachment_id → provider_attachment_id`, `last_history_id → sync_cursor`. Constraint names stay as they are |
| IMAP ids | `provider_message_id` = the normalised RFC 822 Message-ID (synthetic when missing). `provider_thread_id` = `imap:` + the thread's root Message-ID. Folder/UID positions live in `mail_message_locations`; headers for threading in `email_message_headers` |
| Parsing | `mailparser.simpleParser` on the full source for messages up to `MAIL_MAX_MESSAGE_BYTES` (15 MiB); larger ones store headers and a "too large to preview" body. Attachment ids are `idx:{n}` into the parsed attachment list, re-parsed on download |
| Sync | Per folder: STATUS first (skip when UIDNEXT and a non-zero HIGHESTMODSEQ are unchanged), FETCH new UIDs, UID listing via FETCH (never SEARCH, whose index lags), 90-day initial window, backfill job to 365 days, UIDVALIDITY change resets that folder |
| Push | IDLE on INBOX per IMAP account in the worker (measured latency 8 to 11 s on Purelymail), plus the regular poll cadence for every folder |
| Send | SMTP (`nodemailer`) with Bcc stripped from the wire copy, then APPEND to Sent with `\Seen` (Purelymail does not save sent mail itself). APPEND failures retry from a side table. Daily recipient cap 2,800 and per-message cap 250, both configurable |
| Credentials | `mail_account_credentials`, password encrypted with the existing `TOKEN_ENCRYPTION_KEY` helper (`encryptToken`/`decryptToken`). Presets: Purelymail (IMAP 993 TLS, SMTP 465 TLS); custom servers allowed |
| Notifications | Notification emails use the Part 1 system mailer (`getSystemMailer()`), so they no longer depend on a connected mailbox |
| Tests | Fast profile. New tests only for risky logic: the AI/auth fixes, threading and subject normalisation, cursor and UIDVALIDITY handling, location dedupe, trash reconcile, send throttle, Bcc stripping, APPEND retry, credentials encryption |
| Fakes | Filesystem fake transport (`MAIL_PROVIDER_FAKE_DIR`) behind the same transport interfaces as imapflow/nodemailer. The sync engine and sender run their real code against it |
| Live proof | `pnpm mail:live-check` against the owner's Purelymail test mailbox (already used by the Part 1 probe) |
| Builder tooling | DeepSeek Harness. Part 1 ran inside the harness app with sandboxed shell commands; the known-environment commands in section 4 are mandatory. The independent reviews use the harness `subagent` tool (fresh context) with `.dsh/qa.md`, falling back to `qa.sh`, then to an evidenced self-review |

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | `git --no-optional-locks log -1 --format=%h` shows `64363ce` or a later commit; PROGRESS.md says `dealflow-wd-p1-v1` and `STATUS: COMPLETE` | a different state: read PROGRESS.md and log a Decision describing what you found; continue |
| Kit location | `PLAN-PART2.md` and the kit sit at the repo root (or in a subfolder such as `PLAN AND EXECUTE/`) | kit in a subfolder: create a root symlink `PLAN-PART2.md` and copy the kit's `scripts/check-progress.mjs` over the root one (byte-identical), as Part 1 did; log a Decision |
| pnpm 9 | `pnpm -v` prints 9.x, or `/tmp/dealflow-tools/node_modules/.bin/pnpm` exists | reinstall: `npm_config_cache=/tmp/npm-cache npm install --prefix /tmp/dealflow-tools --no-save pnpm@9.15.9`; if that fails too: fatal, Owner action, `STATUS: BLOCKED` |
| Docker | `docker info` works; the owner's `warpdrive-main` stack holds 5433/9000/9001 | Docker down: skip integration, e2e and smoke (SKIPPED + Owner action), continue |
| Purelymail probe credentials | `MAIL_PROBE_USER` and `MAIL_PROBE_PASS` are non-empty in `.env` (check emptiness only, never print values) | Task 5.2 records SKIPPED with an Owner action |
| Subagent tool | the harness offers the `subagent` tool | Task 0.2/5.4 fall back to `qa.sh`, then to the evidenced self-review |

**Known environment (from Part 1; apply in every session, copy into PROGRESS.md → Environment):**
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (shell writes outside the folder are sandboxed).
- Tests: `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` (13 upstream tests assume UTC and en-US; Task 0.5 bakes this into the scripts).
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build` (Task 0.5 bakes this into the script). If `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host DB commands: prefix `DATABASE_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers`.
- Smoke: `DOCKER_BUILDKIT=0 pnpm smoke`.

## 5. Target structure

New (+) and changed (~) paths only.

```
+ PROGRESS.md (new), PROGRESS-P1.md (renamed Part 1 file), AUDIT-P1.md
+ docs/dealflow/MAIL.md, docs/dealflow/mail-live-check.json
~ README.md, docs/dealflow/UPSTREAM.md, .env.example, package.json, pnpm-lock.yaml
+ drizzle/00NN_dealflow_session_auth.sql, 00NN_dealflow_mail_rename.sql, 00NN_dealflow_mail_tables.sql (+ meta)
+ src/db/schema/sessionAuth.ts, src/db/schema/mail.ts;  ~ src/db/schema/email.ts, emailAttachments.ts, index.ts
~ src/config/env.ts, src/constants/errorIds.ts (+ test), src/constants/email.ts, src/constants/jobNames.ts
+ src/constants/mail.ts
~ (AI/auth fixes) src/features/ai/assistant/assistant.ts, src/features/ai/actions/*.ts, src/features/ai/openrouterProvider.ts,
  src/features/auth/passwordLogin.ts, passwordActions.ts, src/app/auth/password|magic/verify|invite/accept/route.ts,
  src/app/(app)/settings/profile/PasswordCard.tsx + page.tsx, src/features/release/router.test.ts
+ src/features/auth/sessionAuth.ts, src/features/auth/aiAuthFixes.integration.test.ts (name per 6.1)
~ every file the mechanical rename touches (src/, scripts/; never drizzle/*.sql)
+ src/features/mail/
    provider/{types.ts, resolve.ts, gmailAdapter.ts, imapProvider.ts}
    transport/{types.ts, real.ts, fakeStore.ts, fake.ts, factory.ts}
    parse/{parseRaw.ts, messageId.ts, subject.ts, threadKey.ts, stripBcc.ts, *.test.ts}
    imap/{folders.ts, cursors.ts, applyInbound.ts, locations.ts, trashState.ts, sync.ts, backfill.ts, send.ts,
          appendSent.ts, throttle.ts, attachments.ts, trash.ts, *.integration.test.ts}
    connect/{presets.ts, credentials.ts, connect.ts, actions.ts, connect.integration.test.ts}
    idle/idleManager.ts
    inbound/storeInbound.ts
~ src/features/email/{outbox.ts, outboxClaim.ts, outboxReconcile.ts, send.ts, sendStore.ts, workerSendCrm.ts,
  sendReplayRepair.ts, attachmentDownload.ts, threadTrash.ts, worker.ts, workerJobs.ts, syncReEnqueue.ts,
  applyMessages.ts, mime.ts, oauth.ts, disconnect.ts, actions.ts, sendSystem.ts}  (+ their tests)
~ src/features/notifications/email/job.ts (+ test), src/server/worker.ts, src/entrypoints/sweepSpam.ts,
  src/app/api/email/attachments/[attachmentId]/route.ts
~ src/app/(app)/settings/email-sync/{page.tsx, EmailSyncClient.tsx, strings.ts};  + ConnectMailboxForm.tsx
~ scripts/e2e/e2e-env.mjs, e2e/helpers.ts;  + e2e/06-mail.spec.ts
+ scripts/dealflow/mail-live-check.ts;  ~ scripts/dealflow/smoke.mjs, scripts/seed-demo-email*.ts (rename only)
```

## 6. Contracts

Everything below is exact. Where a contract names an existing file or function, read it first; if its real shape differs, adapt the call (decision policy), never the contract's behaviour. `PLAN-PART1.md` section 6 still describes the Part 1 contracts; the code wins where they differ.

### 6.1 Review findings (planner's read-only review of Part 1, 2026-10-20)

| ID | Severity | Finding | Required fix | Test |
|---|---|---|---|---|
| R1 | major | `confirmAiAction` (`src/features/ai/assistant/assistant.ts`) reads the pending action, then invokes the write tool, then updates the status. Two concurrent Confirm clicks both see `pending` and both run the write | Claim first with one statement: `UPDATE ai_actions SET status='confirmed', decided_at=now() WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING *`. No row → `E_AI_009`. Then invoke; on a tool error set `status='failed'` with the error. `rejectAiAction` claims the same way (`pending → rejected`) | two concurrent confirms on one `add_note` action: exactly one returns ok, exactly one note exists |
| R2 | major | Deal summary, score, notes-to-activities, email draft and filter actions pass `SIG()` (8 s) to the provider; real model calls with one repair retry often take longer, so they abort in production while the fake passes | `AI_ACTION_TIMEOUT_MS = 60_000` in `src/constants/ai.ts`; those five actions use `AbortSignal.timeout(AI_ACTION_TIMEOUT_MS)`. The OpenRouter client gets `timeout: 55_000, maxRetries: 1` | `grep -n "SIG()" src/features/ai/actions/{dealActions,composeActions,filterActions}.ts` → no lines |
| R3 | major | A user who forgot their password signs in with a magic link and then cannot set a new one: `changePasswordAction` demands the current password whenever a hash exists | New side table `session_auth_events` (6.5). The local sign-in routes record the method (`password`, `magic_link`, `invite`). `changePasswordAction` skips the current-password check when the current session's method is `magic_link` or `invite` and `authenticated_at` is within 15 minutes. `PasswordCard` hides "Current password" in that case and shows "You signed in with an email link, so you can set a new password without the current one." The login page's password tab gains the line "Forgot your password? Use the Email link tab, then set a new password in Settings → Profile." | magic-link session within 15 min changes the password without the current one; a password session cannot; a magic-link session older than 15 min cannot |
| R4 | minor | `src/features/release/router.test.ts` asserts `disabled === false` under default env; Part 1 Task 1.3 changed the default to `true`, so it fails. It was logged as pre-existing, but Part 1 caused it | Update the test to the new default (`disabled` true by default) and add a case that passes `false` into `computeStatus` explicitly. Log a Decision | `pnpm exec vitest run src/features/release/router.test.ts` passes |
| R5 | minor | `passwordLogin` reads `failed_login_count`, adds 1 in JS and writes it back; concurrent wrong guesses undercount | `UPDATE user_credentials SET failed_login_count = failed_login_count + 1 WHERE user_id=$1 RETURNING failed_login_count`; if the result ≥ 10, `UPDATE … SET failed_login_count = 0, locked_until = now() + interval '15 minutes'` | 10 concurrent wrong passwords → the account is locked |
| R6 | major | `deriveMessageId` (`src/features/email/mime.ts`) uses `env.GOOGLE_WORKSPACE_DOMAIN`, which is empty when Google is off, producing `<a.b@>` | Domain = the part after `@` of the sending mailbox's address (lowercased); `dealflow.invalid` only if that is empty. Fixed in Task 1.6 | unit test: `deriveMessageId({ accountId, idempotencyKey, domain: "umev.co.uk" })` ends with `@umev.co.uk>`, and `enqueueSend` passes the account's domain |
| R7 | info | Part 1's independent review fell back to a self-review | Task 0.2 audits Part 1 with a fresh-context subagent | `AUDIT-P1.md` exists |

R1, R3 and R5 tests live in `src/features/ai/aiAuthFixes.integration.test.ts` (one file, real Postgres).

### 6.2 Scripts (`package.json`)

| Script | Command |
|---|---|
| `test:unit` | `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 vitest run --project unit` (changed) |
| `test:integration` | `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 vitest run --project integration` (changed) |
| `build` | `ALLOW_FIRST_LOGIN_ADMIN=false next build` (changed; a build is always production, where the flag must be false) |
| `mail:live-check` | `tsx scripts/dealflow/mail-live-check.ts` (new) |

### 6.3 Environment (`src/config/env.ts`, added)

```ts
// Filesystem fake for the IMAP/SMTP transports (tests and e2e). Non-empty = fake for every IMAP account.
MAIL_PROVIDER_FAKE_DIR: z.string().default(""),
MAIL_INITIAL_SYNC_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
MAIL_BACKFILL_DAYS: z.coerce.number().int().min(0).max(3650).default(365),
MAIL_SYNC_CADENCE_SECONDS: z.coerce.number().int().min(5).max(3600).default(90),
MAIL_IDLE_MAX: z.coerce.number().int().min(0).max(500).default(50),
MAIL_MAX_MESSAGE_BYTES: z.coerce.number().int().positive().default(15_728_640),
MAIL_SEND_DAILY_RECIPIENTS: z.coerce.number().int().positive().default(2800),
MAIL_SEND_MAX_RECIPIENTS: z.coerce.number().int().positive().default(250),
```

`.env.example` gets a `# Mail (IMAP/SMTP)` section with these keys and one-line comments (`MAIL_PROVIDER_FAKE_DIR=` empty). `pnpm env:sync` appends them locally.

### 6.4 Error IDs (append; `MAIL` already in the domain list)

```ts
MAIL_CONNECT_FAILED: "E_MAIL_003",       // IMAP/SMTP server unreachable, TLS failure or timeout
MAIL_AUTH_FAILED: "E_MAIL_004",          // IMAP or SMTP rejected the username/password
MAIL_INBOX_MISSING: "E_MAIL_005",        // mailbox has no INBOX after login
MAIL_ADDRESS_TAKEN: "E_MAIL_006",        // that address is already connected by another user
MAIL_CREDENTIALS_UNREADABLE: "E_MAIL_007", // stored password could not be decrypted; reconnect
MAIL_IMAP_FAILED: "E_MAIL_008",          // an IMAP command failed after login (context names the command)
MAIL_SEND_DEFERRED: "E_MAIL_009",        // daily recipient limit reached; attempt rescheduled
MAIL_TOO_MANY_RECIPIENTS: "E_MAIL_010",  // more recipients than MAIL_SEND_MAX_RECIPIENTS
MAIL_MESSAGE_TOO_LARGE: "E_MAIL_011",    // message larger than MAIL_MAX_MESSAGE_BYTES (attachment download)
MAIL_APPEND_FAILED: "E_MAIL_012",        // APPEND to Sent failed; queued for retry
MAIL_LOCATION_MISSING: "E_MAIL_013",     // no known folder/UID for a message (attachment, trash)
MAIL_INPUT_INVALID: "E_MAIL_014",        // connect form or mail action input failed Zod validation
MAIL_UNSUPPORTED: "E_MAIL_015",          // operation not supported by this provider
```

### 6.5 Schema

**Rename** (one migration, Task 1.1). In `src/db/schema/email.ts` and `emailAttachments.ts` change both the TypeScript property and the SQL name: `gmailThreadId: text("gmail_thread_id")` → `providerThreadId: text("provider_thread_id")`; `gmailMessageId: text("gmail_message_id")` → `providerMessageId: text("provider_message_id")` (in `emailMessages` and `emailSendAttempts`); `gmailAttachmentId: text("gmail_attachment_id")` → `providerAttachmentId: text("provider_attachment_id")`; `lastHistoryId: text("last_history_id")` → `syncCursor: text("sync_cursor")`. Constraint names (`uq_thread_acct_gmail`, `uq_msg_acct_gmail`) stay. Generate an empty custom migration with `pnpm exec drizzle-kit generate --custom --name dealflow_mail_rename` (its snapshot then matches the renamed schema) and write exactly:

```sql
ALTER TABLE "email_threads" RENAME COLUMN "gmail_thread_id" TO "provider_thread_id";--> statement-breakpoint
ALTER TABLE "email_messages" RENAME COLUMN "gmail_message_id" TO "provider_message_id";--> statement-breakpoint
ALTER TABLE "email_send_attempts" RENAME COLUMN "gmail_message_id" TO "provider_message_id";--> statement-breakpoint
ALTER TABLE "email_message_attachments" RENAME COLUMN "gmail_attachment_id" TO "provider_attachment_id";--> statement-breakpoint
ALTER TABLE "email_accounts" RENAME COLUMN "last_history_id" TO "sync_cursor";
```

Mechanical rename of every reference in `src/` and `scripts/` (`.ts`/`.tsx` only, never `drizzle/`):

```bash
git ls-files -z -- 'src/*.ts' 'src/*.tsx' 'scripts/*.ts' | xargs -0 perl -pi -e '
  s/\bgmailThreadId\b/providerThreadId/g; s/\bgmail_thread_id\b/provider_thread_id/g;
  s/\bgmailMessageId\b/providerMessageId/g; s/\bgmail_message_id\b/provider_message_id/g;
  s/\bgmailAttachmentId\b/providerAttachmentId/g; s/\bgmail_attachment_id\b/provider_attachment_id/g;
  s/\blastHistoryId\b/syncCursor/g; s/\blast_history_id\b/sync_cursor/g'
```

Compound names such as `parentGmailMessageId`, `parent_gmail_message_id` and `inReplyToGmailMessageId` are left as they are (they are not matched).

**`src/db/schema/sessionAuth.ts`** (Task 0.4):

```ts
export const sessionAuthEvents = pgTable("session_auth_events", {
  sessionId: uuid("session_id").primaryKey().references(() => sessions.id, { onDelete: "cascade" }),
  method: text("method").notNull().$type<"password" | "magic_link" | "invite">(),
  authenticatedAt: timestamp("authenticated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

`src/features/auth/sessionAuth.ts`: `recordSessionAuth(db, sessionId, method, signal)`; `recentLinkSignIn(db, sessionId, signal): Promise<boolean>` (true when method is `magic_link` or `invite` and `authenticated_at > now() - interval '15 minutes'`).

**`src/db/schema/mail.ts`** (Task 1.2):

```ts
// IMAP/SMTP credentials for a mailbox. Presence of a row is what makes an account "imap".
export const mailAccountCredentials = pgTable("mail_account_credentials", {
  accountId: uuid("account_id").primaryKey().references(() => emailAccounts.id, { onDelete: "cascade" }),
  imapHost: text("imap_host").notNull(),
  imapPort: integer("imap_port").notNull(),
  imapSecure: boolean("imap_secure").notNull().default(true),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpSecure: boolean("smtp_secure").notNull().default(true),
  username: text("username").notNull(),
  passwordEnc: bytea("password_enc").notNull(), // encryptToken(); never logged
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const mailFolderCursors = pgTable(
  "mail_folder_cursors",
  {
    accountId: uuid("account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),
    folder: text("folder").notNull(),
    specialUse: text("special_use").$type<SpecialUse>(),
    uidValidity: bigint("uid_validity", { mode: "bigint" }).notNull(),
    lastUid: bigint("last_uid", { mode: "number" }).notNull().default(0),
    uidNext: bigint("uid_next", { mode: "number" }).notNull().default(0),
    highestModseq: bigint("highest_modseq", { mode: "bigint" }), // null = unknown (Purelymail reports 0 when empty)
    backfillBefore: timestamp("backfill_before", { withTimezone: true }), // oldest date already covered
    backfillDone: boolean("backfill_done").notNull().default(false),
    lastListedAt: timestamp("last_listed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.folder] })],
);

export const mailMessageLocations = pgTable(
  "mail_message_locations",
  {
    accountId: uuid("account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),
    folder: text("folder").notNull(),
    uidValidity: bigint("uid_validity", { mode: "bigint" }).notNull(),
    uid: bigint("uid", { mode: "number" }).notNull(),
    providerMessageId: text("provider_message_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.folder, t.uidValidity, t.uid] }),
    index("mml_account_msg_idx").on(t.accountId, t.providerMessageId),
  ],
);

// RFC 822 threading headers per stored message (both providers write it for outbound; IMAP for inbound).
export const emailMessageHeaders = pgTable(
  "email_message_headers",
  {
    messageId: uuid("message_id").primaryKey().references(() => emailMessages.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull(),
    rfc822MessageId: text("rfc822_message_id").notNull(),
    inReplyTo: text("in_reply_to"),
    references: text("references").array().notNull().default(sql`'{}'`),
  },
  (t) => [index("emh_account_rfc_idx").on(t.accountId, t.rfc822MessageId)],
);

// Sent copies still waiting for APPEND to the Sent folder.
export const mailSentAppends = pgTable("mail_sent_appends", {
  attemptId: uuid("attempt_id").primaryKey().references(() => emailSendAttempts.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull(),
  status: text("status").notNull().$type<"pending" | "done" | "gave_up">().default("pending"),
  tries: integer("tries").notNull().default(0),
  lastErrorId: text("last_error_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

`SpecialUse = "inbox" | "sent" | "archive" | "junk" | "trash" | "drafts"` lives in `src/constants/mail.ts` with the presets and limits. Migration: `pnpm exec drizzle-kit generate --name dealflow_mail_tables`.

### 6.6 MailProvider (`src/features/mail/provider/types.ts`)

```ts
export interface SentMessage {
  providerMessageId: string;
  providerThreadId: string;
  snippet: string | null;
  headers: { rfc822MessageId: string; inReplyTo: string | null; references: string[] };
}
export interface MailProvider {
  readonly kind: "gmail" | "imap";
  // Pull new mail into email_threads/email_messages. Idempotent; advances cursors only after success.
  sync(signal: AbortSignal): Promise<Result<{ applied: number }, AppError>>;
  // Deliver one RFC 822 message. `raw` contains every header including Bcc; the provider decides what goes on the wire.
  send(args: {
    raw: string;
    messageIdHeader: string;
    envelope: { from: string; to: string[] }; // to = to + cc + bcc
    providerThreadId: string | null;         // existing thread for a reply
    parentProviderMessageId: string | null;
    attemptId: string;
    signal: AbortSignal;
  }): Promise<Result<SentMessage, AppError>>;
  // Describe an already-sent message by id (replay repair after a crash between send and store).
  describeSent(args: { providerMessageId: string; signal: AbortSignal }): Promise<Result<SentMessage, AppError>>;
  // Reconcile an attempt whose outcome is unknown: was a message with this Message-ID sent?
  findSent(args: { messageIdHeader: string; signal: AbortSignal }): Promise<Result<{ providerMessageId: string } | null, AppError>>;
  replyHeaders(args: { parentProviderMessageId: string; signal: AbortSignal }): Promise<ReplyThreadHeaders>;
  fetchAttachment(args: { providerMessageId: string; providerAttachmentId: string; signal: AbortSignal }): Promise<Result<{ bytes: Buffer }, AppError>>;
  trashThread(args: { providerThreadId: string; signal: AbortSignal }): Promise<Result<void, AppError>>;
  close(): Promise<void>;
}
```

`src/features/mail/provider/resolve.ts`:

```ts
export interface ResolveDeps { gmailClient?: (accountId: string, signal: AbortSignal) => Promise<Result<GmailClient, AppError>>; transports?: MailTransportFactory }
export async function resolveMailProvider(db: Db, accountId: string, signal: AbortSignal, deps: ResolveDeps = {}): Promise<Result<MailProvider, AppError>>
// credentials row present → createImapProvider(db, account, creds, deps.transports ?? getMailTransportFactory())
// else → createGmailProvider(db, accountId, client) where client comes from deps.gmailClient ?? today's ensureAccessToken + createGmailClient
```

Callers (`runSyncJob`, `runSendJob`, the send action, attachment route, trash action) call `resolveMailProvider` once per job/request and `close()` it in `finally`.

**Gmail adapter** (`gmailAdapter.ts`, `createGmailProvider(db, accountId, gmail: GmailClient)`; also exported `gmailProviderForTest(db, accountId, fake)` used by tests): `sync` → today's `syncMailbox(db, { accountId, gmail, signal })`; `send` → `gmail.sendRaw({ rawBase64: toRawBase64(raw), threadId: providerThreadId ?? undefined })`, then `gmail.getMessage` for `threadId` and `snippet`, `headers` from `replyThreadHeaders` of the parent plus the new Message-ID; `describeSent` → `getMessage`; `findSent` → `searchByRfc822` (first hit); `replyHeaders` → today's `getMessage` + `replyThreadHeaders`; `fetchAttachment` → `getAttachment` (base64url decode); `trashThread` → `gmail.trashThread`; `close` → no-op.

### 6.7 Transports (`src/features/mail/transport/`)

```ts
export interface ImapCredentials { host: string; port: number; secure: boolean; username: string; password: string }
export interface SmtpCredentials { host: string; port: number; secure: boolean; username: string; password: string }
export interface FolderInfo { path: string; specialUse: SpecialUse | null }
export interface FolderStatus { uidValidity: bigint; uidNext: number; highestModseq: bigint | null; messages: number }
export interface FetchedSource { uid: number; size: number; internalDate: Date | null; source: Buffer | null } // null when size > maxBytes
export interface ImapSession {
  readonly supportsIdle: boolean;
  listFolders(signal: AbortSignal): Promise<Result<FolderInfo[], AppError>>;
  status(folder: string, signal: AbortSignal): Promise<Result<FolderStatus, AppError>>;
  listUids(folder: string, signal: AbortSignal): Promise<Result<number[], AppError>>;          // FETCH 1:* (UID), never SEARCH
  uidsInRange(folder: string, since: Date, before: Date | null, signal: AbortSignal): Promise<Result<number[], AppError>>; // SEARCH SINCE/BEFORE (backfill only)
  fetchSources(folder: string, uids: number[], maxBytes: number, signal: AbortSignal): Promise<Result<FetchedSource[], AppError>>;
  fetchHeaderOnly(folder: string, uid: number, signal: AbortSignal): Promise<Result<Buffer | null, AppError>>;
  append(folder: string, raw: Buffer, flags: string[], signal: AbortSignal): Promise<Result<{ uid: number | null; uidValidity: bigint | null }, AppError>>;
  move(folder: string, uids: number[], destination: string, signal: AbortSignal): Promise<Result<Map<number, number>, AppError>>; // old uid → new uid when known
  findByMessageId(folder: string, messageId: string, signal: AbortSignal): Promise<Result<number[], AppError>>;
  idle(folder: string, onExists: () => void, signal: AbortSignal): Promise<Result<void, AppError>>; // resolves when the connection ends
  close(): Promise<void>;
}
export interface SmtpSender {
  verify(signal: AbortSignal): Promise<Result<void, AppError>>;
  send(raw: Buffer, envelope: { from: string; to: string[] }, signal: AbortSignal): Promise<Result<{ response: string }, AppError>>;
}
export interface MailTransportFactory {
  openImap(creds: ImapCredentials, signal: AbortSignal): Promise<Result<ImapSession, AppError>>;
  smtp(creds: SmtpCredentials): SmtpSender;
}
export function getMailTransportFactory(): MailTransportFactory; // MAIL_PROVIDER_FAKE_DIR set → fake, else real
```

**Real** (`real.ts`): `ImapFlow({ host, port, secure, auth: { user, pass }, logger: false, qresync: true, emitLogs: false })`. Every folder operation uses `getMailboxLock(folder)` and releases it in `finally`. `status` uses `client.status(folder, { messages: true, uidNext: true, uidValidity: true, highestModseq: true })` and maps `highestModseq` `0n` → `null`. `listUids` uses `client.fetch("1:*", { uid: true })` and returns the uids (empty mailbox → `[]`). `fetchSources` fetches `{ uid: true, size: true, internalDate: true }` first, then `source: true` only for messages within `maxBytes`, in batches of 25. `fetchHeaderOnly` fetches `headers: true`. `append` returns `uid`/`uidValidity` from the APPENDUID response. `move` uses `messageMove(uids.join(","), destination, { uid: true })` and maps `uidMap`. `findByMessageId` uses `search({ header: { "message-id": messageId } }, { uid: true })`. `idle` opens a dedicated connection, `mailboxOpen(folder)`, attaches an `exists` listener, and lets imapflow idle (`maxIdleTime: 300_000`). Login failures whose server response says authentication failed map to `E_MAIL_004`; connection, TLS and timeout errors map to `E_MAIL_003`; other command failures map to `E_MAIL_008` with `{ command }` in the context. Never put the password into an error context. SMTP: `createTransport({ host, port, secure, auth: { user, pass } })`; `send` uses `sendMail({ envelope, raw })`.

**Fake** (`fakeStore.ts` + `fake.ts`). `fakeStore.ts` imports only `node:` built-ins and uses relative imports (the e2e helpers import it directly). Layout under `MAIL_PROVIDER_FAKE_DIR`:

```
{dir}/{address}/password                    # created on first login with that password; later logins must match
{dir}/{address}/{Folder}/meta.json          # { "uidValidity": "1", "uidNext": 1, "modseq": "1" }
{dir}/{address}/{Folder}/{uid}.eml          # raw RFC 822
{dir}/_smtp/{timestamp}-{n}.json            # { from, to, size } log of every SMTP send
```

Folders and special uses are fixed: `INBOX` (inbox), `Sent` (sent), `Archive` (archive), `Junk` (junk), `Trash` (trash), `Drafts` (drafts), created on first login. Exports: `fakeLogin(dir, address, password)`, `fakeAppend(dir, address, folder, raw): { uid, uidValidity }` (bumps `uidNext` and `modseq`), `fakeList(dir, address, folder): number[]`, `fakeRead(dir, address, folder, uid): Buffer`, `fakeMove(dir, address, folder, uids, dest): Map<number, number>`, `fakeResetUidValidity(dir, address, folder)` (tests only: renumbers files and bumps `uidValidity`), and `fakeDeliver(dir, rawOrFields)` for tests and e2e. Every write takes a lock (`mkdir {path}.lock`, retry every 20 ms up to 2 s, `rmdir` in `finally`). `fake.ts` implements `ImapSession` and `SmtpSender` on top of it (`supportsIdle: false`). Fake SMTP `send` appends the wire copy to every recipient's `INBOX` (creating the mailbox) and logs to `_smtp`. Its `verify` always succeeds. `fakeLogin` with a password shorter than 8 characters fails with `E_MAIL_004`, so tests can exercise the auth error.

### 6.8 Parsing and threading (`src/features/mail/parse/`, pure, unit-tested)

- `normalizeMessageId(raw: string | null | undefined): string | null`: trim; take the first `<…>` token if present; else wrap the bare value in `<>`; lowercase; return null for an empty value.
- `syntheticMessageId(fields: { from: string; date: string; subject: string; size: number }): string` = `<synthetic-{first 32 hex of sha256(from|date|subject|size)}@dealflow.invalid>`.
- `normalizeSubject(subject: string | null): string`: lowercase; repeatedly strip a leading `re`, `fw`, `fwd`, `aw`, `sv`, `antw`, `tr` or `wg` prefix (optionally followed by `[n]` or `(n)`) plus `:` and surrounding spaces; collapse whitespace; trim.
- `hadReplyPrefix(subject: string | null): boolean`: true when `normalizeSubject` removed at least one prefix.
- `stripBccHeader(raw: string): string`: removes the `Bcc:` header and its folded continuation lines from the header block only (the part before the first blank line); the body is untouched.
- `parseRawMessage(raw: Buffer, opts: { ownAddress: string; maxBodyChars?: number }): Promise<ParsedMailMessage>` (uses `simpleParser`):

```ts
export interface ParsedMailMessage {
  providerMessageId: string;       // normalizeMessageId(messageId) ?? syntheticMessageId(...)
  rfc822MessageId: string;         // same value
  inReplyTo: string | null;        // normalized
  references: string[];            // normalized, oldest first, deduped
  fromEmail: string; fromName: string | null;
  toEmails: string[]; ccEmails: string[];
  subject: string | null;
  snippet: string | null;          // text body collapsed to single spaces, first 200 chars
  bodyHtml: string | null; bodyText: string | null;
  sentAt: Date | null;
  participants: string[];          // lowercased from + to + cc, deduped
  direction: "inbound" | "outbound"; // outbound when fromEmail equals ownAddress (case-insensitive)
  attachments: { providerAttachmentId: string; filename: string; mimeType: string; sizeBytes: number }[];
}
```

Attachments: every entry of `parsed.attachments` whose `contentDisposition` is `attachment`, or that has a filename and `related !== true`, keeps its index `i` in the original array as `providerAttachmentId = "idx:" + i`; a missing filename becomes `attachment-{i}`.
- `parseTooLarge(headerBytes: Buffer, size: number, opts)`: same shape from headers only, `bodyText` = "This message is too large to preview here. Open it in your mail app.", `attachments` = `[]`.
- `threadKey` (`threadKey.ts`, needs the db): `resolveThreadKey(tx, { accountId, ownAddress, parsed, signal }): Promise<string>`:
  1. Candidates = `[inReplyTo, ...references reversed]` (non-null, deduped). For each candidate, look up `email_message_headers` (same account, `rfc822_message_id = candidate`) joined to `email_messages` → `email_threads`. The first hit returns that thread's `provider_thread_id`.
  2. Fallback only when the message has an `inReplyTo` or `references`, or `hadReplyPrefix(subject)`: among the account's threads with `last_message_at > sentAt - 30 days` (at most 500, newest first), the first whose `normalizeSubject(subject)` equals this message's and that shares at least one participant other than `ownAddress` (from its messages' from/to/cc) returns its `provider_thread_id`.
  3. Otherwise `"imap:" + (references[0] ?? inReplyTo ?? providerMessageId)`.

### 6.9 IMAP sync (`src/features/mail/imap/`)

- `folders.ts` `discoverFolders(session, signal)`: the folders whose special use is `inbox`, `sent`, `archive`, `junk` or `trash` (INBOX by path when no special use is reported); `drafts` and the rest are ignored.
- `cursors.ts`: read/upsert `mail_folder_cursors`.
- `storeInbound.ts` (`src/features/mail/inbound/`): `storeInboundMessage(tx, { accountId, owner, providerThreadId, parsed, signal }): Promise<{ inserted: boolean; messageRowId: string; threadId: string }>`. The thread upsert, `resolveLink` on new threads, the message insert with `ON CONFLICT (account_id, provider_message_id) DO NOTHING`, the attachment rows, the `email_arrived` realtime event and the deal-arrival collection are moved here out of `applyMessages.ts`, unchanged in behaviour. The message's direction comes from `parsed.direction` (Gmail passes `inbound`, as today). It also inserts `email_message_headers` when the message is new. `applyMessages.ts` then calls it after mapping its `ParsedGmailMessage` (renamed fields) into `ParsedMailMessage`.
- `applyInbound.ts` `applyFolderMessages({ db, account, owner, session, folder, uidValidity, uids, signal })`: fetch sources in batches of 25 (`MAIL_MAX_MESSAGE_BYTES`). For each: parse (or `parseTooLarge`); if a message with that `provider_message_id` already exists for the account, only upsert its location; else, inside one transaction, `resolveThreadKey` → `storeInboundMessage` → upsert location. Collect touched thread ids. Returns `{ applied, touchedThreadIds }`.
- `trashState.ts` `reconcileTrash(db, accountId, threadIds, folderUse: Map<string, SpecialUse | null>)`: for each thread, gather the locations of all its messages. None → leave unchanged. All in junk/trash folders → `trashed_at = coalesce(trashed_at, now())`. Otherwise → `trashed_at = null`.
- `sync.ts` `syncImapAccount(db, { account, owner, session, signal }, deps: { enqueueBackfill: (accountId: string) => Promise<void> } = { enqueueBackfill: defaultEnqueueBackfill })`, per discovered folder:
  1. `status`. No cursor → **initial**: `uids = uidsInRange(folder, now − MAIL_INITIAL_SYNC_DAYS days, null)` for inbox/sent/archive, and `listUids` for junk/trash. Apply them, then upsert the cursor `{ uidValidity, lastUid: max(uids, uidNext − 1), uidNext, highestModseq, backfillBefore: now − MAIL_INITIAL_SYNC_DAYS days (inbox/sent/archive only) }`. Enqueue a backfill job when `MAIL_BACKFILL_DAYS > MAIL_INITIAL_SYNC_DAYS`.
  2. Cursor exists and `uidValidity` differs → delete that folder's cursor and locations, then do the initial path for it (log `[mail.sync] uidvalidity reset {accountId} {folder}`).
  3. Unchanged (`uidNext === cursor.uidNext` and `highestModseq` non-null and equal) and `lastListedAt` within 15 minutes → skip.
  4. Otherwise `listUids`. New = uids > `cursor.lastUid`, applied in ascending order. Vanished = locations of this folder whose uid is not listed and is ≤ the largest listed uid (ignore when the list is empty and `messages > 0`); delete them. Update the cursor (`lastUid`, `uidNext`, `highestModseq`, `lastListedAt = now()`).
  5. After all folders, `reconcileTrash` for every touched thread, plus threads whose locations were deleted.
  The account's `last_sync_at` is set and `last_error_id` cleared at the end; any error returns `err` before the cursor of the failing folder moves.
- `backfill.ts`: queue `PGBOSS_QUEUE_MAIL_BACKFILL = "mail.backfill"`, payload `{ accountId }`, singleton per account. Per inbox/sent/archive cursor with `backfillDone = false`: window = `[backfillBefore − 90 days, backfillBefore)`, clamped at `now − MAIL_BACKFILL_DAYS`. Take `uidsInRange`, at most 300 messages per job run, oldest-first within the window. Apply them, move `backfillBefore` to the window start (only when the whole window is done), and set `backfillDone` once the clamp is reached. Re-enqueue itself with `startAfter: 30` while any folder is not done.
- `idleManager.ts` (`src/features/mail/idle/`): `startIdleManager(boss, { scanMs: 60_000 })` from `registerAllJobs`. Every scan, load IMAP accounts with status `connected` (at most `MAIL_IDLE_MAX`), skip the fake transport (`supportsIdle false`), and start `session.idle("INBOX", onExists)` for accounts without a live session. `onExists` sends the regular sync job (same queue, `singletonKey: accountId`, respecting `pendingTicksVia`). A session that ends or errors is removed and retried on a later scan, with backoff 1, 2, 4… up to 30 minutes per account. Disconnected accounts' sessions are closed on the next scan.
- Cadence: `syncReEnqueue.ts` uses `env.MAIL_SYNC_CADENCE_SECONDS` instead of `SYNC_CADENCE_SECONDS`, and `jitterFor` uses `Math.min(SYNC_JITTER_MODULO_SECONDS, env.MAIL_SYNC_CADENCE_SECONDS)`.

### 6.10 IMAP send, attachments and trash

`imap/send.ts` (the IMAP provider's `send`):
1. Recipients = `envelope.to`. If more than `MAIL_SEND_MAX_RECIPIENTS` → `E_MAIL_010`. (The send action also validates this up front, so users see the error before queueing.)
2. Throttle (`throttle.ts` `checkDailyQuota(db, accountId, recipients, now, limit)`, where `limit` comes from `createImapProvider`'s optional `limits: { dailyRecipients?: number; maxRecipients?: number }` and defaults to the env values; tests pass small limits): sum of to+cc+bcc counts in `email_send_attempts.payload` for this account with `status='sent' AND sent_at > now − 24 h`, plus this message's recipients. Over `MAIL_SEND_DAILY_RECIPIENTS` → `err(E_MAIL_009, { retryAt })`, where `retryAt` = the oldest counted `sent_at` + 24 h + 1 minute. `processSendAttempt` maps `E_MAIL_009` to: release the claim, set `scheduled_at = retryAt` and `status='pending'`, enqueue the scheduled send job for `retryAt` (`enqueueScheduledSendJob`), and return `ok({ status: "deferred" })` (add `"deferred"` to `SendOutcome.status`).
3. `smtp.send(Buffer.from(stripBccHeader(raw)), envelope)`.
4. `providerMessageId = normalizeMessageId(messageIdHeader)`; `providerThreadId = providerThreadId ?? "imap:" + providerMessageId`.
5. Insert `mail_sent_appends { attemptId, accountId, status: 'pending' }`, then `appendSent` inline: APPEND the full `raw` (with Bcc) to the `sent` folder with `\Seen`. On success set `done` and upsert the location (`uid`/`uidValidity` from the response, when given). On failure set `tries + 1` and `last_error_id`. A periodic job `PGBOSS_QUEUE_MAIL_APPEND = "mail.append-sent"` (every 5 minutes) retries pending rows with fewer than 12 tries, rebuilding the raw message from the attempt payload with the same `buildMime` inputs and stored Message-ID; at 12 tries it sets `gave_up`.
6. Return `SentMessage` with `snippet` from the text part (`htmlToPlainText`-style helper already in `src/features/email/plainText.ts`) and `headers { rfc822MessageId: providerMessageId, inReplyTo, references }` taken from the reply headers used to build the message.

Timing: `MAIL_SEND_TIMEOUT_MS = 30_000` (in `src/constants/mail.ts`) is the interactive send budget for IMAP accounts; `sendEmail` uses it instead of its 8 s default when the caller passes no signal and the provider is IMAP. The inline APPEND in step 5 runs with its own `AbortSignal.timeout(15_000)`, independent of the caller's signal, so a slow APPEND can never abort a send that SMTP already accepted.

`replyHeaders` (IMAP): look up `email_message_headers` for the parent message row (by account + `provider_message_id`), returning `{ inReplyTo: parent.rfc822MessageId, references: [...parent.references, parent.rfc822MessageId].join(" ") }`; `{}` when not found.
`findSent` (IMAP): `findByMessageId` in the sent folder (the attempt is older than the SEARCH lag by then); a hit → `{ providerMessageId: normalized header }`.
`describeSent` (IMAP): find the send attempt by `message_id_header`; thread = the attempt's thread row's `provider_thread_id` or `imap:` + id; snippet from the payload text; headers from `email_message_headers` when present.
`fetchAttachment` (IMAP): the first location of the message (prefer inbox, sent, archive), `fetchSources` that uid with `MAIL_MAX_MESSAGE_BYTES`, `simpleParser`, then the attachment at the index. No location → `E_MAIL_013`; source null → `E_MAIL_011`.
`trashThread` (IMAP): every location of the thread's messages not already in the trash folder, grouped by folder → `move(folder, uids, trashPath)`; replace those location rows using the returned uid map (or delete them when no map is returned; the next sync re-adds them).

`storeOutboundCopy` (both providers) takes the `SentMessage` from the provider instead of calling `gmail.getMessage` itself (or calls `provider.describeSent` in the replay-repair path). It inserts `email_message_headers` for the outbound message and sets `direction 'outbound'` as today.

### 6.11 Connecting a mailbox (`src/features/mail/connect/`)

`presets.ts`: `MAIL_PRESETS = { purelymail: { label: "Purelymail", imapHost: "imap.purelymail.com", imapPort: 993, imapSecure: true, smtpHost: "smtp.purelymail.com", smtpPort: 465, smtpSecure: true } }`.

`connect.ts` `connectImapMailbox(db, actor, input, deps: { transports: MailTransportFactory; boss: enqueue fn }, signal): Promise<Result<{ accountId: string }, AppError>>`. Input (Zod):

```ts
{ emailAddress: email ≤ 254, password: string 1..512, preset: "purelymail" | "custom",
  imapHost?: hostname ≤ 253, imapPort?: int 1..65535, imapSecure?: boolean,
  smtpHost?: hostname ≤ 253, smtpPort?: int 1..65535, smtpSecure?: boolean, username?: string ≤ 254 }
```

Custom requires all four host/port fields. Username defaults to the email address. Steps: `openImap` → `listFolders` must include an inbox (`E_MAIL_005`) → `close`; `smtp.verify`. Then, in a transaction: upsert `email_accounts` on `user_id` (`email_address`, `status 'connected'`, `sync_cursor NULL`, `last_error_id NULL`; a unique violation on the address → `E_MAIL_006`); upsert `mail_account_credentials` with `encryptToken(password)`; delete the account's `mail_folder_cursors` and `mail_message_locations`. After commit, enqueue the initial sync (`enqueueInitialSync`). Gmail's `exchangeAndBind` deletes the account's credentials row, so switching back to Gmail works; `disconnect` deletes the credentials row.

`credentials.ts`: `loadImapCredentials(db, accountId, signal): Promise<Result<{ imap: ImapCredentials; smtp: SmtpCredentials } | null, AppError>>` (`decryptToken` failure → `E_MAIL_007`).

`actions.ts` (`"use server"`): `connectImapMailboxAction(raw, csrf)` → `ActionResult<{ accountId }>` (`guardCsrf`, `createContext`, own mailbox only).

UI (`src/app/(app)/settings/email-sync/`): when the actor has no mailbox, or it is disconnected or in error, `ConnectMailboxForm` shows:
- title "Connect your mailbox";
- `Input` "Email address" and `Input type=password` "App password", with the help line "Use an app password from your mail provider, not your login password.";
- `Select` "Provider" with "Purelymail" (default) and "Other IMAP/SMTP server";
- for Other: `Input` "IMAP server", "IMAP port" (993), "SMTP server", "SMTP port" (465), `Switch` "Use TLS for IMAP", "Use TLS for SMTP", `Input` "Username (if different)";
- button "Test and connect" (pending text "Testing connection...");
- errors from `E_MAIL_003` "Could not reach the mail server. Check the server names and ports.", `E_MAIL_004` "The mail server rejected the email or app password.", `E_MAIL_005` "Connected, but the mailbox has no INBOX.", `E_MAIL_006` "That address is already connected by another user.";
- when `authMethods().google` is true, a secondary button "Connect Gmail instead" that runs the existing `connectGmailStart`.

Connected state: "Connected as {address}" plus the provider ("IMAP/SMTP ({imapHost})" or "Gmail"), last sync time, the existing Disconnect button and, for IMAP, "Update password", which reopens the form prefilled. Strings live in `strings.ts`.

### 6.12 Other refactors

- **Call sites**: `processSendAttempt`, `reconcile`, `sendEmail`/`runSend` (`SendEmailArgs.gmail` → `provider`), `storeOutboundCopy`, `performWorkerSendCrm`, `ensureLocalCopyForReplay`, `resolveAttachmentDownload` (`AttachmentDownloadDeps.resolveClient` → `resolveProvider`), `trashThread`, `runSyncJob`/`runSendJob` (`SyncDeps.resolveClient` → `resolveProvider`), `src/features/email/actions.ts` and the attachments route take a `MailProvider` (or a resolver) instead of a `GmailClient`. Gmail-only internals (`sync.ts`, `resync.ts`, `applyMessages.ts`, `spamSweep*.ts`, `sweepSpam.ts`) keep using `GmailClient` inside the adapter. `sweepAllMailboxes` skips IMAP accounts. `outboxClaim.loadSendInputs` returns `providerThreadId` and `parentProviderMessageId`.
- **Tests**: tests that passed a `FakeGmailClient` as `gmail` now pass `gmailProviderForTest(db, accountId, fake)` as `provider`. Assertions stay identical.
- **Message-ID** (R6): `enqueueSend` derives the domain from the account's `email_address`.
- **Notifications**: `SendFn` becomes `(to: string, message: SystemMail, signal) => Promise<Result<{ messageId: string }, AppError>>`, with the default `(to, m, s) => getSystemMailer().send({ ...m, to }, s)`. The notification no longer needs an `email_accounts` row (it sends to the recipient user's address). Remove the job's account lookup. Keep `sendGmail` exported for compatibility but unused. Update its tests.

### 6.13 Test hooks and screenshots

| Screen | Hooks |
|---|---|
| `/settings/email-sync` | `connect-mailbox-form`; labels "Email address", "App password", "Provider", "IMAP server", "IMAP port", "SMTP server", "SMTP port"; button "Test and connect"; `connect-error`; `mailbox-status` with `data-provider` (`imap`/`gmail`) and `data-status`; buttons "Update password", "Disconnect" |
| `/inbox` | thread rows show the subject text; `reader-content`, `reader-reply`, `reader-message-card` (existing) |
| `/settings/profile` | `password-card`, plus `password-reset-note` when the current password is not required |

Screenshots (`e2e/screenshots/`, 1440×900, full page): `p2-email-sync-connect`, `p2-email-sync-error`, `p2-email-sync-connected`, `p2-inbox-synced`, `p2-thread-reply`, `p2-thread-three-messages`, `p2-deal-email-timeline`, `p2-profile-password-reset` (8 files).

### 6.14 Fakes, e2e and live check

- `scripts/e2e/e2e-env.mjs` adds `MAIL_PROVIDER_FAKE_DIR: ".e2e/fakemail"`, `MAIL_SYNC_CADENCE_SECONDS: "5"`, `MAIL_IDLE_MAX: "0"`, `MAIL_INITIAL_SYNC_DAYS: "90"`, `MAIL_BACKFILL_DAYS: "0"`.
- `e2e/helpers.ts` adds `deliverFakeMail({ to, from, fromName?, subject, text, messageId, inReplyTo?, references? })` (builds a small RFC 822 message and calls `fakeDeliver` from `../src/features/mail/transport/fakeStore`), `fakeFolder(address, folder)` (lists `.eml` files), and `waitForText(page, text, timeoutMs)` (reloads every 3 s until visible).
- `scripts/dealflow/mail-live-check.ts` (a script; may read `process.env`; loads `.env` with `process.loadEnvFile` in try/catch): skipped with `{ status: "skipped" }` when `MAIL_PROBE_USER`/`MAIL_PROBE_PASS` are missing. Otherwise it uses the **real** transport factory and the Purelymail preset:
  1. `openImap`, `listFolders` → record the special uses;
  2. send message A (subject `Dealflow live check {ISO}`, Message-ID on the user's domain) to self through `smtp.send` with a Bcc header present in `raw`, then `append` A to Sent;
  3. wait up to 90 s (poll `listUids` on INBOX every 5 s) for A in INBOX; `fetchSources` it; `parseRawMessage`; record `providerMessageId`, attachments count, and that the received copy has no Bcc header;
  4. send reply B with `In-Reply-To`/`References` = A's Message-ID; wait for it; parse; check `references[0]` equals A's id (so the step-3 thread key of `resolveThreadKey` would be `imap:{A id}`);
  5. `findByMessageId` on Sent for A (after the 5 s+ wait);
  6. `move` both inbound copies to Trash.

  It writes `docs/dealflow/mail-live-check.json` `{ status, checkedAt, account (masked), folders, sendOk, appendUid, inboundFound, bccStripped, replyThreadsToA, sentSearchFound, movedToTrash, timingsMs, errors[] }`, with `status: ok` only when every check is true.

## 7. Conventions

- **Read before you edit; extend, don't rewrite.** Open the file, its tests and its callers first. New mail code goes in `src/features/mail/`. Existing `src/features/email/` files change only as section 5 lists, and keep their names.
- **`CLAUDE.md` applies to every file**: Result types, registered `AppError` IDs, Zod at boundaries, required `signal: AbortSignal` threaded through I/O, shadcn primitives only, no native form controls, `process.env` only in `src/config/env.ts` (scripts excepted), files under about 200 lines, constants in `src/constants/`, comments explain why, no em dashes.
- **Mutations are server actions, reads are tRPC.** Every action: `guardCsrf` → `createContext` → permission check → Zod → service → `ActionResult`.
- **Raw SQL is fine where warpdrive already uses it** (the email layer does). Keep parameters bound through the `sql` template; never interpolate strings.
- **Mail secrets**: passwords exist decrypted only inside a function call. They are never logged, never put in an `AppError` context, never returned to the client, and never written to the fake store's logs (the fake's `password` file is test data).
- **Tests**: co-located. Anything importing `@/test/db` is integration (real Postgres via Testcontainers). Mail integration tests use the fake transport with a temp directory (`fs.mkdtempSync(path.join(os.tmpdir(), "dfmail-"))`), never the network. Pure parsing tests are unit tests.
- **Renamed and refactored tests** keep every assertion; only names and wiring change (rule 10).
- **Logging**: `console.warn`/`console.error` with a `[mail.*]` prefix and ids only (account id, folder, uid counts), never message bodies or addresses beyond the account's own.
- **Git**: `git --no-optional-locks` for read-only commands; one commit per task.

## 8. Phases and tasks

### Phase 0: Start, audit of Part 1, fixes

At the end: Part 2's progress file and environment are in place, Part 1 has had an independent audit, and findings R1 to R6 (except R6, which belongs to Phase 1) plus the audit's blockers and majors are fixed.

#### Task 0.1 - Start Part 2: progress files, kit and baseline

**Goal:** Begin Part 2 from a verified green baseline.

**Files:** rename `PROGRESS.md` → `PROGRESS-P1.md`; create `PROGRESS.md`; modify `docs/dealflow/UPSTREAM.md`

**Steps:**
1. Apply the section 4 checks and the known-environment commands. If the kit sits in a subfolder, create the root `PLAN-PART2.md` symlink and copy the kit's `scripts/check-progress.mjs` over the root one, as section 4 says.
2. `git mv PROGRESS.md PROGRESS-P1.md`. Create `PROGRESS.md` in the section 0 format, with every task of this plan, `- Phase 0: {git rev-parse HEAD}` and the Environment section filled in.
3. Run the baseline and record the counts in the QA log as `- Baseline: typecheck … lint … build … unit {n}/{n} · integration {n}/{n}`:
   1. `pnpm typecheck`
   2. `pnpm lint`
   3. `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`
   4. `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pnpm test:unit`
   5. `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pnpm test:integration`: this is one of the two allowed full runs; the two release tests are expected to fail until Task 0.5.
4. `pnpm add mailparser@3.10.0` and `pnpm add -D @types/mailparser@3.9.0`.
5. Commit `0.1: Start Part 2: progress files, kit and baseline`, tick.

**Verify:** `node scripts/check-progress.mjs` → `PROGRESS CHECK OK`.

**Done when:** the baseline is recorded and the new progress file exists.

#### Task 0.2 - Independent audit of Part 1

**Goal:** Get a fresh-context review of Part 1, because Part 1's own review fell back to a self-review.

**Files:** create `AUDIT-P1.md`; modify `PROGRESS.md`

**Steps:**
1. Use the harness `subagent` tool. Its task text is the full content of `.dsh/qa.md` (the kit file), a blank line, then:
   ```
   Part 1 audit of PLAN-PART1.md. Base commit ec6a018. Focus: (1) every sign-in route: origin check, rate limit, no account enumeration, token hashing and single-use consumption, cookie flags; (2) dev-login unreachable outside development/test on loopback; (3) bootstrap election cannot create a second admin or an admin for a non-seed email; (4) invite acceptance and password change; (5) every AI server action checks CSRF, actor, visibility and the rate limit before the provider; (6) AI usage caps checked before every provider call and usage recorded after; (7) assistant: allow-list enforced, writes only on confirm, only by the action owner, no HTML injection in rendering; (8) no secrets or .env values committed; (9) Part 1 contracts in PLAN-PART1.md section 6 vs the code.
   ```
   Do not summarise your own work for it. If the subagent tool is unavailable, run `./qa.sh` with the same request (from wherever the kit's `qa.sh` sits). If that fails too, do the audit yourself per Appendix B and log `qa unavailable (qa.sh failed) - self-review`.
2. Write `AUDIT-P1.md`: one table row per finding (ID `A{n}`, severity, file:line, finding, required fix, test). Then add R1 to R7 from 6.1, with the status column set to `OPEN`.
3. Log `- Audit P1: subagent (fresh context) · QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors}` in the QA log.
4. Commit `0.2: Independent audit of Part 1`, tick.

**Verify:** `grep -cE "^\| (A[0-9]+|R[1-7]) " AUDIT-P1.md` → at least 7.

**Done when:** `AUDIT-P1.md` lists every finding with a status column.

#### Task 0.3 - Assistant confirm race and AI timeouts

**Goal:** Fix R1 and R2.

**Files:** create `src/constants/ai.ts`, `src/features/ai/aiAuthFixes.integration.test.ts`; modify `src/features/ai/assistant/assistant.ts`, `src/features/ai/actions/dealActions.ts`, `composeActions.ts`, `filterActions.ts`, `src/features/ai/openrouterProvider.ts`, `AUDIT-P1.md`

**Steps:**
1. Write the R1 test first in `aiAuthFixes.integration.test.ts` (`makeTestDb`, `ScriptedAiProvider`, the setup style of `assistant.integration.test.ts`): create a pending `add_note` action, run `Promise.all([confirmAiAction(...), confirmAiAction(...)])`, expect exactly one ok result and exactly one note row. See it fail.
2. Implement the claim-first confirm and reject (6.1 R1). The test passes.
3. R2: `AI_ACTION_TIMEOUT_MS = 60_000` in `src/constants/ai.ts`; the five provider-calling actions use it; the OpenAI client is constructed with `timeout: 55_000, maxRetries: 1`.
4. Mark R1 and R2 `FIXED` in `AUDIT-P1.md` with the test name.
5. Commit `0.3: Assistant confirm race and AI timeouts`, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/ai/aiAuthFixes.integration.test.ts` → passes; `grep -c "SIG()" src/features/ai/actions/dealActions.ts src/features/ai/actions/composeActions.ts src/features/ai/actions/filterActions.ts` → every count `0`.

**Done when:** concurrent confirms run the write once and AI actions allow 60 s.

#### Task 0.4 - Password reset after email-link sign-in and atomic lockout

**Goal:** Fix R3 and R5.

**Files:** create `src/db/schema/sessionAuth.ts`, `src/features/auth/sessionAuth.ts`, migration `drizzle/00NN_dealflow_session_auth.sql`; modify `src/db/schema/index.ts`, `src/app/auth/password/route.ts`, `src/app/auth/magic/verify/route.ts`, `src/app/auth/invite/accept/route.ts`, `src/features/auth/passwordActions.ts`, `src/features/auth/passwordLogin.ts`, `src/app/(app)/settings/profile/page.tsx`, `src/app/(app)/settings/profile/PasswordCard.tsx`, `src/app/(auth)/login/LoginPanel.tsx`, `src/constants/authStrings.ts`, `src/features/ai/aiAuthFixes.integration.test.ts`, `AUDIT-P1.md`

**Steps:**
1. Add the R3 and R5 tests to `aiAuthFixes.integration.test.ts` first:
   1. A magic-link session (record `magic_link`) changes the password without the current one. The service function under test is `changePasswordForSession(db, { actorId, sessionId, currentPassword?, newPassword }, signal)`: extract the body of `changePasswordAction` into it so the test can call it.
   2. A password session without the current password gets `E_AUTH_013`.
   3. A magic-link session whose `authenticated_at` is updated to 20 minutes ago gets `E_AUTH_013`.
   4. 10 concurrent wrong `passwordLogin` calls lock the account.

   See them fail.
2. Schema + migration (`pnpm exec drizzle-kit generate --name dealflow_session_auth`, use the next free number); `DATABASE_URL=… pnpm db:migrate:dev`.
3. `sessionAuth.ts` per 6.5. The three local sign-in routes call `recordSessionAuth` right after `createSession` succeeds.
4. `changePasswordForSession` with the R3 rule; `changePasswordAction` calls it. The profile page passes `requiresCurrent = hasPassword && !(await recentLinkSignIn(...))` to `PasswordCard`, which hides "Current password" and shows `password-reset-note` when false. Add the login hint line to the password tab.
5. Atomic lockout (6.1 R5).
6. Mark R3 and R5 `FIXED` in `AUDIT-P1.md`.
7. Commit `0.4: Password reset after email-link sign-in and atomic lockout`, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/ai/aiAuthFixes.integration.test.ts src/features/auth/localAuth.integration.test.ts` → passes.

**Done when:** all R3/R5 cases pass and Part 1's local-auth tests still pass.

#### Task 0.5 - Scripts, release tests and audit leftovers

**Goal:** Fix R4, bake the environment into the scripts, and close every remaining audit blocker and major.

**Files:** modify `package.json`, `src/features/release/router.test.ts`, `AUDIT-P1.md`, plus the files the audit's findings name

**Steps:**
1. Scripts per 6.2.
2. R4 per 6.1.
3. For every `A{n}` blocker or major in `AUDIT-P1.md`: write a failing test where the finding is about behaviour, fix it, and mark it `FIXED` with the test name; or mark it `ACCEPTED` with a one-line reason if it contradicts section 6 or this plan's decisions. Minors: fix when cheap, else `ACCEPTED`/`DEFERRED` with a reason.
4. Commit `0.5: Scripts, release tests and audit leftovers`, tick.

**Verify:** `pnpm test:unit` → passes without exporting TZ in the shell; `grep -c "OPEN" AUDIT-P1.md` → `0`.

**Done when:** no finding is left OPEN.

#### Task 0.6 - Phase 0 QA gate

**Goal:** Prove the fixes before the mail refactor.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile; the audit was Task 0.2). Record the Phase 1 base commit, commit `0.6: Phase 0 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/ai src/features/auth src/features/release` → passes

**QA focus:** Definition of done items 1 and 2; the R1 claim is a single statement; no session can skip the current password except a recent link sign-in.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: Provider-neutral schema and MailProvider

At the end: the columns are provider-neutral, every mail path runs through `MailProvider` with a Gmail adapter, Message-IDs use the mailbox domain, and notification emails use the system mailer. No user-visible change.

#### Task 1.1 - Rename the Gmail columns

**Goal:** One migration and one mechanical rename, with every existing test still green.

**Files:** modify `src/db/schema/email.ts`, `src/db/schema/emailAttachments.ts`, every `.ts`/`.tsx` file under `src/` and `scripts/` that the rename touches; create `drizzle/00NN_dealflow_mail_rename.sql` (+ meta)

**Steps:**
1. Rename the four schema properties and SQL names (6.5). Run `pnpm exec drizzle-kit generate --custom --name dealflow_mail_rename` and write the SQL from 6.5 into the new file.
2. Run the mechanical rename command from 6.5.
3. `pnpm typecheck`; fix what the rename missed (string-built SQL, fixture objects, seed scripts).
4. `DATABASE_URL=… pnpm db:migrate:dev` against the dev database. The owner's running stack keeps working: its app reads the new names only after a rebuild; note that in Owner actions.
5. Run the email-related tests:
   ```bash
   pnpm exec vitest run --project unit src/features/email src/features/leads src/features/notifications
   pnpm exec vitest run --project integration src/features/email src/features/leads src/features/notifications
   ```
   Fix until they pass.
6. Add the rename to `docs/dealflow/UPSTREAM.md` (upstream email fixes must be ported by hand from now on). Log one Decision listing the counts of touched files.
7. Commit `1.1: Rename the Gmail columns`, tick.

**Verify:** `git grep -nE "gmail_(thread|message|attachment)_id|last_history_id" -- src scripts` → no lines (`parent_gmail_message_id` aliases are allowed); `git grep -nE "\bgmail(Thread|Message|Attachment)Id\b|\blastHistoryId\b" -- src scripts` → no lines.

**Done when:** the migration applies and the email, leads and notification tests pass.

#### Task 1.2 - Mail tables

**Goal:** The new tables from 6.5 exist.

**Files:** create `src/db/schema/mail.ts`, `src/constants/mail.ts`, `drizzle/00NN_dealflow_mail_tables.sql` (+ meta); modify `src/db/schema/index.ts`, `src/config/env.ts`, `.env.example`, `src/constants/errorIds.ts`, `src/constants/jobNames.ts`

**Steps:**
1. `src/constants/mail.ts`: `SpecialUse`, `MAIL_PRESETS` (6.11), `MAIL_FOLDER_SYNC_USES = ["inbox", "sent", "archive", "junk", "trash"]`, `MAIL_BATCH_SIZE = 25`, `MAIL_BACKFILL_WINDOW_DAYS = 90`, `MAIL_BACKFILL_MAX_PER_RUN = 300`, `MAIL_APPEND_MAX_TRIES = 12`, `MAIL_RELIST_MINUTES = 15`, `MAIL_THREAD_FALLBACK_DAYS = 30`, `MAIL_SEND_TIMEOUT_MS = 30_000`.
2. Schema per 6.5; env per 6.3; error IDs per 6.4; job names `PGBOSS_QUEUE_MAIL_BACKFILL = "mail.backfill"`, `PGBOSS_QUEUE_MAIL_APPEND = "mail.append-sent"`.
3. `pnpm exec drizzle-kit generate --name dealflow_mail_tables`; check that the SQL creates exactly the five tables and indexes; migrate the dev database; `pnpm env:sync`.
4. Commit `1.2: Mail tables`, tick.

**Verify:** `DATABASE_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive pnpm db:migrate:dev` → exits 0; `pnpm exec vitest run --project unit src/constants src/config` → passes.

**Done when:** the tables exist and the env parses.

#### Task 1.3 - MailProvider interface and Gmail adapter

**Goal:** The provider abstraction and its Gmail implementation.

**Files:** create `src/features/mail/provider/types.ts`, `resolve.ts`, `gmailAdapter.ts`, `gmailAdapter.test.ts`

**Steps:**
1. Types per 6.6. `resolve.ts` per 6.6 (the IMAP branch returns `err(E_MAIL_015)` until Task 2.4 wires `createImapProvider`).
2. `gmailAdapter.ts` per 6.6 mapping, with `gmailProviderForTest`.
3. `gmailAdapter.test.ts` (unit, `FakeGmailClient`, no db: `describeSent`/`send` take what they need from the fake): `send` returns the fake's id and thread id; `findSent` maps a search hit and a miss; `fetchAttachment` decodes base64url; `replyHeaders` builds `inReplyTo` and `references` from a parent message.
4. Commit `1.3: MailProvider interface and Gmail adapter`, tick.

**Verify:** `pnpm exec vitest run --project unit src/features/mail/provider` → passes.

**Done when:** the adapter satisfies the interface and its tests pass.

#### Task 1.4 - Send path on MailProvider

**Goal:** Outbox, reconcile, interactive send, CRM copy, worker send and replay repair use `MailProvider`.

**Files:** modify `src/features/email/outbox.ts`, `outboxClaim.ts`, `outboxReconcile.ts`, `send.ts`, `sendStore.ts`, `workerSendCrm.ts`, `sendReplayRepair.ts`, `worker.ts` (`runSendJob`), `actions.ts`, and their tests

**Steps:**
1. Replace `gmail: GmailClient` with `provider: MailProvider` in these functions per 6.12. `processSendAttempt` builds the MIME as today, then calls `provider.send({ raw: mime, messageIdHeader, envelope, providerThreadId, parentProviderMessageId, attemptId })`; reply threading comes from `provider.replyHeaders`. `reconcile` uses `provider.findSent`. `storeOutboundCopy` takes the `SentMessage`. `ensureLocalCopyForReplay` uses `provider.describeSent`.
2. `runSendJob` resolves the provider with `resolveMailProvider` (deps injectable as `resolveProvider`) and closes it in `finally`.
3. Update the affected tests to pass `gmailProviderForTest(db, accountId, fake)`; assertions unchanged.
4. Commit `1.4: Send path on MailProvider`, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/email` → passes; `grep -n "GmailClient" src/features/email/{outbox,outboxReconcile,send,sendStore,workerSendCrm,sendReplayRepair}.ts` → no lines.

**Done when:** the send path compiles against `MailProvider` and the email tests pass.

#### Task 1.5 - Sync, attachments and trash on MailProvider; neutral inbound store

**Goal:** The remaining paths use the provider, and inbound storage is shared.

**Files:** create `src/features/mail/inbound/storeInbound.ts`, `src/features/mail/parse/types.ts` (`ParsedMailMessage`); modify `src/features/email/applyMessages.ts`, `mimeParse.ts`, `worker.ts` (`runSyncJob`), `attachmentDownload.ts`, `threadTrash.ts`, `actions.ts`, `spamSweepAll.ts`, `src/app/api/email/attachments/[attachmentId]/route.ts`, `src/entrypoints/sweepSpam.ts`, and their tests

**Steps:**
1. `ParsedMailMessage` per 6.8 in `parse/types.ts`. `parseGmailMessage` also extracts `Message-ID`, `In-Reply-To` and `References` with its existing `header()` helper. `applyMessages` maps its parse result into `ParsedMailMessage` (`direction: "inbound"`, `rfc822MessageId` from the header or `""`).
2. Move the thread upsert, message insert, attachments, realtime event and arrival collection into `storeInboundMessage` (6.9). It writes `email_message_headers` when `rfc822MessageId` is non-empty. `applyMessages` calls it; behaviour is unchanged.
3. `runSyncJob` → `resolveMailProvider` + `provider.sync`. `resolveAttachmentDownload` → `provider.fetchAttachment`. `trashThread` → `provider.trashThread`. `sweepAllMailboxes` skips accounts that have credentials.
4. Update the affected tests.
5. Commit `1.5: Sync, attachments and trash on MailProvider; neutral inbound store`, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/email` → passes.

**Done when:** no email path outside the Gmail adapter's internals takes a `GmailClient`.

#### Task 1.6 - Message-ID domain and notification emails via the system mailer

**Goal:** Fix R6 and move notification emails to SMTP.

**Files:** modify `src/features/email/outbox.ts` (`enqueueSend`), `src/features/email/mime.test.ts`, `src/features/notifications/email/job.ts` and its tests, `AUDIT-P1.md`

**Steps:**
1. Add the R6 unit test to `mime.test.ts`, then make `enqueueSend` pass the account's domain (6.1 R6).
2. Notification job per 6.12; update its tests to inject the new `SendFn`.
3. Mark R6 `FIXED`.
4. Commit `1.6: Message-ID domain and notification emails via the system mailer`, tick.

**Verify:** `pnpm exec vitest run src/features/email/mime.test.ts src/features/notifications` → passes.

**Done when:** Message-IDs carry the mailbox domain and notifications no longer need a mailbox.

#### Task 1.7 - Phase 1 QA gate

**Goal:** Prove the refactor changed nothing visible.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 2 base commit, commit `1.7: Phase 1 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/email src/features/notifications src/features/leads` → passes

**QA focus:** Definition of done items 3, 4 and 5; no assertion was weakened in the renamed tests; the Gmail adapter's sync is the unchanged `syncMailbox`.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: IMAP/SMTP transports and connecting a mailbox

At the end: the parser and thread keys are tested, both transports exist, and a user can connect an IMAP/SMTP mailbox in Settings.

#### Task 2.1 - Parser, Message-IDs, subjects and Bcc stripping

**Goal:** The pure parsing helpers from 6.8, test-first.

**Files:** create `src/features/mail/parse/messageId.ts`, `subject.ts`, `stripBcc.ts`, `parseRaw.ts`, `parse.test.ts`

**Steps:**
1. Write `parse.test.ts` (unit) first:
   1. `normalizeMessageId` cases: `"<A@B.com>"`, `" a@b.com "`, `"x <a@b> y"`, empty.
   2. `normalizeSubject` and `hadReplyPrefix`: `"Re: RE: Fwd: Hello"`, `"AW: Angebot"`, `"Re[2]: x"`, `"Hello"`.
   3. `stripBccHeader` removes a folded `Bcc` and keeps the body line `Bcc: in body`.
   4. `parseRawMessage` on three fixtures built in the test (plain, multipart with one attachment, missing Message-ID): ids, `references` order, `direction` for an own-address sender, `idx:` attachment ids, synthetic id.
   5. `parseTooLarge` gives the preview text and no attachments.
2. Implement until green.
3. Commit `2.1: Parser, Message-IDs, subjects and Bcc stripping`, tick.

**Verify:** `pnpm exec vitest run --project unit src/features/mail/parse` → passes (at least 12 tests).

**Done when:** every case passes.

#### Task 2.2 - Transport interfaces and real transports

**Goal:** `ImapSession`/`SmtpSender` over imapflow and nodemailer.

**Files:** create `src/features/mail/transport/types.ts`, `real.ts`, `factory.ts`

**Steps:**
1. Types per 6.7. `real.ts` per 6.7 (each method under 60 lines; error mapping in one helper `mapImapError(e, command)`).
2. `factory.ts` `getMailTransportFactory()` returns the real factory when `MAIL_PROVIDER_FAKE_DIR` is empty (the fake arrives in Task 2.3).
3. Commit `2.2: Transport interfaces and real transports`, tick.

**Verify:** `pnpm typecheck` → exits 0. (Real behaviour is proved by `pnpm mail:live-check` in Task 5.2.)

**Done when:** the real factory compiles against the interfaces.

#### Task 2.3 - Filesystem fake transport

**Goal:** A deterministic fake behind the same interfaces.

**Files:** create `src/features/mail/transport/fakeStore.ts`, `fake.ts`, `fake.test.ts`; modify `factory.ts`

**Steps:**
1. Implement 6.7's fake. `fakeStore.ts` has relative imports and `node:` built-ins only.
2. `factory.ts` returns the fake when `MAIL_PROVIDER_FAKE_DIR` is set.
3. `fake.test.ts` (unit, temp dir):
   1. Login creates the folders; a wrong second password gives `E_MAIL_004`.
   2. `append` → `listUids`/`fetchSources` return it and `status.uidNext` advances.
   3. `move` returns a uid map and the file moves.
   4. SMTP `send` delivers to a recipient's INBOX and logs to `_smtp`.
   5. `fakeResetUidValidity` bumps `uidValidity`.
4. Commit `2.3: Filesystem fake transport`, tick.

**Verify:** `pnpm exec vitest run --project unit src/features/mail/transport` → passes.

**Done when:** the fake behaves as specified.

#### Task 2.4 - Credentials and the connect service

**Goal:** Test, save and resolve IMAP mailboxes.

**Files:** create `src/features/mail/connect/presets.ts`, `credentials.ts`, `connect.ts`, `actions.ts`, `connect.integration.test.ts`, `src/features/mail/provider/imapProvider.ts` (skeleton: `createImapProvider` with every method returning `E_MAIL_015` except `close`); modify `src/features/mail/provider/resolve.ts`, `src/features/email/oauth.ts`, `src/features/email/disconnect.ts`

**Steps:**
1. Implement 6.11's service and action. Wire `resolveMailProvider` to `createImapProvider` when credentials exist. Gmail `exchangeAndBind` and `disconnect` delete the credentials row.
2. `connect.integration.test.ts` (`makeTestDb`, fake transport with a temp dir):
   1. Connect stores an encrypted password: the bytea row is not the plain password, and `loadImapCredentials` returns it.
   2. Connect resets cursors and locations.
   3. A short password gives `E_MAIL_004`.
   4. A second user connecting the same address gets `E_MAIL_006`.
   5. `resolveMailProvider` returns `kind "imap"` after connecting and `kind "gmail"` after the credentials row is deleted.
3. Run exactly that file.
4. Commit `2.4: Credentials and the connect service`, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/mail/connect/connect.integration.test.ts` → passes (at least 5 tests).

**Done when:** mailboxes connect, and the provider resolves by credentials.

#### Task 2.5 - Email sync settings: connect form and Gmail option

**Goal:** The Settings UI from 6.11.

**Files:** create `src/app/(app)/settings/email-sync/ConnectMailboxForm.tsx`; modify `EmailSyncClient.tsx`, `page.tsx`, `strings.ts` and their tests; `src/features/email/mailboxOwnership.ts` (status read gains `provider` and `imapHost`)

**Steps:**
1. Build the form and connected state per 6.11 and the hooks in 6.13, using `Input`, `Select`, `Switch`, `Button` from `src/components/ui/`. The form calls `connectImapMailboxAction` with `readCsrfToken()` and then `router.refresh()`.
2. The page passes `googleEnabled = authMethods().google` and the mailbox's provider.
3. Update the existing tests for the new structure (Gmail-only copy changes).
4. Commit `2.5: Email sync settings: connect form and Gmail option`, tick.

**Verify:** `pnpm exec vitest run "src/app/(app)/settings/email-sync"` → passes.

**Done when:** the page renders the form, errors and connected state.

#### Task 2.6 - Phase 2 QA gate

**Goal:** Prove the parsing, transports and connect flow.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 3 base commit, commit `2.6: Phase 2 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/mail` → passes

**QA focus:** Definition of done items 6 and 12 (fake part); passwords never logged or returned; the fake store has no `@/` imports.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: IMAP sync engine

At the end: connected IMAP mailboxes sync INBOX, Sent, Archive, Junk and Trash into threads, with cursors, backfill, trash state and IDLE.

#### Task 3.1 - Folders, cursors and locations

**Goal:** The building blocks the sync loop uses.

**Files:** create `src/features/mail/imap/folders.ts`, `cursors.ts`, `locations.ts`

**Steps:**
1. `discoverFolders` per 6.9.
2. `cursors.ts`: `getCursors(db, accountId)`, `upsertCursor(db, row)`, `deleteFolderState(db, accountId, folder)` (cursor + that folder's locations).
3. `locations.ts`: `upsertLocation(tx, row)` (`ON CONFLICT DO NOTHING`), `locationsFor(db, accountId, providerMessageIds)`, `folderLocations(db, accountId, folder, uidValidity)`, `deleteLocations(db, accountId, folder, uids)`.
4. Commit `3.1: Folders, cursors and locations`, tick.

**Verify:** `pnpm typecheck` → exits 0.

**Done when:** the helpers compile with the 6.5 schema.

#### Task 3.2 - Inbound apply and threading

**Goal:** Store fetched messages once, with locations, headers and thread keys.

**Files:** create `src/features/mail/parse/threadKey.ts`, `src/features/mail/imap/applyInbound.ts`, `src/features/mail/imap/trashState.ts`

**Steps:**
1. `resolveThreadKey` per 6.8 step order.
2. `applyFolderMessages` per 6.9 (existing message → location only; new message → thread key, `storeInboundMessage`, location, in one transaction).
3. `reconcileTrash` per 6.9.
4. Commit `3.2: Inbound apply and threading`, tick.

**Verify:** `pnpm typecheck` → exits 0. (Behaviour is tested in Task 3.6.)

**Done when:** the apply path compiles and follows 6.8/6.9.

#### Task 3.3 - Incremental sync and UIDVALIDITY reset

**Goal:** `syncImapAccount` and the IMAP provider's `sync`.

**Files:** create `src/features/mail/imap/sync.ts`; modify `src/features/mail/provider/imapProvider.ts`

**Steps:**
1. `syncImapAccount` per 6.9 steps 1 to 5.
2. `createImapProvider(...).sync` opens the session from `loadImapCredentials`, runs `syncImapAccount` with the account owner (`hydrateOwner` from `src/features/email/syncCursor.ts`) and closes the session in `finally`. `E_MAIL_004` sets the account status to `error` with `last_error_id`, so the settings page shows "Update password".
3. Commit `3.3: Incremental sync and UIDVALIDITY reset`, tick.

**Verify:** `pnpm typecheck` → exits 0.

**Done when:** an IMAP account syncs through `runSyncJob`.

#### Task 3.4 - Initial window and background backfill

**Goal:** 90 days first, older mail later.

**Files:** create `src/features/mail/imap/backfill.ts`; modify `src/server/worker.ts` (register), `src/features/mail/imap/sync.ts` (enqueue after initial)

**Steps:**
1. Implement 6.9 backfill: queue creation, handler with `AbortSignal.timeout(120_000)`, self re-enqueue.
2. Register it from `registerAllJobs`.
3. Commit `3.4: Initial window and background backfill`, tick.

**Verify:** `pnpm typecheck` → exits 0.

**Done when:** the initial sync enqueues a backfill that walks back in 90-day windows.

#### Task 3.5 - IDLE manager and sync cadence

**Goal:** Faster arrival and a configurable poll.

**Files:** create `src/features/mail/idle/idleManager.ts`; modify `src/server/worker.ts`, `src/features/email/syncReEnqueue.ts`, `src/features/email/worker.ts` (`jitterFor`), and their tests

**Steps:**
1. `startIdleManager` per 6.9, started after `registerEmailJobs`; the interval is cleared when the worker stops (store the timer and clear it on `SIGTERM` alongside pg-boss's stop).
2. Cadence and jitter from env per 6.9; update the two existing tests for the env-driven cadence (default 90 keeps their numbers).
3. Commit `3.5: IDLE manager and sync cadence`, tick.

**Verify:** `pnpm exec vitest run src/features/email/syncReEnqueue.test.ts src/features/email/worker.test.ts` → passes.

**Done when:** the worker starts the manager and the cadence follows `MAIL_SYNC_CADENCE_SECONDS`.

#### Task 3.6 - Sync integration tests

**Goal:** Prove the sync engine against the fake transport and a real database.

**Files:** create `src/features/mail/imap/sync.integration.test.ts`

**Steps:**
1. Setup: `makeTestDb`; a user from `@/db/testing`; connect via `connectImapMailbox` with the fake transport over a temp dir; a person whose email matches the senders below. Then write these tests and run until green:
   1. **Initial sync**: three messages in INBOX (one older than 90 days by `Date` header and fake internal date) → two stored, cursor set, backfill job enqueued (spy on the enqueue dep).
   2. **Threading by headers**: B with `In-Reply-To: A` arrives after A → same `provider_thread_id` as A; C whose `References` start with A arrives before its parent D (`In-Reply-To: D`, `References: A D`) → C and later D join A's thread.
   3. **Subject fallback**: "Re: Pricing" with no reply headers from a participant of an existing "Pricing" thread within 30 days → same thread; the same subject from a stranger → new thread.
   4. **Dedupe**: the same Message-ID in INBOX and Sent → one `email_messages` row, two locations, direction `outbound` when sent by the account address.
   5. **Trash state**: move all of a thread's messages to Trash in the fake, sync → `trashed_at` set; move one back to INBOX, sync → cleared.
   6. **UIDVALIDITY reset**: `fakeResetUidValidity(INBOX)` → the folder's cursor and locations are rebuilt, no duplicate messages.
   7. **Linking**: an inbound message from the known person links the new thread to that person (and their open deal, if the factory created one).
   8. **Unchanged skip**: a second sync with no changes fetches no sources (spy on the session).
   9. **Backfill**: run the backfill handler → the old message is stored and `backfillDone` is set once the clamp is reached.
2. Commit `3.6: Sync integration tests`, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/mail/imap/sync.integration.test.ts` → passes (at least 9 tests).

**Done when:** all nine cases pass.

#### Task 3.7 - Phase 3 QA gate

**Goal:** Prove sync before sending builds on it.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 4 base commit, commit `3.7: Phase 3 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/mail src/features/email` → passes

**QA focus:** Definition of done items 7, 8 and 9; cursors advance only after a folder's messages are stored; UID listing never uses SEARCH; HIGHESTMODSEQ 0 is treated as unknown.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Sending and mailbox actions over IMAP/SMTP

At the end: IMAP mailboxes send, thread replies, land copies in Sent, respect the limits, download attachments and trash threads.

#### Task 4.1 - SMTP send and the Sent APPEND

**Goal:** The IMAP provider's `send` with a durable APPEND.

**Files:** create `src/features/mail/imap/send.ts`, `appendSent.ts`; modify `src/features/mail/provider/imapProvider.ts`, `src/server/worker.ts` (register `mail.append-sent` every 5 minutes)

**Steps:**
1. Implement 6.10 steps 1 and 3 to 6 (the throttle in step 2 arrives in Task 4.3), including the 6.10 timing rule (30 s interactive budget, independent 15 s APPEND signal) in `send.ts`/`sendEmail`.
2. The append retry job rebuilds the raw message with `buildMime` from the attempt payload and the stored `message_id_header`. Register it with `boss.schedule(PGBOSS_QUEUE_MAIL_APPEND, "*/5 * * * *")`.
3. Commit `4.1: SMTP send and the Sent APPEND`, tick.

**Verify:** `pnpm typecheck` → exits 0.

**Done when:** a send over IMAP delivers by SMTP and APPENDs to Sent.

#### Task 4.2 - Reply headers, thread ids and reconcile for IMAP

**Goal:** Replies thread correctly, and unknown outcomes reconcile.

**Files:** modify `src/features/mail/provider/imapProvider.ts`

**Steps:**
1. `replyHeaders`, `findSent` and `describeSent` per 6.10.
2. Commit `4.2: Reply headers, thread ids and reconcile for IMAP`, tick.

**Verify:** `pnpm typecheck` → exits 0.

**Done when:** the three methods follow 6.10.

#### Task 4.3 - Send throttle

**Goal:** Stay under the host's sending limits without failing sends.

**Files:** create `src/features/mail/imap/throttle.ts`; modify `src/features/mail/imap/send.ts`, `src/features/email/outbox.ts`, `src/features/email/outboxReconcile.ts` (`SendOutcome`), `src/features/email/send.ts` (input check), `src/features/email/composer/sendFailure.ts` (message for `E_MAIL_010`)

**Steps:**
1. `checkDailyQuota` per 6.10 step 2. The deferral handling lives in `processSendAttempt`.
2. `sendEmail` rejects more than `MAIL_SEND_MAX_RECIPIENTS` recipients up front with `E_MAIL_010`. The composer shows "This email has more than {max} recipients. Split it into smaller sends."
3. Commit `4.3: Send throttle`, tick.

**Verify:** `pnpm typecheck` → exits 0.

**Done when:** over-limit sends defer and oversize recipient lists are refused.

#### Task 4.4 - Attachments on demand and trash MOVE

**Goal:** The last two provider methods for IMAP.

**Files:** create `src/features/mail/imap/attachments.ts`, `src/features/mail/imap/trash.ts`; modify `src/features/mail/provider/imapProvider.ts`

**Steps:**
1. `fetchAttachment` and `trashThread` per 6.10.
2. Commit `4.4: Attachments on demand and trash MOVE`, tick.

**Verify:** `pnpm typecheck` → exits 0; `grep -c "E_MAIL_015" src/features/mail/provider/imapProvider.ts` → `0`.

**Done when:** every `MailProvider` method is implemented for IMAP.

#### Task 4.5 - Send integration tests

**Goal:** Prove sending, threading, limits and mailbox actions end to end on the fake.

**Files:** create `src/features/mail/imap/send.integration.test.ts`

**Steps:**
1. Setup as in Task 3.6, plus `FakeStorageClient` for attachments where `sendEmail` needs storage. Tests:
   1. A new send through `sendEmail` → the recipient's fake INBOX has the message without a `Bcc` header; the sender's fake `Sent` has it with `Bcc`; `email_messages` has an outbound row with `provider_thread_id = imap:{message id}`; `email_message_headers` has the row; `mail_sent_appends` is `done`.
   2. A reply in that thread → `In-Reply-To` and `References` point at the parent; same `provider_thread_id`.
   3. An APPEND failure (inject a session whose `append` returns `E_MAIL_012`) → the send still succeeds, `mail_sent_appends` stays `pending` with `tries 1`, and the retry job with a working session sets `done`.
   4. Daily limit: create the provider with `limits: { dailyRecipients: 2 }` (pass it to `processSendAttempt` through the injected provider resolver), two sent recipients already logged → the third attempt is deferred (`status pending`, `scheduled_at` about 24 h after the oldest send), and no SMTP log entry is added.
   5. 251 recipients through `sendEmail` (default cap 250) → `E_MAIL_010` before any attempt row exists.
   6. Reconcile: an attempt with `send_started_at` 15 minutes ago whose message is in fake `Sent` → `sent`.
   7. Attachment download: an inbound message with one attachment → `fetchAttachment` returns the same bytes.
   8. Trash: `trashThread` moves the thread's INBOX copies to fake `Trash`, and the next sync keeps `trashed_at` set.
   9. Message-ID domain: the attempt's `message_id_header` ends with the account address's domain.
2. Run exactly that file.
3. Commit `4.5: Send integration tests`, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/mail/imap/send.integration.test.ts` → passes (at least 9 tests).

**Done when:** all nine cases pass.

#### Task 4.6 - Phase 4 QA gate

**Goal:** Prove the IMAP provider is complete.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 5 base commit, commit `4.6: Phase 4 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/mail src/features/email src/features/notifications` → passes

**QA focus:** Definition of done items 10 and 11; Bcc never on the wire; a failed APPEND never fails a send; deferral never drops a send.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 5: Hardening and hand-off

At the end: browser proof, a live Purelymail proof, the full integration suite, smoke, one independent review, the final checklist and report.

#### Task 5.1 - E2E mail spec and screenshots

**Goal:** Prove mailbox connect, sync, reply and threading in a browser on the production build.

**Files:** modify `scripts/e2e/e2e-env.mjs`, `e2e/helpers.ts`; create `e2e/06-mail.spec.ts`

**Steps:**
1. Env and helpers per 6.14.
2. `06-mail.spec.ts` (admin state; `test.setTimeout(180_000)`):
   1. `/settings/email-sync` → fill Email address `demo1@example.com`, App password `short` → "Test and connect" → `connect-error` contains "rejected" (`p2-email-sync-error`) (the fake rejects passwords under 8 characters).
   2. Password `fake-app-password-1` → connected; `mailbox-status` has `data-provider="imap"` (`p2-email-sync-connected`; take `p2-email-sync-connect` of the empty form before filling).
   3. `deliverFakeMail` from the first person in `fixtures()` (extend `seed-session.ts` to also write `personEmail`, `personName` and that person's deal id, if any) with subject `E2E inbound {Date.now()}` and Message-ID `<e2e-a-{ts}@example.net>` → `waitForText` on `/inbox` (`p2-inbox-synced`).
   4. Open the thread → reply "Thanks, sending details shortly." → the reader shows the sent message (`p2-thread-reply`); `fakeFolder("demo1@example.com", "Sent")` has one more file; the person's mailbox INBOX has the reply with `In-Reply-To: <e2e-a-{ts}@example.net>`.
   5. `deliverFakeMail` a second inbound with `References: <e2e-a-{ts}@example.net> {reply message id}` → the same thread shows three messages (`p2-thread-three-messages`).
   6. When the person has a deal: `/deals/{dealId}` shows the thread subject on the timeline (`p2-deal-email-timeline`); otherwise take the screenshot on the person page and log a Decision.
   7. Request a magic link for demo1 → open it → Continue → `/settings/profile` shows `password-reset-note` (`p2-profile-password-reset`).
3. Run `pnpm e2e` (all specs `00` to `06`); fix product or spec bugs, never weaken assertions.
4. Commit `5.1: E2E mail spec and screenshots`, tick.

**Verify:** `ls e2e/screenshots/p2-*.png | wc -l` → `8`.

**Done when:** `pnpm e2e` passes `00` to `06` and the 8 screenshots exist.

#### Task 5.2 - Live Purelymail check

**Goal:** Prove the real transports, parser and thread keys against our mail host.

**Files:** create `scripts/dealflow/mail-live-check.ts`, `docs/dealflow/mail-live-check.json`; modify `package.json`, `docs/dealflow/HEALTH-CHECK.md`

**Steps:**
1. Implement 6.14's script, then run `pnpm mail:live-check` (allowed by rule 13).
2. If a check fails because of our code, fix it and re-run (stuck rule applies). If it fails because of the host (for example a Bcc copy behaviour), record it in `HEALTH-CHECK.md → Notes for Part 3` and as an Open issue.
3. Commit `5.2: Live Purelymail check`, tick.

**Verify:** `node -e "console.log(require('./docs/dealflow/mail-live-check.json').status)"` → `ok` (or `skipped` with the section 4 owner action).

**Done when:** the result file is committed.

#### Task 5.3 - Integration suite, smoke and docs

**Goal:** The full integration run, the container smoke, demo data and documentation.

**Files:** create `docs/dealflow/MAIL.md`; modify `README.md`, `scripts/seed-demo-email.ts` (only if the rename left it inconsistent), `docs/dealflow/HEALTH-CHECK.md`

**Steps:**
1. `pnpm test:integration` (background, poll the log). Fix failures (stuck rule) or log them with the cause.
2. `DOCKER_BUILDKIT=0 pnpm smoke` → `SMOKE PASS`. The migrate step now includes the Part 2 migrations.
3. `pnpm db:seed:demo` against a scratch database (as Part 1 did) still works after the rename.
4. `docs/dealflow/MAIL.md`: the provider layer, how a user connects Purelymail (Settings → Email sync, app password), the presets, the limits and env vars, the Purelymail facts (no Sent auto-save, SEARCH lag, IDLE latency, HIGHESTMODSEQ 0), the fake transport, and how to run `pnpm mail:live-check`. README gets a short "Email" section pointing to it.
5. Record the results in `HEALTH-CHECK.md → Part 2 end`. Commit `5.3: Integration suite, smoke and docs`, tick.

**Verify:** `grep -c "SMOKE PASS\|integration" docs/dealflow/HEALTH-CHECK.md` → at least 2.

**Done when:** suite, smoke and seed results are recorded and the docs exist.

#### Task 5.4 - Independent review and hardening

**Goal:** One fresh-context review of Part 2, then fix what it finds.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is the full `.dsh/qa.md`, a blank line, then `Final review of PLAN-PART2.md. Base commit {Phase 0 base}.` Wait for `QA RESULT: PASS` or the numbered list. Fallbacks: `qa.sh` with the same request, then an evidenced self-review (log `qa unavailable (qa.sh failed) - self-review`).
2. Fix every blocker and major; commit `5.4: QA fixes round {r}`; re-run the phase gate commands; review again. At most 3 rounds. Minors: fix when cheap, else Open issues.
3. Work through Open issues (prefix fixed ones `RESOLVED:`).
4. Log `- Independent review: subagent (fresh context) round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n}`.
5. Commit `5.4: Independent review and hardening`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`.

**Done when:** the review ran (or the logged fallback), and blockers and majors are fixed or logged with reasons.

#### Task 5.5 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order; one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `5.5: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least 18.

**Done when:** every checklist item has a line.

#### Task 5.6 - Final report and completion

**Goal:** Hand the owner a truthful report and finish the run.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write the PROGRESS.md → Final report:
   - **Definition of done** (items 1 to 13, each PASS, FAIL or NOT VERIFIED with evidence);
   - **Checklist** (from 5.5);
   - **Owner actions** (de-duplicated, numbered, exact commands), including: rebuild the dev stack so the app reads the renamed columns; connect your Purelymail mailbox in Settings → Email sync with an app password; send yourself one email from the CRM and check Sent; reply from your mail app and watch it thread in the CRM within about 15 seconds;
   - **Decisions worth reviewing** (every `CONTRACT CHANGE:`, every group of changed tests);
   - **Open issues**;
   - **Notes for Part 3** (every new screen with its route and screenshot name, the upstream files changed, the environment section).
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `5.6: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`.

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- Products, currencies, forecast, quotes, invoices, automations, webhooks, forms, scheduler, Insights, projects, recycle bin UI, backups, REST API, PWA and the design pass (Parts 3 to 10).
- The shared CC/BCC "copy the CRM" capture address (catch-all routing): moved to a later part.
- Syncing read/unread or other IMAP flags, Drafts sync, server-side mail rules (ManageSieve), CalDAV/CardDAV.
- More than one mailbox per user (`email_accounts.user_id` stays unique), shared team mailboxes.
- OAuth2/XOAUTH2 for IMAP (Purelymail uses app passwords), Microsoft 365 presets.
- Changing the inbox, composer or thread UI beyond what the provider switch needs.
- Moving existing `src/features/email/` files into new folders, or rewriting the Gmail sync engine.
- Pushing, tagging, publishing or deploying.

## 10. ASK and STOP triggers

This plan has no ASK triggers; the only STOP cases are the fatal ones in section 4.

| Situation | Safe default | Owner action to log |
|---|---|---|
| Probe credentials missing | Task 5.2 writes `skipped` | "Add MAIL_PROBE_USER and MAIL_PROBE_PASS to .env and run `pnpm mail:live-check`" |
| Subagent tool unavailable | `qa.sh`, then the evidenced self-review | "Run the review yourself in a new harness session with `.dsh/qa.md` and the request from Task 5.4" |
| Docker not running | skip integration, e2e and smoke (SKIPPED) | "Start Docker Desktop and run `pnpm test:integration`, `pnpm e2e`, `DOCKER_BUILDKIT=0 pnpm smoke`" |
| The owner's dev app still runs the old build | leave it running; do not touch the stack | "Rebuild the dev stack: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no -v)" |
| A pre-existing upstream test fails | leave the test, log `PRE-EXISTING:` with the test name | "Review the pre-existing failures in PROGRESS.md" |
| Live check fails because of the host | record it in HEALTH-CHECK.md and Open issues | "Read docs/dealflow/mail-live-check.json and tell the planner" |
| Google env in `.env` is partial (app refuses to boot) | not the builder's file; e2e and tests use their own env | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty after the last commit.
2. `pnpm install --frozen-lockfile` exits 0.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes (record the count; at least the Phase 0 baseline plus the new tests).
6. `pnpm test:integration` result from Task 5.3 recorded with counts.
7. `pnpm build` exits 0.
8. `pnpm e2e` passes `00` to `06`.
9. `ls e2e/screenshots/p2-*.png | wc -l` is `8`, and every Part 1 screenshot still exists.
10. `DOCKER_BUILDKIT=0 pnpm smoke` printed `SMOKE PASS` and no `dealflow-smoke` container or volume remains.
11. `docs/dealflow/mail-live-check.json` has `status: ok` (or `skipped` with the owner action).
12. `git grep -nE "gmail_(thread|message|attachment)_id|last_history_id" -- src scripts` → no lines.
13. `git grep -n "GmailClient" -- src/features/email/outbox.ts src/features/email/outboxReconcile.ts src/features/email/send.ts src/features/email/sendStore.ts src/features/email/workerSendCrm.ts src/features/email/sendReplayRepair.ts src/features/email/attachmentDownload.ts src/features/email/threadTrash.ts` → no lines.
14. `git grep -n "GOOGLE_WORKSPACE_DOMAIN" -- src/features/email/outbox.ts` → no lines.
15. `git grep -nE "password|passwordEnc" -- src/features/mail | grep -iE "console\.|AppError\(.*password"` → no lines.
16. `AUDIT-P1.md` has no `OPEN` row.
17. Every env var added in 6.3 appears in `.env.example`.
18. `grep -rn $'\u2014' $(git --no-optional-locks diff --name-only {Phase 0 base} HEAD -- src scripts docs e2e README.md)` → no lines.
19. `pnpm check:progress --final` passes.
20. `docs/dealflow/MAIL.md` exists and `docs/dealflow/UPSTREAM.md` lists the column rename.

## 12. Report back

No mid-run reporting. PROGRESS.md is updated after every task and gate; the run ends with the final report (Task 5.6). The owner pastes PROGRESS.md back to the planner, together with `docs/dealflow/mail-live-check.json`.

## Appendix A - DeepSeek Harness overlays

Create these files exactly if either is missing. `loop.sh` passes the first with `--patch`; `qa.sh` passes both.

File: `.dsh/builder.patch.yml`

```yaml
# Dealflow builder overlay for DeepSeek Harness: dsh --profile dealflow --patch .dsh/builder.patch.yml
# A patch row replaces that row's whole config, so each row restates every field it keeps.

# Model for every agent this run creates. DSH_MODEL / DSH_PROVIDER override the defaults.
# The official DeepSeek provider reads DEEPSEEK_API_KEY from the shell or ~/.dsh/.env.
- id: agent-default-model
  config:
    provider: !!js process.env.DSH_PROVIDER || 'deepseek-official'
    model: !!js process.env.DSH_MODEL || 'deepseek-flash'

# Keep the code and the plan out of request metadata: no session-log upload.
- id: session-log-deepseek
  config:
    enabled: false

# Shell commands run with the unconfined local executor: pnpm's store, Docker and Playwright write outside
# this folder, and headless dsh has nobody to approve sandbox escalations. File tools stay confined to the
# folder by fs-sandbox (DSH_PERMISSION_MODE=workspace-write), and .dsh/guard.bash vets every command.
- id: bash-sandbox
  disabled: true

# Permission presets bundle a sandbox mode and refuse an unconfined executor. Without them the session uses
# DSH_PERMISSION_MODE for file tools and the default approval policy (ask, which fails closed headless).
- id: permission
  disabled: true

- insert:
    - id: bash-local
      name: '@deepseek-ai/dsh-bash-local'
      config:
        timeoutMs: 900000
        maxTimeoutMs: 1800000
```

File: `.dsh/qa.patch.yml`

```yaml
# Reviewer overlay, applied after builder.patch.yml by qa.sh. DSH_QA_MODEL lets the checker use another model.
- id: agent-default-model
  config:
    provider: !!js process.env.DSH_QA_PROVIDER || process.env.DSH_PROVIDER || 'deepseek-official'
    model: !!js process.env.DSH_QA_MODEL || process.env.DSH_MODEL || 'deepseek-flash'

# The reviewer goes back to the confined shell: its commands may write only inside this folder.
- id: bash-local
  disabled: true

- id: bash-sandbox
  disabled: false
  config:
    timeoutMs: 900000

- id: permission
  disabled: false
```

## Appendix B - `.dsh/qa.md`

```markdown
# Dealflow QA reviewer

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md, PLAN-PART2.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

If the request is exactly "Reply exactly: QA READY", reply with the two words QA READY and do nothing else.

Hard rules for you:
- You are read-only. Never create, edit, move or delete files, never commit, reset, checkout, stash or push. Commands that only read or that write build output inside this folder (typecheck, lint, build, unit tests) are fine.
- Never call ask_user_question; nobody will answer.
- Never print the contents of .env.
- Stop any server you start.

Input: "Final review of {plan file}. Base commit {hash}.", "Phase N gate review of {plan file}. Base commit {hash}.", or "Part N audit of {plan file}. Base commit {hash}. Focus: ..." (an audit works through every focus item explicitly and reports each one).

Procedure:
1. Read the named plan's sections 2, 3, 6 and 7 and every task (for a phase review: that phase's tasks). For PLAN-PART2.md also read PLAN-PART1.md section 6 where it is referenced.
2. Run `git --no-optional-locks diff --stat {hash}..HEAD` and read the changed files that matter.
3. Run `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` and note the exact results (use the Environment commands in PROGRESS.md). Read PROGRESS.md for the e2e, integration and smoke results; check the screenshot files the plan lists exist in e2e/screenshots.
4. For every task: each listed file exists; each step is really implemented, not stubbed or left as a placeholder; section 6 contracts match exactly (paths, routes, status codes, redirects, error IDs, env vars, schema, prompts, test hooks); section 7 conventions hold; the task's "Done when" holds.
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; no em dashes in new files.
6. Ignore style nits and anything in section 9.

Output exactly one of:

QA RESULT: PASS
(one line per command you ran with its result)

or

QA RESULT: FAIL
1. [blocker|major|minor] file:line or route | what is wrong | what the plan requires (section/task) | how to fix
(at most 25 items, blockers first)
```

## Appendix C - `qa.sh`

```bash
#!/usr/bin/env bash
# Independent QA: a separate DeepSeek Harness process (fresh context) with the reviewer instructions in .dsh/qa.md.
# Usage: ./qa.sh "Final review of PLAN-PART2.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
set -u
cd "$(dirname "$0")"
REQUEST="${1:?pass the review request}"
PROFILE="${DSH_PROFILE:-dealflow}"
command -v dsh >/dev/null 2>&1 || { echo "QA RUNNER ERROR: dsh not found (npm install -g @deepseek-ai/dsh)"; exit 2; }
# The reviewer runs the confined shell (qa.patch.yml) and file tools limited to this folder.
export DSH_PERMISSION_MODE=workspace-write DSH_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1
export BASH_ENV="$PWD/.dsh/guard.bash" DEALFLOW_PROJECT_DIR="$PWD"
unset DSH_TOOLS_MODE
BEFORE="$(git --no-optional-locks status --porcelain 2>/dev/null)"
PROMPT="$(cat .dsh/qa.md)

$REQUEST"
OUT="$(dsh --profile "$PROFILE" --patch .dsh/builder.patch.yml --patch .dsh/qa.patch.yml "$PROMPT" 2>/dev/null)"
CODE=$?
AFTER="$(git --no-optional-locks status --porcelain 2>/dev/null)"
printf '%s\n' "$OUT"
if [ "$BEFORE" != "$AFTER" ]; then
  echo "QA WARNING: the working tree changed during the review; restore those files with git checkout -- <file>"
fi
if printf '%s' "$OUT" | grep -qE "QA RESULT:|QA READY"; then exit 0; fi
echo "QA RUNNER ERROR: no QA RESULT in the output (dsh exit $CODE)"
exit 1
```

## Appendix D - `scripts/check-progress.mjs`

```js
#!/usr/bin/env node
// Verifies PROGRESS.md against the plan and git history (fast verification profile).
// Usage: node scripts/check-progress.mjs          (during the run)
//        node scripts/check-progress.mjs --final  (before setting STATUS: COMPLETE)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART2.md";
const final = process.argv.includes("--final");
const plan = readFileSync(PLAN_FILE, "utf8");
const progress = readFileSync("PROGRESS.md", "utf8");
const problems = [];

const planId = (plan.match(/Plan ID:\s*([A-Za-z0-9._-]+)/) || [])[1];
if (planId && !progress.includes(planId)) problems.push(`PROGRESS.md does not carry plan id ${planId}`);
const tasks = [...plan.matchAll(/^#### Task (\d+\.\d+) [-\u2014] (.+)$/gm)].map((m) => ({ id: m[1], title: m[2].trim() }));
const ticked = new Set([...progress.matchAll(/^- \[x\] (\d+\.\d+)\b/gm)].map((m) => m[1]));
const base = (progress.match(/^- Phase 0: ([0-9a-f]{7,40})/m) || [])[1];
if (!base) problems.push('PROGRESS.md has no "- Phase 0: <hash>" base commit');
const range = base ? `${base}..HEAD` : "HEAD";
const subjects = execSync(`git --no-optional-locks log --format=%s ${range}`, { encoding: "utf8" }).split("\n").filter(Boolean);

for (const s of subjects) {
  if (/^\d+\.\d+\s*[-–,]\s*\d+\.\d+/.test(s)) problems.push(`combined commit not allowed: "${s}"`);
}
const qaLog = (progress.split(/^## QA log$/m)[1] || "").split(/^## /m)[0];
for (const t of tasks) {
  const committed = subjects.some((s) => s.startsWith(`${t.id}: `));
  if (ticked.has(t.id) && !committed) problems.push(`${t.id} is ticked but there is no commit "${t.id}: ..." since ${base}`);
  if (/QA gate$/.test(t.title) && ticked.has(t.id)) {
    const phase = t.id.split(".")[0];
    const line = qaLog.split("\n").find((l) => l.includes(`Phase ${phase} gate`));
    if (!line) problems.push(`${t.id} is ticked but the QA log has no "Phase ${phase} gate" line`);
    else if (!/commands (green|red)/i.test(line)) problems.push(`Phase ${phase} gate line must say "commands green" or "commands red"`);
  }
  if (/^Independent review/.test(t.title) && ticked.has(t.id)) {
    const line = qaLog.split("\n").find((l) => l.startsWith("- Independent review"));
    if (!line) problems.push(`${t.id} is ticked but the QA log has no "- Independent review" line`);
    else if (!/(qa\.sh|QA RESULT)/i.test(line)) problems.push("the Independent review line has no qa.sh result");
  }
}
if (final) {
  const last = tasks[tasks.length - 1];
  for (const t of tasks) if (t !== last && !ticked.has(t.id)) problems.push(`not done: ${t.id} ${t.title}`);
  if (/^##\s*Final report\s*\n+\(written/m.test(progress)) problems.push("Final report section is still empty");
}
if (problems.length) {
  console.log(problems.map((p) => `PROGRESS CHECK: ${p}`).join("\n"));
  process.exit(1);
}
console.log(`PROGRESS CHECK OK: ${ticked.size}/${tasks.length} tasks ticked, all with commits${final ? ", ready to complete" : ""}`);
```

## Appendix E - command guard

File: `.dsh/guard.bash`

```bash
# Sourced by every non-interactive `bash -c` the agent runs (BASH_ENV is exported by loop.sh and qa.sh).
# It hands the command string to guard.mjs before bash runs it; a blocked command exits 126 with the reason.
if [ -n "${BASH_EXECUTION_STRING:-}" ] && [ -n "${DEALFLOW_PROJECT_DIR:-}" ]; then
  if ! printf '%s' "$BASH_EXECUTION_STRING" | node "$DEALFLOW_PROJECT_DIR/.dsh/guard.mjs"; then
    exit 126
  fi
fi
```

File: `.dsh/guard.mjs`

```js
#!/usr/bin/env node
// Command guard for the Dealflow build. .dsh/guard.bash pipes each `bash -c` command string here.
// Shell commands run unconfined (pnpm, Docker and Playwright write outside the folder), so this blocks the
// commands the plan forbids. Exit 2 with a reason on stderr blocks; exit 0 allows.
import { readFileSync } from "node:fs";

let cmd = "";
try {
  cmd = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}
const block = (why) => {
  process.stderr.write(`blocked by Dealflow guard: ${why}. This is a hard limit in the plan; log it and continue.\n`);
  process.exit(2);
};
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART[12]\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
const DENY = [
  [/\/Users\/[^/\s]+\/Downloads\/DEALFLOW(\/|\s|$|["'])|\.\.\/DEALFLOW(\/|\s|$)/, "the old Dealflow app folder is off limits"],
  [/\bgit\s+push\b/, "git push"],
  [/\bgit\s+reset\s+--hard\b/, "git reset --hard"],
  [/\bgit\s+clean\b/, "git clean"],
  [/\bgit\s+(rebase|filter-branch|filter-repo)\b/, "history rewrite"],
  [/\bgit\s+branch\s+-D\b/, "deleting a branch"],
  [/\bgit\s+(checkout|restore)\s+(--\S*\s+)*\.(\s|$)/, "discarding all changes"],
  [/(^|[\s;&|(])sudo\s/, "sudo"],
  [/\brm\s+(-\S+\s+)*\S*\.git(\s|\/|$)/, "deleting git data"],
  [/\bdocker\s+(system|volume|image|container|builder|network)\s+prune\b/, "docker prune"],
  [/\bdocker\s+compose\b.*\bdown\b.*(\s-v\b|--volumes)/, "compose down with volumes"],
  [/\bdocker\s+volume\s+rm\b(?!(\s+dealflow-smoke_[a-z]+)+\s*$)/, "removing a volume other than dealflow-smoke_*"],
  [/\bdocker\s+(rm|rmi|kill|stop)\b(?!.*dealflow-smoke)/, "removing or stopping containers outside dealflow-smoke"],
  [/\b(npm|pnpm|yarn)\s+publish\b/, "publishing a package"],
  [/\bcurl\b[^|]*\|\s*(ba|z)?sh\b/, "piping a download into a shell"],
  [/DROP\s+DATABASE\s+(?!(IF\s+EXISTS\s+)?"?dealflow_e2e\b)/i, "dropping a database other than dealflow_e2e"],
  [/(^|[\s;&|])(cat|less|more|head|tail|bat|nl|strings|xxd|grep)\s+(\S+\s+)*(\S*\/)?\.env(\s|$)/, "printing .env"],
  [/>>?\s*\.env(\s|$)/, "writing .env directly (use scripts/dealflow/env-sync.mjs)"],
  [/\b(sed|perl)\s+-i\b.*(\s|\/)\.env(\s|$)/, "editing .env directly"],
  [/:3333\b/, "port 3333 belongs to the owner's old app"],
];
for (const [re, why] of DENY) if (re.test(cmd)) block(why);
// rm may only touch paths inside the project, /tmp or /private/tmp.
const project = process.env.DEALFLOW_PROJECT_DIR || process.cwd();
for (const m of cmd.matchAll(/\brm\s+([^;&|\n]*)/g)) {
  for (const arg of m[1].split(/\s+/).filter((a) => a !== "" && !a.startsWith("-"))) {
    const target = arg.replace(/^["']|["']$/g, "");
    if (/^(~|\$HOME|\.\.)/.test(target) || target === "/" || target === "*" || target === "/*") block("deleting outside the project");
    if (target.startsWith("/") && !["/tmp/", "/private/tmp/", `${project}/`].some((ok) => target.startsWith(ok))) {
      block("deleting outside the project");
    }
  }
}
const KIT_WRITES = [
  new RegExp(String.raw`(^|[^0-9&])>>?\s*` + KIT),
  new RegExp(String.raw`\b(rm|mv|truncate|tee)\b[^;&|]*\s` + KIT),
  new RegExp(String.raw`\b(sed|perl)\s+-i\b[^;&|]*\s` + KIT),
  new RegExp(String.raw`\bcp\b[^;&|]*\s` + KIT + String.raw`\s*($|[;&|])`),
];
if (KIT_WRITES.some((re) => re.test(cmd))) block("changing a kit file");
process.exit(0);
```

## Appendix F - `loop.sh`

```bash
#!/usr/bin/env bash
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART2.md (dealflow-wd-p2-v1) is finished.
# Usage: ./loop.sh      Env: DSH_MODEL (default deepseek-flash), MAX_RUNS (30), RUN_TIMEOUT_MIN (240), DSH_PROFILE (dealflow)
set -u
cd "$(dirname "$0")"
command -v dsh >/dev/null 2>&1 || { echo "dsh not found: npm install -g @deepseek-ai/dsh, then ./dsh-setup.sh"; exit 2; }
MAX_RUNS="${MAX_RUNS:-30}"
RUN_TIMEOUT_MIN="${RUN_TIMEOUT_MIN:-240}"
PROFILE="${DSH_PROFILE:-dealflow}"
# File tools stay inside this folder (workspace-write). Shell commands run unconfined through bash-local and
# every one passes .dsh/guard.bash first. Headless dsh has nobody to answer approvals, so they fail closed.
export DSH_PERMISSION_MODE=workspace-write DSH_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1
export BASH_ENV="$PWD/.dsh/guard.bash" DEALFLOW_PROJECT_DIR="$PWD"
unset DSH_TOOLS_MODE
PROMPT='Read PLAN-PART2.md in this folder in full and PROGRESS.md, then follow PLAN-PART2.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p2-v1; PLAN-PART1.md is the finished Part 1) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p2-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p2-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
digest() { if [ -f PROGRESS.md ]; then shasum PROGRESS.md | cut -d' ' -f1; else echo none; fi; }
mkdir -p .dsh/logs
STALLED=0
for i in $(seq 1 "$MAX_RUNS"); do
  if finished; then echo "Finished: $(grep -m1 -E '^STATUS:' PROGRESS.md)"; exit 0; fi
  LOG=".dsh/logs/run-$(printf '%02d' "$i")-$(date +%Y%m%d-%H%M%S).log"
  BEFORE="$(digest)"
  echo "=== builder run $i/$MAX_RUNS ($(date)) log: $LOG"
  dsh --profile "$PROFILE" --patch .dsh/builder.patch.yml "$PROMPT" >"$LOG" 2>&1 &
  PID=$!
  ( sleep $((RUN_TIMEOUT_MIN * 60)); kill -TERM "$PID" 2>/dev/null ) &
  WATCHDOG=$!
  wait "$PID"; CODE=$?
  kill "$WATCHDOG" 2>/dev/null; wait "$WATCHDOG" 2>/dev/null
  echo "run $i exited with $CODE; $(grep -m1 -E '^Current:' PROGRESS.md 2>/dev/null)"
  if grep -q "MISSING_CREDENTIAL" "$LOG"; then echo "Stopped: no DeepSeek API key. Put DEEPSEEK_API_KEY in ~/.dsh/.env and rerun."; exit 2; fi
  if [ "$(digest)" = "$BEFORE" ]; then STALLED=$((STALLED + 1)); else STALLED=0; fi
  if [ "$STALLED" -ge 3 ]; then echo "Stopped: PROGRESS.md unchanged for 3 runs. Read the last log in .dsh/logs/."; exit 1; fi
done
echo "Stopped after $MAX_RUNS runs without STATUS: COMPLETE. Check PROGRESS.md."
exit 1
```

## Appendix G - `dsh-setup.sh`

```bash
#!/usr/bin/env bash
# One-time setup of the DeepSeek Harness profile used by loop.sh and qa.sh. Safe to re-run (it rebuilds the profile).
set -u
cd "$(dirname "$0")"
PROFILE="${DSH_PROFILE:-dealflow}"
command -v dsh >/dev/null 2>&1 || { echo "dsh not found: npm install -g @deepseek-ai/dsh"; exit 2; }
echo "dsh $(dsh --version)"
dsh --profile "$PROFILE" --from-default-profile headless --help >/dev/null || { echo "could not create the $PROFILE profile from the headless template"; exit 1; }
dsh --profile "$PROFILE" --patch .dsh/builder.patch.yml --dump-config >/dev/null || { echo "builder overlay does not load"; exit 1; }
dsh --profile "$PROFILE" --patch .dsh/builder.patch.yml --patch .dsh/qa.patch.yml --dump-config >/dev/null || { echo "qa overlay does not load"; exit 1; }
echo "profile $PROFILE: ok"
BASH_ENV="$PWD/.dsh/guard.bash" DEALFLOW_PROJECT_DIR="$PWD" bash -c 'git push origin main' >/dev/null 2>&1
if [ $? -eq 126 ]; then echo "guard self-test (blocks git push): ok"; else echo "guard self-test: FAILED, do not run loop.sh"; exit 1; fi
BASH_ENV="$PWD/.dsh/guard.bash" DEALFLOW_PROJECT_DIR="$PWD" bash -c 'true' || { echo "guard self-test (allows true): FAILED"; exit 1; }
if [ -z "${DEEPSEEK_API_KEY:-}" ] && ! grep -q "^DEEPSEEK_API_KEY=" "${DSH_HOME:-$HOME/.dsh}/.env" 2>/dev/null; then
  echo "note: put DEEPSEEK_API_KEY=... in ${DSH_HOME:-$HOME/.dsh}/.env (keep it out of this project's .env)"
fi
echo "Next: ./qa.sh \"Reply exactly: QA READY\"  then  ./loop.sh"
```

## Appendix H - `AGENTS.md`

```markdown
# Agent notes for this repository

This folder is warpdrive, being extended into Dealflow by an autonomous build.

- If your task prompt names you the QA reviewer, follow `.dsh/qa.md` and ignore the rest of this file.
- Otherwise you are the builder: read `PLAN-PART2.md` in full (Part 1, `PLAN-PART1.md`, is finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART2.md rule 18.
```
