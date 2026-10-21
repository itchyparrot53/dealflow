# PLAN: Dealflow on warpdrive, Part 5: Automations and webhooks

> Plan ID: dealflow-wd-p5-v1 · Written: 2026-10-21 · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 5, fast verification profile, no human in the loop · Type: change to existing project

Parts 1 to 4 are finished (`PROGRESS-P1.md` to `PROGRESS-P3.md`, and `PROGRESS.md` until Task 0.1 renames it to `PROGRESS-P4.md`). Part 4 left 5,063 unit tests, 1,902 integration tests and e2e specs `00` to `08`, all passing, plus quotes and invoices (`src/features/documents/`). Part 5 adds the event backbone, automations and webhooks, and first fixes one Part 4 follow-up (client IP for rate limits). This plan is compact: where it says "find" or "reuse", locate the existing code, reuse it, and log the file you used as a Decision.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 5** in fresh-context sessions, one phase per session. Parts 1 to 4 (`PLAN-PART1.md` to `PLAN-PART4.md`) are finished; their code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART5.md` in full and PROGRESS.md (open earlier `PLAN-PART{N}.md` files only where this plan points to them). If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p5-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 4's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 5.5, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 5.2.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.5, 1.4, 2.4, 3.3, 4.6):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). The one independent review is Task 5.3.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (domain events from `recordChange`, Part 4's client IP logic), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs only. This part needs no external service; e2e uses the fake mail transport, and webhook tests deliver only to local servers on 127.0.0.1.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove or recreate the owner's running Compose project `warpdrive-main`, never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack 3001/5433/8080/9000/9001 (owner's). Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `PLAN-PART3.md`, `PLAN-PART4.md`, `PLAN-PART5.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 4's file to `PROGRESS-P4.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p5-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 5: progress files, kit and baseline
(every task through 5.5, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 4990/4990 · events 20/20

## Decisions
- 0.3: chose … over … because …

## Owner actions
- TODO(owner): …

## Open issues
- None

## Environment
(copy the section 4 "Known environment" commands that this machine needs, and keep them current)

## Final report
(written in Task 5.5)
```

## 1. Goal

Add workflow automation and outgoing webhooks on one event backbone. Changes write domain events into an outbox table inside the same transaction. A worker dispatcher fans each event out to automations (trigger, condition, actions including AI actions, run log, loop guard) and to signed webhook subscriptions (SSRF-safe delivery, retries, auto-disable). Admins can also draft an automation from a plain-English description and start from a small template gallery.

## 2. Definition of done

1. The client IP used for public rate limits comes from a trusted-proxy rule, not the spoofable first `X-Forwarded-For` entry (Part 4 follow-up).
2. Migration `0083_dealflow_automations` adds the five tables of 6.4 and nothing else.
3. Every change recorded through `recordChange`, every create of a deal, person, organization or activity, and every document status change writes one `domain_events` row in the same transaction; a rolled-back write leaves no event.
4. The dispatcher processes events once (row locks with `SKIP LOCKED`), coalesces one transaction's changes to one entity into one `deal.updated` event, and fans out to automations and webhooks.
5. Automations match triggers and filters, evaluate conditions with the saved-filter engine on the record's current state, and run their actions in order through the existing services, so changes, change logs, realtime and permissions behave as for a user edit.
6. The loop guard skips an automation that already ran for the same record in the same event chain, and nothing runs past depth 3; every run (succeeded, failed or skipped) is in the run log with per-action results.
7. AI actions (summarize to note, score, draft email) use the Part 1 AI layer with caps and the fake mode; "Describe it" turns a sentence into a validated draft definition that an admin reviews before saving.
8. Webhooks sign each delivery (`X-Dealflow-Signature`, HMAC-SHA256), refuse private, loopback and link-local targets at connect time (DNS-pinned, no redirects) unless `WEBHOOK_ALLOW_PRIVATE=true`, retry with backoff, auto-disable after 10 consecutive failed attempts, and keep a delivery log with redeliver and test send.
9. Settings → Automations (list, editor, templates, run log) and Settings → Webhooks (subscriptions, delivery log) work for admins only.
10. typecheck, lint, build, unit and the full integration suite pass; e2e specs `00` to `09` pass; the 6 `p5-*` screenshots exist; smoke passes; one independent review ran.

## 3. Decisions already made

- Stack unchanged; no new dependency. Webhook delivery uses `node:http`/`node:https` with a custom `lookup` (Node's `fetch` cannot pin the resolved address). IP range checks are our own pure code (6.6).
- Events come from one place where possible: `recordChange` (`src/features/collaboration/changeLog.ts`) also writes the domain event, because every audited change already goes through it inside the mutation's transaction. Creates and document status changes, which do not all call `recordChange`, call `emitDomainEvent` explicitly.
- The event chain (chain id, depth, causing automation) travels in an `AsyncLocalStorage` context that the automation runner sets, so the services an action calls need no new parameters.
- Conditions are saved-filter `FilterDefinition`s compiled with `filterToSql` and checked with `SELECT EXISTS (... WHERE id = $1 AND {condition})` on the current row.
- Actions run as the automation's creator, who must still be an active admin (else the run is skipped `owner_inactive`). Admin rights make visibility checks pass; the services still validate everything else.
- Payload snapshots are built at dispatch time (the record's state when the worker runs), documented as such. No ordering guarantee between deliveries.
- No delays or scheduled ("N days before close") triggers in this part.
- Managing automations and webhooks needs a new `automations.manage` capability (admin only, declared like `documents.manage`).

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | PROGRESS.md says `dealflow-wd-p4-v1` and `STATUS: COMPLETE` | log a Decision describing what you found; continue |
| Kit location | `PLAN-PART5.md` and the kit at the repo root, or in `PLAN AND EXECUTE/dealflow-wd-part5-kit/` | root symlink plus the byte-identical checker copy, as before; log a Decision |
| Next migration | the last file in `drizzle/` is `0082_dealflow_document_notifications.sql` | next free number; log it |
| `recordChange` callers | `grep -rl "recordChange(" src/features` lists the deal, person, organization and activity edit paths (18 files today) | add `emitDomainEvent` next to any audited change path that bypasses it (for example `src/features/enrichment/prospectApplyItem.ts`'s `writeChangeLogs`); log each |
| Creates | check whether deal, person, organization and activity creates call `recordChange` | if not, add `emitDomainEvent` in each create service (upstream edits, list them in UPSTREAM.md) |
| Filter targets | `src/features/saved-filters/filterAst.ts` compiles definitions for deals, persons and organizations | conditions are offered only for the entity types it supports; log which |
| Encryption helper | Part 2 encrypts mail passwords with an existing helper | reuse it for webhook secrets |
| pnpm 9, Docker, subagent | as in Part 4 | as in Part 4 |

**Known environment:** copy `PROGRESS-P4.md` → Environment (after Task 0.1 renames it) into PROGRESS.md → Environment and follow it.

**Fatal (STOP with `STATUS: BLOCKED`):** pnpm cannot be installed, or `pnpm install --frozen-lockfile` fails for a registry reason.

## 5. Target structure

```
src/features/net/clientIp.ts, clientIp.test.ts                # 6.2
src/db/schema/automations.ts                                   # 6.4
drizzle/0083_dealflow_automations.sql
src/features/events/
  types.ts                                                     # DomainEventType, payload types
  emit.ts, chainContext.ts                                     # 6.5
  dispatcher.ts, dispatcherJob.ts, rottingJob.ts, retentionJob.ts, snapshot.ts
  events.integration.test.ts
src/features/automations/
  definition.ts, definition.test.ts                            # 6.7 Zod schema + trigger matching (pure)
  conditions.ts, runner.ts, actions/{updateDeal,createActivity,addNote,notifyUser,sendEmail,aiActions}.ts
  templates.ts, describe.ts, service.ts, actions.ts, router.ts
  automations.integration.test.ts
  ui/{AutomationsList,AutomationEditor,TriggerPicker,ConditionEditor,ActionList,DescribeDialog,TemplateGallery,RunLog}.tsx
src/features/webhooks/
  ipRanges.ts, ipRanges.test.ts, signature.ts, signature.test.ts   # 6.6 (pure)
  deliver.ts, deliveryJob.ts, service.ts, actions.ts, router.ts
  webhooks.integration.test.ts
  ui/{WebhooksSettings,WebhookDialog,DeliveryLog}.tsx
src/app/(app)/settings/automations/page.tsx, .../automations/[id]/page.tsx, .../settings/webhooks/page.tsx
e2e/09-automations.spec.ts
docs/dealflow/AUTOMATIONS.md, docs/dealflow/WEBHOOKS.md
```

## 6. Contracts

### 6.1 Env (`src/config/env.ts`, appended; `.env.example` gets a `# Automations and webhooks` section)

| Key | Type | Default |
|---|---|---|
| `TRUSTED_PROXY_HOPS` | integer 0..5 | `1` |
| `WEBHOOK_ALLOW_PRIVATE` | boolean | `false` (the e2e env sets `true`) |

Constants in `src/constants/automations.ts`: `AUTOMATION_MAX_DEPTH = 3`, `AUTOMATION_MAX_ACTIONS = 10`, `WEBHOOK_TIMEOUT_MS = 10_000`, `WEBHOOK_RETRY_SECONDS = [60, 300, 1800, 7200, 21600]`, `WEBHOOK_DISABLE_AFTER = 10`, `WEBHOOK_MAX_RESPONSE_BYTES = 65_536`, `EVENT_RETENTION_DAYS = 30`, `RUN_RETENTION_DAYS = 90`, `DISPATCH_BATCH = 100`, `DISPATCH_POLL_SECONDS = 5`, `EMAIL_ACTION_COOLDOWN_HOURS = 24`.

### 6.2 Client IP (Part 4 follow-up)

`clientIp(headers: Headers, hops = env.TRUSTED_PROXY_HOPS): string`: split `x-forwarded-for` on commas and trim. With `hops = 0`, ignore the header and use `x-real-ip`, else `"unknown"`. With `hops = n`, take the entry `n` places from the right (the address the outermost trusted proxy saw), falling back to the leftmost when the list is shorter. Replace Part 4's first-entry logic in the documents public routes and page with it. Unit tests cover the spoofed-left-entry case (`"6.6.6.6, 203.0.113.9"` with hops 1 → `203.0.113.9`).

### 6.3 Error IDs (append; add `AUTOMATION` and `WEBHOOK` domains if the registry keeps a list)

| ID | Cause |
|---|---|
| `E_AUTOMATION_001` | automation not found |
| `E_AUTOMATION_002` | definition failed validation (context carries the Zod issues) |
| `E_AUTOMATION_003` | action failed (context: action index, type, cause id) |
| `E_AUTOMATION_004` | AI draft could not be turned into a valid definition |
| `E_AUTOMATION_005` | email action skipped by the 24 h cooldown or a missing recipient |
| `E_AUTOMATION_INPUT_INVALID` | action input failed Zod |
| `E_WEBHOOK_001` | subscription not found |
| `E_WEBHOOK_002` | URL refused (scheme, credentials, or private target) |
| `E_WEBHOOK_003` | delivery failed (context: status code or network cause) |
| `E_WEBHOOK_004` | subscription disabled |
| `E_WEBHOOK_INPUT_INVALID` | action input failed Zod |

User copy lives in `src/constants/automationsStrings.ts`; for `E_WEBHOOK_002`: "That URL can't receive webhooks. Use a public https address."

### 6.4 Schema (`src/db/schema/automations.ts`)

Id and FK types match the referenced tables; timestamps `timestamptz`.

```ts
domain_events: id bigserial primary key, type text not null, entity_type text not null, entity_id uuid not null,
  actor_id -> users.id on delete set null, changes jsonb null  // [{ field, old, new }]
  txid bigint not null default txid_current(), chain_id uuid not null, depth integer not null default 0,
  automation_id uuid null (no FK: runs may be deleted), created_at not null default now(), processed_at timestamptz null
  indexes: domain_events_pending_idx on (id) where processed_at is null; (created_at)
automations: id, name text not null (1..120), description text null, enabled boolean not null default false,
  definition jsonb not null, created_by -> users.id on delete set null, last_run_at timestamptz null,
  run_count integer not null default 0, created_at, updated_at
automation_runs: id, automation_id -> automations.id on delete cascade, event_id bigint null (no FK: events expire),
  entity_type text not null, entity_id uuid not null, chain_id uuid not null, depth integer not null,
  status text not null check in ('running','succeeded','failed','skipped'),
  skip_reason text null check in ('condition_false','depth_limit','owner_inactive','disabled'),
  steps jsonb not null default '[]',   // [{ index, type, ok, errorId?, detail? }]
  error_id text null, started_at timestamptz not null default now(), finished_at timestamptz null
  unique automation_runs_guard_uq on (automation_id, chain_id, entity_id)   // the loop guard
  index (automation_id, started_at desc)
webhook_subscriptions: id, name text not null, url text not null, events text[] not null,
  secret_enc bytea not null, enabled boolean not null default true, consecutive_failures integer not null default 0,
  disabled_reason text null, created_by -> users.id on delete set null, last_delivery_at timestamptz null, created_at, updated_at
webhook_deliveries: id, subscription_id -> webhook_subscriptions.id on delete cascade, event_id bigint null,
  event_type text not null, payload jsonb not null,
  status text not null check in ('pending','succeeded','retrying','failed'), attempts integer not null default 0,
  next_attempt_at timestamptz null, last_status_code integer null, last_error text null (check length <= 500),
  duration_ms integer null, created_at, updated_at
  index (subscription_id, created_at desc), index (status, next_attempt_at)
```

### 6.5 Events (`src/features/events/`)

```ts
export const DOMAIN_EVENT_TYPES = [
  "deal.created", "deal.updated", "deal.stage_changed", "deal.won", "deal.lost", "deal.deleted", "deal.rotting",
  "person.created", "person.updated", "organization.created", "organization.updated",
  "activity.created", "activity.completed",
  "document.sent", "document.viewed", "document.accepted", "document.declined",
  "invoice.overdue", "invoice.paid", "invoice.voided",
] as const;
export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

// chainContext.ts
export type ChainContext = { chainId: string; depth: number; automationId: string | null };
export function currentChain(): ChainContext | undefined;              // AsyncLocalStorage getStore()
export function runInChain<T>(ctx: ChainContext, fn: () => Promise<T>): Promise<T>;

// emit.ts
export async function emitDomainEvent(db: DbOrTx, ev: {
  type: DomainEventType; entityType: string; entityId: string; actorId: string | null;
  changes?: { field: string; old: unknown; new: unknown }[];
}, signal: AbortSignal): Promise<void>;
// chain_id/depth/automation_id from currentChain(), else a new random chain at depth 0. Ends with
// `NOTIFY dealflow_domain_events` (delivered on commit) so the dispatcher wakes early.
export function eventTypesForChange(entityType: string, field: string, oldValue: unknown, newValue: unknown): DomainEventType[];
// deal: stage field → ["deal.stage_changed", "deal.updated"]; status field to won → ["deal.won", "deal.updated"],
// to lost → ["deal.lost", "deal.updated"]; deleted_at set → ["deal.deleted"]; any other field → ["deal.updated"].
// person/organization: any field → "{type}.updated". activity: done/completed field to true → ["activity.completed"]. Others → [].
// Use the field names recordChange actually receives (check the callers) and log them.
```

`recordChange` calls `emitDomainEvent` for each type `eventTypesForChange` returns, in the same `db`/transaction. The dispatcher coalesces, so one event row per change is fine.

**Dispatcher** (`dispatcher.ts`, run by `dispatcherJob.ts` in the worker every `DISPATCH_POLL_SECONDS` and on `LISTEN dealflow_domain_events`, with one in-flight pass at a time):
1. In one transaction: `SELECT ... FROM domain_events WHERE processed_at IS NULL ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED`.
2. Group: rows with the same `txid`, `entity_type`, `entity_id` and `type = '{entity}.updated'` merge into one event (changes concatenated, the lowest id kept as `eventId`); other types stay separate.
3. For each event: for every enabled automation whose trigger matches (6.7 `matchesTrigger`), insert an `automation_runs` row with `ON CONFLICT (automation_id, chain_id, entity_id) DO NOTHING`; a conflict is the loop guard (no row, count it in the job log); depth above `AUTOMATION_MAX_DEPTH` inserts a `skipped`/`depth_limit` row instead; enqueue `automations.run` with the run id after commit. For every enabled webhook subscription whose `events` include the type, insert a `webhook_deliveries` row (`pending`, payload from `snapshot.ts`) and enqueue `webhooks.deliver` after commit.
4. Set `processed_at = now()` on all selected rows; commit.

`snapshot.ts`: `buildEventPayload(db, event, signal)` → `{ id: string /* "evt_" + eventId */, type, occurredAt, actorId, changes, data }`, where `data` is the entity snapshot: deal `{ id, title, value, currency, status, stage {id,name}, pipeline {id,name}, owner {id,name,email}, person {id,name,email} | null, organization {id,name} | null, expectedCloseDate, createdAt, updatedAt }`; person and organization: id, names, primary email/phone, owner; activity: id, type, subject, dueAt, done, dealId, personId; document: `{ id, kind, number, status, total, currency, dealId, publicUrl }`. A deleted record gives `data: { id }`. Never include tokens, secrets, password hashes or internal notes' private fields.

`rottingJob.ts`: daily at `0 5 * * *` UTC, emits one `deal.rotting` event per open deal whose time in its current stage exceeds the stage's `rotting_days` (warpdrive's existing rotting rule; reuse its calculation) and that has no `deal.rotting` event created after its `stage_entered_at` (so each stage entry fires once; after event retention a still-rotting deal may fire again, documented).

