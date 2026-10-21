# PROGRESS: dealflow-wd-p8-v1

STATUS: IN PROGRESS
Current: 4.2 · Last updated: 2026-10-21 16:12

## Phase base commits
- Phase 0: 908ed5b4df85ad41aa63f197171a74f0a87463df
- Phase 1: 51fad6304187d6be0b3acdb00376b735c4bb020b
- Phase 2: 06cbab182446003d05378bdb00ced999e9d06bb8
- Phase 3: 2fc2637a17976dad3989aadb3dcb7b8ed617fad1
- Phase 4: 5501c2abcc8dea197aa5bc9c9180718adc0bab0f

## Tasks
- [x] 0.1 Start Part 8: progress files, kit and baseline
- [x] 0.2 Schema, migrations, env and image
- [x] 0.3 Pure core (test-first)
- [x] 0.4 Phase 0 QA gate
- [x] 1.1 Projects services, events and notifications (test-first)
- [x] 1.2 From a won deal and the automation action
- [x] 1.3 Projects list and board
- [x] 1.4 Deal projects section
- [x] 1.5 Phase 1 QA gate
- [x] 2.1 Tokens service and settings tab
- [x] 2.2 Registry, handler and resources (test-first)
- [x] 2.3 API docs
- [x] 2.4 Phase 2 QA gate
- [x] 3.1 Recycle bin service and purge (test-first)
- [x] 3.2 Recycle bin page
- [x] 3.3 CSV export everywhere (test-first)
- [x] 3.4 Audit log page
- [x] 3.5 Backups (test-first)
- [x] 3.6 Backups page, demo seed and docs
- [x] 4.1 E2E projects and data spec and screenshots
- [ ] 4.2 Integration suite and smoke with the backup round trip
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (14 warnings) · build ok · unit 5237/5237 in 813 files
- Phase 0 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5261/5261 in 818 files · no named integration files in this gate · image client check: pg_dump 16.15 installs on node:22-alpine
- Phase 1 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5265/5265 in 819 files · projects/automations/events/notifications integration 94/94 (14 files)
- Phase 2 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5267/5267 in 820 files · api/projects/events integration 37/37 (3 files)
- Phase 3 gate: commands green · typecheck ok · lint ok (15 warnings) · build ok · unit 5267/5267 in 820 files · recycle/export/backups/audit/api integration 31/31 (4 files)

## Decisions
- 0.1: section 4 starting point matches: PROGRESS.md said `dealflow-wd-p7-v1` with `STATUS: COMPLETE`, so section 0 rule 1 starts this run fresh at Task 0.1.
- 0.1: Docker answers (`docker info` returns 24.0.5), so the fatal row does not apply. The owner's dev stack is left untouched; later checks bring up only what they need.
- 0.1: the kit arrived untracked as `dealflow-wd-part8-kit/` at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part8-kit` (matching the Part 2 to 7 layout), added the root `PLAN-PART8.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical; `PLAN_FILE` is now `PLAN-PART8.md`).
- 0.1: the last migration is `0088_dealflow_insights_notifications.sql`, so the next free numbers are 0089 and 0090 and Part 8 keeps the planned names `0089_dealflow_projects_api` and `0090_dealflow_projects_notifications`.
- 0.1: the audit table is `audit_events` in `src/db/schema/system.ts` with `id`, `actor_id`, `target_type` (`audit_target` enum), `target_id`, `action`, `before`, `after`, `correlation_id`, `created_at`; the audit page reads that table.
- 0.1: soft delete (`deleted_at`) exists on deals, persons, organizations, activities and leads, plus notes and goals. Section 6.8's entity list is therefore exactly the five task-relevant tables; the recycle bin uses that list.
- 0.1: the leads list exports through `src/features/leads/inbox/exportCsv.ts` (`leadRowsToCsv`, `escapeCsv` from `src/features/import/csvSafe.ts`) with `exportQuery.ts` decoding the list's filter params and `columns`; the new shared CSV writer follows that pattern.
- 0.1: MCP tools in `src/features/mcp/tools/` call domain services (`writes.ts`, `writes-deals.ts`, `writes-contacts.ts`, `writes-activities.ts`, `reads.ts`), so the API resources reuse the same service layer.
- 0.1: `Dockerfile` runtime stage is `base` = `node:22-alpine`, matching `docker-compose.yml`'s `postgres:16-alpine`, so Task 0.2 installs `postgresql16-client`.
- 0.1: `/tmp/dealflow-tools` still holds pnpm 9.15.9 and `/tmp/dealflow-pnpm-store` exists, so no reinstall is needed. The `subagent` tool is available for Task 4.3.

