# PLAN: Dealflow on warpdrive, Part 8: Projects, API and data safety

> Plan ID: dealflow-wd-p8-v1 · Written: 2026-10-21 · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 4, fast verification profile, no human in the loop · Type: change to existing project

Parts 1 to 7 are finished (`PROGRESS-P1.md` to `PROGRESS-P6.md`, and `PROGRESS.md` until Task 0.1 renames it to `PROGRESS-P7.md`). Part 7 left 5,237 unit tests, 2,004 integration tests and e2e specs `00` to `11`, all passing, plus Insights. The roadmap's old Part 8 is split: this Part 8 adds projects, the REST API, the recycle bin, CSV export, the audit log page and backups; Part 9 takes the productivity items. This plan is compact: where it says "find" or "reuse", locate the existing code, reuse it, and log the file you used as a Decision.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 4** in fresh-context sessions, one phase per session. Parts 1 to 7 (`PLAN-PART1.md` to `PLAN-PART7.md`) are finished; their code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART8.md` in full and PROGRESS.md (open earlier `PLAN-PART{N}.md` files only where this plan points to them). If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p8-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 7's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 4.5, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 4.2.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.4, 1.5, 2.4, 3.7):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). The one independent review is Task 4.3.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (the CSV helper shared with Part 7, the Part 5 action registry gaining `create_project`), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs only. This part needs no external service; e2e uses the fake mail transport; API tests call the route handler locally and backups run only against throwaway databases.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove or recreate the owner's running Compose project `warpdrive-main`, never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack 3001/5433/8080/9000/9001 (owner's). Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `PLAN-PART3.md`, `PLAN-PART4.md`, `PLAN-PART5.md`, `PLAN-PART6.md`, `PLAN-PART7.md`, `PLAN-PART8.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 7's file to `PROGRESS-P7.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p8-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 8: progress files, kit and baseline
(every task through 4.5, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 4990/4990 · projects 20/20

## Decisions
- 0.3: chose … over … because …

## Owner actions
- TODO(owner): …

## Open issues
- None

## Environment
(copy the section 4 "Known environment" commands that this machine needs, and keep them current)

## Final report
(written in Task 4.5)
```

## 1. Goal

Add projects (phases and tasks, created by hand, from a won deal, or by an automation), a token-authenticated REST API under `/api/v1` with docs, a recycle bin with restore and a 30-day purge, CSV export on every main list, an admin audit log page, and daily backups (database dump plus file mirror) with download and a documented restore.

## 2. Definition of done

1. Migration `0089_dealflow_projects_api` adds the tables in 6.4, and `0090` adds the `project_task_assigned` notification kind. Nothing else changes.
2. Token format and hashing, CSV writing, API cursors and backup retention are pure, unit-tested functions.
3. Projects are complete:
   - users create, edit, complete and delete projects, with phases and tasks;
   - the project board moves tasks between phases by drag and drop;
   - a won deal offers "Create project";
   - the automation action `create_project` exists;
   - assigning a task notifies the assignee;
   - project events reach automations and webhooks.
4. Admins and users create personal API tokens (shown once, stored hashed, read or read-write scope, optional expiry, revocable). `/api/v1` serves deals, persons, organizations, activities, notes, products and projects:
   - list (cursor pagination, `updated_since`), get, create, update and delete;
   - every call runs as the token's user, through the existing services and permissions;
   - rate-limited per token.
5. The API is documented in-app (`/settings/api`) and in `docs/API.md`, both generated from one route registry.
6. The recycle bin lists soft-deleted deals, persons, organizations, activities, leads and projects from the last 30 days. Users restore their own records and admins restore any. A daily purge hard-deletes older items in a foreign-key-safe order and keeps records that issued documents still reference.
7. CSV export with the current filter and visible columns exists on the deals, persons, organizations, activities, products and invoices lists. It is gated by `data.export`, streamed, and formula-guarded.
8. `/settings/audit-log` shows audit events to admins, with filters and pagination.
9. Backups:
   - a daily job, plus a "Back up now" button, writes `dealflow-backup-{timestamp}.tar.gz` (the `pg_dump` custom-format dump, the MinIO files, and `manifest.json`) to `BACKUP_DIR`, keeping the newest `BACKUP_KEEP`;
   - admins download backups;
   - `pnpm backup:restore` restores one into a database, proven by the smoke test.
10. typecheck, lint, build, unit and the full integration suite pass; e2e specs `00` to `12` pass; the 7 `p8-*` screenshots exist; smoke (with the backup round trip) passes; one independent review ran.

## 3. Decisions already made

- **Stack:** unchanged, no new npm dependency.
  - Backups use the `pg_dump` and `pg_restore` binaries and `tar`. The runtime image gains `postgresql16-client` through `apk` (match the server major version; check `docker-compose.yml`'s Postgres image).
  - Files are copied with the existing storage client (`makeStorageClient`).
- **Restore is CLI only** (`pnpm backup:restore {file} --database-url {url}`), run by the owner with the app stopped. The admin page shows the exact commands and never restores from the browser.
- **API tokens:**
  - format `dfk_` + 32 random bytes in base64url;
  - stored as SHA-256 hex plus an 8-character display prefix;
  - compared by hash lookup;
  - a token acts as its user, so visibility and permissions apply exactly as in the UI.
  - Scopes: `read`, `write` (write includes read).
- **API shape:**
  - JSON; success `{ data }` or `{ data, nextCursor }`; errors `{ error: { id, message } }`, with HTTP status from the error.
  - Deletes are soft deletes through the existing services.
  - Money is decimal strings.
  - Timestamps are ISO 8601 UTC.
  - Every write goes through the same service the UI uses, so change logs, events and automations fire.
- **One route registry** (`src/features/api/registry.ts`) drives routing, Zod validation and the docs (in-app page and `docs/API.md` via `pnpm api:docs`). No OpenAPI file in this part.
- **Projects visibility:**
  - a project linked to a deal is visible to whoever can see that deal;
  - an unlinked project is visible to every signed-in user;
  - the owner, assignees and admins edit.
- **Recycle bin:**
  - restore uses the entity's existing restore path if one exists, else a new restore function that clears `deleted_at` through `recordChange` (so the change log and events record it);
  - the purge job runs daily at `0 3 * * *` UTC.
- **CSV export:** generalise Part 7's CSV escaping into a shared `src/features/export/csv.ts` (Part 7's `toCsv` keeps working by calling it). Follow the leads list's existing export as the pattern (find it in `src/features/leads/`).
- **Out of scope here (Part 9):** palette commands, the shortcut help sheet, undo toasts, recurring activities, call logging, the duplicate finder, AI filters on people/organizations/leads, column pickers and bulk actions.

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | PROGRESS.md says `dealflow-wd-p7-v1` and `STATUS: COMPLETE` | log a Decision describing what you found; continue |
| Docker | `docker info` answers within 30 s | if it does not, open Docker Desktop (`open -a Docker`), wait up to 3 minutes, then `pnpm dev:up`; still down → fatal, `STATUS: BLOCKED` with an Owner action |
| Kit location | `PLAN-PART8.md` and the kit at the repo root, or in `PLAN AND EXECUTE/dealflow-wd-part8-kit/` | root symlink plus the byte-identical checker copy; log a Decision |
| Next migration | the last file in `drizzle/` is `0088_dealflow_insights_notifications.sql` | next free numbers; log them |
| Audit events | `src/db/schema/system.ts` holds the audit events table | use the real table and columns; log them |
| Soft delete | `deleted_at` exists on deals, persons, organizations, activities and leads (check each) | include only entities with a soft-delete column; log the list |
| Lead export | the leads list has a CSV export gated by `data.export` | copy its pattern; log the files |
| MCP services | `src/features/mcp/tools/` calls domain services for reads and writes | reuse the same service calls in the API handlers where they fit; log them |
| Runtime image | `Dockerfile` runtime stage is `node:22-alpine` | install the client the same way for the real base; log it |
| pnpm 9, subagent | as in Part 7 (reinstall pnpm into `/tmp/dealflow-tools` if `/tmp` was cleared) | as in Part 7 |

**Known environment:** after Task 0.1 renames it, copy `PROGRESS-P7.md` → Environment into PROGRESS.md → Environment and follow it. Smoke needs `COMPOSE_PARALLEL_LIMIT=1` (Part 7 finding).

**Fatal (STOP with `STATUS: BLOCKED`):**
- pnpm cannot be installed.
- `pnpm install --frozen-lockfile` fails for a registry reason.
- Docker stays down after the recovery steps above.

## 5. Target structure

```
src/db/schema/projects.ts, src/db/schema/apiTokens.ts, src/db/schema/backups.ts
drizzle/0089_dealflow_projects_api.sql, drizzle/0090_dealflow_projects_notifications.sql
src/features/projects/
  projects.ts, phases.ts, tasks.ts, fromDeal.ts, visibility.ts, actions.ts, router.ts
  projects.integration.test.ts
  ui/{ProjectsList,ProjectBoard,PhaseColumn,TaskCard,TaskDialog,NewProjectDialog,DealProjectsSection}.tsx
src/features/automations/actions/createProject.ts
src/features/api/
  tokens.ts, tokenFormat.ts, tokenFormat.test.ts, cursor.ts, cursor.test.ts
  registry.ts, handler.ts, resources/{deals,persons,organizations,activities,notes,products,projects}.ts
  docs.ts, api.integration.test.ts
  ui/{ApiTokensSettings,NewTokenDialog,ApiDocs}.tsx
src/app/api/v1/[...path]/route.ts               # one catch-all dispatching through the registry
src/features/recycle/
  recycle.ts, restore.ts, purgeJob.ts, recycle.integration.test.ts, ui/RecycleBin.tsx
src/features/export/
  csv.ts, csv.test.ts, exports.ts, exports.integration.test.ts, ui/ExportButton.tsx
src/features/audit/auditLog.ts, ui/AuditLog.tsx
src/features/backups/
  retention.ts, retention.test.ts, manifest.ts, backup.ts, backupJob.ts, restore.ts, backups.integration.test.ts
  ui/BackupsSettings.tsx
scripts/dealflow/backup-restore.ts, scripts/dealflow/api-docs.ts
src/app/(app)/projects/page.tsx, src/app/(app)/projects/[id]/page.tsx
src/app/(app)/settings/{api,recycle-bin,audit-log,backups}/page.tsx
src/app/(app)/settings/backups/[file]/download/route.ts
src/app/(app)/export/[entity]/route.ts
e2e/12-projects-data.spec.ts
docs/API.md, docs/dealflow/PROJECTS.md, docs/dealflow/BACKUPS.md
```

## 6. Contracts

### 6.1 Env and constants

**Env** (`src/config/env.ts`, plus `.env.example` section `# Backups`):

| Key | Type | Default |
|---|---|---|
| `BACKUP_DIR` | string | `/var/lib/dealflow/backups` |
| `BACKUP_KEEP` | integer 1..90 | `7` |
| `BACKUP_ENABLED` | boolean | `true` |
| `PG_DUMP_PATH` | string | `pg_dump` |
| `PG_RESTORE_PATH` | string | `pg_restore` |

**Compose:**
- `docker-compose.yml` gives the `worker` service a named volume `backups` mounted at `/var/lib/dealflow/backups`.
- The `app` service mounts the same volume read-only for downloads.
- The smoke compose project gets its own volume, as before.

**Constants** (`src/constants/projectsApi.ts`):

```ts
API_TOKEN_PREFIX = "dfk_"
API_RATE_PER_MINUTE = 120
API_PAGE_DEFAULT = 50
API_PAGE_MAX = 200
API_BODY_MAX_BYTES = 262_144
RECYCLE_RETENTION_DAYS = 30
PROJECT_DEFAULT_PHASES = ["Kickoff", "Delivery", "Wrap-up"]
EXPORT_MAX_ROWS = 50_000
```

### 6.2 Error IDs (append; add the `PROJECT`, `API`, `RECYCLE`, `EXPORT` and `BACKUP` domains to the registry and its test allow-list)

| ID | Cause |
|---|---|
| `E_PROJECT_001` | project not found or not visible |
| `E_PROJECT_002` | task or phase not found |
| `E_PROJECT_003` | edit by someone who is not owner, assignee or admin |
| `E_PROJECT_004` | action input failed Zod |
| `E_API_001` | missing or malformed bearer token (401) |
| `E_API_002` | token unknown, revoked or expired (401) |
| `E_API_003` | scope does not allow this method (403) |
| `E_API_004` | rate limited (429, with `Retry-After`) |
| `E_API_005` | unknown route or method (404/405) |
| `E_API_006` | body invalid (422, with Zod issues) |
| `E_RECYCLE_001` | item not found or not restorable by this user |
| `E_RECYCLE_002` | restore blocked (its parent is still deleted; context names the parent) |
| `E_EXPORT_001` | export not allowed (no `data.export`) |
| `E_EXPORT_002` | export larger than `EXPORT_MAX_ROWS` (narrow the filter) |
| `E_BACKUP_001` | backup failed (context: step and exit code) |
| `E_BACKUP_002` | backup file not found |
| `E_BACKUP_003` | backups disabled or `BACKUP_DIR` not writable |

User copy goes in `src/constants/projectsApiStrings.ts`.

### 6.3 Test hooks and screenshots

`data-testid` hooks:

- **Projects:** `projects-table`, `project-row` (`data-project-id`), `project-new`, `project-board`, `phase-column` (`data-phase-id`), `task-card` (`data-task-id`), `task-add`, `task-dialog`, `project-status`, `deal-create-project`, `deal-projects-section`.
- **API:** `api-tokens-table`, `api-token-new`, `api-token-secret`, `api-token-revoke`, `api-docs`.
- **Recycle bin:** `recycle-table`, `recycle-row` (`data-entity`, `data-id`), `recycle-restore`.
- **Export:** `export-csv` (on each list).
- **Audit log:** `audit-table`, `audit-row`.
- **Backups:** `backups-table`, `backup-now`, `backup-row`, `backup-download`.

Screenshots:
- `p8-projects-list`
- `p8-project-board`
- `p8-api-tokens`
- `p8-api-docs`
- `p8-recycle-bin`
- `p8-audit-log`
- `p8-backups`

### 6.4 Schema

Id and FK types match the referenced tables. Timestamps are `timestamptz`.

```ts
// projects.ts
projects: id, name text not null (1..150), description text null (<= 5000),
  status text not null default 'active' check in ('active','on_hold','completed','cancelled'),
  deal_id -> deals.id on delete set null, organization_id -> organizations.id on delete set null,
  person_id -> persons.id on delete set null, owner_id -> users.id on delete restrict not null,
  start_date date null, due_date date null, completed_at timestamptz null,
  created_at, updated_at, deleted_at timestamptz null
  indexes (deal_id), (owner_id, status) where deleted_at is null
project_phases: id, project_id -> projects.id on delete cascade, name text not null (1..80), position integer not null
  index (project_id, position)
project_tasks: id, project_id -> projects.id on delete cascade, phase_id -> project_phases.id on delete set null,
  title text not null (1..200), description text null (<= 5000), assignee_id -> users.id on delete set null,
  due_date date null, done boolean not null default false, done_at timestamptz null, position integer not null,
  created_at, updated_at
  indexes (project_id, phase_id, position), (assignee_id, done)
// apiTokens.ts
api_tokens: id, user_id -> users.id on delete cascade, name text not null (1..80), token_hash text not null unique,
  token_prefix text not null, scope text not null check in ('read','write'), expires_at timestamptz null,
  last_used_at timestamptz null, revoked_at timestamptz null, created_at
  index (user_id)
// backups.ts
backup_runs: id, file_name text null, status text not null check in ('running','succeeded','failed'),
  trigger text not null check in ('schedule','manual'), size_bytes bigint null, db_bytes bigint null,
  file_count integer null, error_id text null, error_detail text null (<= 500),
  started_by -> users.id on delete set null, started_at timestamptz not null default now(), finished_at timestamptz null
```

Migration `0090` adds `project_task_assigned` to `notification_type`, with the maps, labels, defaults (email on) and tests, as earlier parts did.

### 6.5 Pure helpers

**`tokenFormat.ts`:**

```ts
newApiToken(): { token: string; hash: string; prefix: string }
// token = "dfk_" + base64url(32 bytes); hash = sha256 hex of the full token; prefix = token.slice(0, 12)
hashApiToken(token: string): string
parseBearer(header: string | null): string | null
// "Bearer dfk_..." (case-insensitive scheme, single space, the dfk_ prefix required) or null
```

**`cursor.ts`:**

```ts
encodeCursor({ updatedAt: string; id: string }): string    // base64url JSON
decodeCursor(s: string): Result<{ updatedAt; id }>
```

Lists order by `(updated_at, id)` ascending with a keyset `WHERE (updated_at, id) > (cursor)`.

**`export/csv.ts`:**

```ts
csvLine(cells: (string | number | null)[]): string   // RFC 4180 quoting, CRLF, formula guard: prefix ' to cells starting with = + - @ tab or CR
csvStream(header: string[], rows: AsyncIterable<(string | number | null)[]>): ReadableStream<Uint8Array>
// begins with a UTF-8 BOM so Excel opens it correctly
```

Part 7's `toCsv` delegates to `csvLine`.

**`backups/retention.ts`:**

```ts
backupFileName(now: Date): string                                // dealflow-backup-2026-10-21T020000Z.tar.gz
filesToPrune(names: string[], keep: number): string[]
// only names matching the pattern; newest kept by the timestamp in the name; anything else is ignored, never deleted
```

**`backups/manifest.ts`:**

```ts
buildManifest({ createdAt, appVersion, dbBytes, files: { key, size }[], schemaMigration: string }): Manifest
// version: 1
```

### 6.6 Projects

**Service** (`projects.ts`, `phases.ts`, `tasks.ts`):

- **Projects:**
  - `listProjects({ status?, ownerId?, dealId?, search? })` returns visible projects only (`visibility.ts`: deal-linked follows the deal visibility clause; unlinked are visible to all).
  - `getProject` (with phases and tasks ordered).
  - `createProject({ name, description?, dealId?, organizationId?, personId?, ownerId?, startDate?, dueDate?, phases?: string[] })`: phases default to `PROJECT_DEFAULT_PHASES`.
  - `updateProject`.
  - `setProjectStatus`: `completed` sets `completed_at`; any other status clears it.
  - `deleteProject` (soft).
- **Phases:** `addPhase`, `renamePhase`, `movePhase`, `deletePhase`. Deleting a phase moves its tasks to "no phase" (`phase_id` null).
- **Tasks:**
  - `addTask`, `updateTask`, `moveTask({ taskId, phaseId | null, position })` (renumber positions in one transaction), `completeTask`, `reopenTask`, `deleteTask`.
  - Assigning a task (create or change of assignee to someone other than the actor) creates a `project_task_assigned` notification after commit.

**Events** (append to `DOMAIN_EVENT_TYPES`, the trigger union, the webhook groups and `snapshot.ts`):
- `project.created`
- `project.status_changed`
- `project.deleted`
- `project_task.completed`

Each is emitted in the mutation's transaction with `emitDomainEvent`. The snapshot is `{ project: { id, name, status, dealId, ownerId, dueDate }, task?: { id, title, assigneeId } }`. The condition target is the linked deal, or none, in which case a condition skips the run.

**From a deal** (`fromDeal.ts`): `createProjectFromDeal(dealId, { phases? })` takes the name `{deal title}` and links the deal, person and organization, with the owner set to the deal owner. It is allowed for won deals only; any other deal returns `E_PROJECT_004` with the reason.

**Automation action** `create_project`:

```ts
{ type: "create_project"; phases?: string[] /* 1..10, each 1..80 */; nameTemplate?: string /* variables, default "{{deal.title}}" */ }
```

- Added to the definition schema, registry, editor and docs.
- Runs `createProjectFromDeal` as the automation owner, with no won-status restriction when called by an automation.
- Add one built-in template: "Start a project when a deal is won" (`deal.won` → `create_project`).

### 6.7 API

**Registry** (`registry.ts`): an array of route entries.

```ts
{ resource: "deals"; method: "GET" | "POST" | "PATCH" | "DELETE"; path: "/deals" | "/deals/:id"; scope: "read" | "write";
  summary: string; query?: ZodSchema; body?: ZodSchema; handler: (ctx: ApiCtx, params, query, body, signal) => Promise<Result<unknown>>;
  example: { request?: unknown; response: unknown } }
```

**Resources and fields:**

| Resource | List filters | Create and update fields |
|---|---|---|
| deals | `pipelineId`, `stageId`, `status`, `ownerId`, `updated_since` | title, value, currency, pipelineId, stageId, personId, organizationId, ownerId, expectedCloseDate, status (won/lost through the won/lost services) |
| persons | `search`, `organizationId`, `updated_since` | name, emails, phones, organizationId, ownerId |
| organizations | `search`, `updated_since` | name, address, ownerId |
| activities | `dealId`, `personId`, `assigneeId`, `done`, `updated_since` | typeId, subject, dueAt, endAt, durationMinutes, assigneeId, dealId, personId, organizationId, note, done |
| notes | `dealId`, `personId`, `organizationId` | body, dealId, personId, organizationId |
| products | `active` | name, code, unit, price, currency, taxPercent, active |
| projects | `status`, `dealId` | create, update, and the nested tasks route `GET/POST /projects/:id/tasks`, `PATCH /projects/:id/tasks/:taskId` |

Map field names to the real service inputs and log the mapping.

**Handler** (`handler.ts`, used by `src/app/api/v1/[...path]/route.ts` for GET, POST, PATCH and DELETE):

1. `parseBearer` → hash → look up an active token (not revoked, not expired). Update `last_used_at` at most once a minute.
2. Hydrate the token's user as the actor. An inactive user is treated like a revoked token (`E_API_002`).
3. Check the scope (`write` needed for POST, PATCH and DELETE).
4. Rate limit with the existing `createRateLimiter`, keyed by token id, `API_RATE_PER_MINUTE`.
5. Match the registry route. Parse the query and body with the route's Zod schemas (body at most `API_BODY_MAX_BYTES`, JSON only).
6. Run the handler. Map `Result` errors to HTTP statuses: not found 404, permission 403, validation 422, conflict 409.

Additional rules:
- No CSRF check: these are bearer-token requests with no cookies. Reject requests that carry a session cookie but no bearer header with `E_API_001`, so the API is never cookie-authenticated.
- Responses carry `Cache-Control: no-store`.

**Tokens service** (`tokens.ts`):
- `listTokens(actor)`: own tokens; admins also see all, with the user.
- `createToken({ name, scope, expiresInDays?: 7 | 30 | 90 | 365 | null })` returns the plain token once.
- `revokeToken(id)`: the owner or an admin.

Tokens are managed in `/settings/api` (tab "Tokens"). The docs tab is `ApiDocs`.

**Docs** (`docs.ts`): `renderApiDocsMarkdown(registry)` builds `docs/API.md` (`pnpm api:docs` writes it; a unit test fails when the committed file is stale). The in-app `ApiDocs` component renders the same registry with these sections:
- authentication, scopes and errors;
- pagination;
- rate limits;
- one section per resource, with method, path, scope, query and body fields, and the example request and response;
- a curl example per section using `{BASE_URL}` and `dfk_...`.

### 6.8 Recycle bin, export, audit

**Recycle** (`recycle.ts`):
- `listDeleted({ entity?, search? })` covers the entities in section 4, deleted within `RECYCLE_RETENTION_DAYS`, ordered by `deleted_at` desc. Non-admins see items they own or deleted (use the change log actor where the table has no deleted-by column; log the rule). Each row shows entity, name, deleted at, deleted by, and days left.
- `restoreItem({ entity, id })`: `E_RECYCLE_002` when the parent (for example the deal of an activity) is still deleted. It restores through the path in section 3 and is recorded in the change log.

**Purge** (`purgeJob.ts`, daily `0 3 * * *` UTC):
- Hard-deletes items deleted more than 30 days ago in FK-safe order: activities and notes, then leads, deals, persons, organizations, projects.
- It skips a deal that `documents` reference (restrict), and any row whose delete hits an FK error. These are logged and kept, and returned in the job result.
- Integration tests prove the skip.

**Export** (`exports.ts`, route `GET /export/{entity}?{the list's filter params}&columns={comma list}`; session required):
- Requires `can(actor, "data.export")` (`E_EXPORT_001`).
- Reuses the list's own query and visibility (find each list's query function), with the same filter params the list page uses and the visible columns from the list's column state.
- Streams `csvStream`. Over `EXPORT_MAX_ROWS` gives `E_EXPORT_002` (check the count first).
- File name `{entity}-{YYYY-MM-DD}.csv`.
- Entities: `deals`, `persons`, `organizations`, `activities`, `products`, `invoices` (the documents list filtered to invoices).
- `ExportButton` sits in each list toolbar and is hidden without `data.export`.