`retentionJob.ts`: daily at `30 4 * * *` UTC: delete processed events older than `EVENT_RETENTION_DAYS`, runs older than `RUN_RETENTION_DAYS`, finished deliveries older than `RUN_RETENTION_DAYS`.

### 6.6 Webhook security (pure)

`ipRanges.ts`: `isBlockedAddress(ip: string): boolean`, true for:
- IPv4: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`.
- IPv6: `::/128`, `::1/128`, `fc00::/7`, `fe80::/10`, `ff00::/8`, `2001:db8::/32`, plus `::ffff:0:0/96` and `64:ff9b::/96`, which are judged by the embedded IPv4 address.
- Anything that does not parse.

Parse with `node:net` `isIP` and your own expansion (handle `::` compression and dotted-quad tails).

`checkWebhookUrl(raw: string, allowPrivate: boolean): Result<URL>`: must parse; scheme `https:` (also `http:` only when `allowPrivate`); no username or password; a literal IP host must not be blocked (unless `allowPrivate`); otherwise `E_WEBHOOK_002`.

`signature.ts`:
```ts
export function signPayload(secret: string, timestamp: number, body: string): string; // hex HMAC-SHA256 of `${timestamp}.${body}`
export function signatureHeader(secret: string, timestamp: number, body: string): string; // `t=${timestamp},v1=${hex}`
export function verifySignature(secret: string, header: string, body: string, nowSeconds: number, toleranceSeconds = 300): boolean; // timingSafeEqual; for receivers and tests
export function newWebhookSecret(): string; // "whsec_" + randomBytes(24).toString("base64url")
```

### 6.7 Automation definition (`definition.ts`, Zod, pure)

```ts
type Trigger =
  | { type: "deal.created" | "deal.won" | "deal.lost" | "deal.deleted" | "deal.rotting"; pipelineId?: string }
  | { type: "deal.updated"; pipelineId?: string; fields?: string[] }      // fire only when one of these fields changed
  | { type: "deal.stage_changed"; pipelineId?: string; stageId?: string }  // stageId = the stage entered
  | { type: "person.created" | "organization.created" | "activity.created" | "activity.completed" }
  | { type: "document.sent" | "document.viewed" | "document.accepted" | "document.declined" | "invoice.overdue" | "invoice.paid"; kind?: "quote" | "invoice" };