- 0.2: `drizzle-kit generate` wrote `0089_dealflow_projects_api.sql` with exactly the five tables from 6.4 (`projects`, `project_phases`, `project_tasks`, `api_tokens`, `backup_runs`); no unrelated table changed. It is applied to the dev database and the tables plus `project_task_assigned` were verified with `psql` there.
- 0.2: the notification kind is added by `0090_dealflow_projects_notifications.sql` (generated with `--custom`) and `drizzle/meta/0090_snapshot.json` was patched by hand to list all 19 enum values, so the next `db:generate` does not try to add a label that already exists (same fix as Part 7's 0088).
- 0.2: `trigger` on `backup_runs` is a reserved word in Postgres. Drizzle quotes every identifier, so the column is created and compared as `"trigger"`; no renaming was needed.
- 0.2: the runtime image installs `postgresql16-client` with `apk` to match `docker-compose.yml`'s `postgres:16-alpine` (the section 4 row).
- 0.2: the new `backups` volume is mounted read-write on `worker` and read-only on `app`; `docker compose config --quiet` passes for the base file and the local override.
- 0.2: `scripts/dealflow/smoke.mjs` now also removes `${PROJECT}_backups` in its cleanup, so the smoke project leaves no volume behind; the backup round trip itself lands in Task 4.2.
- 0.2: adding the enum value made two exhaustive `Record<NotificationType, ...>` maps fail typecheck, so `deepLink.ts` (fallback `/projects`) and `NotificationItem.tsx` (label from `taskTitle` or `projectName`) gained the type, with the feed and preference strings.

- 0.3: all five test files were written and run before their modules: they failed at import (5 files, no tests), then passed 36/36 after implementation. Cases cover token length, prefix and hash stability, bearer parsing, cursor round trip and junk, CSV quoting/CRLF/BOM/formula guard/null cells, retention pruning and manifest shape.
- 0.3: `csvLine` quotes only when RFC 4180 needs it (comma, quote, CR or LF), which changes Part 7's `toCsv` output from always-quoted to minimal quoting. The formula guard is unchanged and still runs before the quoting decision. Per rule 10 this shared-CSV change is deliberate, so `insights/csv.test.ts` was updated to the new contract (same cases and same coverage, no assertion dropped).
- 0.3: the streamed CSV starts with a UTF-8 BOM; the stream test decodes with `ignoreBOM: true` so it asserts the BOM instead of letting `TextDecoder` strip it.
- 0.3: a cursor is base64url JSON `{updatedAt,id}`; `decodeCursor` returns a `Result` and rejects non-JSON, non-objects, missing or non-string fields and an unparsable timestamp. The list query will compare `(updated_at, id) > (cursor)`.
- 0.3: `filesToPrune` sorts by the parsed UTC timestamp (not by input order) and ignores both foreign names and a matching name whose timestamp is impossible, so a prune can never delete a file this job did not write.
- 0.3: the manifest is `version: 1` with files sorted by key and a `fileCount`, so two runs over the same bucket produce identical bytes.
- 0.3: 16 error IDs (PROJECT, API, RECYCLE, EXPORT, BACKUP) are appended to the registry and the test allow-list; user copy lives in `src/constants/projectsApiStrings.ts`.

- 0.4: the first `pnpm lint` run found two real errors introduced by this part, both fixed in the gate: the CSV test's async generator had no await (`require-await`), so it now builds an async iterator explicitly, and `notifications/email/render.ts` had a non-exhaustive switch for the new kind, so `project_task_assigned` gained an email copy case. A third baseline failure (biome import order in `schema/index.ts` and formatting in `smoke.mjs`) was fixed with `biome check --write`.
- 0.4: the QA focus asks that the image change builds. In addition to the four gate commands, a throwaway `node:22-alpine` container installed `postgresql16-client` and reported `pg_dump (PostgreSQL) 16.15` and `pg_restore (PostgreSQL) 16.15`; the full multi-stage image build is covered by the smoke run in Task 4.2.
- 0.4: Phase 1's base is `51fad63` (the last task commit before this gate commit), the same convention Part 7 used for its phase bases.

- 1.1: the card was written before the services and the first run failed on the missing module, then one real bug surfaced: `moveTask` renumbered only the target column, so a cross-phase move left a gap in the source column. It now renumbers both, and the case asserts dense positions on each side.
- 1.1: project visibility compiles into a SQL `EXISTS` subquery that reuses `dealVisibilityClause` with its required `d`/`p` aliases, so a deal-linked project follows exactly the deal predicate (deleted and archived-pipeline deals included) and an unlinked project is visible to every signed-in user.
- 1.1: edit rights are owner, any task assignee, or admin. `loadEditableProject` checks visibility first, so an invisible project is `E_PROJECT_001` and a visible-but-unowned one is `E_PROJECT_003` (no existence leak).
- 1.1: every project mutation writes its domain event inside the mutation transaction (`project.created`, `project.status_changed`, `project.deleted`, `project_task.completed`); the task completion event carries `{field:"task", new: taskId}` so the dispatcher snapshot can add the task to the payload.
- 1.1: the snapshot builds `{ project: { id, name, status, dealId, ownerId, dueDate }, task?: { id, title, assigneeId } }`, and `loadEventTarget`/`resolveTarget` treat a project event's condition target as its linked deal; an unlinked project therefore skips a condition (the existing runner rule).
- 1.1: assignment notifications go through `createNotification` after the task commit and are best-effort (a failure is logged, never undoes the write). The project case was added to `canActorAccessParent`: unlinked projects require an active user, linked ones reuse the deal check, so an assignee who cannot see the deal gets no notification.
- 1.1: project events were added to `DOMAIN_EVENT_TYPES`, the automation trigger union, the webhook event groups (a "Projects" group with both `project.` and `project_task.` prefixes) and the notification deep link (`/projects/{id}`).

- 1.2: `createProjectFromDeal` goes through `loadEditableDeal`, so the deal must be visible and editable before a project can start; the user path refuses a non-won deal with `E_PROJECT_004` and `context.reason = "deal_not_won"`, while an automation passes `allowAnyStatus` (6.6).
- 1.2: the automation action `create_project` takes optional `phases` (1..10, each 1..80) and `nameTemplate`; the runner renders the template with the Part 4 variable vocabulary and falls back to the deal title when it is unset or renders empty. The handler returns the shared `E_AUTOMATION_ACTION_FAILED` on refusal, like the other actions.
- 1.2: the built-in template is "Start a project when a deal is won" (`deal.won` to `create_project`); the template-count assertion in the automations integration suite changed from 6 to 7 because the plan adds one template (no assertion weakened).
- 1.2: the loop-guard case registers a second automation on `project.created` that creates another project from the same deal, then drains the dispatcher; the number of projects stays within `AUTOMATION_MAX_DEPTH + 2` and does not grow on later dispatches, so the chain depth guard really terminates the loop.
- 1.2: `ActionList` gained the two fields (project name template and comma-separated phases), and the editor's default action uses the three default phase names.

- 1.3: the board's move rule is a pure `applyMove` helper (`ui/boardMove.ts`) with four unit cases (within-column reorder, cross-column renumber, no-phase column, clamped index). The board applies it optimistically, calls `moveTaskAction`, then replaces the local list with the server's full task list; a failed call restores the previous list and shows an inline `role="alert"`.
- 1.3: the drag uses dnd-kit's `PointerSensor` with an 8px activation distance (the deal board's rule), so a click still opens the task dialog. Cards are `useDraggable`, phase columns `useDroppable`, and the overlay renders a non-interactive `TaskCard`.
- 1.3: list filters (status, owner, search) live in the URL; the `/projects` page parses them once through the status schema and delegates to `listProjects`, so the table shows exactly the server's visibility-filtered set rather than filtering a full list in the browser.
- 1.3: every interactive surface is a design-system wrapper: Dialog (new project, task), Select (status, phase, filters), Combobox (deal, owner, assignee), DatePicker, Checkbox, Progress, Badge, DropdownMenu and the shared ConfirmDialog. Every mutation passes the CSRF token.
- 1.3: `PhasesPopover` and `boardMove.ts` are extra files beyond the plan's structure, split out to keep `ProjectBoard.tsx` within the file-size convention; the navigation gained "Projects" after "Insights" with a FolderKanban icon, and the number-key shortcuts follow `NAV_ITEMS` automatically.