**Audit log** (`auditLog.ts`, `/settings/audit-log`, admins only):
- Filters: actor `Select`, action `Select` (distinct actions), date range.
- Keyset pagination, 50 per page.
- Columns: time, actor, action, target, details (JSON in an expandable `pre`, with secrets never shown: the audit writer already redacts; check it and log).

### 6.9 Backups

**`backup.ts`** `runBackup({ trigger, startedBy? }, signal)`:

1. If `BACKUP_ENABLED` is false or `BACKUP_DIR` is not writable → `E_BACKUP_003`.
2. Insert a `backup_runs` row with status `running`. Make a temp work dir under `BACKUP_DIR/.tmp-{id}`.
3. Dump the database: spawn `PG_DUMP_PATH --format=custom --no-owner --no-privileges --file={work}/db.dump {DATABASE_URL}`, passing the password through `PGPASSWORD`, not argv. On a non-zero exit → `E_BACKUP_001` with step `pg_dump`.
4. Copy files: list every object in the storage bucket with the storage client and write each to `{work}/files/{key}`, streaming one at a time.
5. Write `manifest.json` (6.5), including the latest applied migration name.
6. Archive: spawn `tar -czf {BACKUP_DIR}/{fileName} -C {work} .`, then remove the work dir.
7. Set the run to `succeeded` with sizes, then prune with `filesToPrune(readdir, BACKUP_KEEP)`.
8. On failure: set the run to `failed` with `error_id` and a truncated detail, remove the work dir and any partial archive, and send an email to the admins via `getSystemMailer()`.