type Action =
  | { type: "update_deal"; set: { stageId?: string; ownerId?: string; status?: "won" | "lost"; lostReasonId?: string; expectedCloseInDays?: number /* 0..3650 */ } }
  | { type: "create_activity"; activityTypeId: string; subject: string /* 1..200, variables */; dueInDays: number /* 0..365 */; assignee: "deal_owner" | "automation_owner" | { userId: string } }
  | { type: "add_note"; body: string /* 1..5000, variables */ }
  | { type: "notify_user"; to: "deal_owner" | { userId: string }; message: string /* 1..500, variables */ }
  | { type: "send_email"; templateId: string /* existing email template */; to: "deal_person" }
  | { type: "ai_summarize_deal" }                    // writes the summary as a note
  | { type: "ai_score_deal" }                        // stores the score the Part 1 feature stores
  | { type: "ai_draft_email"; instructions: string /* 1..1000 */ };  // saves a draft for the deal owner, never sends

export type AutomationDefinition = { trigger: Trigger; condition: FilterDefinition | null; actions: Action[] /* 1..10 */ };
export const automationDefinitionSchema: z.ZodType<AutomationDefinition>;
export function matchesTrigger(t: Trigger, ev: { type: DomainEventType; changes: {field:string}[]; pipelineId: string | null; stageId: string | null; documentKind: "quote" | "invoice" | null }): boolean;
export function conditionTarget(ev: { type: DomainEventType }): "deal" | "person" | "organization";
// deal.*, activity.*, document.* and invoice.* events take their conditions on the related deal (no deal → the run is skipped condition_false); person.created → person; organization.created → organization.
```

Variables in `subject`, `body` and `message` render with Part 4's `renderVariables` over the deal context (`deal.title`, `deal.value`, `person.name`, `person.first_name`, `organization.name`, `owner.name`, `owner.email`).

### 6.8 Runner (`runner.ts`, job `automations.run`)

1. Load the run and its automation. If the automation is disabled now → `skipped`/`disabled`. If the creator is not an active admin → `skipped`/`owner_inactive`.
2. Resolve the condition target. With a condition, evaluate `SELECT EXISTS (SELECT 1 FROM {table} {alias} WHERE {alias}.id = $1 AND {filterToSql(condition)})`, using the same aliases and options the saved-filter list queries use. False → `skipped`/`condition_false`.
3. `runInChain({ chainId: run.chain_id, depth: run.depth + 1, automationId }, ...)`: run the actions in order. Each action calls the existing service with the creator's context, so the changes it makes emit events in the same chain. Record a step per action. The first failure stops the run (`failed`, `error_id` of that step).
4. Set `finished_at`, `status`, and bump `automations.run_count` and `last_run_at`.

Action rules:
- `update_deal` goes through the services the deal page uses (stage move, owner change, won/lost with a lost reason, close date).
- `create_activity` and `add_note` use the activities and notes services, linked to the deal.
- `notify_user` uses `createNotification`. Add a kind `automation` with an `ALTER TYPE` migration in the same task, as Part 4 did.
- `send_email` sends the template through the creator's connected mailbox to the deal's person's primary email, using Part 4's `send.ts` pattern. It is skipped with `E_AUTOMATION_005` when there is no email, no mailbox, or this automation already emailed this person within `EMAIL_ACTION_COOLDOWN_HOURS` (check earlier runs' steps).
- AI actions call the Part 1 functions (deal summary, score, email draft) with the creator as the actor, so caps, rate limits and `AI_FAKE` apply.

### 6.9 Describe it and templates

- `describe.ts`: `draftAutomation({ text }, actor)` calls the AI layer's JSON helper (`chatJson`) with a system prompt. The prompt lists the trigger and action types of 6.7, the actor's pipelines and stages (ids and names), activity types, email templates and users (ids and names), and asks for an `AutomationDefinition` JSON.
  - The result is parsed with `automationDefinitionSchema`. If that fails, one repair round sends back the Zod issues; if it fails again → `E_AUTOMATION_004`.
  - The draft is returned, never saved. The editor opens it for review.
  - Add a deterministic fake response for this feature in the AI fake (a "deal won → create follow-up activity in 1 day" definition built from the first activity type).
- `templates.ts`: 6 built-in templates. Each is `{ key, name, description, build(ctx) }` and builds a definition from the install's first pipeline, stages and activity types:
  1. "Onboarding call when a deal is won": `deal.won` → `create_activity` "Onboarding call with {{person.name}}", due in 2 days.
  2. "Tell the owner when a quote is accepted": `document.accepted` → `notify_user` deal owner.
  3. "Chase overdue invoices": `invoice.overdue` → `create_activity` "Chase invoice for {{organization.name}}", due 0.
  4. "Move to the next stage when a quote is sent": `document.sent` (kind quote) → `update_deal` stage = the stage after the first one.
  5. "Summarize big deals when they reach the last stage": `deal.stage_changed` to the last stage, condition value > 10000 → `ai_summarize_deal`.
  6. "Welcome note for new organizations": `organization.created` → `notify_user` automation owner.

  Templates open in the editor as new, disabled automations.

### 6.10 Webhook delivery (`deliver.ts`, job `webhooks.deliver`)

1. Load the delivery and subscription. If the subscription is disabled, mark the delivery `failed` with `E_WEBHOOK_004`.
2. Body = `JSON.stringify(payload)`. Headers: `content-type: application/json`, `user-agent: Dealflow-Webhooks/1`, `x-dealflow-event: {type}`, `x-dealflow-delivery: {delivery id}`, `x-dealflow-signature: {signatureHeader(secret, now, body)}`.
3. Request with `http(s).request` and `lookup: pinnedLookup(allowPrivate)`. `pinnedLookup` resolves with `dns.lookup(host, { all: true })`; if any address is blocked (and `allowPrivate` is false) it fails with `E_WEBHOOK_002`; otherwise it returns the first address. Rules:
   - `checkWebhookUrl` runs first.
   - Redirects are never followed (3xx = failure).
   - Timeout `WEBHOOK_TIMEOUT_MS` via `AbortSignal.timeout`.
   - Read at most `WEBHOOK_MAX_RESPONSE_BYTES` of the response, then destroy the socket.
4. On 2xx: `succeeded`; reset `consecutive_failures` to 0; set `last_delivery_at`.
5. On 410: `failed`; disable the subscription now (`disabled_reason` "Receiver returned 410 Gone").
6. Any other failure:
   - increment `attempts` and `consecutive_failures`; store `last_status_code`/`last_error` (truncated to 500 characters) and `duration_ms`;
   - if `attempts <= 5`: `retrying`, with `next_attempt_at` = now + `WEBHOOK_RETRY_SECONDS[attempts - 1]`, re-enqueued with `startAfter`;
   - otherwise `failed`.
7. When `consecutive_failures` reaches `WEBHOOK_DISABLE_AFTER`: disable the subscription (`disabled_reason` "Disabled after 10 failed deliveries") and send the creator one system email via `getSystemMailer()`.

Service (`service.ts`):
- `createSubscription` validates the URL and returns the plain secret once. It is stored with the existing encryption helper.
- `updateSubscription`, `rotateSecret` (returns the new secret once), `setEnabled` (enabling resets `consecutive_failures` and `disabled_reason`), `deleteSubscription`.
- `sendTest(id)` delivers a synthetic `ping` event (`{ id: "evt_test", type: "ping", data: {} }`) synchronously and returns status and duration.
- `redeliver(deliveryId)` creates a new delivery with the same payload.

### 6.11 UI

- **Rules for all screens:**
  - shadcn wrappers only; admins only (`automations.manage`), with nav links hidden for others.
  - Settings navigation gains "Automations" and "Webhooks" after "Documents".
- **`/settings/automations`:** a table showing name, trigger summary ("When a deal is won"), enabled `Switch`, runs, last run, and a row menu (Edit, Duplicate, Delete). Buttons: "New automation", "Start from a template" (`TemplateGallery` `Dialog`, 6 cards) and "Describe it" (`DescribeDialog`: a `Textarea`, then "Draft it", then a loading state, then it opens the editor with the draft and a note "Review before saving"; error copy for `E_AUTOMATION_004` and AI cap errors).
- **`/settings/automations/{id}` editor:**
  - name, description, enabled;
  - **When:** `TriggerPicker`, with a type `Select` plus the trigger's filters (pipeline, stage, fields, document kind);
  - **Only if:** `ConditionEditor`, reusing the saved-filter condition builder component if it can be embedded (find it), else a small builder for the deal fields the filter AST supports; log which;
  - **Then:** `ActionList`, an ordered list (up/down buttons, max 10) with a form per action type, a variables help `Popover` for text fields, and selects for stages, users, activity types and email templates;
  - "Save" (Zod errors shown inline) and a "Run log" tab.
- **Run log (`RunLog`):** last 100 runs: time, record link, status `Badge`, skip reason, and expandable steps with error copy.
- **`/settings/webhooks`:**
  - table: name, URL, events count, status (enabled, disabled with reason), last delivery, menu (Edit, Send test, Rotate secret, Enable/Disable, Delete);
  - `WebhookDialog`: name, URL, event checkboxes grouped by entity using the `Checkbox` wrapper;
  - after create or rotate, a one-time secret panel with a copy button and the text "Copy this secret now. You won't see it again.";
  - `DeliveryLog` per subscription: last 100 deliveries (time, event, status, attempts, code, duration, Redeliver) with the payload in an expandable `pre`.
- **Test hooks:** `automations-table`, `automation-row` (`data-automation-id`), `automation-new`, `automation-templates`, `automation-describe`, `automation-describe-input`, `automation-editor`, `automation-trigger-type`, `automation-action-add`, `automation-save`, `automation-enabled`, `automation-runs`, `automation-run-row` (`data-status`), `webhooks-table`, `webhook-new`, `webhook-dialog`, `webhook-url`, `webhook-secret`, `webhook-row` (`data-webhook-id`), `webhook-deliveries`, `webhook-delivery-row` (`data-status`).
- **Screenshots:** `p5-automations-list`, `p5-automation-editor`, `p5-automation-describe`, `p5-automation-runs`, `p5-webhooks`, `p5-webhook-deliveries`.

### 6.12 Demo seed and e2e env

- **Seed:** two automations, both disabled: template 1, and template 3. Plus one webhook subscription to `https://example.invalid/hooks/dealflow`, disabled with reason "Demo".
- **E2E env:** gains `WEBHOOK_ALLOW_PRIVATE=true`.