- 1.4: the Projects section is registered in `DEAL_SIDEBAR_SECTION_IDS`/`DEAL_SIDEBAR_SECTIONS` like Documents, but it renders from data the server already loaded: `DealDetailView` adds `listProjects(db, actor, { dealId }, signal)` to its read and threads the rows through `DealWorkspaceClient` to the sidebar. That keeps the section free of a second client query and leaves every existing sidebar fixture working because the new prop defaults to an empty list.
- 1.4: "Create project" shows only when the deal is won and the actor can edit it; it calls `createProjectFromDealAction`, which reuses `createProjectFromDeal`, so the won-status and deal-visibility rules are the same as the service path (the button is UX only).
- 1.4: the section shows each linked project's name, status badge and done/total progress, and links to `/projects/{id}`; the empty state says "No projects linked yet."

- 1.5: the gate's first lint run found two React hook errors introduced by this part: `ProjectBoard` and `TaskDialog` synced props into state with `useEffect`. Both effects were removed: the board keeps local state seeded once (every server change is already applied locally by the action result), and the task dialog is mounted per task with a `key`, so its fields initialize from props without a cascading render.
- 1.5: the same run found one `no-unnecessary-condition` error in `projectsErrorMessage` (a typed index made `??` look impossible); the lookup is now typed `string | undefined`, so the fallback is honest.
- 1.5: Phase 2's base is `06cbab1` (the last task commit before this gate commit).

