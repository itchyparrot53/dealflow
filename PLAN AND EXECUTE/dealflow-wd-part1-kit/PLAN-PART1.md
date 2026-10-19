# PLAN: Dealflow on warpdrive, Part 1: Foundation and AI layer

> Plan ID: dealflow-wd-p1-v1 · Written: 2026-10-19 · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`, headless runs) · Run mode: one autonomous run, Phases 0 to 6, fast verification profile, no human in the loop · Type: change to existing project

This folder holds warpdrive, an MIT-licensed Next.js CRM (about 112k lines, about 1,150 test files). We extend it in place and rename the product to Dealflow. `ROADMAP.md` (shipped with this kit) describes all ten parts; this file is Part 1 only. Part 1 puts the repo under git with an `upstream` remote, records a health check of the untouched app, probes our mail host (Purelymail), renames the product, removes Caddy from the default Docker topology, turns telemetry and the update check off by default, adds email + password and magic-link sign-in with safe bootstrap and invite emails, and adds a built-in AI layer (OpenRouter through the `openai` SDK, a deterministic fake, usage logging and monthly caps) with deal summary and scoring, email drafting, notes to activities, AI filters and an assistant whose writes wait for confirmation. Read `CLAUDE.md` before you start: its conventions are requirements for every file you touch.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 6** across fresh-context sessions started automatically by `loop.sh` (one phase per session). The code in this folder is the base you extend; where it differs from what this plan describes, the code is the source of truth for existing behaviour and you keep new work consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests green (bounded fixes) → log → end session
            └─ last phase: e2e + screenshots, integration suite, container smoke, ONE independent qa review, final checklist, final report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART1.md` in full and PROGRESS.md. If PROGRESS.md does not exist or its title line is not `# PROGRESS: dealflow-wd-p1-v1`, you are starting fresh at Task 0.1. Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task; `loop.sh` starts the next session with a fresh context. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 6.5, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** You run in DeepSeek Harness headless mode: nobody can answer, so never call `ask_user_question` and never wait for approval (an unanswered question can stall the run until the watchdog kills it). Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a real API key, mailbox credentials, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a CSS class, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 2 minutes and needs no browser; tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Phase 0 and Task 6.2.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.7, 1.6, 2.7, 3.5, 4.6, 5.5):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No `qa` review at phase gates (fast profile, owner's choice). The single independent review is Task 6.3.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. If an existing test breaks because this plan deliberately changed behaviour or visible text, update the test to the new contract and log a Decision naming the test file. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (API keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake or randomly generated values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted fake; email uses the capture or log mailer. The only real-network calls allowed are `git fetch upstream`, package installs, the public OpenRouter model list (`pnpm ai:check-model` without `--chat`) and `pnpm mail:probe` when the owner put probe credentials in `.env`.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` (the old app; reference for the planner only). Never delete anything outside this project folder. Never remove containers, volumes or images you didn't create in this run, never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (its containers, its images `dealflow-smoke-*` and volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: dev 3000/8080, e2e 3210/3211, container smoke 3310/3311/3312. Never touch port 3333 (the owner's old app).
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys or blanking the exact placeholder lines it wrote itself.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`. A kit file that is missing is recreated from the appendices, nothing else. A command blocked by the guard (`.dsh/guard.mjs`, message `blocked by Dealflow guard`) is a hard limit: do not try to work around it; log it and continue.

**Git**
19. Task 0.1 creates the repository, the `upstream` remote and the snapshot commit, and records the snapshot hash as `- Phase 0: {hash}`. Before each later phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits. Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands (`status`, `diff`, `log`) so no stray `.git/index.lock` is left behind.

**PROGRESS.md format** (create in Task 0.1 with every task of every phase listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p1-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {snapshot hash}

## Tasks
- [ ] 0.1 Repository, upstream remote and kit
(every task through 6.5, including every gate task, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 1234/1234

## Decisions
- 0.2: chose … over … because …

## Owner actions
- TODO(owner): …

## Open issues
- None

## Final report
(written in Task 6.5)
```

## 1. Goal

Turn this warpdrive checkout into the first working version of Dealflow for one company: our name, our deployment shape (behind the owner's own Caddy), sign-in that does not depend on Google, and a built-in AI layer that is cheap, capped, logged and fully testable without a key. Record the health of the untouched app and the real behaviour of our mail host so Part 2 (IMAP/SMTP) can be planned on facts.

## 2. Definition of done

1. The folder is a git repository on branch `main` with remote `upstream` = `https://github.com/sneg55/warpdrive.git`; the first commit is the snapshot of the code as received; every later task has its own commit.
2. `docs/dealflow/HEALTH-CHECK.md` records the baseline of the untouched app: tool versions, install, typecheck, lint, unit and integration results with counts, build, demo seed and an e2e click-through of 9 main pages with screenshots `p1-00-*`, plus every pre-existing failure and what was done about it.
3. `pnpm mail:probe` exists. With `MAIL_PROBE_USER`/`MAIL_PROBE_PASS` in `.env` it writes `docs/dealflow/mail-probe-result.json` (capabilities, special-use folders, mailbox status values, IDLE, Sent auto-save, APPEND and MOVE results); without them it writes a `skipped` result and an owner action exists.
4. The product reads "Dealflow" in UI text, page titles, notification emails, the MCP server name, `package.json`, README and docs. LICENSE keeps the original copyright line and adds ours. `src/features/branding/brand.test.ts` passes.
5. Telemetry and the update check are off by default (`DISABLE_TELEMETRY` and `DISABLE_UPDATE_CHECK` default `true`); the worker makes no GitHub call unless the owner turns it on.
6. `docker-compose.yml` has no Caddy service; app, ws and MinIO publish on configurable host binds and ports (default `127.0.0.1`); `docs/reverse-proxy.md` documents the three routes (app, `/_ws`, `s3.`) and ships `docs/reverse-proxy/Caddyfile.example`; the container smoke test in Task 6.2 passes.
7. Sign-in offers email + password (argon2id, 12 to 128 characters, 10 failures lock the account for 15 minutes) and a magic link (15 minutes, single use, confirm page, no account enumeration). Google appears only when its three env vars are set. Dev-login works only in development/test, on a loopback host, with `ALLOW_FIRST_LOGIN_ADMIN=true`. The first admin is `SEED_ADMIN_EMAIL`, created through a magic link or `pnpm auth:bootstrap-link`.
8. Inviting a user emails a set-password link (or shows the link when SMTP is not configured); the invite page sets name and password and signs the user in. Settings → Profile sets or changes the password and signs out other sessions.
9. The AI layer calls OpenRouter through the `openai` SDK with `OPENROUTER_MODEL` (default `deepseek/deepseek-v4.1-flash`); `AI_FAKE=true` gives deterministic answers; every call writes an `ai_usage` row; a company monthly cap and an optional per-user cap are enforced; Settings → AI (admins) shows provider, usage by feature and by user, and edits the caps.
10. The deal workspace shows an "AI insights" card: summary with health, risks and next steps (each with "Add" that creates the activity) and a 0 to 100 score with reasons.
11. The email composer has "Write with AI"; a deal note's menu has "Turn into activities" (proposals you can edit, then create); the deal filter dialog has "Describe a filter" that fills the conditions.
12. The top bar opens an assistant drawer: conversations persist, read tools answer from CRM data the user may see, write tools create pending actions that change nothing until "Confirm"; "Reject" cancels; another user cannot confirm someone else's action.
13. `CLAUDE.md` describes the fast verification profile and the Dealflow conventions; no contradicting test-first rule remains.
14. Gates: `pnpm typecheck`, `pnpm lint`, `pnpm build` and `pnpm test:unit` exit 0; `pnpm test:integration` passes (or every failure is logged with its cause); `pnpm e2e` passes specs `00` to `05`; every screenshot listed in 6.12 exists; `pnpm check:progress --final` passes.

## 3. Decisions already made

| Area | Decision |
|---|---|
| Codebase | warpdrive as received in this folder; extend in place, new work in new feature folders and new schema files |
| Runtime | Node 22 or newer (the machine has 24.16), pnpm 9.15.9 (`packageManager` field), Docker Desktop |
| Framework | Existing: Next 16 App Router, React 19, TypeScript 6, Drizzle 0.45 on Postgres 16, tRPC 11 (reads), server actions (mutations), shadcn/Radix + Tailwind 4, pg-boss 12, Vitest 4, Biome 2 + type-aware ESLint 10. No upgrades in this part |
| New dependencies | `openai@7.39.0`, `nodemailer@10.1.7` (ships its own types), `imapflow@2.5.7` (probe script only in Part 1), `@node-rs/argon2@2.2.2`; dev: `@playwright/test@1.64.1`. Exact versions (these packages release daily) |
| Sign-in | Email + password and magic link built in; Google SSO optional (all three `GOOGLE_*` vars set); no self-sign-up: accounts come from invites or the bootstrap of `SEED_ADMIN_EMAIL` |
| Passwords | argon2id via `@node-rs/argon2` defaults; 12 to 128 characters; stored in a new `user_credentials` table, not on `users` |
| Tokens | 32 random bytes, base64url in the link, sha256 in the database (same construction as warpdrive sessions); magic link 15 minutes, invite 7 days, admin setup 24 hours; single use |
| System mail | `SystemMailer` over nodemailer SMTP (`SMTP_*` env); log mode when `SMTP_HOST` is empty; capture mode (`MAIL_FAKE=true`) writes JSON files for tests |
| AI | OpenRouter via `openai` SDK with `baseURL`; default model `deepseek/deepseek-v4.1-flash` (live, supports tools and JSON mode; the dated snapshot `deepseek/deepseek-v4.1-flash-1017` can be set in `OPENROUTER_MODEL`); `AI_FAKE` deterministic provider; a scripted provider for unit/integration tests |
| AI limits | Singleton `ai_settings` row: enabled, company monthly cap (default 2,000,000 tokens), optional per-user cap; calendar month in UTC |
| Assistant tools | Reuse warpdrive's MCP tool registry (same permission checks as external MCP clients) through an allow-list; every write tool becomes a pending action |
| Deploy | Compose project `dealflow`; Caddy removed from the default compose; `Caddyfile` kept as `docs/reverse-proxy/Caddyfile.example` |
| Telemetry | PostHog and the GitHub update check stay in the code, both off by default |
| Branding | User-visible text, metadata, docs and package name become Dealflow. Internal identifiers stay (cookie names `wd_*`, storage keys, event names, Postgres user/database defaults `warpdrive`, MinIO bucket default `warpdrive`) |
| Verification | Fast profile: typecheck per task; gates = typecheck, lint, build, unit; integration once (baseline) plus once at the end; new tests only for risky server logic; Playwright e2e against a production build once at the end of the part; one independent review (Task 6.3) |
| E2E | Playwright 1.64.1, Chromium only, production build on port 3210, ws on 3211, throwaway database `dealflow_e2e` inside the dev Postgres, signed-in state written by a seed script |
| Builder model | DeepSeek Harness default provider `deepseek-official`, model from `DSH_MODEL` (default `deepseek-flash`, the harness's current Flash alias); set `DSH_MODEL` to the dated V4.1 Flash 1017 id if your DeepSeek account lists one. `DEEPSEEK_API_KEY` lives in `~/.dsh/.env` or the shell, never in this project |
| Builder tooling | DeepSeek Harness `dsh` 0.2.x headless runs (one phase per run) driven by `loop.sh`; profile `dealflow` made from the shipped headless template by `dsh-setup.sh`; overlays `.dsh/builder.patch.yml` and `.dsh/qa.patch.yml` (Appendix A); reviewer instructions `.dsh/qa.md` (Appendix B) run by `qa.sh` as a separate `dsh` process (Appendix C); `scripts/check-progress.mjs` (Appendix D); command guard `.dsh/guard.bash` + `.dsh/guard.mjs` (Appendix E); `loop.sh`, `dsh-setup.sh`, `AGENTS.md` (Appendix F to H) |
| Harness permissions | `DSH_PERMISSION_MODE=workspace-write`: file tools can only write inside this folder. Shell commands run through dsh's unconfined `bash-local` executor (pnpm's store, Docker and Playwright write outside the folder, and headless dsh has nobody to approve sandbox escalations), and every command first passes `.dsh/guard.bash` (exported as `BASH_ENV`), which blocks the hard-limit commands. The reviewer uses the confined `bash-sandbox` executor |

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Folder contents | warpdrive source, no `.git`, no `node_modules`; kit files present (`PLAN-PART1.md`, `ROADMAP.md`, `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`) | `.git` already present: skip `git init`, keep the history, log a Decision. Missing kit file: recreate it from Appendix A to H |
| Harness | you run inside `dsh` headless; `./qa.sh "Reply exactly: QA READY"` prints `QA READY` | `qa.sh` fails in Task 6.3: do the review yourself following Appendix B and log `qa unavailable (qa.sh failed) - self-review` with evidence for every check |
| `node -v` | v22 or newer | older than 22: fatal, Owner action "install Node 22 or newer", `STATUS: BLOCKED` |
| `pnpm -v` | 9.x | run `corepack enable pnpm` then re-check; if that fails, `npm install -g pnpm@9.15.9`; if both fail: fatal, Owner action, `STATUS: BLOCKED` |
| `docker info` | daemon running | Docker missing or stopped: Owner action "start Docker Desktop", skip compose, integration, e2e and smoke steps (log SKIPPED with reason), continue |
| `git fetch upstream` | works | no network or repo moved: plain snapshot commit without upstream history, log a Decision and Owner action `git remote add upstream … && git fetch upstream` |
| Ports 5433, 9000, 9001, 3000, 8080, 3210, 3211 | free | set `DEV_PG_PORT` / `MINIO_PORT` / `MINIO_CONSOLE_PORT` in the shell for compose and the e2e env, log a Decision |
| `pnpm exec playwright install chromium` | succeeds | e2e steps SKIPPED with Owner action `pnpm exec playwright install chromium`, continue |
| `.env` | may be absent, or contain only the owner's `MAIL_PROBE_*` lines | `env-sync.mjs` creates or completes it; never print it |
| Purelymail probe credentials | may be absent | probe writes `skipped`, Owner action to add them and run `pnpm mail:probe` |
| OpenRouter model list (`https://openrouter.ai/api/v1/models`) | lists `deepseek/deepseek-v4.1-flash` | unreachable: record "not checked"; listed without that id: keep the default, log an Open issue with the ids that start with `deepseek/deepseek-v4` |

## 5. Target structure

New (+) and changed (~) paths only.

```
+ PROGRESS.md
  (kit, not yours to edit: AGENTS.md, .dsh/, loop.sh, qa.sh, dsh-setup.sh, scripts/check-progress.mjs, PLAN-PART1.md, ROADMAP.md)
+ docs/dealflow/HEALTH-CHECK.md, UPSTREAM.md, mail-probe-result.json
+ docs/reverse-proxy.md, docs/reverse-proxy/Caddyfile.example        (Caddyfile moved here)
~ docs/deploy.md, docs/mcp-server.md, README.md, LICENSE, CLAUDE.md, package.json, pnpm-lock.yaml
~ docker-compose.yml, docker-compose.dev.yml, .env.example, .gitignore, biome.json, eslint.config.mjs
~ Caddyfile.test.ts, deployWorkflow.test.ts (deleted), Dockerfile.test.ts, vitest.setup.ts
+ playwright.config.ts
+ e2e/helpers.ts, e2e/00-health.spec.ts … e2e/05-assistant.spec.ts
+ scripts/auditConfig.ts
+ scripts/dealflow/env-sync.mjs, mail-probe.ts, check-model.ts, bootstrap-link.ts, smoke.mjs
+ scripts/e2e/e2e-env.mjs, e2e-server.mjs, build.mjs, seed-session.ts
~ src/config/env.ts                         (Google optional, SMTP, AI, WS_PORT, defaults)
~ src/constants/errorIds.ts (+ test), rateLimits.ts, strings.ts, settingsStrings.ts, enrichmentStrings.ts, docs.ts
+ src/constants/authStrings.ts, aiStrings.ts
~ src/entrypoints/ws.ts                     (env.WS_PORT)
+ src/db/schema/authLocal.ts, src/db/schema/ai.ts;  ~ src/db/schema/index.ts
+ drizzle/0075_dealflow_auth.sql, drizzle/0076_dealflow_ai.sql (+ meta)
+ src/features/branding/brand.test.ts
+ src/features/mailer/{types.ts, systemMailer.ts, smtpMailer.ts, logMailer.ts, captureMailer.ts, templates.ts, *.test.ts}
+ src/features/auth/{password.ts, authTokens.ts, credentials.ts, passwordLogin.ts, magicLink.ts,
                     bootstrapLocal.ts, invites.ts, originCheck.ts, sessionCookies.ts, authMethods.ts,
                     sessionsAdmin.ts, passwordActions.ts, localAuth.integration.test.ts, originCheck.test.ts}
~ src/features/auth/bootstrap.ts (export the lock key), devLogin.ts (+ test)
+ src/app/auth/password/route.ts, src/app/auth/magic-link/route.ts, src/app/auth/magic/verify/route.ts,
  src/app/auth/invite/accept/route.ts
~ src/app/auth/start/route.ts, src/app/auth/dev-login/route.ts
~ src/app/(auth)/login/page.tsx;  + src/app/(auth)/login/LoginPanel.tsx, magic/page.tsx, invite/page.tsx
~ src/features/identity/actions/invite.ts, src/app/(app)/settings/users/InviteUserForm.tsx
+ src/app/(app)/settings/profile/PasswordCard.tsx;  ~ src/app/(app)/settings/profile/page.tsx
+ src/features/ai/{types.ts, provider.ts, openrouterProvider.ts, fakeProvider.ts, scriptedProvider.ts,
                   chatJson.ts, usage.ts, aiSettings.ts, rateLimit.ts, errors.ts, dealContext.ts,
                   dealInsights.ts, emailDraft.ts, notesToActivities.ts, aiFilter.ts, router.ts,
                   assistant/{tools.ts, prompt.ts, assistant.ts, conversations.ts},
                   actions/{settingsActions.ts, dealActions.ts, composeActions.ts, filterActions.ts, assistantActions.ts},
                   ui/{DealAiCard.tsx, AiDraftButton.tsx, NotesToActivitiesDialog.tsx, AiFilterBox.tsx,
                       AssistantLauncher.tsx, AssistantSheet.tsx, AssistantMessages.tsx, renderSimpleText.tsx},
                   *.test.ts, *.integration.test.ts}
~ src/features/mcp/tools/types.ts (registry keeps definitions), src/server/trpc/root.ts (ai router)
~ src/features/deal-workspace/DealSidebar.tsx, history/NoteCard.tsx, src/features/email/composer/Composer.tsx,
  src/features/deals/CreateFilterModal.tsx, src/components/shell/TopBar.tsx, src/app/(app)/settings/SettingsNav.tsx
+ src/app/(app)/settings/ai/page.tsx, AiSettingsClient.tsx
```

## 6. Contracts

Everything below is exact. Where a contract names an existing warpdrive file or function, read it before you use it; if its real signature differs, adapt the call (decision policy), never the contract's behaviour.

### 6.1 Scripts (`package.json` → `scripts`, added)

| Script | Command |
|---|---|
| `check:progress` | `node scripts/check-progress.mjs` |
| `env:sync` | `node scripts/dealflow/env-sync.mjs` |
| `dev:up` | `docker compose -p dealflow -f docker-compose.yml -f docker-compose.dev.yml up -d postgres minio createbuckets` |
| `db:migrate:dev` | `tsx --env-file=.env src/entrypoints/migrate.ts` |
| `mail:probe` | `tsx scripts/dealflow/mail-probe.ts` |
| `ai:check-model` | `tsx scripts/dealflow/check-model.ts` |
| `auth:bootstrap-link` | `tsx --env-file=.env scripts/dealflow/bootstrap-link.ts` |
| `e2e:build` | `node scripts/e2e/build.mjs` |
| `e2e` | `pnpm e2e:build && playwright test` |
| `smoke` | `node scripts/dealflow/smoke.mjs` |

Package name `dealflow`, description `Dealflow: a self-hosted CRM for business development, built on warpdrive.` Version stays `1.2.0`. `author` stays; add `"contributors": ["Dealflow contributors"]`.

### 6.2 Environment (`src/config/env.ts`)

Changes to the `base` Zod object (everything else unchanged):

```ts
// Google SSO is optional: all three set = enabled, all three empty = disabled (superRefine below).
GOOGLE_OAUTH_CLIENT_ID: z.string().default(""),
GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(""),
GOOGLE_WORKSPACE_DOMAIN: z.string().default(""),
AUTH_PASSWORD_ENABLED: boolFromString.default(true),
AUTH_MAGIC_LINK_ENABLED: boolFromString.default(true),
// System mail (magic links, invites). Empty SMTP_HOST = log mode (links printed to the server log).
SMTP_HOST: z.string().default(""),
SMTP_PORT: z.coerce.number().int().positive().default(465),
SMTP_SECURE: boolFromString.default(true),
SMTP_USER: z.string().default(""),
SMTP_PASS: z.string().default(""),
SMTP_FROM: z.string().default("Dealflow <no-reply@localhost>"),
MAIL_FAKE: boolFromString.default(false),
MAIL_CAPTURE_DIR: z.string().default(".mail-capture"),
WS_PORT: z.coerce.number().int().positive().default(8080),
OPENROUTER_API_KEY: z.string().default(""),
OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
OPENROUTER_MODEL: z.string().min(1).default("deepseek/deepseek-v4.1-flash"),
AI_FAKE: boolFromString.default(false),
DISABLE_TELEMETRY: boolFromString.default(true),      // was false
DISABLE_UPDATE_CHECK: boolFromString.default(true),   // was false
```

Add `"SMTP_PASS"` and `"OPENROUTER_API_KEY"` to `SECRET_FILE_VARS`. Add to the `superRefine`:
- Google all-or-nothing: if some but not all of the three `GOOGLE_*` values are non-empty, issue on path `GOOGLE_OAUTH_CLIENT_ID` with message `GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_WORKSPACE_DOMAIN must be set together`.
- In production, at least one sign-in method: `AUTH_PASSWORD_ENABLED || AUTH_MAGIC_LINK_ENABLED || googleConfigured`, else issue on `AUTH_PASSWORD_ENABLED` with `at least one sign-in method must be enabled`.

`AI_FAKE` and `MAIL_FAKE` are allowed in production (the e2e harness runs a production build with both on); their factories print one `console.warn` when on.

`.env.example` gains these keys in a `# Sign-in`, `# System mail`, `# AI (OpenRouter)` and `# Docker host ports` section (empty or default values, comments in plain English), plus `APP_BIND=127.0.0.1`, `APP_PORT=3000`, `WS_BIND=127.0.0.1`, `WS_HOST_PORT=8080`, `MINIO_BIND=127.0.0.1`, `MINIO_PORT=9000`, `DEALFLOW_ENV_FILE=.env`, and the probe keys `MAIL_PROBE_USER=`, `MAIL_PROBE_PASS=`, `MAIL_PROBE_IMAP_HOST=imap.purelymail.com`, `MAIL_PROBE_IMAP_PORT=993`, `MAIL_PROBE_SMTP_HOST=smtp.purelymail.com`, `MAIL_PROBE_SMTP_PORT=465`, `MAIL_PROBE_TO=`. `APP_DOMAIN` and `ACME_EMAIL` move under `# Reverse proxy example (only for docs/reverse-proxy/Caddyfile.example)`. `.env.example.test.ts` keeps passing (the required keys stay listed).

`vitest.setup.ts`: no change is needed for the new keys (all have defaults); keep the Google test values (all three set = Google enabled in unit tests, which is what existing Google tests expect).

New helper `src/features/auth/authMethods.ts`:

```ts
import { env } from "@/config/env";
export interface AuthMethods { password: boolean; magicLink: boolean; google: boolean }
export function authMethods(): AuthMethods {
  const google =
    env.GOOGLE_OAUTH_CLIENT_ID !== "" && env.GOOGLE_OAUTH_CLIENT_SECRET !== "" && env.GOOGLE_WORKSPACE_DOMAIN !== "";
  return { password: env.AUTH_PASSWORD_ENABLED, magicLink: env.AUTH_MAGIC_LINK_ENABLED, google };
}
```

### 6.3 Error IDs (append to `ERROR_IDS`; add `"AI"` and `"MAIL"` to the domain list in `errorIds.test.ts`)

```ts
AUTH_INVALID_CREDENTIALS: "E_AUTH_007", // email/password pair rejected (also unknown email)
AUTH_LOCKED: "E_AUTH_008",              // too many failed password attempts; locked until lockedUntil
AUTH_TOKEN_INVALID: "E_AUTH_009",       // magic/invite/setup token unknown, expired, used or wrong kind
AUTH_PASSWORD_WEAK: "E_AUTH_010",       // password outside 12..128 characters
AUTH_METHOD_DISABLED: "E_AUTH_011",     // sign-in method turned off by env
AUTH_ORIGIN_REJECTED: "E_AUTH_012",     // unauthenticated POST failed the same-origin check
AUTH_PASSWORD_MISMATCH: "E_AUTH_013",   // current password wrong on change
AUTH_INPUT_INVALID: "E_AUTH_014",       // auth form or action input failed Zod validation
MAIL_SEND_FAILED: "E_MAIL_001",         // SMTP send rejected or failed
MAIL_CAPTURE_FAILED: "E_MAIL_002",      // capture mailer could not write its file
AI_UNAVAILABLE: "E_AI_001",             // no provider: OPENROUTER_API_KEY empty and AI_FAKE off
AI_DISABLED: "E_AI_002",                // ai_settings.enabled = false
AI_COMPANY_LIMIT: "E_AI_003",           // company monthly token cap reached
AI_USER_LIMIT: "E_AI_004",              // per-user monthly token cap reached
AI_BAD_OUTPUT: "E_AI_005",              // model reply failed JSON/schema twice
AI_PROVIDER_FAILED: "E_AI_006",         // provider call failed (network, 4xx/5xx)
AI_INPUT_INVALID: "E_AI_007",           // AI action input failed Zod validation or unsupported target
AI_CONVERSATION_NOT_FOUND: "E_AI_008",  // conversation missing or owned by another user
AI_ACTION_NOT_FOUND: "E_AI_009",        // pending action missing, decided, or owned by another user
AI_TOOL_FAILED: "E_AI_010",             // confirmed write tool returned an error
AI_RATE_LIMITED: "E_AI_011",            // more than 20 AI requests per minute for this user
```

### 6.4 Schema (new files; export both from `src/db/schema/index.ts`)

`src/db/schema/authLocal.ts`:

```ts
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity";

// Local credentials live beside users (not on it) so upstream changes to users.ts stay cherry-pickable.
export const userCredentials = pgTable("user_credentials", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash"),
  passwordUpdatedAt: timestamp("password_updated_at", { withTimezone: true }),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const authTokenKind = pgEnum("auth_token_kind", ["magic_link", "invite", "admin_setup"]);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: authTokenKind("kind").notNull(),
    tokenHash: text("token_hash").notNull().unique(), // sha256 base64url of the emailed token
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_user_kind_idx").on(t.userId, t.kind)],
);
export type UserCredentials = typeof userCredentials.$inferSelect;
export type AuthTokenKind = (typeof authTokenKind.enumValues)[number];
```

`src/db/schema/ai.ts`:

```ts
import { sql } from "drizzle-orm";
import { bigserial, boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { deals } from "./deals";
import { users } from "./identity";

export interface AiToolCallRecord { id: string; name: string; arguments: string }
export interface DealSummaryData {
  summary: string;
  health: "good" | "at_risk" | "stalled";
  risks: string[];
  nextSteps: { subject: string; typeKey: string; dueInDays: number }[];
}
export const aiActionStatus = pgEnum("ai_action_status", ["pending", "confirmed", "rejected", "failed"]);

export const aiSettings = pgTable(
  "ai_settings",
  {
    id: boolean("id").primaryKey().default(true),
    enabled: boolean("enabled").notNull().default(true),
    companyMonthlyTokenLimit: integer("company_monthly_token_limit").notNull().default(2_000_000),
    userMonthlyTokenLimit: integer("user_monthly_token_limit"), // null = no per-user cap
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [check("ai_settings_singleton", sql`${t.id} = true`)],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id), // null for future system callers (automations)
    feature: text("feature").notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull(),
    completionTokens: integer("completion_tokens").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_created_idx").on(t.createdAt), index("ai_usage_user_created_idx").on(t.userId, t.createdAt)],
);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("ai_conversations_user_idx").on(t.userId, t.updatedAt)],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seq: bigserial("seq", { mode: "number" }).notNull(), // total order inside a conversation
    conversationId: uuid("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<"user" | "assistant" | "tool">(),
    content: text("content"),
    toolCalls: jsonb("tool_calls").$type<AiToolCallRecord[]>(),
    toolCallId: text("tool_call_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId, t.seq)],
);

export const aiActions = pgTable(
  "ai_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seq: bigserial("seq", { mode: "number" }).notNull(),
    conversationId: uuid("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
    args: jsonb("args").notNull(),
    summary: text("summary").notNull(),
    status: aiActionStatus("status").notNull().default("pending"),
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("ai_actions_conversation_idx").on(t.conversationId, t.seq)],
);

export const dealAiInsights = pgTable("deal_ai_insights", {
  dealId: uuid("deal_id").primaryKey().references(() => deals.id, { onDelete: "cascade" }),
  summary: jsonb("summary").$type<DealSummaryData>(),
  summaryAt: timestamp("summary_at", { withTimezone: true }),
  score: integer("score"),
  scoreReasons: jsonb("score_reasons").$type<string[]>(),
  scoredAt: timestamp("scored_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

Migrations: `pnpm exec drizzle-kit generate --name dealflow_auth` (Task 2.1) and `--name dealflow_ai` (Task 3.1) produce `drizzle/0075_dealflow_auth.sql` and `drizzle/0076_dealflow_ai.sql`. Never edit earlier migrations. `0076` ends with `INSERT INTO "ai_settings" ("id") VALUES (true) ON CONFLICT DO NOTHING;` appended by hand after generation (keep the `--> statement-breakpoint` separator).

### 6.5 Local sign-in

**Constants** (`src/constants/authStrings.ts` holds UI text; numbers live in the feature files):
`PASSWORD_MIN = 12`, `PASSWORD_MAX = 128`, `LOGIN_MAX_FAILURES = 10`, `LOGIN_LOCK_MS = 15 * 60_000`, `AUTH_TOKEN_TTL_MS = { magic_link: 15 * 60_000, invite: 7 * 24 * 3_600_000, admin_setup: 24 * 3_600_000 }`. Rate limits added to `RATE_LIMITS`: `authPassword: { limit: 10, windowMs: MINUTE }`, `authMagicRequest: { limit: 5, windowMs: 15 * MINUTE }`, `authTokenVerify: { limit: 30, windowMs: MINUTE }`.

**Modules** (none of `password.ts`, `authTokens.ts`, `credentials.ts` may import `@/config/env`; the e2e seed script imports them):

| File | Exports |
|---|---|
| `password.ts` | `hashPassword(pw: string): Promise<string>`; `verifyPassword(hash: string, pw: string): Promise<boolean>`; `checkPasswordPolicy(pw: string): Result<string, AppError>` (E_AUTH_010) |
| `authTokens.ts` | `mintAuthToken(db, userId, kind, signal): Promise<{ token: string; expiresAt: Date }>` (for `invite` it first marks the user's open invite tokens consumed); `peekAuthToken(db, token, kinds, signal): Promise<Result<{ userId: string; email: string; name: string; kind: AuthTokenKind }, AppError>>`; `consumeAuthToken(db, token, kinds, signal): Promise<Result<{ userId: string; kind: AuthTokenKind }, AppError>>` |
| `credentials.ts` | `getCredentials(db, userId, signal)`; `setPassword(db, userId, pw, signal)` (hash, upsert, `passwordUpdatedAt = now`, counters reset); `markEmailVerified(db, userId, signal)` |
| `passwordLogin.ts` | `passwordLogin(db, { email, password }, signal): Promise<Result<{ userId: string }, AppError>>` |
| `bootstrapLocal.ts` | `ensureBootstrapAdmin(db, email, seedAdminEmail, opts: { allowAfterBootstrap: boolean }, signal): Promise<Result<{ userId: string } \| null, AppError>>` |
| `magicLink.ts` | `requestMagicLink(db, { email, next }, deps: { mailer: SystemMailer; baseUrl: string; seedAdminEmail: string }, signal): Promise<Result<{ sent: boolean }, AppError>>` |
| `invites.ts` | `issueInviteLink(db, userId, baseUrl, signal): Promise<{ url: string; expiresAt: Date }>`; `acceptInvite(db, { token, name, password }, signal): Promise<Result<{ userId: string }, AppError>>` |
| `originCheck.ts` | `isSameOriginPost(headers: Headers): boolean` |
| `sessionCookies.ts` | `applySessionCookies(res: NextResponse, sid: string, expiresAt: Date): void` (sets `wd_sid` with `sessionCookieOptions()` and a fresh `wd_csrf`, httpOnly false, secure true, sameSite lax, same expiry) |
| `sessionsAdmin.ts` | `revokeOtherSessions(db, userId, keepSessionId, signal): Promise<void>` |
| `passwordActions.ts` | `"use server"` `changePasswordAction(raw: { currentPassword?: string; newPassword: string }, csrfToken: string \| null): Promise<ActionResult<{ ok: true }>>` |

Token core (write exactly):

```ts
// authTokens.ts
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
const hashToken = (token: string): string => createHash("sha256").update(token).digest("base64url");
// mint: token = randomBytes(32).toString("base64url"); insert { userId, kind, tokenHash: hashToken(token), expiresAt: now + TTL }
// consume: ONE statement, so two concurrent clicks cannot both succeed.
const rows = await db
  .update(authTokens)
  .set({ consumedAt: sql`now()` })
  .where(and(eq(authTokens.tokenHash, hashToken(token)), inArray(authTokens.kind, kinds),
    isNull(authTokens.consumedAt), gt(authTokens.expiresAt, sql`now()`)))
  .returning({ userId: authTokens.userId, kind: authTokens.kind });
// then require users.isActive = true for that userId, else err(E_AUTH_009). No row -> err(E_AUTH_009).
// peek: same predicate as a SELECT joined to users (email, name, isActive), no write.
```

Password login (write exactly; the dummy verify keeps unknown-email timing close to a real check):

```ts
let dummyHash: Promise<string> | null = null;
const dummy = (): Promise<string> => (dummyHash ??= hashPassword("dealflow-timing-equaliser"));
export async function passwordLogin(db: Db, input: { email: string; password: string }, signal: AbortSignal) {
  const email = input.email.trim().toLowerCase();
  const [u] = await db.select({ id: users.id, isActive: users.isActive }).from(users).where(eq(users.email, email)).limit(1);
  signal.throwIfAborted();
  const cred = u === undefined ? undefined : await getCredentials(db, u.id, signal);
  if (u === undefined || !u.isActive || cred?.passwordHash == null) {
    await verifyPassword(await dummy(), input.password);
    return err(new AppError(ERROR_IDS.AUTH_INVALID_CREDENTIALS, "invalid credentials"));
  }
  if (cred.lockedUntil !== null && cred.lockedUntil > new Date()) {
    return err(new AppError(ERROR_IDS.AUTH_LOCKED, "locked", { until: cred.lockedUntil.toISOString() }));
  }
  if (!(await verifyPassword(cred.passwordHash, input.password))) {
    const failures = cred.failedLoginCount + 1;
    const lock = failures >= LOGIN_MAX_FAILURES;
    await db.update(userCredentials).set({
      failedLoginCount: lock ? 0 : failures,
      lockedUntil: lock ? new Date(Date.now() + LOGIN_LOCK_MS) : cred.lockedUntil,
    }).where(eq(userCredentials.userId, u.id));
    return err(new AppError(ERROR_IDS.AUTH_INVALID_CREDENTIALS, "invalid credentials"));
  }
  await db.update(userCredentials).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(userCredentials.userId, u.id));
  return ok({ userId: u.id });
}
```

Origin check (write exactly):

```ts
import { env } from "@/config/env";
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
// Unauthenticated POSTs (login, magic link, invite accept) have no CSRF cookie yet, so they rely on
// Origin / Sec-Fetch-Site. Same rule as csrf.ts: BASE_URL origin, or a same-host loopback origin outside production.
export function isSameOriginPost(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = headers.get("origin");
  if (origin === null) return site === "same-origin";
  if (origin === new URL(env.BASE_URL).origin) return true;
  if (env.NODE_ENV === "production") return false;
  try {
    const u = new URL(origin);
    return LOOPBACK.has(u.hostname) && u.host === headers.get("host");
  } catch {
    return false;
  }
}
```

**Bootstrap rule** (`ensureBootstrapAdmin`): compare lowercased `email` with lowercased `seedAdminEmail`; different or seed empty → `ok(null)`. Otherwise, inside one transaction holding `pg_advisory_xact_lock(BOOTSTRAP_LOCK_KEY)` (export the constant from `bootstrap.ts`): read `settings.bootstrappedAt`. If a user with that email exists: when bootstrap is open, set `isAdmin = true` and the admin permission set (from `readSeedHandles` / `ensureSeedData`), close bootstrap, return it; when closed, return it unchanged. If no user exists: when bootstrap is open or `allowAfterBootstrap`, run `ensureSeedData`, insert the user (name = the part of the email before `@`, `isAdmin: true`, admin permission set, `primaryVisibilityGroupId` = Everyone), insert the Everyone membership, set `bootstrappedAt = now()` when it was null, return it; else `ok(null)`. Magic-link requests call it with `allowAfterBootstrap: false`; `pnpm auth:bootstrap-link` calls it with `true` (shell access is the recovery path).

**Routes** (all POST bodies are `application/x-www-form-urlencoded`; all redirects are 303 to absolute URLs built from `env.BASE_URL`; `next` always passes through `safeLoginReturnPath` from `loginReturn.ts`, default `/pipeline`):

| Method, path | Behaviour |
|---|---|
| POST `/auth/password` | 404 if password sign-in disabled. 403 text `Forbidden` if `!isSameOriginPost`. Rate limit `authPassword` → `/login?error=rate_limited&method=password`. Body `email`, `password`, `next` (Zod: email ≤ 254, password ≤ 1024). `passwordLogin` ok → `createSession` → `applySessionCookies` → `next`. Any error (invalid, locked, bad input) → `/login?error=invalid_credentials&method=password`. |
| POST `/auth/magic-link` | 404 if magic link disabled. Origin check as above. Rate limit `authMagicRequest` → `/login?error=rate_limited&method=link`. Body `email`, `next`. Calls `requestMagicLink` and ignores its result (errors are logged with `console.error`). Always → `/login?sent=1&method=link`. |
| GET `/login/magic?token&next` | Page. `peekAuthToken(['magic_link'])`. Valid: card "Sign in as {email}" with a form POST to `/auth/magic/verify` carrying hidden `token` and `next` and a "Continue" button. Invalid: the expired card. |
| POST `/auth/magic/verify` | Origin check, rate limit `authTokenVerify`. `consumeAuthToken(['magic_link'])` → `markEmailVerified` → session → cookies → `next`. Error → `/login?error=link_expired&method=link`. |
| GET `/login/invite?token` | Page. `peekAuthToken(['invite','admin_setup'])`. Valid: form POST `/auth/invite/accept` with hidden `token`, inputs `name` (prefilled with the user's name unless it equals the email), `password`, `confirm`. Shows `?error=` messages. Invalid: the expired card. |
| POST `/auth/invite/accept` | Origin check, rate limit `authTokenVerify`. Validation before consuming: name 1..120 after trim (`name_missing`), password policy (`password_short`), `password === confirm` (`password_mismatch`) → back to `/login/invite?token={token}&error={code}`. Then `acceptInvite` → session → cookies → `/pipeline`. Token error → `/login?error=link_expired`. |
| GET `/auth/start` | Unchanged, but 404 when Google is not configured. |
| GET `/auth/dev-login` | Unchanged route, stricter core: `devLoginCore` also requires `nodeEnv` to be `development` or `test` and the request `host` header's hostname to be `localhost`, `127.0.0.1` or `[::1]`; the route passes `req.headers.get("host")`. Otherwise `err("disabled")` → 404. |

`requestMagicLink`: normalise email; `ensureBootstrapAdmin(..., { allowAfterBootstrap: false })`; look up the active user by email; none → `ok({ sent: false })` without sending. Otherwise mint a `magic_link` token, build `{baseUrl}/login/magic?token={token}&next={encodeURIComponent(next)}`, send `magicLinkMail` through the mailer; mailer error → return it; else `ok({ sent: true })`.

`acceptInvite`: policy check → `consumeAuthToken(['invite','admin_setup'])` → `UPDATE users SET name, invited_at = NULL` → `setPassword` → `markEmailVerified` → `ok({ userId })`.

Login error codes → messages (`authStrings.ts`): `invalid_credentials` "That email and password don't match, or the account is locked for 15 minutes after too many attempts. You can also sign in with an email link." · `rate_limited` "Too many attempts. Wait a few minutes and try again." · `link_expired` "That link has expired or was already used. Request a new one." · `auth_failed` "Google sign-in failed. Try again or use another method." Sent notice: "Check your email. If an account exists for that address, a sign-in link is on its way. It expires in 15 minutes." Invite errors: `name_missing` "Enter your name." · `password_short` "Use 12 to 128 characters." · `password_mismatch` "The passwords don't match." Expired card: "This link has expired or was already used." with a "Back to sign in" link.

**Invites**: `inviteUserAction` (in `src/features/identity/actions/invite.ts`) keeps its checks; after `inviteUser` succeeds it calls `issueInviteLink`, sends `inviteMail` via `getSystemMailer()`, and returns `ok({ userId, inviteUrl, emailSent })` where `emailSent = sendResult.ok && mailer.mode !== "log"`. `InviteUserForm` success state: `emailSent` → `invite-result` text "Invite sent to {email}."; otherwise "Email is not set up, so no invite was sent. Share this link with {name}:". Both show a read-only `Input` with `data-testid="invite-link"` holding the URL and the existing copy button.

**Profile password card** (`/settings/profile`): the server page passes `hasPassword: boolean` (from `getCredentials`). Labels: "Current password" (only when `hasPassword`), "New password", "Confirm new password"; button "Save password". `changePasswordAction`: `guardCsrf`, `createContext` (actor and session required), Zod input, policy check, verify current when a hash exists (E_AUTH_013), `setPassword`, `revokeOtherSessions(db, actor.id, session.sessionId)`. Success text (`password-saved`): "Password saved. Other sessions were signed out."

### 6.6 System mailer (`src/features/mailer/`)

```ts
export interface SystemMail { to: string; subject: string; text: string; html: string }
export interface SystemMailer {
  readonly mode: "smtp" | "log" | "capture";
  send(mail: SystemMail, signal: AbortSignal): Promise<Result<{ messageId: string }, AppError>>;
}
export function getSystemMailer(): SystemMailer; // MAIL_FAKE -> capture; SMTP_HOST "" -> log; else smtp. Cached on globalThis (Symbol.for("dealflow.systemMailer"))
export function setSystemMailerForTest(m: SystemMailer | null): void;
```

- `smtpMailer.ts`: `createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE, auth: SMTP_USER === "" ? undefined : { user: SMTP_USER, pass: SMTP_PASS } })`, `sendMail({ from: SMTP_FROM, to, subject, text, html })`; `signal.throwIfAborted()` before and after; a thrown send error → `err(E_MAIL_001)` (never log the password).
- `logMailer.ts`: `console.warn` of `[mailer:log] to={to} subject={subject}` followed by the text body; returns a random message id.
- `captureMailer.ts`: `mkdir -p MAIL_CAPTURE_DIR`, writes `{Date.now()}-{randomUUID()}.json` containing `{ to, subject, text, html, sentAt }`; write failure → `err(E_MAIL_002)`.
- `templates.ts`: `magicLinkMail({ url })` → subject "Your Dealflow sign-in link", text "Sign in to Dealflow with this link. It expires in 15 minutes and works once.\n\n{url}\n\nIf you didn't ask for it, ignore this email."; `inviteMail({ url, inviterName })` → subject "{inviterName} invited you to Dealflow", text "Set your password and sign in with this link. It expires in 7 days.\n\n{url}". HTML versions wrap the same text in `<p>` tags with the URL in an `<a>`; every interpolated value passes through an `escapeHtml` helper.

### 6.7 AI provider (`src/features/ai/`)

```ts
// types.ts
export type AiChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; content: string; tool_call_id: string };
export interface AiToolDef { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }
export interface AiToolCall { id: string; name: string; arguments: string }
export interface AiChatRequest { messages: AiChatMessage[]; tools?: AiToolDef[]; json?: boolean; maxTokens?: number; temperature?: number }
export interface AiChatResult { content: string | null; toolCalls: AiToolCall[]; usage: { promptTokens: number; completionTokens: number }; model: string }
export interface AiProvider {
  readonly kind: "openrouter" | "fake" | "scripted";
  chat(req: AiChatRequest, signal: AbortSignal): Promise<Result<AiChatResult, AppError>>;
}
export const AI_FEATURES = ["assistant", "deal_summary", "deal_score", "email_draft", "notes_to_activities", "ai_filter"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];
```

- `provider.ts`: `getAiProvider(): AiProvider | null`: test override first (`setAiProviderForTest(p: AiProvider | null | undefined)`, stored on `globalThis` under `Symbol.for("dealflow.aiProvider")`; `undefined` clears it), then `AI_FAKE` → fake (one `console.warn("AI_FAKE is on: AI answers are fake")`), then empty `OPENROUTER_API_KEY` → `null`, else the cached OpenRouter provider.
- `openrouterProvider.ts`: `new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL, defaultHeaders: { "HTTP-Referer": env.BASE_URL, "X-Title": "Dealflow" } })`; `client.chat.completions.create({ model: OPENROUTER_MODEL, messages, temperature: req.temperature ?? 0.3, max_tokens: req.maxTokens ?? 1200, ...(req.tools ? { tools: req.tools } : {}), ...(req.json ? { response_format: { type: "json_object" } } : {}) }, { signal })`. Map `choices[0].message.content`, `tool_calls` (function calls only) and `usage` (missing → zeros), `model` from the response. An `AbortError` is rethrown; any other thrown error → `err(E_AI_006, { status })`. Cast the SDK message type at one place with a comment instead of using `any`.
- `scriptedProvider.ts`: `class ScriptedAiProvider implements AiProvider` with `calls: AiChatRequest[]`, constructor queue of `Partial<AiChatResult> | AppError`, `push(...)`; each `chat` records a `structuredClone(req)` and returns the next item (defaults `content: null, toolCalls: [], usage: { promptTokens: 100, completionTokens: 50 }, model: "test/model"`); an empty queue returns `err(E_AI_006)`.
- `fakeProvider.ts`: deterministic, picks by the joined system messages, first match wins; usage always `{ promptTokens: 10, completionTokens: 5 }`, model `fake/dealflow`:

| System text contains | `content` |
|---|---|
| `sales analyst` | `{"summary":"FAKE summary of this deal.","health":"at_risk","risks":["FAKE risk: no recent contact"],"nextSteps":[{"subject":"FAKE follow-up call","typeKey":"call","dueInDays":2}]}` |
| `score sales deals` | `{"score":72,"reasons":["FAKE: engaged contact","FAKE: close date soon"]}` |
| `You write sales emails` | `{"subject":"FAKE subject","body":"FAKE body: {instruction}"}` where `{instruction}` is the `instruction` field of the user JSON (empty if unparsable) |
| `turn meeting or call notes` | `{"activities":[{"subject":"FAKE follow-up task","typeKey":"task","dueDate":"{today UTC YYYY-MM-DD}","note":"FAKE"}]}` |
| `CRM filter builder` | `{"definition":{"combinator":"and","conditions":[{"field":"value","op":"gt","value":1000}]},"explanation":"FAKE: deals worth more than 1,000"}` |
| `Dealflow Assistant` | if the last message is a user message starting with `/fake-tool ` followed by JSON `{"name":…,"arguments":{…}}` → `content: null`, `toolCalls: [{ id: "fake_1", name, arguments: JSON.stringify(arguments) }]`; otherwise `FAKE AI: {last user message}` |
| anything else | `FAKE AI: {last user message}` |

The `/fake-tool` branch only fires when the user message is the last message, so after the tool result comes back the next call answers with text and the loop ends.

- `chatJson.ts`:

```ts
export async function chatJson<T>(
  db: Db, actorId: string, feature: AiFeature,
  opts: { system: string; user: string; schema: z.ZodType<T>; maxTokens?: number },
  signal: AbortSignal,
): Promise<Result<T, AppError>>
// 1. assertAiAllowed (6.8). 2. attempt(extra?): provider.chat({ messages: [system, user, ...(extra ? [{ role: "user", content: extra }] : [])], json: true, maxTokens }, signal);
//    provider err -> return it (no retry); recordAiUsage; JSON.parse(stripJsonFences(content ?? "")) then schema.safeParse.
// 3. First failure -> attempt(`Your previous reply was not valid. Reply with JSON only, matching the schema exactly. Error: ${message}`).
// 4. Second failure -> err(E_AI_005).
export function stripJsonFences(text: string): string; // /^```(?:json)?\s*([\s\S]*?)\s*```$/i on the trimmed text
```

### 6.8 AI usage and limits (`usage.ts`, `aiSettings.ts`, `rateLimit.ts`)

- `getAiSettings(db, signal)`: `INSERT … ON CONFLICT DO NOTHING` then select the singleton. `updateAiSettings(db, input, signal)`; input Zod `{ enabled: boolean, companyMonthlyTokenLimit: int 0..1_000_000_000, userMonthlyTokenLimit: int 1..1_000_000_000 | null }`.
- `monthStartUtc(now = new Date()): Date` = first day of the month 00:00 UTC.
- `getUsage(db, signal)`: `{ monthStart, companyUsed, byFeature: { feature, tokens }[], byUser: { userId, name, tokens }[] }` summing `prompt_tokens + completion_tokens` since `monthStart`.
- `assertAiAllowed(db, actorId, signal): Promise<Result<AiProvider, AppError>>` in this order: provider null → E_AI_001; settings disabled → E_AI_002; company used ≥ company limit → E_AI_003; user cap set and user used ≥ cap → E_AI_004.
- `recordAiUsage(db, { userId, feature, result }, signal)` inserts one row per provider call.
- `checkAiRateLimit(userId): boolean`: per-user limiter, 20 calls per minute, built with `createRateLimiter` from `src/server/rateLimit.ts` and stored on `globalThis` (`Symbol.for("dealflow.aiRateLimiter")`); every AI server action calls it first and returns E_AI_011 when it fails.
- `aiErrors.ts`: `aiErrorMessage(id: string): string` mapping E_AI_001 "AI isn't set up on this server." · E_AI_002 "AI is turned off for this company." · E_AI_003 "The company has used its AI allowance for this month." · E_AI_004 "You have used your AI allowance for this month." · E_AI_005 "The AI reply could not be understood. Try again." · E_AI_006 "The AI service did not answer. Try again in a minute." · E_AI_011 "Too many AI requests. Wait a minute and try again." · default "Something went wrong. Try again."

### 6.9 AI features

All server actions live in `src/features/ai/actions/*.ts` (`"use server"`), follow warpdrive's action pattern (`guardCsrf(csrfToken)` → `createContext()` → actor required → Zod parse → `checkAiRateLimit` → service), and return `ActionResult<T>` via `toClientResult`. Reads go through the tRPC router `ai` (added to `appRouter` in `src/server/trpc/root.ts`) built with `protectedProcedure`.

**Context** (`dealContext.ts`): `buildDealContext(db, actor, dealId, signal): Promise<Result<DealContext, AppError>>` calls `getWorkspace(db, toAuthUser-equivalent, dealId, signal)` (visibility; invisible → that error, provider never called), `listNotes(db, "deal", dealId, signal)` (newest 10, body cut to 400 chars) and `listActivitiesForEntity(db, actor, "deal", dealId, signal)` (up to 10 open ones by due date, up to 10 most recent done ones). `DealContext` JSON: `{ today, deal: { title, value, currency: settings base currency, pipeline, stage, status, expectedCloseDate, daysInStage, person, organization, owner, labels }, upcomingActivities: [{ subject, type, dueAt }], recentActivities: [{ subject, type, doneAt }], notes: [{ at, text }] }`. Active activity type keys come from `activity_types` where `archived_at IS NULL`.

**Deal summary** (`dealInsights.ts` `summarizeDeal(db, actor, dealId, signal)`), feature `deal_summary`, system prompt exactly:
`You are a sales analyst inside a CRM. Reply with JSON only, no other text, in exactly this shape: {"summary": string (max 80 words), "health": "good" | "at_risk" | "stalled", "risks": string[] (max 3, each max 20 words), "nextSteps": [{"subject": string (max 12 words), "typeKey": one of {keys}, "dueInDays": integer 0-30}] (max 3)}. Use only the data given. If there is little data, say so in the summary.` with `{keys}` = comma-separated active type keys. User message = `JSON.stringify(context)`. Zod with fix-ups: summary ≤ 800 chars; risks sliced to 3; nextSteps sliced to 3; unknown `typeKey` → `task`; `dueInDays` rounded and clamped 0..30. Upsert into `deal_ai_insights` (`summary`, `summaryAt`).

**Deal score** (`scoreDeal`), feature `deal_score`, system prompt exactly:
`You score sales deals from 0 to 100 for likelihood to close. Use only the data given. Reply with JSON only: {"score": integer 0-100, "reasons": string[] (2-4 items, max 15 words each)}.` User message = context plus `{ daysSinceLastActivity, openActivities }`. Score rounded and clamped 0..100; reasons sliced to 4. Upsert `score`, `scoreReasons`, `scoredAt`.

Actions `generateDealSummaryAction(dealId, csrf)`, `scoreDealAction(dealId, csrf)` → `ActionResult<DealAiInsightView>`. tRPC `ai.dealInsight({ dealId })` → `DealAiInsightView | null` after the same visibility check. `DealAiInsightView = { summary: DealSummaryData | null; summaryAt: string | null; score: number | null; scoreReasons: string[]; scoredAt: string | null }`.

**Email draft** (`emailDraft.ts` `draftEmail(db, actor, input, signal)`), feature `email_draft`. Input Zod `{ instruction: string 1..500, tone: "friendly" | "formal" | "short", dealId?: uuid, personId?: uuid, recipientEmail?: email }`. System prompt exactly:
`You write sales emails for {userName} at {companyName}. Tone: {toneText}. Write in British English. Reply with JSON only: {"subject": string (max 120 characters), "body": string (plain text, no markdown, with a greeting and a sign-off using the sender's first name, max 250 words)}. Use only facts from the context. Do not invent prices, dates or promises.`
Tones: friendly `warm and friendly but professional`, formal `formal and polite`, short `very brief, 3 to 5 sentences`. `{companyName}` = `settings.companyName` or `our company`. User message JSON: `{ instruction, recipient: { name, organization, email } | null, deal: { title, stage, value, expectedCloseDate } | null, recentNotes (≤ 5) }` built only from records the actor can see (deal via `getWorkspace`; person via the contacts read the person page uses). Returns `{ subject, bodyText, bodyHtml }`; `bodyHtml` = escaped text, blank-line-separated paragraphs in `<p>`, single newlines as `<br>`. Action `draftEmailAction(raw, csrf)`.

**Notes to activities** (`notesToActivities.ts`), feature `notes_to_activities`. Only notes whose `entityType` is `deal` (others → E_AI_007); visibility through `getWorkspace` on the note's deal. System prompt exactly:
`You turn meeting or call notes into follow-up activities for a CRM. Today is {YYYY-MM-DD} ({weekday}). Reply with JSON only: {"activities": [{"subject": string (max 12 words), "typeKey": one of {keys}, "dueDate": "YYYY-MM-DD" (today or later), "note": string (max 40 words)}]} with at most 5 items. Only include concrete follow-ups the notes imply. If there are none, reply {"activities": []}.`
User message = the note body. Fix-ups: date before today → today; unknown key → `task`; slice to 5. Returns proposals only. Action `proposeActivitiesFromNoteAction(noteId, csrf)` → `ActionResult<{ dealId: string; proposals: Proposal[] }>`. The client creates the selected ones with warpdrive's `createActivityAction` (`typeId` from `trpc.activities.listTypes` by key, `subject`, `allDay: true`, `dueAt: composeDueAt(dueDate, "")` from `src/features/activities/activityTime.ts`, `dealId`, `note`).

**AI filter** (`aiFilter.ts`), feature `ai_filter`. Input `{ entity: "deal" | "person" | "organization" | "lead", text: string 1..500 }`. Field catalogue per entity from the existing configs (`DEAL_CONDITION_CONFIG`; `PERSON_FILTER_CONFIG`, `ORG_FILTER_CONFIG`, `LEAD_CONDITION_CONFIG`), rendered as JSON `[{ field, ops, kind }]` where `kind` is `number`, `date`, `labels` or `text`. System prompt exactly:
`You are a CRM filter builder. Convert the user's request into a filter for {entityPlural}. Reply with JSON only: {"definition": {"combinator": "and" | "or", "conditions": [{"field": string, "op": string, "value": string | number | string[]}]}, "explanation": string (max 25 words)}. Use only these fields and operators: {fields}. Date values are one of {datePresets} or YYYY-MM-DD. Owner values are user ids from {users}. Stage values are stage ids from {stages}. Label values are label names from {labels}. The current user id is {userId}. Today is {YYYY-MM-DD}. Operators isEmpty and isNotEmpty take no value.`
`{datePresets}` = `DATE_PRESET_KEYS`; users = active users `{ id, name }`; stages = all stages of visible pipelines `{ id, name }`; labels = names for that entity. The returned definition must pass `savedFilterDefinitionSchema(entity)`; a failure counts as invalid output for the `chatJson` retry (wrap the schema so the explanation and the definition validate together). Action `describeFilterAction(raw, csrf)` → `ActionResult<{ definition: unknown; explanation: string }>`.

**tRPC `ai` router** (`src/features/ai/router.ts`): `status` → `{ available: boolean; enabled: boolean; providerKind: "openrouter" | "fake" | "none" }` (any user); `overview` → admin only (`TRPCError FORBIDDEN`, message `E_PERM_001`) `{ settings, usage: getUsage(), model: OPENROUTER_MODEL, providerKind }`; `dealInsight({ dealId })`; `conversations.list` (own, newest 30); `conversations.get({ id })` (own, else NOT_FOUND `E_AI_008`).

**Settings → AI** (`/settings/ai`, admins only; non-admins get `notFound()`; nav item "AI" with the `Bot` icon shown when `isAdmin`, next to the enrichment item): provider line ("OpenRouter, model {model}", "Fake AI (AI_FAKE is on)", or "Not set up: add OPENROUTER_API_KEY to the server environment"); `Progress` bar with `data-testid="ai-usage-used"` text "Used {used} of {limit} tokens this month"; tables by feature (rows `ai-usage-feature-row`) and by user; form: `Switch` "AI enabled", `Input` "Company monthly token limit", `Input` "Per-user monthly token limit" (empty = no limit), button "Save AI settings", success `ai-settings-saved` "AI settings saved." Numbers formatted with `Intl.NumberFormat("en-GB")`. Action `updateAiSettingsAction(raw, csrf)` (admin only, E_PERM_001 otherwise).

### 6.10 Assistant (`src/features/ai/assistant/`)

**Tool catalogue** (`tools.ts`). Change `ToolRegistry` in `src/features/mcp/tools/types.ts` to also keep `readonly definitions = new Map<string, { description: string; inputSchema: z.ZodObject }>()`, filled by `registerTool` (one added line; nothing else in MCP changes). The assistant builds a fresh `McpServer({ name: "dealflow-assistant", version: "1.0.0" })` per request, calls `registerReadTools(server, getCtx)` and `registerWriteTools(server, getCtx, db)` with `getCtx = () => buildAppContext(db, actor)` (from `src/features/mcp/actorContext.ts`), and exposes only these names:

- read: `search`, `list_deals`, `get_deal`, `list_leads`, `get_lead`, `list_persons`, `get_person`, `list_organizations`, `get_organization`, `list_activities`, `list_pipelines`, `pipeline_summary`
- write: `create_activity`, `update_activity`, `complete_activity`, `add_note`, `create_person`, `update_person`, `create_organization`, `update_organization`, `create_deal`, `update_deal`, `move_deal_stage`, `create_lead`, `convert_lead_to_deal`

`toToolDef(name, def)`: `parameters = z.toJSONSchema(def.inputSchema, { io: "input", unrepresentable: "any" })` with the `$schema` key removed. `summarizeWrite(name, args)`: `create_activity` → `Create activity "{subject}"`; `update_activity` → `Update activity {id}`; `complete_activity` → `Mark activity {id} as done` or `as not done`; `add_note` → `Add note: "{first 60 chars of body}"`; `create_person` / `create_organization` → `Create person "{name}"` / `Create organization "{name}"`; `update_person` / `update_organization` → `Update person {id}` / `Update organization {id}`; `create_deal` → `Create deal "{title}"`; `update_deal` → `Update deal {dealId or id}`; `move_deal_stage` → `Move deal {dealId} to stage {toStageId}`; `create_lead` → `Create lead "{title}"`; `convert_lead_to_deal` → `Convert lead {leadId or id} to a deal`; fallback `{name} {first 80 chars of JSON args}`. Tool results are the `CallToolResult` text joined and cut to 8,000 characters; `isError` results are passed back as `{ "error": text }`.

**Prompt** (`prompt.ts`), exactly:
`You are Dealflow Assistant, a sales assistant inside the Dealflow CRM for the company "{companyName}". Today is {YYYY-MM-DD} ({weekday}). The user is {userName}. Default currency: {baseCurrency}.\nRules:\n1. Use the tools to look up data. Never invent records, IDs, names or numbers.\n2. To change data, call a write tool. Write tools do not run immediately: the user must confirm them. After proposing, tell the user what you proposed and that they need to click Confirm.\n3. Keep answers short and practical. Use "- " bullet lines for several items.\n4. If a request is ambiguous (for example two deals match), ask a short clarifying question.\n5. You can only see records this user is allowed to see.`

**Loop** (`assistant.ts`, feature `assistant`):

```ts
export async function sendAssistantMessage(db, actor, conversationId, content, signal): Promise<Result<ConversationView, AppError>> {
  // assertAiAllowed; conversation owned by actor else E_AI_008
  // insert user message; if title === "New conversation" set title = first 60 chars of content
  // history = last 40 messages by seq -> AiChatMessage[] (assistant rows carry tool_calls, tool rows carry tool_call_id);
  //           drop leading rows until the first is a user message
  // messages = [{ role: "system", content: prompt }, ...history]
  for (let step = 0; step < 6; step++) {
    const res = await provider.chat({ messages, tools: catalogue.defs, maxTokens: 1500 }, signal);
    if (!res.ok) return res;
    await recordAiUsage(...);
    store + push assistant message { content, tool_calls }
    if (res.value.toolCalls.length === 0) return ok(await conversationView(...));
    for (const call of res.value.toolCalls) {
      // unknown or not allow-listed -> { error: "Unknown tool" }
      // args: JSON.parse(call.arguments) (failure -> {}), then the tool's Zod schema safeParse -> { error: "Invalid arguments", issues }
      // read -> catalogue.reads.invoke(name, parsed) ; write -> insert ai_actions (pending, summary) and result
      //         { status: "pending_confirmation", actionId, summary }
      store + push { role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 8000) }
    }
  }
  store assistant "I couldn't finish that within the step limit. Try a more specific request."; return view
}
confirmAiAction(db, actor, actionId, signal) // pending + userId === actor.id else E_AI_009; writes.invoke(tool, args);
  // isError -> status failed, result { error }, store assistant "Couldn't do that: {error text}"
  // else status confirmed, result parsed text, store assistant "Done: {summary}"; decidedAt = now; return view
rejectAiAction(db, actor, actionId, signal) // same ownership rule; status rejected; store "Cancelled: {summary}"; return view
```

`ConversationView = { id, title, items: Array<{ kind: "message"; id; role: "user" | "assistant"; content: string; createdAt: string } | { kind: "action"; id; tool; summary; status; createdAt: string }> }`: user and assistant messages with non-empty content plus all actions, merged by `createdAt` then `seq` (message before action on ties).

Actions (`assistantActions.ts`, timeout `AbortSignal.timeout(90_000)` instead of `SIG()`): `createConversationAction(csrf)`, `sendAssistantMessageAction({ conversationId, content: string 1..4000 }, csrf)`, `confirmAiActionAction(actionId, csrf)`, `rejectAiActionAction(actionId, csrf)`, all → `ActionResult<ConversationView>` (create → the empty view).

**UI**: `AssistantLauncher` (client) in `TopBar` before `NotificationsBell`: ghost icon button with `Sparkles`, `aria-label="Open assistant"`, `data-testid="assistant-trigger"`; disabled with a `Tooltip` "AI isn't set up on this server" when `ai.status.available` is false. `AssistantSheet` uses the shadcn `Sheet` (right side, `sm:max-w-[420px]`): title "Assistant"; header `Select` of conversations (label "Conversation", sr-only) and button "New chat"; body list (`assistant-message` with `data-role`, user bubbles right `bg-primary text-primary-foreground`, assistant left `bg-muted`, `rounded-lg px-3 py-2 max-w-[85%]`), text rendered by `renderSimpleText` (paragraphs on newlines, lines starting `- ` as list items, `**x**` as `<strong>`; React nodes only, never `dangerouslySetInnerHTML`); action cards `assistant-action` with `data-status`, the summary, a status `Badge`, and for pending ones buttons "Confirm" and "Reject"; empty conversation shows three `assistant-suggestion` buttons: "Which of my deals need attention this week?", "What are my overdue activities?", "Summarise my open pipeline". Footer `Textarea` labelled "Message the assistant" (Enter sends, Shift+Enter new line, max 4,000) and button "Send"; while waiting the button reads "Thinking..." and the input is disabled. After Confirm: `trpc.useUtils().invalidate()` and `router.refresh()`. Open state and conversation id persist in `localStorage` keys `df.assistantOpen` and `df.assistantConversationId`, each access in try/catch.

### 6.11 Compose, ports and docs

`docker-compose.yml`: add `name: dealflow` as the first key; delete the `caddy` service and the `caddydata`/`caddyconfig` volumes; change every `env_file: .env` to `env_file: ${DEALFLOW_ENV_FILE:-.env}`; add
- `minio.ports: ["${MINIO_BIND:-127.0.0.1}:${MINIO_PORT:-9000}:9000"]`
- `app.ports: ["${APP_BIND:-127.0.0.1}:${APP_PORT:-3000}:3000"]`
- `ws.ports: ["${WS_BIND:-127.0.0.1}:${WS_HOST_PORT:-8080}:8080"]`
Rewrite the header comment: no proxy in the default stack, the owner's reverse proxy fronts app, `/_ws` and `s3.`; set the binds to `0.0.0.0` (or a LAN address) only when the proxy runs on another machine.

`docker-compose.dev.yml` becomes only: `postgres.ports: ["${DEV_PG_PORT:-5433}:5432"]` and `minio.ports: ["${MINIO_CONSOLE_PORT:-9001}:9001"]` (the base file already publishes app, ws and MinIO's 9000; duplicating them would clash). Keep its "deliberately not an override file" comment, drop the Caddy stanza.

`git mv Caddyfile docs/reverse-proxy/Caddyfile.example`; replace its upstream names `app:3000`, `ws:8080`, `minio:9000` with `{$APP_UPSTREAM:localhost:3000}`, `{$WS_UPSTREAM:localhost:8080}`, `{$S3_UPSTREAM:localhost:9000}` and keep every security header. `Caddyfile.test.ts` reads the new path. `docs/reverse-proxy.md`: the three routes as a table (`https://crm.example.com` → app 3000; `https://crm.example.com/_ws*` → ws 8080 with WebSocket upgrade; `https://s3.crm.example.com` → MinIO 9000), the headers that must stay on the `s3.` host (nosniff, CSP sandbox, HSTS), the env values (`BASE_URL`, `NEXT_PUBLIC_WS_URL=wss://crm.example.com/_ws`, `MINIO_ENDPOINT=https://s3.crm.example.com`), the 80 MB body cap, and the Caddy example usage. `docs/deploy.md` is rewritten for this topology (keep its secret-generation and `_FILE` sections).

### 6.12 Test hooks and screenshots

| Screen | Hooks (labels are visible text) |
|---|---|
| `/login` | tabs "Password" and "Email link"; labels "Email", "Password"; buttons "Sign in", "Email me a sign-in link"; `login-error`, `login-sent`; Google link "Sign in with Google" only when configured |
| `/login/magic` | button "Continue"; `magic-invalid` |
| `/login/invite` | labels "Name", "New password", "Confirm password"; button "Set password and sign in"; `invite-invalid`, `invite-error` |
| `/settings/profile` | `password-card`; labels in 6.5; button "Save password"; `password-saved` |
| `/settings/users` | `invite-result`, `invite-link` |
| deal workspace | `deal-ai-card`; buttons "Generate summary", "Refresh summary", "Score deal", "Rescore"; `deal-ai-summary`, `deal-ai-health` (`data-health`), `deal-ai-next-step` (button "Add", then `data-added="true"` and text "Added"), `deal-ai-score` (`data-score`), `deal-ai-error` |
| email composer | `ai-draft-trigger` ("Write with AI"); label "What should the email say?"; label "Tone"; button "Draft"; `ai-draft-error` |
| deal note menu | item "Turn into activities"; dialog title "Suggested activities"; rows `ai-proposal`; button "Create selected" |
| deal filter dialog | label "Describe a filter"; button "Generate filter"; `ai-filter-explanation`, `ai-filter-error` |
| assistant | listed in 6.10 |
| `/settings/ai` | listed in 6.9 |

Screenshots (`e2e/screenshots/`, full page, 1440×900): `p1-00-pipeline`, `p1-00-deal`, `p1-00-people`, `p1-00-orgs`, `p1-00-leads`, `p1-00-activities`, `p1-00-inbox`, `p1-00-dashboard`, `p1-00-settings`, `p1-login`, `p1-login-sent`, `p1-magic-confirm`, `p1-invite-accept`, `p1-profile-password`, `p1-users-invite`, `p1-deal-ai-card`, `p1-composer-ai`, `p1-notes-to-activities`, `p1-filter-ai`, `p1-settings-ai`, `p1-assistant-empty`, `p1-assistant-pending`, `p1-assistant-confirmed` (23 files).

### 6.13 Fake modes

| Service | Flag | Behaviour |
|---|---|---|
| OpenRouter | `AI_FAKE=true` | 6.7 table; tests inject `ScriptedAiProvider` via `setAiProviderForTest` |
| System mail | `MAIL_FAKE=true` | capture JSON files in `MAIL_CAPTURE_DIR`; tests may also `setSystemMailerForTest` |
| Purelymail | none | the probe is the only real-mail code in Part 1 and runs only with owner credentials |

### 6.14 E2E harness

- `playwright.config.ts`: `testDir: "e2e"`, `workers: 1`, `fullyParallel: false`, `retries: 0`, `timeout: 60_000`, Chromium only, `use: { baseURL: "http://localhost:3210", viewport: { width: 1440, height: 900 }, trace: "retain-on-failure", screenshot: "only-on-failure" }`, `webServer: { command: "node scripts/e2e/e2e-server.mjs", url: "http://localhost:3210/login", timeout: 300_000, reuseExistingServer: false, stdout: "pipe", stderr: "pipe" }`.
- `scripts/e2e/e2e-env.mjs` exports `e2eEnv(secrets)` returning the complete env object below and `readDevMinioCreds()` (parses only `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` out of `.env`; nothing else from `.env` is used). `secrets` = `{ ws, token, oauth }` generated with `randomBytes` per run (`ws`: 32 bytes hex; `token`, `oauth`: 32 bytes base64).

```js
{
  NODE_ENV: "production", PORT: "3210", BASE_URL: "http://localhost:3210",
  DATABASE_URL: `postgres://warpdrive:warpdrive@localhost:${process.env.DEV_PG_PORT ?? "5433"}/dealflow_e2e`,
  WS_TICKET_SECRET: secrets.ws, WS_PUBLIC_URL: "ws://localhost:3211", NEXT_PUBLIC_WS_URL: "ws://localhost:3211", WS_PORT: "3211",
  MINIO_ENDPOINT: `http://localhost:${process.env.MINIO_PORT ?? "9000"}`, MINIO_BUCKET: "warpdrive", ...readDevMinioCreds(),
  TOKEN_ENCRYPTION_KEY: secrets.token, OAUTH_SIGNING_KEY: secrets.oauth, MCP_ENABLED: "true",
  GOOGLE_OAUTH_CLIENT_ID: "placeholder-e2e", GOOGLE_OAUTH_CLIENT_SECRET: "placeholder-e2e", GOOGLE_WORKSPACE_DOMAIN: "example.com", // Task 2.1 sets all three to ""
  SEED_ADMIN_EMAIL: "demo1@example.com", ALLOW_FIRST_LOGIN_ADMIN: "false", BASE_CURRENCY: "USD",
  DISABLE_TELEMETRY: "true", DISABLE_UPDATE_CHECK: "true", POSTHOG_KEY: "", POSTHOG_HOST: "",
  AUTH_PASSWORD_ENABLED: "true", AUTH_MAGIC_LINK_ENABLED: "true",
  SMTP_HOST: "", MAIL_FAKE: "true", MAIL_CAPTURE_DIR: ".e2e/mail",
  AI_FAKE: "true", OPENROUTER_API_KEY: "", NEXT_TELEMETRY_DISABLED: "1",
}
```

- `scripts/e2e/build.mjs`: `spawnSync("pnpm", ["exec", "next", "build"], { env: { ...process.env, ...e2eEnv(randomSecrets()) }, stdio: "inherit" })`, exit with its status.
- `scripts/e2e/e2e-server.mjs` (plain ESM, imports `pg` and `node:child_process`): (1) `rm -rf .e2e` then `mkdir -p .e2e/mail`; (2) connect to `postgres://warpdrive:warpdrive@localhost:{DEV_PG_PORT}/postgres`, `DROP DATABASE IF EXISTS dealflow_e2e WITH (FORCE)`, `CREATE DATABASE dealflow_e2e`, then on the new database `CREATE EXTENSION IF NOT EXISTS pgcrypto` and `citext` (connection failure: print `e2e: dev Postgres is not reachable, run pnpm dev:up` and exit 1); (3) run in order, each with the e2e env and failing fast: `pnpm exec tsx src/entrypoints/migrate.ts`, `pnpm exec tsx scripts/seed-demo.ts`, `pnpm exec tsx scripts/e2e/seed-session.ts`; (4) spawn `pnpm exec tsx src/entrypoints/ws.ts` and `pnpm exec next start -p 3210` with the env; (5) on SIGINT/SIGTERM kill both children and exit; if either child exits, kill the other and exit 1.
- `scripts/e2e/seed-session.ts`: with its own `pg` Pool + drizzle on `DATABASE_URL`, creates sessions through `createSession` from `src/features/auth/session.ts` for `demo1@example.com` (admin) and `demo2@example.com` (rep), writes Playwright storage states `.e2e/admin.json` and `.e2e/rep.json` (cookies `wd_sid` httpOnly and `wd_csrf` = random base64url not httpOnly; `domain: "localhost"`, `path: "/"`, `secure: true`, `sameSite: "Lax"`, `expires` = session expiry in epoch seconds), and `.e2e/fixtures.json` `{ dealId, dealTitle, adminEmail, repEmail }` (the oldest open, non-archived, non-deleted deal). From Task 6.1 it also sets demo1's password to the value of `E2E_ADMIN_PASSWORD` in `e2e/helpers.ts` via `setPassword`.
- `e2e/helpers.ts`: `export const E2E_ADMIN_PASSWORD = "correct horse battery staple"`, `fixtures()` (reads `.e2e/fixtures.json`), `shot(page, name)` (full-page PNG to `e2e/screenshots/{name}.png`), `latestMail(to)` (newest capture file in `.e2e/mail` whose `to` matches, parsed), `linkFrom(mail)` (first `http://localhost:3210/...` URL in `text`).
- Specs: `00-health`, `01-auth`, `02-invite-profile`, `03-ai-deal`, `04-ai-compose-filter`, `05-assistant` (contents in Tasks 0.5 and 6.1).

### 6.15 Phase 0 outputs

`docs/dealflow/HEALTH-CHECK.md` sections: `## Environment` (node, pnpm, docker, git versions; date), `## Results` (table: step, command, result, count, duration), `## Pre-existing failures` (each failing test or step with error excerpt and what was done: fixed in 0.3, or left with reason), `## Click-through` (the 9 pages with HTTP status and screenshot name), `## Notes for Part 2`.

`docs/dealflow/mail-probe-result.json`:

```json
{
  "status": "ok | skipped | failed",
  "probedAt": "ISO time",
  "account": "masked, e.g. a***@example.com",
  "imap": { "host": "", "port": 993, "capabilities": [], "enabled": [], "qresync": false, "condstore": false, "idleAdvertised": false },
  "folders": [{ "path": "", "specialUse": "\\Sent | null", "flags": [] }],
  "folderStatus": { "INBOX": { "messages": 0, "uidNext": 1, "uidValidity": "123", "highestModseq": "0 or null" } },
  "idle": { "worked": false, "latencyMs": null },
  "send": { "ok": false, "messageId": "", "smtpResponse": "" },
  "sentFolder": { "autoSaved": false, "appendWorked": null },
  "move": { "worked": false },
  "errors": ["step: message"]
}
```

`folderStatus` has one entry per probed folder; bigints are strings, absent values `null`.

## 7. Conventions

- **Read before you edit; extend, don't rewrite.** Open the file and its neighbours first. New work goes into new feature folders (`src/features/ai/`, `src/features/mailer/`, `src/features/branding/`) and new schema files. Edits to upstream files stay small and are listed in section 5.
- **CLAUDE.md applies to everything**: Result types (no throws for operational failures), `AppError` with registered IDs only, Zod once at each boundary, required `signal: AbortSignal` threaded through I/O, shadcn primitives only (`Dialog`, `Sheet`, `DropdownMenu`, `Popover`, `Select`, `Tabs`, `Switch`, `Checkbox`, `Tooltip`, `DatePicker` from `src/components/ui/`), no native form controls, no `process.env` outside `src/config/env.ts` (scripts under `scripts/` may read it), files under about 200 lines, constants in `src/constants/`, comments explain why, **no em dashes in any file you write**.
- **Mutations are server actions, reads are tRPC.** Every action: `guardCsrf(csrfToken)` first, `createContext()` for the actor, permission check, Zod parse, then the service; return `ActionResult` (`toClientResult`). Client callers pass `readCsrfToken()` from `src/utils/csrfCookie.ts`.
- **Tests**: co-located `*.test.ts`. Anything importing `@/test/db` is integration (real Postgres via Testcontainers); keep unit tests DB-free. Name risky-logic DB tests `*.integration.test.ts`. Never mock the database. AI tests use `ScriptedAiProvider`; mail tests use the capture mailer or `setSystemMailerForTest`.
- **UI copy**: sentence case, plain English, the exact strings in section 6; variables in braces in this plan are filled from data.
- **Branding**: user-visible text says Dealflow; internal identifiers listed in section 3 stay.
- **Formatting**: `pnpm format` before committing a task that touched many files; `pnpm lint` must stay green at gates.
- **Git**: `git --no-optional-locks` for read-only commands; one commit per task; never commit `.env`, `.e2e/`, `.smoke/`, `.mail-capture/`, screenshots or `.dsh/logs/`.

## 8. Phases and tasks

### Phase 0: Repository, baseline and health check

At the end: a git repository with upstream history, the untouched app installed, tested, built and clicked through, the e2e harness working, and the mail probe recorded.

#### Task 0.1 - Repository, upstream remote and kit

**Goal:** Put the folder under git on `main` with an `upstream` remote and record the received code as the Phase 0 base.

**Files:** create `PROGRESS.md`; modify `.gitignore`, `biome.json`, `eslint.config.mjs`, `package.json`

**Steps:**
1. Check the section 4 rows for the folder, Node, pnpm, Docker and the harness, and write the versions down for Task 0.4. Fatal rows stop the run as section 4 says.
2. If `.git` is absent: `git init -b main` and `git remote add upstream https://github.com/sneg55/warpdrive.git`, then `git fetch upstream --tags`. If the fetch fails, skip to step 4 and log the Decision and Owner action from section 4.
3. Choose the upstream base closest to the received files. Candidates: tag `v1.2.0` if it exists, and `upstream/main`. For each candidate run
   ```bash
   GIT_INDEX_FILE=/tmp/dealflow-probe-index git read-tree "$REF"
   GIT_INDEX_FILE=/tmp/dealflow-probe-index git add -A -- . ':(exclude)PLAN-PART1.md' ':(exclude)ROADMAP.md' ':(exclude)AGENTS.md' ':(exclude).dsh' ':(exclude)loop.sh' ':(exclude)qa.sh' ':(exclude)dsh-setup.sh' ':(exclude)scripts/check-progress.mjs' ':(exclude,glob)**/.DS_Store'
   GIT_INDEX_FILE=/tmp/dealflow-probe-index git diff --cached --shortstat "$REF"
   rm -f /tmp/dealflow-probe-index
   ```
   and pick the candidate with fewer changed files. Then `git reset "$REF"` (mixed reset: moves HEAD and the index, leaves files alone). Log the choice under Decisions.
4. Stage the snapshot with the same pathspec as step 3 (`git add -A -- . ':(exclude)…'`) and commit `chore: snapshot of the received warpdrive export`. Record its hash.
5. Create `PROGRESS.md` in the section 0 format with every task of this plan, `- Phase 0: {snapshot hash}` and `Current: 0.1`.
6. Append to `.gitignore`: `.DS_Store`, `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`, `.dsh/logs/`, `.dsh/guard.enabled`, `docs/dealflow/*.local.*`.
7. In `biome.json` → `files.includes` add `"!**/.dsh"`, `"!scripts/check-progress.mjs"`, `"!.e2e"`, `"!e2e/screenshots"`, `"!test-results"`, `"!playwright-report"`, `"!.smoke"`, `"!.mail-capture"`. In `eslint.config.mjs` add the same paths plus `"e2e/**"` and `"playwright.config.ts"` to the top-level `ignores` (typecheck still covers the e2e TypeScript).
8. Add every script from 6.1 to `package.json`.
9. Stage everything (`git add -A`, which now includes the kit files), commit `0.1: Repository, upstream remote and kit`, tick 0.1.

**Verify:** `git --no-optional-locks log --oneline | head -3` → the 0.1 commit above the snapshot commit; `node scripts/check-progress.mjs` → `PROGRESS CHECK OK`.

**Done when:** the repository exists on `main`, `upstream` is set (or the Decision is logged), and PROGRESS.md lists every task.

#### Task 0.2 - Toolchain, install and dev services

**Goal:** Install dependencies, create or complete `.env` safely, start dev Postgres and MinIO, and migrate.

**Files:** create `scripts/dealflow/env-sync.mjs`; modify `.env` only through that script

**Steps:**
1. If `pnpm -v` is not 9.x, follow the section 4 row. Run `pnpm install --frozen-lockfile`.
2. Create `scripts/dealflow/env-sync.mjs` (plain ESM, Node built-ins only):
   ```js
   // Appends keys that .env lacks, with local-dev values; never rewrites or prints existing lines.
   // --migrate blanks only the exact placeholder lines this script wrote in an earlier version.
   import { randomBytes } from "node:crypto";
   import { existsSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
   const hex = (n) => randomBytes(n).toString("hex");
   const b64 = (n) => randomBytes(n).toString("base64");
   const DEV = {
     DATABASE_URL: "postgres://warpdrive:warpdrive@localhost:5433/warpdrive",
     BASE_URL: "http://localhost:3000",
     WS_TICKET_SECRET: hex(32), WS_PUBLIC_URL: "ws://localhost:8080", NEXT_PUBLIC_WS_URL: "ws://localhost:8080",
     MINIO_ENDPOINT: "http://localhost:9000", MINIO_ACCESS_KEY: hex(10), MINIO_SECRET_KEY: hex(24), MINIO_BUCKET: "warpdrive",
     TOKEN_ENCRYPTION_KEY: b64(32), OAUTH_SIGNING_KEY: b64(32), MCP_ENABLED: "true",
     GOOGLE_OAUTH_CLIENT_ID: "placeholder-dev", GOOGLE_OAUTH_CLIENT_SECRET: "placeholder-dev", GOOGLE_WORKSPACE_DOMAIN: "example.com",
     SEED_ADMIN_EMAIL: "demo1@example.com", ALLOW_FIRST_LOGIN_ADMIN: "true", BASE_CURRENCY: "USD",
   };
   const PLACEHOLDERS = ["GOOGLE_OAUTH_CLIENT_ID=placeholder-dev", "GOOGLE_OAUTH_CLIENT_SECRET=placeholder-dev", "GOOGLE_WORKSPACE_DOMAIN=example.com"];
   const exampleKeys = readFileSync(".env.example", "utf8").split("\n")
     .map((l) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]);
   const current = existsSync(".env") ? readFileSync(".env", "utf8") : "";
   if (process.argv.includes("--migrate")) {
     const lines = current.split("\n");
     const next = lines.map((l) => (PLACEHOLDERS.includes(l.trim()) ? `${l.split("=")[0]}=` : l));
     writeFileSync(".env", next.join("\n"));
     console.log(`env-sync: blanked ${lines.filter((l) => PLACEHOLDERS.includes(l.trim())).length} placeholder line(s)`);
     process.exit(0);
   }
   const have = new Set(current.split("\n").map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l)?.[1]).filter(Boolean));
   const added = [];
   let out = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
   for (const [key, exampleValue] of exampleKeys) {
     if (have.has(key)) continue;
     out += `${key}=${DEV[key] ?? exampleValue}\n`;
     added.push(key);
   }
   if (added.length > 0) appendFileSync(".env", out);
   console.log(`env-sync: appended ${added.length} key(s): ${added.join(", ")}`);
   ```
   Run `pnpm env:sync`. It prints key names only.
3. `pnpm dev:up`. Wait until `docker compose -p dealflow -f docker-compose.yml -f docker-compose.dev.yml exec -T postgres pg_isready -U warpdrive` succeeds (poll every 2 s, up to 60 s). The upstream compose still contains Caddy at this point; `dev:up` names only the services it needs.
4. `pnpm db:migrate:dev` → exits 0.
5. Commit `0.2: Toolchain, install and dev services`, tick.

**Verify:** `pnpm exec tsc --version` prints a version; `pnpm db:migrate:dev` exits 0 a second time (idempotent).

**Done when:** dependencies are installed, `.env` is complete, dev services are up and migrated.

#### Task 0.3 - Baseline fixes from the OSS export

**Goal:** Repair the three failures caused by files the open-source export left out, without weakening any check.

**Files:** create `scripts/auditConfig.ts`; delete `deployWorkflow.test.ts`; modify `Dockerfile.test.ts`

**Steps:**
1. `scripts/seedSavedFilters.test.ts` imports `analyzeSavedFilter` from `./auditConfig`, which is missing. Create it:
   ```ts
   import {
     type SavedFilterTargetEntity,
     savedFilterDefinitionSchema,
   } from "@/features/saved-filters/schemas";

   export interface SavedFilterRow { id: string; name: string; targetEntity: SavedFilterTargetEntity; definition: unknown }
   export type SavedFilterIssue =
     | { kind: "invalid"; id: string; message: string }
     | { kind: "lossy"; id: string; droppedKeys: string[] }
     | { kind: "degenerate"; id: string };

   // A saved filter is conformant when it parses, the parse keeps every condition key it was given,
   // and it still narrows something (a condition or the rotting flag).
   export function analyzeSavedFilter(row: SavedFilterRow): SavedFilterIssue | null {
     const parsed = savedFilterDefinitionSchema(row.targetEntity).safeParse(row.definition);
     if (!parsed.success) return { kind: "invalid", id: row.id, message: parsed.error.message };
     const input = (row.definition ?? {}) as { conditions?: Record<string, unknown>[] };
     const output = parsed.data as { conditions: Record<string, unknown>[]; rotting?: boolean };
     const dropped = (input.conditions ?? []).flatMap((c, i) =>
       Object.keys(c).filter((k) => !(k in (output.conditions[i] ?? {}))),
     );
     if (dropped.length > 0) return { kind: "lossy", id: row.id, droppedKeys: dropped };
     if (output.conditions.length === 0 && output.rotting !== true) return { kind: "degenerate", id: row.id };
     return null;
   }
   ```
2. Delete `deployWorkflow.test.ts`: it asserts the upstream's private GitHub deploy pipeline (`.github/workflows/deploy.yml`), which this export does not contain and we do not use.
3. In `Dockerfile.test.ts` remove the `workflow` read and the test "is passed as a build arg by the deploy workflow"; keep the three Dockerfile stage tests.
4. Log one Decision naming all three files.
5. Commit `0.3: Baseline fixes from the OSS export`, tick.

**Verify:** `pnpm typecheck` → exits 0; `pnpm exec vitest run --project unit scripts/seedSavedFilters.test.ts Dockerfile.test.ts` → passes.

**Done when:** typecheck is green and the two files pass.

#### Task 0.4 - Baseline run and health report

**Goal:** Measure the untouched app: typecheck, lint, unit, integration, build and demo seed.

**Files:** create `docs/dealflow/HEALTH-CHECK.md`, `docs/dealflow/UPSTREAM.md`

**Steps:**
1. Run, in order, recording result, counts and wall time: `pnpm typecheck`; `pnpm lint`; `pnpm test:unit`; `pnpm test:integration` (Docker; this is the one allowed full integration run before Task 6.2; give it up to 40 minutes, in the background, polling its log); `pnpm build`; `pnpm db:seed:demo`.
2. For each failure decide: caused by this environment or the export (missing file, missing env, port) → fix it now (stuck rule applies) and re-run that step; anything else is a **pre-existing failure**: do not touch the test, list it in `HEALTH-CHECK.md → Pre-existing failures` and in PROGRESS.md → Open issues with the prefix `PRE-EXISTING:` and the exact test name.
3. Gate rule for the rest of the run: a gate command counts as green when its only failures are `PRE-EXISTING:` entries with the same test names. Any other failure is red.
4. Write `HEALTH-CHECK.md` per 6.15 (the click-through section is filled in Task 0.5).
5. Write `docs/dealflow/UPSTREAM.md`: the remote, our branch, the snapshot base chosen in 0.1, how to bring an upstream fix over (`git fetch upstream`, `git cherry-pick -x {sha}`), that our migrations are named `00NN_dealflow_*` and an upstream migration must be regenerated with the next free number, and a running list "Upstream files we changed" (start it with the files changed in 0.3).
6. Commit `0.4: Baseline run and health report`, tick.

**Verify:** `grep -c "^| " docs/dealflow/HEALTH-CHECK.md` → at least 7.

**Done when:** every baseline step has a recorded result and every failure is fixed or listed.

#### Task 0.5 - E2E harness and health click-through

**Goal:** Build the Playwright harness from 6.14 and click through 9 main pages of the seeded app.

**Files:** create `playwright.config.ts`, `scripts/e2e/e2e-env.mjs`, `scripts/e2e/build.mjs`, `scripts/e2e/e2e-server.mjs`, `scripts/e2e/seed-session.ts`, `e2e/helpers.ts`, `e2e/00-health.spec.ts`; modify `src/config/env.ts`, `src/entrypoints/ws.ts`, `package.json`, `docs/dealflow/HEALTH-CHECK.md`

**Steps:**
1. `pnpm add -D @playwright/test@1.64.1`, then `pnpm exec playwright install chromium` (section 4 fallback if it fails).
2. Add `WS_PORT` to `env.ts` exactly as in 6.2 and change `src/entrypoints/ws.ts` to `startWsServer(env.WS_PORT, …)` with the log line `ws server listening on :${env.WS_PORT}`.
3. Write the harness files exactly as 6.14 describes (`seed-session.ts` without the password step for now).
4. `e2e/00-health.spec.ts`: `test.use({ storageState: ".e2e/admin.json" })`; one test per page in this order: `/pipeline`, `/deals/{dealId}` (from `fixtures()`), `/contacts/people`, `/contacts/orgs`, `/leads`, `/activities`, `/inbox`, `/dashboard`, `/settings/profile`. Each: `const res = await page.goto(path)`; expect `res?.status()` below 400; expect the URL not to contain `/login`; expect no heading with the text of `STRINGS.errors.boundaryTitle` (read it from `src/constants/strings.ts` and hard-code the same text in the spec); wait for `networkidle`; `shot(page, "p1-00-{name}")` with names `pipeline`, `deal`, `people`, `orgs`, `leads`, `activities`, `inbox`, `dashboard`, `settings`.
5. Make sure dev services are up (`pnpm dev:up`), then run `pnpm e2e`. Fix harness problems until the 9 tests pass. A page that fails because of the untouched app (not the harness) is a pre-existing failure (Task 0.4 rule): log it and keep its test.
6. Fill `HEALTH-CHECK.md → Click-through`.
7. Commit `0.5: E2E harness and health click-through`, tick.

**Verify:** `ls e2e/screenshots/p1-00-*.png | wc -l` → `9`.

**Done when:** `pnpm e2e` passes `00-health` (or each failure is logged as pre-existing) and 9 screenshots exist.

#### Task 0.6 - Purelymail probe

**Goal:** Record what our IMAP/SMTP host really supports, or record that the probe was skipped.

**Files:** create `scripts/dealflow/mail-probe.ts`, `docs/dealflow/mail-probe-result.json`; modify `package.json`, `pnpm-lock.yaml`

**Steps:**
1. `pnpm add imapflow@2.5.7 nodemailer@10.1.7` (nodemailer ships its own types; do not add `@types/nodemailer`).
2. Write `scripts/dealflow/mail-probe.ts` (a script: may read `process.env`, may use `console.log`). Start with `try { process.loadEnvFile(".env"); } catch { /* no .env */ }`. Read `MAIL_PROBE_USER`, `MAIL_PROBE_PASS` (both required, else write `{ status: "skipped", probedAt, errors: ["MAIL_PROBE_USER/MAIL_PROBE_PASS not set"] }` and exit 0), and the host/port/`MAIL_PROBE_TO` keys with the `.env.example` defaults (`MAIL_PROBE_TO` defaults to the user). Never print or store the password; store the account masked (first letter, `***`, `@domain`).
3. Probe steps, each in its own try/catch that appends `"{step}: {message}"` to `errors` and continues:
   1. `new ImapFlow({ host, port, secure: port === 993, auth: { user, pass }, logger: false, qresync: true })`, `connect()`; record `[...client.capabilities.keys()].sort()`, `[...client.enabled]`, `qresync`/`condstore` (present in capabilities or enabled), `idleAdvertised` (`IDLE` capability).
   2. `client.list()` → `folders` (`path`, `specialUse ?? null`, `[...flags]`).
   3. For INBOX and every special-use folder: `client.status(path, { messages: true, uidNext: true, uidValidity: true, highestModseq: true })` → `folderStatus[path]` with bigints as strings and absent values as `null` (this captures the HIGHESTMODSEQ 0 empty-mailbox behaviour).
   4. IDLE: `client.mailboxOpen("INBOX")`, register `client.on("exists", …)` resolving a promise with the time, start `client.idle()` without awaiting it.
   5. Send: build the raw message once with `createTransport({ streamTransport: true, buffer: true })` (`from` = user, `to` = `MAIL_PROBE_TO`, subject `Dealflow mail probe {ISO time}`, text `Automated probe from Dealflow Part 1. Safe to delete.`, `messageId` `<probe-{uuid}@{user's domain}>`), then send that raw buffer through `createTransport({ host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user, pass } })` with `sendMail({ envelope: { from: user, to: [MAIL_PROBE_TO] }, raw })`. Record `ok`, `messageId`, `smtpResponse` (the `response` string).
   6. Wait up to 60 s for the `exists` event → `idle.worked`, `idle.latencyMs` (from send to event).
   7. Sent folder (special use `\Sent`): poll `client.search({ header: { "message-id": messageId } })` inside a mailbox lock for up to 15 s → `sentFolder.autoSaved`. If not found, `client.append(sentPath, raw, ["\\Seen"])` and search again → `sentFolder.appendWorked` (otherwise leave `null`).
   8. MOVE: in INBOX search for the probe Message-ID and `client.messageMove(uids, trashPath, { uid: true })` → `move.worked`.
   9. `logout()`.
4. Write the result JSON (6.15 shape, `folderStatus` key) to `docs/dealflow/mail-probe-result.json` with `status` `ok` when steps 1, 5 and 6 succeeded, else `failed`, and print a short summary.
5. Run `pnpm mail:probe`. With no credentials: add `TODO(owner): put MAIL_PROBE_USER and MAIL_PROBE_PASS (a Purelymail test mailbox and its app password) in .env, run pnpm mail:probe and commit docs/dealflow/mail-probe-result.json`. Add a summary line to `HEALTH-CHECK.md → Notes for Part 2`.
6. Commit `0.6: Purelymail probe`, tick.

**Verify:** `node -e "const r=require('./docs/dealflow/mail-probe-result.json');console.log(r.status)"` → `ok`, `failed` or `skipped`.

**Done when:** the script exists and a result file is committed.

#### Task 0.7 - Phase 0 QA gate

**Goal:** Prove Phase 0 is sound before changing the product.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands below; fix until green (rule 9.1; the pre-existing rule from 0.4 applies).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile; the single independent review is Task 6.3). Record the Phase 1 base commit, commit `0.7: Phase 0 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → green under the 0.4 rule

**QA focus:** Definition of done items 1 to 3; `.env` was never overwritten; no kit file is committed in the snapshot commit.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0 (or only pre-existing failures)

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: Rebrand, defaults and deploy shape

At the end: the product reads Dealflow, telemetry and the update check are off by default, the default compose has no Caddy, and CLAUDE.md matches how we verify.

#### Task 1.1 - Dealflow name in the app

**Goal:** Every user-visible string says Dealflow; a test keeps it that way.

**Files:** modify `src/constants/strings.ts`, `src/constants/settingsStrings.ts`, `src/constants/enrichmentStrings.ts`, `src/app/(app)/settings/email-sync/strings.ts`, `src/app/oauth/authorize/consent.tsx`, `src/features/notifications/email/render.ts`, `src/features/release/ui/VersionBanner.tsx`, `src/features/leads/inbox/SourceOriginInfo.tsx`, `src/features/deal-workspace/composer/VideoCallField.tsx`, `src/app/layout.tsx` (comment only), tests that assert the old text; create `src/features/branding/brand.test.ts`

**Steps:**
1. Replace "Warpdrive"/"warpdrive" in user-visible strings of the files above with "Dealflow" (`STRINGS.app.name = "Dealflow"`, login title, crash title, connected-apps texts, "Already in Dealflow", email-sync intro, consent heading "Connect an application to Dealflow?", notification subjects and the "Open in Dealflow" link, the lead source-origin sentence). `VersionBanner` reads "A new upstream release ({latest}) is available" because the update check follows the upstream project.
2. `VIDEO_CALL_LINK_BASE` becomes `https://meet.jit.si/dealflow-` (real, free rooms; the comment explains why).
3. Leave internal identifiers as section 3 says (cookie names, storage keys, `warpdrive:open-search`, `Symbol.for("warpdrive.rateLimiters")`, `RELEASE_REPO`, `https://warpdrive.invalid` in `loginReturn.ts`, the MinIO bucket default, `DOCS_SITE_URL`). Comments may keep the old name.
4. Run `grep -rniI "warpdrive" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` and confirm every remaining hit is one of the allowed identifiers or a comment.
5. Update tests that assert the old visible text (expected now: Dealflow); log one Decision listing them.
6. `brand.test.ts` (unit): `STRINGS.app.name` is `"Dealflow"`; the notification render for a mention contains "Dealflow" and not "Warpdrive"; for each file in the step 1 list, every line matching `/warpdrive/i` is a comment (trimmed line starts with `//`, `*` or `/*`) or contains one of the allowed identifiers.
7. Commit `1.1: Dealflow name in the app`, tick.