## 7. Conventions

Same as Parts 1 to 4 (CLAUDE.md is the authority). Events are written inside the caller's transaction, never after it. Jobs take an `AbortSignal` and are idempotent: a re-run of a finished run or delivery is a no-op. Tests for client IP, IP ranges, signatures, definition parsing, trigger matching, the outbox, the dispatcher, the loop guard, the runner and delivery are written first.

## 8. Phases and tasks

### Phase 0: Start, follow-up, schema and pure core

#### Task 0.1 - Start Part 5: progress files, kit and baseline

**Goal:** A Part 5 PROGRESS.md and a green baseline.

**Files:** create `PROGRESS.md`; rename `PROGRESS.md` → `PROGRESS-P4.md`; possibly root symlink `PLAN-PART5.md`, `scripts/check-progress.mjs`

**Steps:**
1. Check section 4's table; log each result as a Decision.
2. `git mv PROGRESS.md PROGRESS-P4.md`; create PROGRESS.md in the section 0 format with every task unchecked; record the Phase 0 base commit; copy `PROGRESS-P4.md` → Environment; carry over still-open owner actions.
3. Kit in a subfolder: root symlink plus the byte-identical checker copy.
4. Baseline: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`. Log `- Baseline: ...`. No integration run here.
5. Commit `0.1: Start Part 5: progress files, kit and baseline`, tick.

**Verify:** `pnpm check:progress` → OK

**Done when:** PROGRESS.md lists all tasks and the baseline line exists.

#### Task 0.2 - Trusted client IP (test-first)

**Goal:** 6.2 and the two env keys of 6.1.

**Files:** create `src/features/net/{clientIp.ts,clientIp.test.ts}`; modify `src/config/env.ts`, `.env.example`, `src/constants/automations.ts` (create), the documents public routes and page

**Steps:**
1. Tests first (hops 0, 1, 2, short list, spoofed left entry, whitespace), see them fail, implement.
2. Replace the Part 4 IP logic; run `pnpm exec vitest run src/features/net src/features/documents`.
3. Commit, tick.

**Verify:** `pnpm exec vitest run src/features/net` → passes

**Done when:** tests pass and no other IP parsing remains in the documents feature.

#### Task 0.3 - Automations schema and migration

**Goal:** The tables of 6.4.

**Files:** create `src/db/schema/automations.ts`, `drizzle/0083_dealflow_automations.sql` (+ meta); modify `src/db/schema/index.ts`

**Steps:**
1. Schema exactly as 6.4; generate with `--name dealflow_automations`; check the SQL; apply to the dev database.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the migration is applied and typecheck passes.

#### Task 0.4 - Pure core: definition, trigger matching, IP ranges, signatures (test-first)

**Goal:** `definition.ts`, `ipRanges.ts` (with `checkWebhookUrl`), `signature.ts`.

**Files:** create those files and their `.test.ts` files; create `src/features/events/types.ts`

**Steps:**
1. Tests first:
   - **IP ranges:** every range in 6.6, with one blocked and one allowed neighbour for each IPv4 range. Also `::1`, `fe80::1`, `fd00::1`, `::ffff:127.0.0.1`, `::ffff:8.8.8.8` (allowed), `64:ff9b::a00:1` (blocked) and `2606:4700::1111` (allowed), plus junk strings.
   - **`checkWebhookUrl`:** http refused unless private is allowed; credentials refused; an IP-literal private host refused.
   - **Signatures:** a known vector (secret `whsec_test`, timestamp `1700000000`, body `{"a":1}`; compute the expected hex once in the test with `node:crypto` and pin it); `verifySignature` rejects a stale timestamp and a tampered body.
   - **Definition:** a valid example of every trigger and action type parses; 11 actions are refused; `matchesTrigger` handles fields, stage, pipeline and document kind.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run src/features/automations src/features/webhooks` → passes