- 2.1: a token read never selects `token_hash`; `TokenView` carries only the 8-character display prefix, scope, dates and owner. The plain token exists only in the return value of `createToken`, shown once in the dialog.
- 2.1: revoking a token that is missing or belongs to someone else returns `E_API_002` (unknown), not a permission error, so a non-admin cannot probe other users' token ids. Admins may list and revoke any token, matching 6.7.
- 2.1: the expiry choices are the fixed 7/30/90/365 days or never, as the contract lists; the service converts the choice to an absolute `expires_at` at creation.
- 2.1: API lives in the settings nav's "My account" group because every signed-in user manages personal tokens; the page itself re-reads the session through `createContext` like the other settings pages.

- 2.2: the twelve cases were written first and failed for real reasons, which the fixes pinned: raw `db.execute` returns timestamptz as strings (the serializers accept either), and GET/PATCH/DELETE initially read a deal by id without the visibility predicate, so a private deal leaked to another user's token. Deal reads now join the same `dealVisibilityClause` the board uses.
- 2.2: field mapping to the real services: `value` decimal string to `Number` for createDeal/updateDeal, `organizationId` to `orgId`, `status` to markWon/markLost/reopenDeal, `stageId` to changeStage, `ownerId` to changeOwner, `currency` to setDealTerms; everyone else uses createPerson/updatePerson/createOrg/updateOrg/createActivity/updateActivity/createNote/updateNote/product services/createProject + task services. Person create uses the ContactActor shape (adds the user's primary visibility group) and person emails/phones string arrays become `{value,label,primary}` points.
- 2.2: list visibility: deals use the SQL predicate; persons and organizations page-scan with `canSee`; activities resolve each row through `resolveActivityVisibility`; notes check `canActorAccessParent`; products are shared. Each list is keyset-ordered by `(updated_at, id)` and advances `nextCursor` from the last returned row.
- 2.2: auth order is exactly 6.7: bearer parse (a session cookie alone is E_API_001), hash lookup with revoked/expired/inactive checks (E_API_002), scope (E_API_003), per-token limiter (E_API_004 with Retry-After), route match (404/405), then Zod query/body (E_API_006, body capped at 262144 bytes). `last_used_at` is written at most once a minute, and every response carries `Cache-Control: no-store`.
- 2.2: HTTP statuses map from explicit sets of error-ID values, because the ids are `E_X_00N` and a suffix check would never match; 404 for the domain not-founds, 403 for permission/scope, 422 for validation, 409 for CAS preconditions.
- 2.2: the integration suite calls `handleApiRequest` (the same function the catch-all route invokes) with real Postgres; only `@/db/client` is mocked, so no service or SQL is faked. The suite covers all twelve required cases including the 121st-call limit and the private-deal 404.

- 2.3: one registry feeds both surfaces: `buildApiDocSections(API_ROUTES)` turns each entry into serializable data (method, path, scope, summary, query/body field names, example, curl), `renderApiDocsMarkdown` writes docs/API.md, and `ApiDocs` renders the same sections in the Documentation tab. `pnpm api:docs` regenerates the file; `docs.test.ts` fails when it is stale and also checks every registered route appears once. Regenerating immediately after the test proves the file is current (`git diff --exit-code` clean).
- 2.3: the docs script imports the registry (so the docs describe the real routes), which transitively imports services that validate env at import time. It fills obviously fake placeholders only for keys the process has not set, and never reads `.env`, so `pnpm api:docs` works on a bare shell.
- 2.3: the plan asked to repoint "the upstream docs link in the app" at `/settings/api?tab=docs`. The only such link is the main navigation's Docs item, which points at the whole documentation site (`DOCS_SITE_URL`), not API docs; repointing it would remove every other doc topic from the app. Instead the API page carries the Documentation tab and the settings nav links to it, and the global Docs link is unchanged; logging the deviation here.

- 2.4: the gate's build caught a real client/server boundary bug: `ApiDocs` imported the prose and types from `docs.ts`, whose registry import pulled `pg` into the client bundle (Turbopack: cannot resolve dns/fs). The serializable shapes and prose moved to `docSections.ts`, which the client tab imports; `docs.ts` still builds the markdown and re-exports the types. Committed as `2.4: fixes round 1`, then all gate commands were re-run on that tree.
- 2.4: Phase 3's base is `2fc2637` (the last task commit before the gate's fix round).