Spawned processes get the `AbortSignal`. Exactly one backup runs at a time (a `pg_try_advisory_lock`; a second call returns the running run).

**`backupJob.ts`:** schedule `0 2 * * *` UTC when `BACKUP_ENABLED`, and enqueue on "Back up now".

**`restore.ts` and `scripts/dealflow/backup-restore.ts`:** `pnpm backup:restore {file} --database-url {url} [--files] [--yes]`:

1. Extract to a temp dir and print the manifest.
2. Refuse without `--yes` (it prints what will happen).
3. Run `pg_restore --clean --if-exists --no-owner --no-privileges --dbname={url} db.dump`.
4. With `--files`, upload every file back to the bucket.
5. Print a summary.

**`BackupsSettings`** (`/settings/backups`, admins only):
- A status line: enabled, directory, keep N, next run.
- "Back up now".
- A runs table: time, trigger, status, size, files, file name, download.
- The download route streams the file (`Content-Disposition: attachment`), refusing names that fail the pattern (no path traversal).
- A "How to restore" panel with the exact CLI commands for Docker Compose, for example: `docker compose stop app worker ws` → `docker compose run --rm -v ...:/restore worker node dist/scripts/backup-restore.js /restore/{file} --database-url "$DATABASE_URL" --files --yes` → `docker compose start app worker ws`. Adjust to how scripts are packaged in the image and log it.