**Done when:** all cases pass.

#### Task 0.5 - Phase 0 QA gate

**Goal:** Prove the follow-up, schema and pure core.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 1 base commit, commit `0.5: Phase 0 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/documents` → passes

**QA focus:** Definition of done items 1 and 2; IP checks cover IPv4-mapped IPv6.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: Event outbox and dispatcher

#### Task 1.1 - Emit from recordChange (test-first)

**Goal:** `emit.ts`, `chainContext.ts`, `eventTypesForChange`, and the hook in `recordChange`.

**Files:** create `src/features/events/{emit.ts,chainContext.ts,events.integration.test.ts}`; modify `src/features/collaboration/changeLog.ts`

**Steps:**
1. Read the `recordChange` callers and log the field names for stage, status, deleted and activity done.
2. Tests first (real Postgres):
   - a deal stage move through the real service writes `deal.stage_changed` and `deal.updated`;
   - marking the deal won writes `deal.won`;
   - a write whose transaction rolls back leaves no event;
   - inside `runInChain` the event carries that chain id, depth and automation id.
3. Implement until green.
4. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/events` → passes

**Done when:** the cases pass.

#### Task 1.2 - Create and document events

**Goal:** Events for creates and document status changes.

**Files:** modify the deal, person, organization and activity create services; `src/features/documents/{issue.ts,publicDocuments.ts,payments.ts,overdueJob.ts}`; any audited path that bypasses `recordChange`; `events.integration.test.ts`; `docs/dealflow/UPSTREAM.md`

**Steps:**
1. Add `emitDomainEvent` where section 4 says it is missing, in the same transaction.
2. Document events:
   - issue or markSent → `document.sent`;
   - first view → `document.viewed`;
   - accept and decline → `document.accepted` and `document.declined`;
   - the overdue job → one `invoice.overdue` per updated row (use `RETURNING id`);
   - a payment reaching the total → `invoice.paid`;
   - void → `invoice.voided`.
3. Add cases: creating a deal writes `deal.created`; accepting a quote writes `document.accepted`; the overdue job writes one event per invoice.
4. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/events src/features/documents` → passes