- 3.1: the service and its seven integration cases landed in the same pass (the first run passed after the type fixes), so this task is not strictly test-first; the cases cover the window, owner/deleted-by visibility, entity and search filters, deal restore, the blocked activity parent, the permission refusal and the purge skip.
- 3.1: deleted-by comes from the latest `change_logs` row with `field = 'deleted'` for that entity, because none of the six tables carries a deleted_by column. A non-admin sees a row when they own it or that actor is them; admins see everything.
- 3.1: restore clears `deleted_at` and calls `recordChange` in one transaction, so the change log and the domain event are written together. `dealEventTypes` now treats `deleted: false` as `deal.updated` (a restore is not a deletion), and project restores emit no event; `ChangeLogEntityType` widens only the change-log argument type, leaving `ENTITY_TYPES` (timeline and comments) unchanged.
- 3.1: an activity is blocked with `E_RECYCLE_002` when its dominant parent (deal, then person, then organization) is still deleted, and the context names the parent and id.
- 3.1: the purge runs in FK-safe order (activities, notes, leads, deals, persons, organizations, projects), deletes row by row so one FK failure cannot abort the batch, keeps the row and reports `{ entity, id, reason }`; the pg-boss queue `recycle.purge` is scheduled at `0 3 * * *` UTC and registered in the worker.

- 3.2: the page is server-fronted (filters and search in the URL, `listDeleted` on the server) with one client table for restore; restore goes through a CSRF-guarded server action and refreshes. Entity, name, deleted-at, deleted-by and days-left columns, a destructive days-left badge under 3 days, and the "permanently deleted after 30 days" line.
- 3.2: Recycle bin sits in the settings nav's My account group because any user restores their own deletions; the service still hides everyone else's rows.