**Verify:** `pnpm exec vitest run --project unit src/features/branding/brand.test.ts` → passes.

**Done when:** the grep shows only allowed hits and the brand test passes.

#### Task 1.2 - Package, docs, licence and MCP names

**Goal:** Rename the package, README, docs and the MCP server; keep the MIT notice and add ours.

**Files:** modify `package.json`, `README.md`, `LICENSE`, `docs/mcp-server.md`, `src/app/api/mcp/route.ts`, `src/features/mcp/server.ts`, related MCP tests

**Steps:**
1. `package.json` per 6.1.
2. `LICENSE`: keep `Copyright (c) 2026 Nikita Sawinyh`; add the line `Copyright (c) 2026 Dealflow contributors` below it.
3. MCP `serverInfo` and `McpServer` names become `dealflow`; update tests that assert `warpdrive`.
4. Rewrite `README.md` for Dealflow: one-paragraph description; "Built on [warpdrive](https://github.com/sneg55/warpdrive) by Nikita Sawinyh (MIT)"; features (warpdrive's list plus Part 1 additions: password and email-link sign-in, built-in AI); quickstart (`pnpm install`, `pnpm env:sync`, `pnpm dev:up`, `pnpm db:migrate:dev`, `pnpm db:seed:demo`, `pnpm dev`, sign in at `/auth/dev-login?email=demo1@example.com` in development); self-hosting pointer to `docs/deploy.md` and `docs/reverse-proxy.md`; AI section (OpenRouter key, model, `AI_FAKE`, caps in Settings → AI); tests (`pnpm test:unit`, `pnpm test:integration`, `pnpm e2e`); licence. Drop the "warpdrive vs Pipedrive" table. Keep the screenshot images with Dealflow alt text.
5. `docs/mcp-server.md`: rename the product.
6. Commit `1.2: Package, docs, licence and MCP names`, tick.

**Verify:** `grep -c "Dealflow" README.md` → at least 5; `grep -c "Nikita Sawinyh" LICENSE` → `1`.

**Done when:** package, README, licence and MCP names are updated.

#### Task 1.3 - Telemetry and update check off by default

**Goal:** No PostHog capture and no GitHub poll unless the owner opts in.

**Files:** modify `src/config/env.ts`, `.env.example`, env tests that assert the old defaults

**Steps:**
1. In `env.ts` set the `DISABLE_TELEMETRY` and `DISABLE_UPDATE_CHECK` defaults to `true` (6.2) and update their comments: opt in by setting `false`.
2. `.env.example`: `DISABLE_TELEMETRY=true`, `DISABLE_UPDATE_CHECK=true`, with one-line comments.
3. Update env tests that assumed `false`; log a Decision.
4. Commit `1.3: Telemetry and update check off by default`, tick.

**Verify:** `pnpm exec vitest run --project unit src/config/env.test.ts src/features/release src/features/observability` → passes.

**Done when:** both default to off and the tests agree.

#### Task 1.4 - Compose without Caddy and reverse-proxy docs

**Goal:** The default stack publishes app, ws and MinIO for the owner's own proxy; Caddy becomes a documented example.

**Files:** modify `docker-compose.yml`, `docker-compose.dev.yml`, `.env.example`, `Caddyfile.test.ts`, `docs/deploy.md`; move `Caddyfile` to `docs/reverse-proxy/Caddyfile.example`; create `docs/reverse-proxy.md`

**Steps:**
1. Apply 6.11 to both compose files and move the Caddyfile with `git mv`.
2. Update `Caddyfile.test.ts` to read `docs/reverse-proxy/Caddyfile.example`; its assertions stay.
3. `.env.example`: the Docker host-port keys from 6.2 and the reverse-proxy section.
4. Write `docs/reverse-proxy.md` and rewrite `docs/deploy.md` (6.11).
5. Restart the dev services so the project picks up the new file: `pnpm dev:up` (same project name `dealflow`, same volumes).
6. Check: `docker compose config --quiet` and `docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet` both exit 0, and `docker compose config --services` does not list `caddy`.
7. Add the changed upstream files to `docs/dealflow/UPSTREAM.md`. Commit `1.4: Compose without Caddy and reverse-proxy docs`, tick.

**Verify:** `docker compose config --services | grep -c caddy` → `0`; `pnpm exec vitest run --project unit Caddyfile.test.ts` → passes.

**Done when:** both compose files validate without Caddy and the docs exist. (The container smoke runs in Task 6.2.)

#### Task 1.5 - CLAUDE.md fast profile and project notes

**Goal:** One set of instructions: CLAUDE.md describes the fast verification profile and the Dealflow rules.

**Files:** modify `CLAUDE.md`

**Steps:**
1. Title and project lines: **Project:** Dealflow (built on warpdrive); description updated (single company, self-hosted, password/email-link/Google sign-in, IMAP/SMTP mail planned, built-in AI).
2. Replace the section "Test-Driven Development (required)" with "## Verification profile (fast)": per change run `pnpm typecheck`; before calling a phase done run `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`; integration tests (`pnpm test:integration`, Docker) run once per part; write new tests for risky server logic only (money, dates, state machines, permissions, public routes, auth, mail sync, threading), and write those test-first; Playwright e2e (`pnpm e2e`) and a screenshot gallery run once at the end of each part; never mock the database in the tests you do write; never claim something works without running the check that proves it.
3. Add "## Dealflow conventions": brand rule (section 3), new work in new feature folders and new schema files, migrations named `00NN_dealflow_<topic>`, upstream policy pointer to `docs/dealflow/UPSTREAM.md`, plans live in `PLAN-PART<N>.md` with `ROADMAP.md` as context, every external service has a fake (`AI_FAKE`, `MAIL_FAKE`).
4. Keep every other section (stack, conventions, engineering conventions, linting, git safety) unchanged apart from the stack line gaining `openai`, `nodemailer`, `imapflow`, `@node-rs/argon2`, Playwright.
5. Commit `1.5: CLAUDE.md fast profile and project notes`, tick.

**Verify:** `grep -c "Test-Driven Development (required)" CLAUDE.md` → `0`; `grep -c "Verification profile (fast)" CLAUDE.md` → `1`.

**Done when:** CLAUDE.md and this plan no longer contradict each other.

#### Task 1.6 - Phase 1 QA gate

**Goal:** Prove the rebrand and the deploy changes broke nothing.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 2 base commit, commit `1.6: Phase 1 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → green under the 0.4 rule

**QA focus:** Definition of done items 4, 5, 6 (config part) and 13; no internal identifier was renamed; the LICENSE notice is intact.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: Sign-in without Google

At the end: email + password and magic-link sign-in work, Google is optional, bootstrap and dev-login are safe, invites send a set-password link, and the profile page manages the password.

#### Task 2.1 - Auth env, schema and error IDs

**Goal:** Land the configuration, tables and IDs every later auth task uses.

**Files:** modify `src/config/env.ts`, `.env.example`, `src/constants/errorIds.ts`, `src/constants/errorIds.test.ts`, `src/constants/rateLimits.ts`, `src/db/schema/index.ts`, `scripts/e2e/e2e-env.mjs`, env tests; create `src/db/schema/authLocal.ts`, `src/features/auth/authMethods.ts`, `drizzle/0075_dealflow_auth.sql` (+ meta)

**Steps:**
1. `env.ts`: the Google, `AUTH_*`, `SMTP_*`, `MAIL_*` changes and both superRefine rules from 6.2 (AI keys come in 3.1). `.env.example` sections per 6.2.
2. `authMethods.ts` per 6.2.
3. Error IDs `E_AUTH_007` to `E_AUTH_014`, `E_MAIL_001`, `E_MAIL_002`; add `"MAIL"` to the domain list in `errorIds.test.ts`.
4. Rate limits `authPassword`, `authMagicRequest`, `authTokenVerify` (6.5).
5. `authLocal.ts` exactly as 6.4; export it from the schema index; `pnpm exec drizzle-kit generate --name dealflow_auth`; check the SQL creates `user_credentials`, the enum and `auth_tokens` and nothing else; `pnpm db:migrate:dev`.
6. `pnpm env:sync -- --migrate` (blanks the dev Google placeholders so Google is off locally), then `pnpm env:sync` (appends the new keys). In `scripts/e2e/e2e-env.mjs` set the three `GOOGLE_*` values to `""`.
7. Update env tests for the new optional Google contract and add unit cases: two of three Google vars set → parse error; all empty → ok; production with every method off → parse error. Log the Decision.
8. Commit `2.1: Auth env, schema and error IDs`, tick.

**Verify:** `pnpm exec vitest run --project unit src/config src/constants/errorIds.test.ts` → passes; `pnpm db:migrate:dev` → exits 0.

**Done when:** the migration applies and the env tests pass.

#### Task 2.2 - System mailer

**Goal:** One way to send system mail: SMTP, log or capture.

**Files:** create `src/features/mailer/types.ts`, `systemMailer.ts`, `smtpMailer.ts`, `logMailer.ts`, `captureMailer.ts`, `templates.ts`, `templates.test.ts`, `captureMailer.test.ts`

**Steps:**
1. Implement 6.6 exactly. Each implementation file stays under 80 lines.
2. `templates.test.ts` (unit): the magic-link mail contains the URL in text and HTML; a URL containing `<script>` and `&` is escaped in HTML; subjects match 6.6.
3. `captureMailer.test.ts` (unit, temp dir under `os.tmpdir()`): `send` writes one JSON file with `to`, `subject`, `text`, `html`, `sentAt`; an unwritable directory returns `E_MAIL_002`.
4. Commit `2.2: System mailer`, tick.

**Verify:** `pnpm exec vitest run --project unit src/features/mailer` → passes.

**Done when:** the three modes exist and the tests pass.

#### Task 2.3 - Local auth services

**Goal:** Passwords, tokens, lockout, bootstrap, magic links and invite acceptance as Result-returning services, proved by integration tests.

**Files:** create `src/features/auth/password.ts`, `authTokens.ts`, `credentials.ts`, `passwordLogin.ts`, `bootstrapLocal.ts`, `magicLink.ts`, `invites.ts`, `sessionsAdmin.ts`, `localAuth.integration.test.ts`; modify `src/features/auth/bootstrap.ts` (export `BOOTSTRAP_LOCK_KEY`), `package.json`

**Steps:**
1. `pnpm add @node-rs/argon2@2.2.2`.
2. Write the modules per 6.5 (token core and `passwordLogin` exactly as given). Write the integration tests first, see them fail, then implement.
3. `localAuth.integration.test.ts` (uses `makeTestDb`; truncate the touched tables between tests like `bootstrap.test.ts` does; seed data with `ensureSeedData` inside a transaction where a user row is needed) covers:
   1. hash then verify works; a wrong password fails; `checkPasswordPolicy` rejects 11 and 129 characters.
   2. `passwordLogin` ok with the right password; unknown email and inactive user both return `E_AUTH_007`.
   3. 10 wrong passwords lock the account: the 11th attempt with the right password returns `E_AUTH_008`; after setting `locked_until` into the past, the right password works and the counter is 0.
   4. a magic-link token consumes once; the second consume returns `E_AUTH_009`; an expired token (update `expires_at` to the past) returns `E_AUTH_009`; an invite token is rejected when only `magic_link` is accepted.
   5. two concurrent `consumeAuthToken` calls on one token: exactly one succeeds.
   6. `requestMagicLink` for an unknown, non-seed email sends nothing (capture mailer via `setSystemMailerForTest` sees zero mails) and returns ok.
   7. bootstrap: with bootstrap open, a request for the seed email creates an admin and closes bootstrap; a second, different email creates nothing; once bootstrap is closed, `allowAfterBootstrap: false` for a deleted seed user returns `null`, `true` recreates it as admin.
   8. `acceptInvite` sets the name and password, clears `invited_at`, and `passwordLogin` then works; a reused invite token returns `E_AUTH_009`.
   9. issuing a second invite link makes the first invite token unusable.
4. Run exactly `pnpm exec vitest run --project integration src/features/auth/localAuth.integration.test.ts`; fix until green.
5. Commit `2.3: Local auth services`, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/auth/localAuth.integration.test.ts` → all pass (at least 9 tests).

**Done when:** every case passes.

#### Task 2.4 - Auth routes and safe dev-login

**Goal:** HTTP endpoints for password, magic link and invite acceptance; Google and dev-login gated.

**Files:** create `src/features/auth/originCheck.ts`, `originCheck.test.ts`, `sessionCookies.ts`, `src/app/auth/password/route.ts`, `src/app/auth/magic-link/route.ts`, `src/app/auth/magic/verify/route.ts`, `src/app/auth/invite/accept/route.ts`; modify `src/app/auth/start/route.ts`, `src/app/auth/dev-login/route.ts`, `src/features/auth/devLogin.ts`, `src/features/auth/devLogin.test.ts`

**Steps:**
1. `originCheck.ts` exactly as 6.5; `originCheck.test.ts` (unit, uses the `vitest.setup.ts` BASE_URL `https://app.example.com`): matching origin true; other origin false; `sec-fetch-site: cross-site` false; no origin with `same-origin` true; no origin and no fetch-site false.
2. `sessionCookies.ts` per 6.5.
3. The four route handlers per the 6.5 table (`export const runtime = "nodejs"`; parse `await req.formData()` through Zod; one `AbortSignal.timeout(10_000)` per request; redirects with `NextResponse.redirect(new URL(path, env.BASE_URL), 303)`).
4. `/auth/start`: return 404 when `authMethods().google` is false.
5. `devLoginCore`: add `host: string | null` to `DevLoginDeps` and the guard from 6.5; the route passes the host header. Add `devLogin.test.ts` cases: production → disabled; `nodeEnv: "development"` with host `crm.example.com` → disabled; `localhost:3000` → allowed path proceeds as before.
6. Commit `2.4: Auth routes and safe dev-login`, tick.

**Verify:** `pnpm exec vitest run --project unit src/features/auth/originCheck.test.ts` → passes; `pnpm exec vitest run src/features/auth/devLogin.test.ts` → passes.

**Done when:** routes compile, unit tests pass, and dev-login refuses non-loopback hosts.

#### Task 2.5 - Login, magic-link and invite pages

**Goal:** The sign-in screens for every enabled method.

**Files:** create `src/constants/authStrings.ts`, `src/app/(auth)/login/LoginPanel.tsx`, `src/app/(auth)/login/magic/page.tsx`, `src/app/(auth)/login/invite/page.tsx`; modify `src/app/(auth)/login/page.tsx`

**Steps:**
1. `authStrings.ts`: every string in 6.5 (titles: "Sign in to Dealflow", "Sign in as {email}", "Set your password").
2. `login/page.tsx` (server component; `searchParams` is a Promise in Next 16): reads `authMethods()`, `error`, `sent`, `method`, `next`; renders a centred card (`w-full max-w-[400px] rounded-lg border bg-background p-6`) with the title and `LoginPanel`.
3. `LoginPanel.tsx` (client): shadcn `Tabs` with "Password" and "Email link" (only enabled ones; default from `method`, else the first). Password tab: a plain `<form method="post" action="/auth/password">` with `Label`/`Input` "Email" (`type="email"`, `name="email"`, `autoComplete="username"`, required), "Password" (`type="password"`, `name="password"`, `autoComplete="current-password"`, required), hidden `next`, `Button type="submit"` "Sign in". Email-link tab: form to `/auth/magic-link` with "Email" and "Email me a sign-in link". Above the tabs: `login-error` (destructive text) for a known `error` code, `login-sent` for `sent=1`. Below, only when Google is on: a divider "or" and a link button "Sign in with Google" to `/auth/start?next={next}`.
4. `login/magic/page.tsx` and `login/invite/page.tsx` per 6.5 with the same card; invite inputs `name`, `password`, `confirm` with labels "Name", "New password", "Confirm password" (`autoComplete="new-password"`); `invite-error` for known codes; expired card with `magic-invalid` / `invite-invalid`.
5. No native selects, checkboxes or overlays; `Input`, `Label`, `Button`, `Tabs` come from `src/components/ui/` (add the standard shadcn `Label` wrapper over `@radix-ui/react-label` only if no label primitive exists; check first).
6. Commit `2.5: Login, magic-link and invite pages`, tick.

**Verify:** `pnpm typecheck` → exits 0; `pnpm lint` → exits 0.

**Done when:** the three pages render every state in 6.5 (proved in Task 6.1).

#### Task 2.6 - Invite email, profile password and bootstrap link

**Goal:** Invites send a set-password link, users manage their password, and the owner can mint an admin link from the shell.

**Files:** modify `src/features/identity/actions/invite.ts`, `src/app/(app)/settings/users/InviteUserForm.tsx`, `src/app/(app)/settings/profile/page.tsx`, related invite tests; create `src/features/auth/passwordActions.ts`, `src/app/(app)/settings/profile/PasswordCard.tsx`, `scripts/dealflow/bootstrap-link.ts`

**Steps:**
1. `inviteUserAction`: per 6.5 (invite link + `inviteMail` with the inviter's name). Update `InviteUserForm` success UI and its tests; remove the old "No email is sent automatically" notice. Log the Decision.
2. `passwordActions.ts` and `PasswordCard.tsx` per 6.5 (`data-testid="password-card"`, labels, `password-saved`, error text from `authStrings.ts`); mount the card in the profile page below the existing profile form with `hasPassword` from `getCredentials`.
3. `scripts/dealflow/bootstrap-link.ts`: builds its own pg Pool + drizzle from `process.env.DATABASE_URL`, calls `ensureBootstrapAdmin(db, SEED_ADMIN_EMAIL, SEED_ADMIN_EMAIL, { allowAfterBootstrap: true })`, mints an `admin_setup` token, prints `Admin setup link (valid 24 hours, single use): {BASE_URL}/login/invite?token={token}`, closes the pool. Empty `SEED_ADMIN_EMAIL` → prints `SEED_ADMIN_EMAIL is not set` and exits 1.
4. Commit `2.6: Invite email, profile password and bootstrap link`, tick.

**Verify:** `pnpm exec vitest run "src/app/(app)/settings/users"` → passes; `pnpm auth:bootstrap-link` → prints a link containing `/login/invite?token=`.

**Done when:** invites carry links, the password card works, and the CLI prints a working link.

#### Task 2.7 - Phase 2 QA gate

**Goal:** Prove sign-in changes are sound before building the AI layer.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 3 base commit, commit `2.7: Phase 2 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → green under the 0.4 rule
- `pnpm exec vitest run --project integration src/features/auth/localAuth.integration.test.ts` → passes

**QA focus:** Definition of done items 7 and 8; tokens are hashed; consume is a single statement; no route reveals whether an email exists; dev-login is unreachable in production.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: AI core

At the end: an OpenRouter provider, a deterministic fake, JSON helpers, usage logging, company and per-user caps, and an admin page that shows and edits them.

#### Task 3.1 - AI env, dependency and schema

**Goal:** Configuration, the `openai` SDK and the AI tables.

**Files:** modify `src/config/env.ts`, `.env.example`, `src/constants/errorIds.ts`, `src/constants/errorIds.test.ts`, `src/db/schema/index.ts`, `package.json`; create `src/db/schema/ai.ts`, `drizzle/0076_dealflow_ai.sql` (+ meta)

**Steps:**
1. `pnpm add openai@7.39.0`.
2. `env.ts`: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL`, `AI_FAKE` (6.2), `OPENROUTER_API_KEY` added to `SECRET_FILE_VARS`; `.env.example` AI section with a comment that `deepseek/deepseek-v4.1-flash-1017` pins the dated snapshot. `pnpm env:sync`.
3. Error IDs `E_AI_001` to `E_AI_011`; `"AI"` in the test's domain list.
4. `ai.ts` exactly as 6.4; export it; `pnpm exec drizzle-kit generate --name dealflow_ai`; append the `ai_settings` seed insert (6.4); `pnpm db:migrate:dev`.
5. Commit `3.1: AI env, dependency and schema`, tick.

**Verify:** `pnpm db:migrate:dev` → exits 0; `pnpm exec vitest run --project unit src/constants/errorIds.test.ts src/config` → passes.

**Done when:** the migration applies and the env parses with and without the AI keys.

#### Task 3.2 - Provider layer and JSON helper

**Goal:** One provider interface with OpenRouter, fake and scripted implementations, and a JSON helper with one retry.

**Files:** create `src/features/ai/types.ts`, `provider.ts`, `openrouterProvider.ts`, `fakeProvider.ts`, `scriptedProvider.ts`, `chatJson.ts`, `aiErrors.ts`, `fakeProvider.test.ts`, `chatJson.test.ts`

**Steps:**
1. Implement 6.7 and the `aiErrors.ts` map from 6.8. `chatJson` needs `assertAiAllowed` and `recordAiUsage` from Task 3.3: take them through a `deps` parameter (`{ assertAllowed, record }`) with the real functions as defaults, so the unit test runs without a database.
2. `fakeProvider.test.ts` (unit): each table row returns its documented content; `/fake-tool {"name":"add_note","arguments":{"body":"x"}}` returns one tool call named `add_note` with `{"body":"x"}` arguments; after a `tool` message the assistant branch returns text.
3. `chatJson.test.ts` (unit, `ScriptedAiProvider` + stub deps): parses a fenced JSON reply; retries once after invalid JSON and succeeds (the second request carries the "Your previous reply was not valid" message); two invalid replies → `E_AI_005`; a provider error is returned without retry; the record stub is called once per provider call.
4. Commit `3.2: Provider layer and JSON helper`, tick.

**Verify:** `pnpm exec vitest run --project unit src/features/ai` → passes.

**Done when:** providers and `chatJson` behave as 6.7 says.

#### Task 3.3 - Usage, caps and rate limit

**Goal:** Every AI call is logged and blocked when AI is off or a cap is reached.

**Files:** create `src/features/ai/usage.ts`, `aiSettings.ts`, `rateLimit.ts`, `usage.integration.test.ts`

**Steps:**
1. Implement 6.8. Wire the real `assertAiAllowed`/`recordAiUsage` as `chatJson`'s default deps.
2. `usage.integration.test.ts` (`makeTestDb`, `setAiProviderForTest(new ScriptedAiProvider())` in `beforeEach`, `setAiProviderForTest(undefined)` after): provider `null` → `E_AI_001`; settings disabled → `E_AI_002`; company usage at the cap (insert one `ai_usage` row) → `E_AI_003`; a per-user cap of 100 with 150 tokens used by that user → `E_AI_004` while another user is allowed; usage from the previous month does not count; `getUsage` sums by feature and by user.
3. Run exactly that file; fix until green.
4. Commit `3.3: Usage, caps and rate limit`, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/ai/usage.integration.test.ts` → passes (at least 6 tests).

**Done when:** caps and logging are proven.

#### Task 3.4 - AI router, Settings page and model check

**Goal:** Admins see provider, usage and caps and can change them; the owner can check the model id.

**Files:** create `src/features/ai/router.ts`, `src/features/ai/actions/settingsActions.ts`, `src/constants/aiStrings.ts`, `src/app/(app)/settings/ai/page.tsx`, `src/app/(app)/settings/ai/AiSettingsClient.tsx`, `scripts/dealflow/check-model.ts`; modify `src/server/trpc/root.ts`, `src/app/(app)/settings/SettingsNav.tsx`

**Steps:**
1. Router with `status` and `overview` now (the other procedures arrive in 4.1 and 5.3); register it as `ai` in `appRouter`.
2. `updateAiSettingsAction` per 6.9.
3. Page, client component and nav item per 6.9; all strings in `aiStrings.ts`.
4. `check-model.ts`: fetch `{OPENROUTER_BASE_URL or https://openrouter.ai/api/v1}/models` with `AbortSignal.timeout(15_000)`; print every id starting with `deepseek/deepseek-v4.1-flash` with whether `supported_parameters` includes `tools` and `response_format` and its prompt/completion price; print `CONFIGURED MODEL LISTED` or `CONFIGURED MODEL NOT LISTED` for `OPENROUTER_MODEL` (default `deepseek/deepseek-v4.1-flash`). With `--chat` and a key in the environment: one request "Reply with the single word: ok" through the `openai` SDK; print the reply and token usage. Without a key `--chat` prints `skipped: OPENROUTER_API_KEY not set`. Load `.env` with `process.loadEnvFile` in try/catch.
5. Run `pnpm ai:check-model` (no `--chat`); record the output summary in PROGRESS.md → Decisions. Add `TODO(owner): add OPENROUTER_API_KEY to the server .env, set AI_FAKE=false, then run pnpm ai:check-model --chat`.
6. Commit `3.4: AI router, Settings page and model check`, tick.

**Verify:** `pnpm typecheck` → exits 0; `pnpm ai:check-model` → prints `CONFIGURED MODEL LISTED` (or the section 4 fallback is logged).

**Done when:** `/settings/ai` compiles and the model check ran.

#### Task 3.5 - Phase 3 QA gate

**Goal:** Prove the AI core before features use it.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 4 base commit, commit `3.5: Phase 3 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → green under the 0.4 rule
- `pnpm exec vitest run --project integration src/features/ai/usage.integration.test.ts` → passes

**QA focus:** Definition of done item 9; no real API call in any test; the API key is never logged; caps are checked before every provider call.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: AI on records

At the end: the deal workspace has an AI insights card, the composer drafts emails, deal notes turn into activities, and the deal filter dialog understands plain English.

#### Task 4.1 - Deal context, summary and score

**Goal:** Visibility-safe deal context and the two deal insight services.

**Files:** create `src/features/ai/dealContext.ts`, `dealInsights.ts`, `actions/dealActions.ts`, `dealInsights.integration.test.ts`; modify `src/features/ai/router.ts`

**Steps:**
1. Implement 6.9 context, summary, score, both actions and `ai.dealInsight`.
2. `dealInsights.integration.test.ts` (`makeTestDb`, factories from `@/db/testing`, `ScriptedAiProvider`): summary stored in `deal_ai_insights` and one `ai_usage` row with feature `deal_summary`; an unknown `typeKey` becomes `task` and `dueInDays: 99` becomes 30; a score of 140 is stored as 100; a regular user who cannot see the deal gets the not-found error and `provider.calls.length === 0`.
3. Run exactly that file; fix until green.
4. Commit `4.1: Deal context, summary and score`, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/ai/dealInsights.integration.test.ts` → passes (at least 4 tests).

**Done when:** insights are stored and invisible deals are refused before any AI call.

#### Task 4.2 - Deal AI card

**Goal:** Show and refresh the summary and score on the deal page.

**Files:** create `src/features/ai/ui/DealAiCard.tsx`; modify `src/features/deal-workspace/DealSidebar.tsx`

**Steps:**
1. `DealAiCard` (client, props `dealId`, `personId`, `orgId`): reads `ai.status` and `ai.dealInsight`; renders the heading "AI insights" with a `Sparkles` icon and the hooks from 6.12. Summary block: empty → "Generate summary"; present → health `Badge` ("On track", "At risk", "Stalled"), summary text, "Risks" list, "Next steps" rows each with type name, "in {n} days" and an "Add" button that calls `createActivityAction` (typeId from `trpc.activities.listTypes` by key, `allDay: true`, `dueAt: composeDueAt(today + n days as YYYY-MM-DD, "")`, `dealId`, `personId`, `orgId`) and then invalidates `activities.listForEntity` for the deal; footer "Updated {relative time}" and "Refresh summary". Score block: empty → "Score deal"; present → "{score}/100" and reasons, "Rescore". Errors → `deal-ai-error` with `aiErrorMessage`. AI unavailable or disabled → one muted line with that message and no buttons. Buttons show a pending state while their action runs.
2. Render `<DealAiCard …/>` as the first child inside the root element of `DealSidebar` (values from `workspace.deal`). Keep the sidebar's existing sections, tests and layout unchanged; add the file to `UPSTREAM.md`'s changed list.
3. Commit `4.2: Deal AI card`, tick.

**Verify:** `pnpm typecheck` → exits 0; `pnpm exec vitest run src/features/deal-workspace/DealSidebar.test.tsx` → passes (mock `DealAiCard` in that test only if it breaks for lack of a tRPC provider, and log the Decision).

**Done when:** the card renders on the deal page (proved in Task 6.1).

#### Task 4.3 - Email draft in the composer

**Goal:** "Write with AI" fills the subject and body of warpdrive's composer.

**Files:** create `src/features/ai/emailDraft.ts`, `actions/composeActions.ts`, `ui/AiDraftButton.tsx`; modify `src/features/email/composer/Composer.tsx`

**Steps:**
1. Implement the email draft service and action (6.9).
2. `AiDraftButton` (client): `Popover` trigger per 6.12; content: `Textarea` "What should the email say?" (3 rows, 500 max), `Select` "Tone" (Friendly, Formal, Short; default Friendly), button "Draft". On success call `onDraft({ subject, bodyHtml })` and close; errors in `ai-draft-error`. Hidden when `ai.status.available` is false.
3. In `Composer.tsx` render it in the toolbar row after `SignatureDropdown` with `dealId={links.linkDealId ?? null}`, `personId={links.linkPersonId ?? null}`, `recipientEmail={toList[0]}`, and `onDraft` that sets the subject only when it is empty and the subject is not locked (`resolvedThreadId === undefined`), and sets the body to `bodyHtml + body` so the draft lands above any signature. Existing composer tests must still pass.
4. Commit `4.3: Email draft in the composer`, tick.

**Verify:** `pnpm exec vitest run src/features/email/composer/Composer.test.tsx` → passes.

**Done when:** the button drafts into the composer (proved in Task 6.1).

#### Task 4.4 - Notes to activities

**Goal:** A deal note's menu proposes follow-up activities the user can edit and create.

**Files:** create `src/features/ai/notesToActivities.ts`, `ui/NotesToActivitiesDialog.tsx`; modify `src/features/ai/actions/dealActions.ts`, `src/features/deal-workspace/history/NoteCard.tsx`

**Steps:**
1. Implement the service and `proposeActivitiesFromNoteAction` (6.9).
2. `NoteCard`: when `entityType === "deal"`, add a `DropdownMenuItem` "Turn into activities" before "Edit" that opens the dialog.
3. `NotesToActivitiesDialog` (shadcn `Dialog`, title "Suggested activities"): on open it calls the action and shows a loading line; then one `ai-proposal` row per proposal with `Checkbox` (checked), `Input` subject, `Select` type and `DatePicker` due date; empty list → "No follow-ups found in this note."; button "Create selected" (disabled when none checked) creates them one after another with `createActivityAction` (6.9), invalidates the deal's activity list, calls `onChanged`, closes. Errors inline with `aiErrorMessage`.
4. Commit `4.4: Notes to activities`, tick.

**Verify:** `pnpm exec vitest run src/features/deal-workspace/history` → passes.

**Done when:** the menu item appears on deal notes and creates activities (proved in Task 6.1).

#### Task 4.5 - Describe a filter

**Goal:** Plain English becomes deal filter conditions in the existing filter dialog.

**Files:** create `src/features/ai/aiFilter.ts`, `aiFilter.test.ts`, `actions/filterActions.ts`, `ui/AiFilterBox.tsx`; modify `src/features/deals/CreateFilterModal.tsx`

**Steps:**
1. Implement the service and `describeFilterAction` (6.9) for all four entities.
2. `aiFilter.test.ts` (unit, `ScriptedAiProvider` + stub deps): a valid deal definition passes; a condition with field `nope` fails validation and triggers the retry; two invalid replies → `E_AI_005`; the system prompt lists `value` and `expectedCloseDate`.
3. `AiFilterBox` (client): `Input` "Describe a filter" (placeholder "Open deals over 10,000 closing this month"), button "Generate filter", `ai-filter-explanation`, `ai-filter-error`; hidden when AI is unavailable. Props `entity` and `onDefinition(def)`.
4. In `CreateFilterModal` render it at the top of the dialog body for `entity="deal"` with `onDefinition={(d) => { setRows(definitionToRows(d)); setCombinator(d.combinator); }}`. Existing tests must pass.
5. Commit `4.5: Describe a filter`, tick.

**Verify:** `pnpm exec vitest run --project unit src/features/ai/aiFilter.test.ts src/features/deals/CreateFilterModal.test.tsx` → passes.

**Done when:** the dialog fills its rows from a description (proved in Task 6.1).

#### Task 4.6 - Phase 4 QA gate

**Goal:** Prove the record features are sound.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 5 base commit, commit `4.6: Phase 4 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → green under the 0.4 rule
- `pnpm exec vitest run --project integration src/features/ai/dealInsights.integration.test.ts` → passes

**QA focus:** Definition of done items 10 and 11; every AI action checks CSRF, the actor, visibility and the rate limit before calling the provider; activities are created through warpdrive's own action (its permission check applies).

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 5: Assistant

At the end: a drawer assistant that answers from CRM data through warpdrive's MCP tools and only writes after Confirm.

#### Task 5.1 - Tool catalogue from the MCP registry

**Goal:** Turn the allow-listed MCP tools into OpenAI tool definitions plus read/write invokers.

**Files:** modify `src/features/mcp/tools/types.ts`; create `src/features/ai/assistant/tools.ts`, `src/features/ai/assistant/tools.test.ts`

**Steps:**
1. `ToolRegistry.definitions` and the one-line fill in `registerTool` (6.10). MCP tests must still pass.
2. `tools.ts`: `READ_TOOLS`, `WRITE_TOOLS` (6.10 lists), `buildAssistantCatalogue(db, actor): { defs: AiToolDef[]; reads: ToolRegistry; writes: ToolRegistry; schemas: Map<string, z.ZodObject>; kind(name): "read" | "write" | null }`, `toToolDef`, `summarizeWrite`, `toolResultText(result: CallToolResult): string` (joined text, cut to 8,000).
3. `tools.test.ts` (unit; build the catalogue with a placeholder db object, since registration does not query): 25 definitions; every name in the two lists is present and no other; each `parameters` has `type: "object"` and no `$schema`; `summarizeWrite("add_note", { body: "x".repeat(100) })` is `Add note: "` + 60 x's + `"`.
4. Commit `5.1: Tool catalogue from the MCP registry`, tick.

**Verify:** `pnpm exec vitest run --project unit src/features/ai/assistant/tools.test.ts src/features/mcp` → passes (MCP tests that need a database run in the integration lane and are not part of this check).

**Done when:** the catalogue matches 6.10.

#### Task 5.2 - Assistant loop and pending actions

**Goal:** Conversations, the tool loop, confirm and reject, proved against a real database.

**Files:** create `src/features/ai/assistant/prompt.ts`, `assistant.ts`, `conversations.ts`, `assistant.integration.test.ts`

**Steps:**
1. Implement 6.10 (`conversations.ts`: create, list, get view, ownership check; `assistant.ts`: `sendAssistantMessage`, `confirmAiAction`, `rejectAiAction`).
2. `assistant.integration.test.ts` (`makeTestDb`, factories, `ScriptedAiProvider`):
   1. a plain answer is stored and returned in `items`; the title becomes the first 60 characters of the message.
   2. a read call (`search`) sends a `tool` message back on the second provider call (`provider.calls[1].messages` contains a `tool` role).
   3. a write call (`add_note` on a deal the user can see) creates a pending action and no note exists yet.
   4. confirming creates the note, sets `confirmed`, and adds "Done: {summary}".
   5. another user confirming that action gets `E_AI_009` and the action stays pending.
   6. rejecting sets `rejected` and adds "Cancelled: {summary}".
   7. invalid arguments return an error tool result and create no action.
   8. a tool not on the allow-list (`delete_email_draft`) returns `Unknown tool`.
   9. six tool-calling replies in a row end with the step-limit message.
3. Run exactly that file; fix until green.
4. Commit `5.2: Assistant loop and pending actions`, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/ai/assistant/assistant.integration.test.ts` → passes (at least 9 tests).

**Done when:** writes only happen on confirm by the owner of the action.

#### Task 5.3 - Assistant actions and reads

**Goal:** Expose the assistant to the browser.

**Files:** create `src/features/ai/actions/assistantActions.ts`; modify `src/features/ai/router.ts`

**Steps:**
1. The four server actions and `ai.conversations.list` / `ai.conversations.get` per 6.9 and 6.10.
2. Commit `5.3: Assistant actions and reads`, tick.

**Verify:** `pnpm typecheck` → exits 0.

**Done when:** actions and reads compile with the contracts' types.

#### Task 5.4 - Assistant drawer

**Goal:** The chat drawer in the top bar.

**Files:** create `src/features/ai/ui/AssistantLauncher.tsx`, `AssistantSheet.tsx`, `AssistantMessages.tsx`, `renderSimpleText.tsx`, `renderSimpleText.test.tsx`; modify `src/components/shell/TopBar.tsx`

**Steps:**
1. Build the UI exactly as 6.10 describes (each file under 200 lines; the Sheet is the shadcn primitive).
2. `TopBar`: render `<AssistantLauncher />` before `NotificationsBell`; widen the right cluster from `w-44` to `w-52` so it fits.
3. `renderSimpleText.test.tsx` (unit, jsdom docblock): `**bold**` renders a `strong`; `- a\n- b` renders two `li`; `<img src=x onerror=alert(1)>` renders as text, not an element.
4. Commit `5.4: Assistant drawer`, tick.

**Verify:** `pnpm exec vitest run --project unit src/features/ai/ui/renderSimpleText.test.tsx src/components/shell` → passes.

**Done when:** the drawer opens from the top bar (proved in Task 6.1).

#### Task 5.5 - Phase 5 QA gate

**Goal:** Prove the assistant before the end-of-part checks.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 6 base commit, commit `5.5: Phase 5 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → green under the 0.4 rule
- `pnpm exec vitest run --project integration src/features/ai/assistant/assistant.integration.test.ts` → passes

**QA focus:** Definition of done item 12; write tools never run inside `sendAssistantMessage`; the tool allow-list is enforced on every call; assistant output is rendered without HTML injection.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 6: Hardening and hand-off

At the end: browser proof and screenshots, the full integration suite, a container smoke test, one independent review, the final checklist and the final report.

#### Task 6.1 - E2E specs and screenshot gallery

**Goal:** Prove Part 1 in a real browser against the production build and save every screenshot in 6.12.

**Files:** modify `scripts/e2e/seed-session.ts`; create `e2e/01-auth.spec.ts`, `e2e/02-invite-profile.spec.ts`, `e2e/03-ai-deal.spec.ts`, `e2e/04-ai-compose-filter.spec.ts`, `e2e/05-assistant.spec.ts`

**Steps:**
1. `seed-session.ts`: also `setPassword` for demo1 with `E2E_ADMIN_PASSWORD` (import from `src/features/auth/credentials.ts`).
2. `01-auth` (no storage state): `/login` shows both tabs (`p1-login`); wrong password → `login-error`; right password for `demo1@example.com` → lands on a `/pipeline` URL; sign out through the user menu; "Email link" tab with demo1 → `login-sent` (`p1-login-sent`); `latestMail("demo1@example.com")` → open `linkFrom(mail)` → "Continue" visible (`p1-magic-confirm`) → click → `/pipeline`; opening the same link again → `magic-invalid`; an unknown email still shows `login-sent` and writes no mail for it.
3. `02-invite-profile` (admin state): `/settings/users` invite `e2e-{Date.now()}@example.com` named "E2E Invitee" → `invite-result` and `invite-link` (`p1-users-invite`); in a fresh context open the link → fill Name, New password, Confirm password (12+ characters) → "Set password and sign in" → `/pipeline` (`p1-invite-accept` taken before submitting); back as admin, `/settings/profile` → `password-card`: Current password = `E2E_ADMIN_PASSWORD`, set a new one, `password-saved` (`p1-profile-password`); restore the original password the same way so later specs can sign in.
4. `03-ai-deal` (admin state): `/deals/{dealId}` → "Generate summary" → `deal-ai-summary` contains "FAKE summary of this deal." and `deal-ai-health` has `data-health="at_risk"`; "Add" on the first next step → `data-added="true"`, and the activity "FAKE follow-up call" appears on the deal; "Score deal" → `deal-ai-score` `data-score="72"` (`p1-deal-ai-card`); add a note "Call went well, send pricing Friday" through the notes composer, open its menu → "Turn into activities" → one `ai-proposal` with "FAKE follow-up task" (`p1-notes-to-activities`) → "Create selected" → the activity appears.
5. `04-ai-compose-filter` (admin state): on the deal open the Email composer → "Write with AI" → instruction "Ask for a call next week" → "Draft" → subject "FAKE subject" and body containing "FAKE body: Ask for a call next week" (`p1-composer-ai`); close without sending. On the pipeline open the filter dialog → "Describe a filter" "big deals" → "Generate filter" → `ai-filter-explanation` contains "FAKE" and the first condition row shows the value field (`p1-filter-ai`). `/settings/ai` → `ai-usage-used` shows a non-zero used number and at least one `ai-usage-feature-row` (`p1-settings-ai`).
6. `05-assistant` (admin state): top bar `assistant-trigger` → "Assistant" sheet with three `assistant-suggestion` (`p1-assistant-empty`); send "hello" → an assistant message "FAKE AI: hello"; send `/fake-tool {"name":"add_note","arguments":{"entityType":"deal","entityId":"{dealId}","body":"Assistant note E2E"}}` → `assistant-action` with `data-status="pending"` (`p1-assistant-pending`); the deal page does not show the note yet; "Confirm" → `data-status="confirmed"` and a "Done:" message (`p1-assistant-confirmed`); the deal page now shows "Assistant note E2E"; a second pending action → "Reject" → `rejected`.
7. Run `pnpm e2e` (dev services up). Fix product or spec bugs until all six specs pass. Never weaken an assertion; a spec that contradicts section 6 is fixed to match section 6 with a Decision.
8. Commit `6.1: E2E specs and screenshot gallery`, tick.

**Verify:** `ls e2e/screenshots/*.png | wc -l` → at least 23.

**Done when:** `pnpm e2e` passes specs 00 to 05 and every screenshot in 6.12 exists.

#### Task 6.2 - Integration suite and container smoke

**Goal:** Run the full integration suite once and prove the new compose stack builds, boots and keeps data across a restart.

**Files:** create `scripts/dealflow/smoke.mjs`; modify `docs/dealflow/HEALTH-CHECK.md`

**Steps:**
1. `pnpm test:integration` (background, poll the log, up to 40 minutes). Failures other than `PRE-EXISTING:` entries are fixed (stuck rule) or logged in Open issues with the error.
2. `scripts/dealflow/smoke.mjs` (plain ESM): writes `.smoke/smoke.env` with random secrets (same generators as `env-sync.mjs`) and `BASE_URL=http://localhost:3310`, `APP_PORT=3310`, `WS_HOST_PORT=3311`, `MINIO_PORT=3312`, `NEXT_PUBLIC_WS_URL=ws://localhost:3311`, `WS_PUBLIC_URL=ws://ws:8080`, `MINIO_ENDPOINT=http://localhost:3312`, `DATABASE_URL=postgres://warpdrive:warpdrive@postgres:5432/warpdrive`, `SEED_ADMIN_EMAIL=smoke@example.com`, `ALLOW_FIRST_LOGIN_ADMIN=false`, `SMTP_HOST=`, `MAIL_FAKE=false`, `AI_FAKE=true`, `DEALFLOW_ENV_FILE=.smoke/smoke.env`, plus every other required key from `.env.example` with a safe value. Then, with `DEALFLOW_ENV_FILE=.smoke/smoke.env`: `docker compose -p dealflow-smoke --env-file .smoke/smoke.env up -d --build`; poll `http://localhost:3310/api/health` until 200 (up to 15 minutes, every 5 s); `POST /auth/magic-link` with `email=smoke@example.com` and header `Origin: http://localhost:3310` → expect a 303 to `/login?sent=1`; `docker compose -p dealflow-smoke restart app`; poll health again; `docker compose -p dealflow-smoke exec -T postgres psql -U warpdrive -tAc "select count(*) from users where email='smoke@example.com' and is_admin"` → `1`; finally (always, also on failure) `docker compose -p dealflow-smoke down` and `docker volume rm dealflow-smoke_pgdata dealflow-smoke_miniodata`. Print `SMOKE PASS` or `SMOKE FAIL: {step}` and exit accordingly.
3. Run `pnpm smoke`. Docker unavailable → SKIPPED with the section 4 Owner action.
4. Add both results to `HEALTH-CHECK.md` under `## Part 1 end`.
5. Commit `6.2: Integration suite and container smoke`, tick.

**Verify:** `pnpm smoke` → prints `SMOKE PASS`.

**Done when:** the suite result and the smoke result are recorded, and no `dealflow-smoke` container or volume is left (`docker ps -a --filter name=dealflow-smoke -q | wc -l` → `0`).

#### Task 6.3 - Independent review and hardening

**Goal:** One independent review of the whole part, then fix what it finds.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run `./qa.sh "Final review of PLAN-PART1.md. Base commit {Phase 0 base}."` (it starts a separate `dsh` process with the reviewer instructions in `.dsh/qa.md`). It returns `QA RESULT: PASS` or a numbered list. If `qa.sh` reports a changed working tree, restore those files with `git checkout -- {file}` and log it.
2. Fix every blocker and major item; commit `6.3: QA fixes round {r}`; re-run the phase gate commands; run `qa.sh` again. At most 3 rounds. Minor items: fix if cheap, else Open issues.
3. Work through Open issues (prefix fixed ones `RESOLVED:`).
4. Log `- Independent review: qa.sh round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n}` in the QA log. If `qa.sh` itself fails twice, do the review yourself following Appendix B and log `- Independent review: qa unavailable (qa.sh failed) - self-review` followed by every check with its evidence.
5. Commit `6.3: Independent review and hardening`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`.

**Done when:** the review ran (or the logged fallback), blockers and majors are fixed or logged with reasons.

#### Task 6.4 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order; write one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `6.4: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least 18.

**Done when:** every checklist item has a line.

#### Task 6.5 - Final report and completion

**Goal:** Hand the owner a truthful report and finish the run.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report: **Definition of done** (items 1 to 14, each PASS, FAIL or NOT VERIFIED with evidence); **Checklist** (from 6.4); **Owner actions** (de-duplicated, numbered, exact commands, including the real-service smoke test: add `OPENROUTER_API_KEY`, set `AI_FAKE=false`, generate a summary on a deal, draft an email, ask the assistant "What are my overdue activities?"; and set `SMTP_*` to Purelymail and request a magic link); **Decisions worth reviewing** (every `CONTRACT CHANGE:` and every changed test); **Open issues**; **Notes for Part 2** (probe results, health-check facts, every upstream file changed, every screen with its route and screenshot name).
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES` when any Definition-of-done item is FAIL), commit `6.5: Final report and completion`, tick, and end the session with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`.

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- The `MailProvider` layer, IMAP sync, column renames and notification emails through the system mailer (Part 2). Part 1 touches mail only through the probe script and the system mailer.
- Products, currencies, forecast, quotes, invoices, automations, webhooks, forms, scheduler, Insights, projects, recycle bin UI, backups, REST API, PWA and the design pass (Parts 3 to 10).
- AI on people, organizations and leads beyond the server-side filter support; deal score badges on board cards; bulk scoring (Parts 7 and 8).
- Streaming assistant replies, conversation deletion, assistant memory across conversations.
- Password reset by email (the magic link covers a forgotten password), resend-invite buttons, SSO other than Google, 2FA.
- Renaming internal identifiers (cookies, storage keys, Postgres defaults, bucket default) or the `site/` and `docs-site/` sub-apps.
- Upgrading any existing dependency, refactoring upstream code that works, restyling screens beyond the new components.
- Pushing, tagging, publishing or deploying anything.

## 10. ASK and STOP triggers

This plan has no ASK triggers; the only STOP cases are the fatal ones in section 4.

| Situation | Safe default | Owner action to log |
|---|---|---|
| No `OPENROUTER_API_KEY` | verify with `AI_FAKE=true` and the scripted provider | "Add OPENROUTER_API_KEY to the server .env, set AI_FAKE=false, run `pnpm ai:check-model --chat`, then try a deal summary, an email draft and the assistant" |
| No probe credentials | write the `skipped` probe result | "Add MAIL_PROBE_USER and MAIL_PROBE_PASS to .env, run `pnpm mail:probe`, commit the result" |
| No SMTP for magic links | log mode locally, capture mode in e2e | "Set SMTP_HOST=smtp.purelymail.com, SMTP_PORT=465, SMTP_SECURE=true, SMTP_USER, SMTP_PASS, SMTP_FROM in the server .env" |
| Docker not running | skip compose, integration, e2e and smoke steps, mark them SKIPPED | "Start Docker Desktop and run `pnpm dev:up`, `pnpm test:integration`, `pnpm e2e`, `pnpm smoke`" |
| `git fetch upstream` fails | snapshot commit without upstream history | "Run `git remote add upstream https://github.com/sneg55/warpdrive.git` (if missing) and `git fetch upstream`" |
| Chromium install fails | skip e2e, mark SKIPPED | "Run `pnpm exec playwright install chromium`, then `pnpm e2e`" |
| A pre-existing upstream test fails | leave the test untouched, log `PRE-EXISTING:` | "Review the pre-existing failures listed in docs/dealflow/HEALTH-CHECK.md" |
| `qa.sh` fails | evidenced self-review (Task 6.3) | "Run `./qa.sh \"Reply exactly: QA READY\"` and check the dsh setup" |
| The guard blocks a command the plan needs | do not work around it; log an Open issue with the command | "Review the blocked command in PROGRESS.md and run it yourself if it is safe" |
| Production deploy | none in this part | "Copy .env.example to the server .env, fill it, `docker compose up -d --build` behind your Caddy using docs/reverse-proxy.md, then `pnpm auth:bootstrap-link` inside the app container or request a magic link for SEED_ADMIN_EMAIL" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty after the last commit (generated folders are ignored).
2. `pnpm install --frozen-lockfile` exits 0.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` green (only `PRE-EXISTING:` failures allowed); record the count.
6. `pnpm test:integration` result from Task 6.2 recorded with counts.
7. `pnpm build` exits 0.
8. `pnpm e2e` passes `00` to `05`.
9. `ls e2e/screenshots/*.png | wc -l` is at least 23 and every name in 6.12 exists.
10. `pnpm smoke` printed `SMOKE PASS` in Task 6.2 and no `dealflow-smoke` container or volume remains.
11. `grep -rniI "warpdrive" src --include='*.tsx' | grep -v '\.test\.'` lists only allowed identifiers and comments; `brand.test.ts` passes.
12. `docker compose config --services` does not list `caddy`; `docs/reverse-proxy.md` and `docs/reverse-proxy/Caddyfile.example` exist.
13. `grep -E "^(DISABLE_TELEMETRY|DISABLE_UPDATE_CHECK)=true$" .env.example | wc -l` is `2`.
14. Every env var added in 6.2 appears in `.env.example`.
15. Security spot checks against the e2e server (start it with `node scripts/e2e/e2e-server.mjs` in the background after `pnpm e2e:build`, stop it afterwards): `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3210/auth/dev-login?email=demo1@example.com"` → `404`; `curl -s -o /dev/null -w "%{http_code}" -X POST -H "Origin: https://evil.example" -d "email=a@b.c&password=x" http://localhost:3210/auth/password` → `403`; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3210/auth/start` → `404`.
16. `psql` (or a tsx one-liner) on `dealflow_e2e`: `select count(*) from auth_tokens where token_hash like 'ey%' or length(token_hash) <> 43` → `0` (only sha256 base64url digests are stored).
17. `grep -rn "process.env" src --include='*.ts' --include='*.tsx' | grep -v "src/config/env.ts\|src/config/clientEnv.ts\|src/instrumentation.ts\|\.test\."` → no lines.
18. `grep -rn $'\u2014' $(git --no-optional-locks diff --name-only {Phase 0 base} HEAD -- src scripts docs e2e CLAUDE.md README.md)` → no lines (no em dashes in files this part wrote).
19. `pnpm check:progress --final` passes.
20. `docs/dealflow/HEALTH-CHECK.md`, `docs/dealflow/UPSTREAM.md` and `docs/dealflow/mail-probe-result.json` exist and are committed.

## 12. Report back

No mid-run reporting. PROGRESS.md is updated after every task and gate; the run ends with the final report (Task 6.5). The owner pastes PROGRESS.md back to the planner, together with `docs/dealflow/mail-probe-result.json` if the probe ran after the build.

## Appendix A - DeepSeek Harness overlays

Create these files exactly if either is missing. `loop.sh` passes the first with `--patch`; `qa.sh` passes both. A patch row replaces that row's whole `config`.

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

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md for this part). You did not write this code. Assume the builder cut corners and verify everything yourself.

If the request is exactly "Reply exactly: QA READY", reply with the two words QA READY and do nothing else.

Hard rules for you:
- You are read-only. Never create, edit, move or delete files, never commit, reset, checkout, stash or push. Commands that only read or that write build output inside this folder (typecheck, lint, build, unit tests) are fine.
- Never call ask_user_question; nobody will answer.
- Never print the contents of .env.
- Stop any server you start.

Input: "Final review of PLAN-PART1.md. Base commit {hash}." (or "Phase N gate review of ..." for a single phase).

Procedure:
1. Read PLAN-PART1.md sections 2, 3, 6 and 7 and every task (for a phase review: that phase's tasks).
2. Run `git --no-optional-locks diff --stat {hash}..HEAD` and read the changed files that matter.
3. Run `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` and note the exact results. Read PROGRESS.md for the e2e, integration and smoke results; open e2e/screenshots and check the files listed in section 6.12 exist.
4. For every task: each listed file exists; each step is really implemented, not stubbed or left as a placeholder; section 6 contracts match exactly (paths, routes, status codes, redirects, error IDs, env vars, schema, prompts, test hooks); section 7 conventions hold; the task's "Done when" holds.
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; no em dashes in new files.
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
# Usage: ./qa.sh "Final review of PLAN-PART1.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
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

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART1.md";
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
// commands PLAN-PART1.md forbids. Exit 2 with a reason on stderr blocks; exit 0 allows.
import { readFileSync } from "node:fs";

let cmd = "";
try {
  cmd = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}
const block = (why) => {
  process.stderr.write(`blocked by Dealflow guard: ${why}. This is a hard limit in PLAN-PART1.md; log it and continue.\n`);
  process.exit(2);
};
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART1\.md|ROADMAP\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
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
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART1.md (dealflow-wd-p1-v1) is finished.
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
PROMPT='Read PLAN-PART1.md in this folder in full and PROGRESS.md, then follow PLAN-PART1.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p1-v1) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p1-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p1-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
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
- Otherwise you are the builder: read `PLAN-PART1.md` in full and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART1.md rule 18.
```