**Done when:** the cases pass and existing documents tests still pass.

#### Task 1.3 - Dispatcher, snapshot and retention (test-first)

**Goal:** `dispatcher.ts`, `dispatcherJob.ts`, `snapshot.ts`, `rottingJob.ts`, `retentionJob.ts`.

**Files:** create those files; modify the worker registration, `src/constants/jobNames.ts`, `events.integration.test.ts`

**Steps:**
1. Cases first:
   - two field edits in one transaction produce one `deal.updated` run with two changes;
   - two concurrent dispatcher passes process each event once (`SKIP LOCKED`);
   - a matching automation gets a run row, and a second event in the same chain for the same record gets none (loop guard);
   - depth 4 gives a `skipped`/`depth_limit` row;
   - a webhook subscription for `deal.won` gets a delivery with a deal snapshot that has no secret fields;
   - the rotting job emits once per stage entry for a deal past its stage's rotting days;
   - retention deletes only old processed rows.
2. Implement: the worker polls every 5 s and on `LISTEN`; the jobs enqueue after commit.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/events` → passes

**Done when:** the cases pass.

#### Task 1.4 - Phase 1 QA gate

**Goal:** Prove the backbone.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 2 base commit, commit `1.4: Phase 1 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/events src/features/documents src/features/deals src/features/collaboration` → passes

**QA focus:** Definition of done items 3 and 4; no event is written outside the mutation's transaction.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: Automation engine

#### Task 2.1 - Runner, conditions and the capability (test-first)

**Goal:** `runner.ts`, `conditions.ts`, the `automations.run` job, `automations.manage`, error IDs, the `automation` notification kind.

**Files:** create `src/features/automations/{runner.ts,conditions.ts,service.ts,automations.integration.test.ts}`; modify the error registry, permission registry, worker, notification types (+ `ALTER TYPE` migration)

**Steps:**
1. Cases first, with a stub action registry for now:
   - a false condition gives `skipped`/`condition_false`;
   - a disabled automation is skipped;
   - an inactive creator gives `owner_inactive`;
   - a failing first action stops the second;
   - a re-run of a finished run is a no-op.
2. Implement the runner, the condition check (`filterToSql`), and the service (CRUD with `automationDefinitionSchema`, enable and disable).
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/automations` → passes

**Done when:** the cases pass.

#### Task 2.2 - Core actions

**Goal:** `update_deal`, `create_activity`, `add_note`, `notify_user`.

**Files:** create `src/features/automations/actions/{updateDeal,createActivity,addNote,notifyUser,index}.ts`; modify `automations.integration.test.ts`

**Steps:**
1. Find and log the service each action calls.
2. Cases:
   - "deal won → create activity" end to end (event, dispatcher, run, activity exists with the rendered subject);
   - `update_deal` stage move writes a change log entry and an event in the same chain at depth 1;
   - two automations that move a deal back and forth stop after one round (loop guard), with no runaway runs;
   - `notify_user` creates an `automation` notification.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/automations` → passes

**Done when:** the cases pass.

#### Task 2.3 - Email and AI actions

**Goal:** `send_email`, `ai_summarize_deal`, `ai_score_deal`, `ai_draft_email`.

**Files:** create `src/features/automations/actions/{sendEmail,aiActions}.ts`; modify `automations.integration.test.ts`

**Steps:**
1. Find and log the Part 1 AI functions and the email template renderer.
2. Cases:
   - `send_email` delivers once through the fake transport (Part 4's test setup), and a second trigger within 24 h is skipped with `E_AUTOMATION_005`;
   - no person email gives `E_AUTOMATION_005`;
   - `ai_summarize_deal` with `AI_FAKE` writes a note;
   - an AI action over the cap fails the step with the AI cap error and logs usage as the Part 1 layer does.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/automations` → passes

**Done when:** the cases pass.

#### Task 2.4 - Phase 2 QA gate

**Goal:** Prove the engine.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 3 base commit, commit `2.4: Phase 2 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/automations src/features/events src/features/ai src/features/notifications` → passes

**QA focus:** Definition of done items 5 to 7 (engine side); actions call existing services, never write tables directly.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: Webhooks

#### Task 3.1 - Safe delivery (test-first)

**Goal:** `deliver.ts` with `pinnedLookup`, and the `webhooks.deliver` job.

**Files:** create `src/features/webhooks/{deliver.ts,deliveryJob.ts,webhooks.integration.test.ts}`; modify the worker, `jobNames.ts`