**Smoke:** extend `scripts/dealflow/smoke.mjs` so that, after its existing checks, it:
1. runs a backup inside the smoke worker container;
2. checks the archive exists and contains `db.dump` and `manifest.json`;
3. creates a scratch database `dealflow_restore_check` in the smoke Postgres, restores into it, and checks the `deals` row count matches the source;
4. drops the scratch database.

Everything stays inside the `dealflow-smoke` project.

### 6.10 UI

All UI uses shadcn wrappers only, and every client action passes the CSRF token.

**Navigation:**
- The main navigation gains "Projects" after "Insights".
- Settings gains "API", "Recycle bin", "Audit log" (admin) and "Backups" (admin).

**`/projects`:**
- A table: name, status `Badge`, linked deal, owner, progress (done/total, a progress bar from the existing `Progress` wrapper or a simple styled div), and due date.
- Filters: status, owner, search.
- A "New project" `Dialog`: name, link deal (combobox), owner, dates, and phases (editable list defaulting to the three defaults).

**`/projects/{id}` board:**
- A header with name (inline edit), status `Select`, owner, dates, linked deal link, and a `DropdownMenu` (Complete, Put on hold, Cancel, Delete).
- Phase columns (and a "No phase" column when tasks have none) with task cards: title, assignee avatar, due date, done checkbox.
- dnd-kit drag between and within columns, with an optimistic update and rollback (inline `role="alert"` on error, as in the forecast).
- "Add task" per column.
- `TaskDialog` for details (title, description, assignee, due date, phase, done, delete).
- Phases are managed from a "Phases" `Popover` (add, rename, reorder, delete).