- 3.3: `exportTable` gates on `can(actor, "data.export")` (E_EXPORT_001), checks the count before loading (E_EXPORT_002 with an injectable cap for the test), selects the requested columns (unknown keys fall back to all) and returns header/rows/filename; the route streams them through `csvStream`, so the BOM, CRLF, quoting and formula guard are the shared writer's.
- 3.3: the seven cases pass: the gate, visibility (a regular exporter does not see another user's private deal while an admin does), the chosen column header, the cap, the formula-leading title, the route's attachment name and headers, and the 401 without a session.
- 3.3: deals reuse `listDeals` (so the pipeline filter and its visibility clause apply), people/organizations reuse `listPeople`/`listOrgs`, activities `listActivityRows`, products `listProducts`, and invoices a documents query joined to deals with the deal visibility clause. The export button is hidden server-side without the flag on all six lists; the deals one rides in the list toolbar via a new `exportSlot`, and the activities one sits above the client table (its filters live in client state, not the URL, so they are not carried; logged as a limitation).

- 3.4: the audit page is admin-only because the service refuses everyone else with E_PERM_DENIED (403), and the nav item only renders for admins. Filters are actor, action (the distinct actions from the table) and a date range; pagination is a keyset cursor on `(created_at, id)` descending, 50 per page.
- 3.4: the plan says the audit writer already redacts secrets. It does not: `recordAudit` stores the caller's before/after verbatim. The reader therefore redacts any key matching password/secret/token/hash/credential/api key (recursively, replacing with "[redacted]") before the page sees it, and the page states that secrets are redacted. Logged as the required check plus the defensive fix rather than trusting a writer that has no redaction.

- 3.5: `runBackup` takes injectable dump/archive runners and a storage client, so the suite proves the steps without pg_dump or MinIO. The default dump runner passes the database password only in `PGPASSWORD` (never argv) and the archive runner uses `tar -czf`.
- 3.5: the advisory lock is taken on a dedicated pool client (`pg_try_advisory_lock(hashtext('dealflow_backup'))`), so a second concurrent call gets the running run instead of starting a second dump; the lock is released in a finally and the client returned.
- 3.5: failures mark the run `failed` with `E_BACKUP_001` and a step detail, remove the temp work dir and any partial archive, and email active admins (best-effort). Successful runs record sizes/file count and prune only names matching the archive pattern.
- 3.5: the download route rejects any name that does not match the exact archive pattern before touching the filesystem, requires an admin, and streams the file with an attachment name.
- 3.5: `StorageClient` gained optional `listObjects` and `putObject` (real MinIO implementation plus the fake), because the mirror and its restore need them; optional keeps every existing narrow test fake compiling. `pnpm backup:restore` runs the CLI-only restore (extract, manifest, `pg_restore --clean --if-exists`, optional `--files` re-upload).
- 3.5: five integration cases pass: success with mirroring and pruning, pg_dump failure with no archive and an admin email, the concurrent second call, and the download route's admin/path checks.

- 3.6: the Backups page is a server component (admin gate, status line, last 50 runs) with one client component for "Back up now"; the action runs the same `runBackup`, so a manual run and the schedule share every step, lock and cleanup path. The download link points at the guarded route. The restore panel shows the exact Compose commands (stop app/worker/ws, `docker compose run` the restore script, start them again).
- 3.6: the demo seed gained `scripts/seed-demo-projects.ts`: the "Website relaunch" project linked to the first won demo deal with three phases and six tasks (two done), an unlinked "Internal: website refresh", and one read "Demo token" whose plain value is never printed. It reuses rows by name so a re-run never duplicates. `pnpm db:seed:demo` printed `demo_projects=2 demo_project_tasks=6 demo_api_tokens=1` on the dev database.
- 3.6: docs added: `docs/dealflow/PROJECTS.md`, `docs/dealflow/BACKUPS.md` (contents, schedule, retention, download, exact restore commands, and the warning to copy archives off the machine), the Part 8 sections in AUTOMATIONS.md and WEBHOOKS.md, the Part 8 upstream file list, and a README section linking docs/API.md.

- 3.7: the gate's lint pass fixed the Phase 3 code's own findings: process.env access moved behind the existing env boundary (a new `childProcessEnv` helper for the spawn environment), the backup run split its file mirroring into a helper to stay under the complexity cap, raw `throw new Error` in the download route became a 404 response, the export route's async generator without an await became an explicit iterator, and unused imports/assertions were removed.
- 3.7: Phase 4's base is the commit before this gate commit (`git rev-parse HEAD` at the time).

- 4.1: `e2e/12-projects-data.spec.ts` drives the real screens: reopens/wins the seeded deal, creates a project from the deal sidebar, adds a task, drags it from Kickoff to Delivery with the dnd-kit pointer gesture, reloads and confirms it stayed, then screenshots the board and `/projects`; creates a read-write token, reads it once, calls `GET /api/v1/deals?limit=2` and `POST /api/v1/notes` with Playwright's request API and no cookies, and opens the Documentation tab; deletes a person through the API, restores it in the recycle bin and reopens the person page; downloads the deals CSV and checks its header line; opens the audit log and the backups page.
- 4.1: three honest fixes during the runs: the "Won" step now waits for the header to swap to Reopen instead of navigating mid-request; the token dialog creates a write-scope token (the default read scope made POST /notes 403); the "Close" locator is scoped to the footer because the dialog also has an X. The person deletion uses the API rather than the contacts UI (logged as a deviation from the literal step list); the restore itself is the UI.
- 4.1: the full `pnpm e2e` is green, 22 tests (specs 00 to 12), and the 7 `p8-*` screenshots exist. Fixing it also surfaced one Part 7 e2e assertion that still expected the old always-quoted CSV header; it now expects the shared writer's minimal quoting.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on every command that loads `.env`.
- TODO(owner): rebuild the dev stack so it reads migrations 0089 and 0090 once they are applied: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2). Recreate it with `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` if `/tmp` was cleared.
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211. Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312), with `COMPOSE_PARALLEL_LIMIT=1`.
- Docker 24.0.5 is up; the dev stack provides Postgres on 5433 and MinIO on 9000/9001 (`pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left", log `TODO(owner): free Docker disk space` and mark the step SKIPPED.
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report
(written in Task 4.5)