**Steps:**
1. Cases first, against a local `node:http` server on `127.0.0.1` started in the test (pass `allowPrivate: true` explicitly where a case must reach it):
   - a 200 marks the delivery `succeeded`, and the receiver verifies the signature with `verifySignature`;
   - a 500 marks it `retrying` with `next_attempt_at` 60 s later;
   - the sixth failure marks it `failed`;
   - 10 consecutive failed attempts disable the subscription and send one system email (captured with the mail fake);
   - a 410 disables immediately;
   - a 302 is not followed;
   - a slow receiver times out;
   - with `allowPrivate: false`, a URL whose host resolves to `127.0.0.1` (use `localhost`) is refused with `E_WEBHOOK_002` before any connection (the server records no request).
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/webhooks` → passes

**Done when:** every case passes.

#### Task 3.2 - Subscriptions service, test send and redeliver

**Goal:** 6.10's service and actions, and the reads.

**Files:** create `src/features/webhooks/{service.ts,actions.ts,router.ts}`; modify the app router, `webhooks.integration.test.ts`

**Steps:**
1. Cases:
   - create returns the secret once, and the stored secret is encrypted (not equal to the plain text);
   - rotate changes the signature;
   - enable resets the failure count;
   - redeliver creates a new delivery;
   - a non-admin is refused.
2. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/webhooks` → passes

**Done when:** the cases pass.

#### Task 3.3 - Phase 3 QA gate

**Goal:** Prove webhooks.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 4 base commit, commit `3.3: Phase 3 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/webhooks src/features/events` → passes

**QA focus:** Definition of done item 8; the address check happens inside `lookup` (no check-then-connect gap); secrets never appear in logs, payloads or reads.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Screens, describe it, templates

#### Task 4.1 - Automations list and editor

**Goal:** `/settings/automations` and the editor (6.11).

**Files:** create `AutomationsList.tsx`, `AutomationEditor.tsx`, `TriggerPicker.tsx`, `ConditionEditor.tsx`, `ActionList.tsx`, the two route pages; modify `src/features/automations/{actions.ts,router.ts}`, the settings navigation

**Steps:**
1. Build per 6.11 with the hooks; inline Zod errors.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** both pages render and save.

#### Task 4.2 - Run log

**Goal:** `RunLog` in the editor.

**Files:** create `RunLog.tsx`; modify `router.ts`

**Steps:**
1. A runs read (last 100) and the table with expandable steps.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the tab renders runs.

#### Task 4.3 - Describe it and the template gallery

**Goal:** 6.9.

**Files:** create `src/features/automations/{describe.ts,templates.ts}`, `DescribeDialog.tsx`, `TemplateGallery.tsx`; modify the AI fake responses, `actions.ts`, `automations.integration.test.ts`

**Steps:**
1. Add cases:
   - with `AI_FAKE`, `draftAutomation` returns a definition that passes the schema;
   - a scripted provider returning invalid JSON twice gives `E_AUTOMATION_004` (use `ScriptedAiProvider`);
   - every template builds a valid definition on the test database.
2. Build the dialog and gallery.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/automations` → passes

**Done when:** the cases pass and both dialogs open the editor.

#### Task 4.4 - Webhooks settings and delivery log

**Goal:** `/settings/webhooks` (6.11).

**Files:** create `WebhooksSettings.tsx`, `WebhookDialog.tsx`, `DeliveryLog.tsx`, the route page; modify the settings navigation

**Steps:**
1. Build per 6.11 with the one-time secret panel and the hooks.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the page renders and every action is wired.

#### Task 4.5 - Demo seed and docs

**Goal:** 6.12 and the docs.

**Files:** modify the demo seed, the e2e env (`WEBHOOK_ALLOW_PRIVATE=true`); create `docs/dealflow/AUTOMATIONS.md`, `docs/dealflow/WEBHOOKS.md`; modify `docs/dealflow/UPSTREAM.md`, `README.md`

**Steps:**
1. Seed per 6.12.
2. AUTOMATIONS.md: events, triggers, conditions, actions, loop guard, AI actions, describe it, templates, run log, retention.
3. WEBHOOKS.md: events list, the payload shape with an example, headers, how to verify a signature (a 15-line Node example using `node:crypto`), retries, auto-disable, the blocked address ranges, `WEBHOOK_ALLOW_PRIVATE`.
4. UPSTREAM.md: every upstream file changed. README: a short section.
5. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the docs exist and the seed compiles.

#### Task 4.6 - Phase 4 QA gate

**Goal:** Prove the screens build.

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
- `pnpm exec vitest run --project integration src/features/automations src/features/webhooks` → passes

**QA focus:** Definition of done items 7 and 9; shadcn-only UI; admin-only pages.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 5: Hardening and hand-off

#### Task 5.1 - E2E automations spec and screenshots

**Goal:** `e2e/09-automations.spec.ts` and the 6 screenshots.

**Files:** create `e2e/09-automations.spec.ts`; modify `e2e/helpers.ts` only if a helper is missing

**Steps:**
1. As the admin (saved session):
   - open Settings → Automations (`p5-automations-list`);
   - open "Describe it", type "When a deal is won, create a follow-up call tomorrow", draft it (`p5-automation-describe`), and close without saving;
   - start from template 1, enable it, save (`p5-automation-editor`);
   - mark a seeded open deal won through the UI;
   - wait until the run log shows a `succeeded` run (poll with reloads up to 30 s, since the dispatcher polls every 5 s) (`p5-automation-runs`), and confirm the activity "Onboarding call with ..." is on the deal.
2. Webhooks:
   - start a `node:http` receiver on `127.0.0.1` on a free port inside the spec;
   - create a subscription to `http://127.0.0.1:{port}/hook` for `deal.won`, copy the secret from `webhook-secret` (`p5-webhooks`);
   - mark another deal won;
   - expect the receiver to get one request whose signature verifies with the copied secret;
   - open the delivery log (`p5-webhook-deliveries`).
3. Run the full `pnpm e2e` (specs `00` to `09`); fix until green.
4. Commit, tick.

**Verify:** `pnpm e2e` → passes; `ls e2e/screenshots/p5-*.png | wc -l` → `6`

**Done when:** e2e is green and 6 screenshots exist.

#### Task 5.2 - Integration suite and smoke

**Goal:** The once-per-part full runs.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. `pnpm test:integration` (full); fix failures caused by this part; pre-existing ones get `PRE-EXISTING:` Open issues.
2. `DOCKER_BUILDKIT=0 pnpm smoke` → SMOKE PASS, and no `dealflow-smoke` container or volume left.
3. Log both results as Decisions, commit, tick.

**Verify:** `pnpm test:integration` passes and `DOCKER_BUILDKIT=0 pnpm smoke` prints SMOKE PASS (or SKIPPED with the reason from section 10)

**Done when:** both ran and are logged.

#### Task 5.3 - Independent review and hardening