**Deal page:**
- A "Projects" section (registered like Part 4's Documents section) listing linked projects.
- "Create project" appears when the deal is won.

**`/settings/api`:**
- `Tabs`: Tokens, Documentation.
- Tokens: a table (name, prefix, scope, created, last used, expires, revoke) and a "New token" `Dialog` (name, scope, expiry).
- After creating a token, a one-time panel shows the token with a copy button and the text "Copy this token now. You won't see it again."

**`/settings/recycle-bin`:**
- An entity filter `Select` and search.
- A table with restore buttons, a days-left `Badge`, and an explanation line: "Items are permanently deleted after 30 days."

**Lists:** each of the six lists gets an "Export CSV" button with the current filters and columns.

**`/settings/audit-log`** and **`/settings/backups`**: as in 6.8 and 6.9.

### 6.11 Demo seed

- Two projects: one linked to a won demo deal, with the three default phases and 6 tasks (2 done); one unlinked "Internal: website refresh".
- One read API token for the first admin, with name "Demo token" and the plain token never printed. The token is created with a random secret and only its hash is stored, so it is unusable. It exists only to show the table.
- No backup runs.

## 7. Conventions

The conventions from Parts 1 to 7 still apply, and CLAUDE.md is the authority. In addition:

- API handlers and exports reuse existing services and list queries; they never write tables directly.
- Tokens are compared by hash.
- Backups never put secrets in argv or logs.
- Write these tests first: token format, cursors, CSV, retention, project services and moves, the API auth, scope, rate and route matrix, restore rules, the purge skip, the export gate, and backup step failures.

## 8. Phases and tasks

### Phase 0: Start, schema and pure core

#### Task 0.1 - Start Part 8: progress files, kit and baseline

**Goal:** A Part 8 PROGRESS.md and a green baseline.

**Files:** create `PROGRESS.md`; rename `PROGRESS.md` → `PROGRESS-P7.md`; possibly root symlink `PLAN-PART8.md`, `scripts/check-progress.mjs`

**Steps:**
1. Check section 4's table and log each result as a Decision (follow the Docker recovery row if needed).
2. `git mv PROGRESS.md PROGRESS-P7.md`. Create PROGRESS.md in the section 0 format with every task unchecked:
   - record the Phase 0 base commit;
   - copy `PROGRESS-P7.md` → Environment;
   - carry over still-open owner actions.
3. If the kit is in a subfolder, add the root symlink plus the byte-identical checker copy.
4. Baseline: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`. Log `- Baseline: ...`.
5. Commit `0.1: Start Part 8: progress files, kit and baseline`, tick.

**Verify:** `pnpm check:progress` → OK

**Done when:** PROGRESS.md lists all tasks and the baseline line exists.

#### Task 0.2 - Schema, migrations, env and image

**Goal:** The tables of 6.4, the notification kind, the env keys, the backups volume and the Postgres client in the runtime image.

**Files:** create the three schema files and both migrations (+ meta); modify `src/db/schema/index.ts`, the notification types, maps, labels, defaults and their tests, `src/config/env.ts`, `.env.example`, `Dockerfile`, `docker-compose.yml`, the smoke compose overrides if any

**Steps:**
1. Write the schema exactly as 6.4 and generate both migrations (the second with `--custom`). Apply them to the dev database.
2. Add the env keys and constants. Install `postgresql16-client` (matching major) in the runtime stage. Add the `backups` volume to `worker` (read-write) and `app` (read-only).
3. Validate the compose files (`docker compose config --quiet` for the base and local overrides).
4. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the migrations are applied, compose validates and typecheck passes.

#### Task 0.3 - Pure core (test-first)

**Goal:** `tokenFormat.ts`, `cursor.ts`, `export/csv.ts`, `backups/retention.ts`, `backups/manifest.ts`, and the error IDs.

**Files:** create those files and their tests; modify the error registry and its test allow-list, Part 7's `insights/csv.ts` (delegate to `csvLine`), `src/constants/projectsApi.ts`, `src/constants/projectsApiStrings.ts`

**Steps:**
1. Write the tests first and see them fail. Cover:
   - token length, prefix and hash stability;
   - `parseBearer` accepting `bearer dfk_x` and rejecting `Basic`, a missing prefix and extra spaces;
   - cursor round trip and junk rejection;
   - CSV quoting, CRLF, BOM, the formula guard and null cells;
   - `filesToPrune` keeping the newest N and ignoring foreign names;
   - manifest shape.
2. Implement until green. Part 7's CSV tests must still pass.
3. Commit, tick.

**Verify:** `pnpm exec vitest run src/features/api src/features/export src/features/backups src/features/insights` → passes

**Done when:** all cases pass.

#### Task 0.4 - Phase 0 QA gate

**Goal:** Prove the schema and the pure core.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 1 base commit, commit `0.4: Phase 0 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes

**QA focus:** Definition of done items 1 and 2; the image change builds.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: Projects

#### Task 1.1 - Projects services, events and notifications (test-first)

**Goal:** `projects.ts`, `phases.ts`, `tasks.ts`, `visibility.ts`, the events, the reads and the actions.

**Files:** create those files plus `actions.ts`, `router.ts`, `projects.integration.test.ts`; modify `src/features/events/{types.ts,snapshot.ts}`, the automation trigger union and its test, the webhook event groups, the app router

**Steps:**
1. Write the cases first:
   - create with default phases;
   - move a task across phases and renumber positions;
   - delete a phase, after which its tasks have no phase;
   - complete sets `completed_at` and emits `project.status_changed`;
   - assigning a task to another user creates one notification, and self-assignment creates none;
   - a project linked to a private deal is invisible to a regular user who cannot see the deal;
   - a non-owner non-assignee gets `E_PROJECT_003`;
   - completing a task emits `project_task.completed`.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/projects src/features/events` → passes

**Done when:** every case passes.

#### Task 1.2 - From a won deal and the automation action

**Goal:** `fromDeal.ts`, the `create_project` action and its template.

**Files:** create `src/features/projects/fromDeal.ts`, `src/features/automations/actions/createProject.ts`; modify the automation definition schema and test, the action registry, `ActionList.tsx`, `templates.ts`, `projects.integration.test.ts`

**Steps:**
1. Add cases:
   - a won deal creates a linked project named after it;
   - an open deal is refused by the user path;
   - the template "Start a project when a deal is won" runs end to end and creates one project, and the loop guard stops a second run in the same chain.
2. Implement.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/projects src/features/automations` → passes

**Done when:** the cases pass.

#### Task 1.3 - Projects list and board

**Goal:** `/projects` and `/projects/{id}` (6.10).

**Files:** create `ProjectsList.tsx`, `ProjectBoard.tsx`, `PhaseColumn.tsx`, `TaskCard.tsx`, `TaskDialog.tsx`, `NewProjectDialog.tsx`, both route pages; modify the main navigation

**Steps:**
1. Build per 6.10 with the hooks, the drag with rollback, and CSRF tokens.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** both pages render, and tasks move and save.

#### Task 1.4 - Deal projects section

**Goal:** The Projects section and "Create project" on won deals.

**Files:** create `DealProjectsSection.tsx`; modify the deal section registry and the deal workspace read

**Steps:**
1. Register the section like the Documents section, and show the button only for won deals.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** a won deal shows the button and creates a project.

#### Task 1.5 - Phase 1 QA gate

**Goal:** Prove projects.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 2 base commit, commit `1.5: Phase 1 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/projects src/features/automations src/features/events src/features/notifications` → passes

**QA focus:** Definition of done item 3; visibility follows the deal.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: REST API

#### Task 2.1 - Tokens service and settings tab

**Goal:** `tokens.ts`, the token actions and reads, and the Tokens tab.

**Files:** create `src/features/api/tokens.ts`, `src/features/api/ui/{ApiTokensSettings,NewTokenDialog}.tsx`, `src/app/(app)/settings/api/page.tsx`; modify the settings navigation, the app router

**Steps:**
1. Implement the service (create returns the plain token once; list never returns the hash), the actions with CSRF, and the tab with the one-time panel.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** a token can be created, listed and revoked in the UI.

#### Task 2.2 - Registry, handler and resources (test-first)

**Goal:** `registry.ts`, `handler.ts`, the seven resources, and the catch-all route.

**Files:** create those files and `api.integration.test.ts`

**Steps:**
1. Write the cases first, calling the route handler with real Postgres (mock only the `@/db/client` binding, as Part 7 did):
   - no header → 401 `E_API_001`; a session cookie without a bearer header → 401;
   - revoked, expired, or belonging to an inactive user → 401 `E_API_002`;
   - a read token doing POST → 403 `E_API_003`;
   - the 121st call in a minute → 429 with `Retry-After`;
   - an unknown route → 404 and an unsupported method → 405;
   - an invalid body → 422 with issues;
   - deals: list paginates with `nextCursor`, `updated_since` filters, get, create (emits `deal.created`), patch stage, delete (soft);
   - a regular user's token cannot read a private deal of another owner (404);
   - persons and activities: list and create;
   - projects: create plus a nested task.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/api` → passes

**Done when:** every case passes.

#### Task 2.3 - API docs

**Goal:** `docs.ts`, the Documentation tab, `docs/API.md` and `pnpm api:docs`.

**Files:** create `src/features/api/docs.ts`, `src/features/api/ui/ApiDocs.tsx`, `scripts/dealflow/api-docs.ts`, `docs/API.md`; modify `package.json` (script `api:docs`), and the upstream docs link in the app (point it at `/settings/api?tab=docs`; log the file)

**Steps:**
1. Render the docs from the registry, generate `docs/API.md`, and add a unit test that regenerates in memory and compares it with the committed file.
2. Commit, tick.

**Verify:** `pnpm exec vitest run src/features/api` → passes

**Done when:** the docs render and the staleness test passes.

#### Task 2.4 - Phase 2 QA gate

**Goal:** Prove the API.

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
- `pnpm exec vitest run --project integration src/features/api src/features/projects src/features/events` → passes

**QA focus:** Definition of done items 4 and 5; there is no cookie-authenticated path; tokens never appear in logs or reads.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: Data safety and admin tools

#### Task 3.1 - Recycle bin service and purge (test-first)

**Goal:** `recycle.ts`, `restore.ts` and `purgeJob.ts`.

**Files:** create those files and `recycle.integration.test.ts`; modify the worker, `jobNames.ts`

**Steps:**
1. Write the cases first:
   - lists only items within 30 days;
   - a regular user sees their own items only;
   - restoring a deal clears `deleted_at` and writes a change log entry and an event;
   - restoring an activity whose deal is deleted gives `E_RECYCLE_002`;
   - the purge hard-deletes a 31-day-old person but keeps a 31-day-old deal that an issued invoice references, and returns it as skipped;
   - the purge ignores 29-day-old items.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/recycle` → passes

**Done when:** every case passes.

#### Task 3.2 - Recycle bin page

**Goal:** `/settings/recycle-bin` (6.10).

**Files:** create `src/features/recycle/ui/RecycleBin.tsx`, the route page; modify the settings navigation

**Steps:**
1. Build per 6.10 with CSRF.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** items list and restore.

#### Task 3.3 - CSV export everywhere (test-first)

**Goal:** `exports.ts`, the export route, and `ExportButton` on the six lists.

**Files:** create `src/features/export/{exports.ts,exports.integration.test.ts,ui/ExportButton.tsx}`, `src/app/(app)/export/[entity]/route.ts`; modify the six list toolbars

**Steps:**
1. Write the cases first:
   - without `data.export` → 403 `E_EXPORT_001`;
   - the deals export respects a filter and the chosen columns, and a regular user's export excludes a private deal;
   - a value starting with `=` is guarded;
   - over the row cap → `E_EXPORT_002` (set a tiny cap in the test).
2. Implement and wire the buttons.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/export` → passes

**Done when:** the cases pass and all six lists show the button.

#### Task 3.4 - Audit log page

**Goal:** `/settings/audit-log` (6.8).

**Files:** create `src/features/audit/{auditLog.ts,ui/AuditLog.tsx}`, the route page; modify the settings navigation and the app router

**Steps:**
1. Build the read (admin-only, keyset pagination) and the page. Confirm the redaction rule and log it.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** an admin sees events and a regular user is refused.

#### Task 3.5 - Backups (test-first)

**Goal:** `backup.ts`, `backupJob.ts`, `restore.ts`, the restore script and the download route.

**Files:** create those files, `backups.integration.test.ts`, `src/app/(app)/settings/backups/[file]/download/route.ts`; modify the worker, `jobNames.ts`, `package.json` (script `backup:restore`)

**Steps:**
1. Write the cases first. Give `runBackup` injectable runners (`spawn` for pg_dump and tar) and the storage client, so these run in the integration lane with `FakeStorageClient`:
   - a successful run writes a run row, calls pg_dump with the password in the env (never in argv), writes files and the manifest, archives and prunes to `BACKUP_KEEP`;
   - a pg_dump failure marks the run failed with step `pg_dump`, leaves no partial file, and emails admins (system mailer fake);
   - a second concurrent call returns the running run;
   - the download route refuses `../x` and non-matching names, and requires an admin.

   If `pg_dump` exists on the host, also run one real dump against the test database and `pg_restore --list` it.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/backups` → passes

**Done when:** every case passes.

#### Task 3.6 - Backups page, demo seed and docs

**Goal:** `/settings/backups`, 6.11, and the docs.

**Files:** create `src/features/backups/ui/BackupsSettings.tsx`, the route page; modify the settings navigation, the demo seed; create `docs/dealflow/PROJECTS.md`, `docs/dealflow/BACKUPS.md`; modify `docs/dealflow/AUTOMATIONS.md`, `WEBHOOKS.md`, `UPSTREAM.md`, `README.md`

**Steps:**
1. Build the page per 6.9.
2. Extend the seed per 6.11 and run `pnpm db:seed:demo` on the dev database.
3. Write the docs:
   - PROJECTS.md;
   - BACKUPS.md (what is included, schedule, retention, where files live, download, the exact restore procedure for Compose, and a warning to copy backups off the machine);
   - update the AUTOMATIONS and WEBHOOKS event lists and the new action;
   - list the upstream files in UPSTREAM.md;
   - add a README section linking API.md.
4. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the page renders, the seed ran and the docs exist.

#### Task 3.7 - Phase 3 QA gate

**Goal:** Prove the data-safety work.

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
- `pnpm exec vitest run --project integration src/features/recycle src/features/export src/features/backups src/features/audit src/features/api` → passes

**QA focus:** Definition of done items 6 to 9; there is no path traversal; secrets stay out of argv and logs; exports reuse the list visibility.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Hardening and hand-off

#### Task 4.1 - E2E projects and data spec and screenshots

**Goal:** `e2e/12-projects-data.spec.ts` and the 7 screenshots.

**Files:** create `e2e/12-projects-data.spec.ts`; modify `e2e/helpers.ts` only if a helper is missing

**Steps:**
1. Projects, as the admin (saved session):
   - mark a seeded open deal won, then click "Create project" on it;
   - open the project and drag a task from "Kickoff" to "Delivery", then reload and confirm it stays (`p8-project-board`);
   - open `/projects` (`p8-projects-list`).
2. API:
   - create a write token in Settings → API and copy it from `api-token-secret` (`p8-api-tokens`);
   - with Playwright's `request` and no cookies, `GET /api/v1/deals?limit=2` returns 200 with `data` and `nextCursor`, and `POST /api/v1/notes` with a deal id returns 201;
   - open the Documentation tab (`p8-api-docs`).
3. Recycle bin:
   - delete a person, open the recycle bin (`p8-recycle-bin`), restore the person, and expect the person page to load again.
4. Export:
   - on the deals list, export CSV and expect a download whose first line holds the visible column headers.
5. Audit log:
   - open the audit log and expect at least one row (`p8-audit-log`).
6. Backups:
   - open Backups (`p8-backups`). Click "Back up now" only if `pg_dump` is available to the e2e worker; otherwise just assert the page and the restore panel, and log which path ran (the smoke test proves the real backup).
7. Run the full `pnpm e2e` (specs `00` to `12`); fix until green.
8. Commit, tick.

**Verify:** `pnpm e2e` → passes; `ls e2e/screenshots/p8-*.png | wc -l` → `7`

**Done when:** e2e is green and 7 screenshots exist.

#### Task 4.2 - Integration suite and smoke with the backup round trip

**Goal:** The once-per-part full runs, including 6.9's smoke extension.

**Files:** modify `scripts/dealflow/smoke.mjs`, `PROGRESS.md`; any files the fixes need

**Steps:**
1. Extend the smoke per 6.9 (backup in the worker container, archive contents, restore into `dealflow_restore_check`, deals count match, drop).
2. Run `pnpm test:integration` (full). Fix failures caused by this part; pre-existing ones get `PRE-EXISTING:` Open issues.
3. Run `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke` → SMOKE PASS, including the backup round trip. No `dealflow-smoke` container or volume may be left.
4. Log both results as Decisions, commit, tick.

**Verify:** `pnpm test:integration` passes and the smoke prints SMOKE PASS with a "backup round trip ok" line (or SKIPPED with the reason from section 10)

**Done when:** both ran and are logged.

#### Task 4.3 - Independent review and hardening

**Goal:** One fresh-context review of Part 8, then fix what it finds.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is the full `.dsh/qa.md`, a blank line, then `Final review of PLAN-PART8.md. Base commit {Phase 0 base}.` Wait for `QA RESULT: PASS` or the numbered list. Fallbacks: `qa.sh` with the same request, then an evidenced self-review (log `qa unavailable (qa.sh failed) - self-review`).
2. Fix every blocker and major, and commit `4.3: QA fixes round {r}`. Re-run the gate commands of Task 3.7 and review again. At most 3 rounds. Minors: fix when cheap, else Open issues.
3. Log `- Independent review: subagent (fresh context) round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n}`.
4. Commit `4.3: Independent review and hardening`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`.

**Done when:** the review ran (or the logged fallback), and blockers and majors are fixed or logged with reasons.

#### Task 4.4 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order. Write one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `4.4: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least 17.

**Done when:** every checklist item has a line.

#### Task 4.5 - Final report and completion

**Goal:** Hand the owner a short, truthful report and finish.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report, kept short because the owner reads it on a phone. Do not repeat the Decisions list. Include:
   - **Definition of done:** items 1 to 10, one line each.
   - **Checklist:** from 4.4.
   - **Owner actions:** numbered, with exact commands, including:
     - the dev stack rebuild for migrations 0089 and 0090 and the new image;
     - copying backups off the machine;
     - creating an API token if you want one.
   - **Decisions worth reviewing:** only `CONTRACT CHANGE:` lines and changed tests.
   - **Open issues.**
   - **Notes for Part 9:** new routes and screenshots, the API registry, and the upstream files changed.
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `4.5: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`.

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- Part 9 items: palette commands, the shortcut help sheet, undo toasts, recurring activities, call logging, the duplicate finder, AI filters on people, organizations and leads, column pickers and bulk actions.
- OAuth apps for the REST API, per-resource token scopes, an OpenAPI file and webhook management over the API.
- Restoring from the browser, off-site backup uploads (S3 or SFTP targets) and encrypted backups.
- Project templates beyond the phase list, time tracking, Gantt views and task dependencies.
- Exports in formats other than CSV.

## 10. ASK and STOP triggers

This plan has no ASK triggers. The only STOP cases are the fatal ones in section 4.

| Situation | Safe default | Owner action to log |
|---|---|---|
| Docker stops responding after Task 0.1 | try `open -a Docker` and `pnpm dev:up` once; still down → record the step SKIPPED and finish the non-Docker tasks with `COMPLETE WITH OPEN ISSUES` | "Restart Docker Desktop, then run `pnpm test:integration`, `pnpm e2e`, `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke`" |
| Subagent tool unavailable | `qa.sh`, then the evidenced self-review | "Run the review yourself in a new harness session with `.dsh/qa.md` and the request from Task 4.3" |
| A pre-existing upstream test fails | leave it and log `PRE-EXISTING:` | "Review the pre-existing failures in PROGRESS.md" |
| `postgresql16-client` is not available for the runtime base | use the client package that matches the server major for that base, and log it | none |
| A list has no reusable query function for export | extract the list's query into a function that both the list and the export call, and record it in UPSTREAM.md | none |
| The Docker VM runs out of memory or disk during smoke | `COMPOSE_PARALLEL_LIMIT=1`; still failing → SKIPPED | "Give Docker Desktop more memory or disk and re-run the smoke" |
| Google env in `.env` still partial | keep the Environment prefixes | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty.
2. `pnpm install --frozen-lockfile` exits 0 and `package.json` gained no dependency (scripts may change).
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes (count ≥ the baseline).
6. `pnpm test:integration` passes (Task 4.2).
7. `pnpm build` exits 0 and lists `/projects`, `/projects/[id]`, `/api/v1/[...path]`, `/settings/api`, `/settings/recycle-bin`, `/settings/audit-log`, `/settings/backups`, `/export/[entity]`.
8. `pnpm e2e` passes for specs `00` to `12`.
9. 7 `e2e/screenshots/p8-*.png` exist, and the Part 1 to 7 screenshots are still present.
10. Smoke printed SMOKE PASS and "backup round trip ok", and left no `dealflow-smoke` container or volume.
11. `drizzle/0089_dealflow_projects_api.sql` creates exactly the 5 tables of 6.4.
12. `git grep -nE "token_hash|tokenHash" -- src/features/api/router.ts src/features/api/ui` prints nothing (no read returns the hash).
13. `git grep -nE "PGPASSWORD|password" -- src/features/backups` shows the password passed only through the child env, never in an argv array (cite the lines).
14. `pnpm api:docs && git diff --exit-code docs/API.md` exits 0 (the docs are current).
15. `git grep -n "dangerouslySetInnerHTML" -- src/features/projects src/features/api src/features/recycle src/features/backups` prints nothing.
16. No em dash in any file added or changed in this part (`git diff --name-only {Phase 0 base} | xargs perl -CSD -ne 'print "$ARGV\n" if /\x{2014}/' | sort -u` prints nothing, kit files excepted).
17. `docs/API.md`, `docs/dealflow/PROJECTS.md` and `docs/dealflow/BACKUPS.md` exist; `UPSTREAM.md` lists this part's upstream files.
18. `pnpm check:progress --final` passes.

## 12. Report back

There is no mid-run reporting. The run ends with the final report (Task 4.5). The owner pastes PROGRESS.md → Final report back to the planner; the Decisions list is not needed.

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

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md to PLAN-PART8.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

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
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; money is computed on integer minor units with no floats, converted totals never add unconverted amounts or drop deals silently (excluded deals are listed), the forecast reuses the deals visibility filter; document public routes take only the publicId and a validated body, never render HTML, issued documents are immutable; domain events are written inside the mutation's transaction, automation actions go through existing services and respect the loop guard, webhook delivery checks every resolved address inside the DNS lookup with no redirects, webhook secrets are encrypted and never returned after creation; public form and booking handlers write nothing on spam paths, bookings re-check the slot under a per-host lock in the same transaction, only `/f/*` and `/book/*` may be framed; reports apply the deals or activities visibility clause, never add values across currencies in SQL, send only aggregated rows to the AI; API calls authenticate only by hashed bearer token and run as the token's user through existing services, exports reuse list visibility, backups keep secrets out of argv and logs, and download routes refuse path traversal; no em dashes in new files.
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
# Usage: ./qa.sh "Final review of PLAN-PART8.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
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

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART8.md";
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
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART[1-8]\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
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
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART8.md (dealflow-wd-p8-v1) is finished.
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
PROMPT='Read PLAN-PART8.md in this folder in full and PROGRESS.md, then follow PLAN-PART8.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p8-v1; earlier parts are finished) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p8-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p8-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
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
- Otherwise you are the builder: read `PLAN-PART8.md` in full (Parts 1 to 7 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART8.md rule 18.
```