**Goal:** One fresh-context review of Part 5, then fix what it finds.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is the full `.dsh/qa.md`, a blank line, then `Final review of PLAN-PART5.md. Base commit {Phase 0 base}.` Wait for `QA RESULT: PASS` or the numbered list. Fallbacks: `qa.sh` with the same request, then an evidenced self-review (log `qa unavailable (qa.sh failed) - self-review`).
2. Fix every blocker and major; commit `5.3: QA fixes round {r}`; re-run the gate commands of Task 4.6; review again. At most 3 rounds. Minors: fix when cheap, else Open issues.
3. Log `- Independent review: subagent (fresh context) round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n}`.
4. Commit `5.3: Independent review and hardening`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`.

**Done when:** the review ran (or the logged fallback), and blockers and majors are fixed or logged with reasons.

#### Task 5.4 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order; one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `5.4: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least 16.

**Done when:** every checklist item has a line.

#### Task 5.5 - Final report and completion

**Goal:** Hand the owner a short, truthful report and finish.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report, short (the owner reads it on a phone). Do not repeat the Decisions list. Include:
   - Definition of done (items 1 to 10, one line each);
   - Checklist (from 5.4);
   - Owner actions (numbered, exact commands, including the dev stack rebuild for migration 0083);
   - Decisions worth reviewing (only `CONTRACT CHANGE:` lines and changed tests);
   - Open issues;
   - Notes for Part 6 (new routes and screenshots, the event types, how forms and the scheduler should emit events, upstream files changed).
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `5.5: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`.

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- Delays, wait steps and date-based triggers ("3 days before close").
- Branching (if/else) inside an automation; more than 10 actions.
- Automations on leads, projects or custom objects.
- Incoming webhooks or a public REST API (Part 8 adds API tokens).
- Webhook payload customisation or field selection; ordered delivery.
- Zapier, Make or other integration marketplaces.

## 10. ASK and STOP triggers

This plan has no ASK triggers; the only STOP case is the fatal one in section 4.

| Situation | Safe default | Owner action to log |
|---|---|---|
| Subagent tool unavailable | `qa.sh`, then the evidenced self-review | "Run the review yourself in a new harness session with `.dsh/qa.md` and the request from Task 5.3" |
| Docker not running or out of disk | skip integration, e2e and smoke (SKIPPED) | "Start Docker Desktop / free Docker disk, then run `pnpm test:integration`, `pnpm e2e`, `DOCKER_BUILDKIT=0 pnpm smoke`" |
| A pre-existing upstream test fails | leave it, log `PRE-EXISTING:` | "Review the pre-existing failures in PROGRESS.md" |
| The saved-filter condition builder cannot be embedded | a small builder for deal fields the AST supports | none |
| An audited change path cannot emit inside its transaction | emit right after it in the same request and log it as an Open issue | none |
| The reverse proxy adds more than one hop | default `TRUSTED_PROXY_HOPS=1` stays | "Set TRUSTED_PROXY_HOPS in .env to the number of proxies in front of the app" |
| Google env in `.env` still partial | keep the Environment prefixes | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty.
2. `pnpm install --frozen-lockfile` exits 0 and `package.json` gained no dependency.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes (count ≥ the baseline).
6. `pnpm test:integration` passes (Task 5.2).
7. `pnpm build` exits 0.
8. `pnpm e2e` passes, specs `00` to `09`.
9. 6 `e2e/screenshots/p5-*.png` exist and the Part 1 to 4 screenshots are still present.
10. Smoke printed SMOKE PASS and left no `dealflow-smoke` container or volume.
11. `drizzle/0083_dealflow_automations.sql` creates exactly the 5 tables of 6.4.
12. `git grep -n "x-forwarded-for" -- src/features/documents src/app/d src/app/api/public` prints nothing (they use `clientIp`); list any other upstream use as an Open issue.
13. `git grep -nE "fetch\\(" -- src/features/webhooks` prints nothing (delivery uses the pinned `http(s).request`).
14. `git grep -nE "secret" -- src/features/webhooks/router.ts` shows no read that returns `secret_enc` or a decrypted secret.
15. No em dash in any file added or changed in this part (`git diff --name-only {Phase 0 base} | xargs perl -CSD -ne 'print "$ARGV\n" if /\x{2014}/' | sort -u` prints nothing, kit files excepted).
16. `docs/dealflow/AUTOMATIONS.md` and `docs/dealflow/WEBHOOKS.md` exist; `UPSTREAM.md` lists this part's upstream files.
17. `pnpm check:progress --final` passes.

## 12. Report back

No mid-run reporting. The run ends with the final report (Task 5.5). The owner pastes PROGRESS.md → Final report back to the planner (the Decisions list is not needed).

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

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md to PLAN-PART5.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

If the request is exactly "Reply exactly: QA READY", reply with the two words QA READY and do nothing else.

Hard rules for you:
- You are read-only. Never create, edit, move or delete files, never commit, reset, checkout, stash or push. Commands that only read or that write build output inside this folder (typecheck, lint, build, unit tests) are fine.
- Never call ask_user_question; nobody will answer.
- Never print the contents of .env.
- Stop any server you start.

Input: "Final review of {plan file}. Base commit {hash}.", "Phase N gate review of {plan file}. Base commit {hash}.", or "Part N audit of {plan file}. Base commit {hash}. Focus: ..." (an audit works through every focus item explicitly and reports each one).

Procedure:
1. Read the named plan's sections 2, 3, 6 and 7 and every task (for a phase review: that phase's tasks). For a later part also read the earlier plans' sections where it references them.
2. Run `git --no-optional-locks diff --stat {hash}..HEAD` and read the changed files that matter.
3. Run `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` and note the exact results (use the Environment commands in PROGRESS.md). Read PROGRESS.md for the e2e, integration and smoke results; check the screenshot files the plan lists exist in e2e/screenshots.
4. For every task: each listed file exists; each step is really implemented, not stubbed or left as a placeholder; section 6 contracts match exactly (paths, routes, status codes, redirects, error IDs, env vars, schema, prompts, test hooks); section 7 conventions hold; the task's "Done when" holds.
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; money is computed on integer minor units with no floats, converted totals never add unconverted amounts or drop deals silently (excluded deals are listed), the forecast reuses the deals visibility filter; document public routes take only the publicId and a validated body, never render HTML, issued documents are immutable; domain events are written inside the mutation's transaction, automation actions go through existing services and respect the loop guard, webhook delivery checks every resolved address inside the DNS lookup with no redirects, and webhook secrets are encrypted and never returned after creation; no em dashes in new files.
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
# Usage: ./qa.sh "Final review of PLAN-PART5.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
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

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART5.md";
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
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART[1-5]\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
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
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART5.md (dealflow-wd-p5-v1) is finished.
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
PROMPT='Read PLAN-PART5.md in this folder in full and PROGRESS.md, then follow PLAN-PART5.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p5-v1; earlier parts are finished) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p5-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p5-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
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
- Otherwise you are the builder: read `PLAN-PART5.md` in full (Parts 1 to 4 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART5.md rule 18.
```
