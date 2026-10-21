# PROGRESS: dealflow-wd-p9-v1

STATUS: IN PROGRESS
Current: 4.4 · Last updated: 2026-10-21 20:15

## Phase base commits
- Phase 0: 086de8ab14904cc0daee69b2d1fc4d03d48fd3c6
- Phase 1: fcd660bfaae40d7206ddafdb3f07b69b5ad078bd
- Phase 2: 05e0cb6
- Phase 3: 9d4c5146d5caf213f60698a92a33cde8ec11b19b
- Phase 4: 99b4a59e321c0f4b5f89e019d7bd9ab30a569d34

## Tasks
- [x] 0.1 Start Part 9: progress files, kit and baseline
- [x] 0.2 Prove Part 8
- [x] 0.3 Schema, migration and audit redaction
- [x] 0.4 Pure core (test-first)
- [x] 0.5 Phase 0 QA gate
- [x] 1.1 Recurrence service and the completion hook (test-first)
- [x] 1.2 Call logging (test-first)
- [x] 1.3 Recurrence field and calendar drag
- [x] 1.4 Activities list: columns, URL filters, bulk actions
- [x] 1.5 Phase 1 QA gate
- [x] 2.1 Duplicate finder (test-first)
- [x] 2.2 People and organizations bulk actions
- [x] 2.3 AI filters on people, organizations and leads
- [x] 2.4 Organization parent-loop guard
- [x] 2.5 Phase 2 QA gate
- [x] 3.1 Toaster and undo
- [x] 3.2 Palette commands
- [x] 3.3 Shortcut sequences and the help sheet
- [x] 3.4 Demo seed and docs
- [x] 3.5 Phase 3 QA gate
- [x] 4.1 E2E productivity spec and screenshots
- [x] 4.2 Integration suite and smoke
- [x] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (15 warnings) · build ok · unit 5269/5269 in 821 files
- Part 8 proof: integration 2046/2046 (405 files) · e2e 22/22 (specs 00 to 12) · smoke PASS · backup round trip ok (0 deals) · no dealflow-smoke container or volume left
- Phase 0 gate: commands green · typecheck ok · lint ok (15 warnings) · build ok · unit 5308/5308 in 827 files · no named integration files in this gate (DoD 1 to 4)
- Phase 1 gate: commands green · typecheck ok · lint ok (15 warnings) · build ok · unit 5313/5313 in 828 files · activities/export/events integration 140/140 (35 files)
- Phase 2 gate: commands green · typecheck ok · lint ok (15 warnings) · build ok · unit 5318/5318 in 828 files · duplicates/contacts/ai/leads integration 264/264 (51 files)
- Phase 3 gate: commands green · typecheck ok · lint ok (15 warnings) · build ok · unit 5320/5320 in 828 files · activities/duplicates/contacts/deals integration 395/395 (96 files)
- Independent review: subagent (fresh context) round 1: QA RESULT FAIL · 3 blockers/3 majors/9 minors · fixed all 3 blockers, all 3 majors and minors 7, 8, 9, 10, 11 and 13; minors 12 and 14 are Open issues, 15 corrected here.
- Post-review verification: typecheck ok · lint ok (15 warnings) · build ok · unit 5320/5320 in 828 files · integration 2077/2077 (410 files) · e2e 23/23 (specs 00 to 13)

## Decisions
- 0.1: section 4 starting point matches: PROGRESS.md said `dealflow-wd-p8-v1` with `STATUS: COMPLETE WITH OPEN ISSUES`, so section 0 rule 1 starts this run fresh at Task 0.1.
- 0.1: the first Docker-disk check failed section 4's fatal row (254.9 MB free of 58.4 GB), so the run started with `STATUS: BLOCKED` and only the progress-file work was committed. The owner raised the Docker Desktop disk limit; the re-check at 17:24 reports 35.0 GB free of 95.0 GB (61% used) and `docker info` answers with 24.0.5, so the fatal row is cleared and the run resumes at Task 0.1.
- 0.1: the kit arrived untracked as `dealflow-wd-part9-kit/` at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part9-kit` (the Part 2 to 8 layout), added the root `PLAN-PART9.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical, `PLAN_FILE` now `PLAN-PART9.md`).
- 0.1: the last migration is `0090_dealflow_projects_notifications.sql`, so 0091 is the next free number and the planned `0091_dealflow_activity_extras` name holds.
- 0.1: the calendar does not support drag to reschedule: `src/app/(app)/activities/calendar/` (`WeekAgendaGrid.tsx`, `MonthView.tsx`, `CalendarClient.tsx`) has no dnd-kit, draggable or drop handlers, so Task 1.3 adds it per 6.6.
- 0.1: organizations have no parent column. Org-to-org links are `organization_relations` (`source_org_id`, `target_org_id`, free-text `relation_type`) in `src/db/schema/organizationRelations.ts`, written by `src/features/contacts/orgRelations.ts`; self-relation is refused (app check plus DB check) but there is no ancestor/cycle guard, so Task 2.4 adds the recursive CTE guard and `E_ORGREL_001`.
- 0.1: the palette is `src/features/search/ui/CommandPalette.tsx` (installed `cmdk`, opened by `useSearchHotkey.ts` and the `warpdrive:open-search` event in `events.ts`); the shortcut registry is `src/features/shortcuts/` (`GlobalShortcuts.tsx`, `navShortcut.ts`, `shortcutTarget.ts`). Tasks 3.2 and 3.3 extend those files.
- 0.1: merge has no route: `src/features/contacts/MergeDialog.tsx` handles one current record plus a candidate on the detail page, `BulkMergeDialog.tsx` handles two selected records, and `merge.ts` is the service behind the list merge actions. The duplicate finder (Task 2.1) opens `BulkMergeDialog` with both ids preselected.
- 0.1: Part 1's deal AI filter is `src/features/ai/aiFilter.ts` (schema, `describeFilter`) behind `src/features/ai/actions/filterActions.ts` (CSRF, rate limit via `checkAiRateLimit`), so Task 2.3 generalises it by target and keeps the action's checks.
- 0.1: `/tmp/dealflow-tools` holds pnpm 9.15.9 and `/tmp/dealflow-pnpm-store` exists, so no reinstall is needed; the `subagent` tool is available for Task 4.3.
- 0.2: the full integration suite (405 files, 2046 tests) and e2e (22/22, specs 00 to 12) were green on the current tree with no code change; the dev database was up to date (`pnpm db:migrate:dev` printed "migrations applied", 91 migration rows).
- 0.2: the first real smoke run caught a Part 8 restore bug the disk block hid: `restoreBackup` called `pg_restore` without `--dbname`, so pg_restore wrote SQL to stdout instead of connecting (`PGDATABASE` only supplies connection defaults). It now passes `--dbname` with the database name (never the URL) so the password stays in the child env, and the smoke's `run()` appends captured stdout/stderr when a captured step fails, which is how the failure was diagnosed. The round trip compares 0 deals because the smoke seed creates only an admin.
- 0.3: `drizzle/0091_dealflow_activity_extras.sql` creates exactly `activity_recurrence`, `activity_calls` and `duplicate_dismissals` (no other table changed) and is applied to the dev database (92 migration rows). Redaction moved to `src/features/audit/redact.ts`: `recordAudit` runs `redactRecord` before insert and `listAuditEvents` still runs `redact`, so both the writer and rows from older writers are covered; the new integration case stores `password` and a nested `apiKey` as `[redacted]`.
- 4.2: the full integration suite is green on the final tree (410 files, 2077 tests) and `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke` printed SMOKE PASS with "backup round trip ok (0 deals)"; no `dealflow-smoke` container or volume remains. The round trip still compares 0 deals because the smoke seed creates only an admin.
- 4.1: `e2e/13-productivity.spec.ts` drives the seven surfaces and writes the seven `p9-*` screenshots; the full suite is 23/23 (specs 00 to 13) in 1.6 min. The run fixed three real bugs: a zero-length call produced `durationMinutes: 0` which the activity schema rejects (now null), a cleared date range was indistinguishable from an absent one so a remount re-applied today (now serialized as `from=none`/`to=none`, which the export ignores), and the contacts pages called `buttonVariants` (a client export) from a server component (now the client `LinkButton`). The spec waits for the undo write before reloading and blurs the palette input before the g/j sequence; the Part 6 booking spec clears the date filter before looking for a future booking.
- 3.4: `scripts/seed-demo-productivity.ts` adds a weekly series (Mon and Thu) due next Monday, a monthly series anchored on the 31st, three logged calls (Connected, No answer, Left voicemail), a same-email-different-case person pair, a same-name-same-organization pair and the "Acme Ltd"/"ACME Limited" organization pair; a re-run reuses rows by subject or name. `pnpm db:seed:demo` against the dev database printed `demo_recurring=2 demo_calls=3 demo_duplicate_pairs=3`. `docs/dealflow/PRODUCTIVITY.md` documents recurrence, calls, the calendar, the activities list, duplicates, bulk actions, AI filters, undo, the palette and every shortcut; `UPSTREAM.md` gained the Part 9 file list and `README.md` the productivity section.
- 3.3: one registry (`shortcuts/registry.ts`) feeds both the matcher and `ShortcutHelp`; the g/n sequences use `createSequenceMatcher` (1200 ms, modifiers reset), the number-row nav is unchanged, and `?` (or the palette's "Keyboard shortcuts" action) opens a Dialog grouped Navigation, Create, Lists and Palette. Sequences and `?` are ignored inside text inputs and while an overlay is open, and the help sheet is generated from the same registry so a shortcut cannot be undocumented.
- 3.2: the registry in `commandRegistry.ts` has Create, Go to and Actions commands; `visibleCommands` filters them by the actor's flags (admin commands hidden from a regular user), and `CommandPalette` renders the groups above record search with `palette-command`/`data-command-id`, taking the actor from the app layout. The existing palette is a custom dialog rather than cmdk (code is the source of truth), so the groups render in that list; they are click-driven so Enter keeps selecting records. Create commands navigate to the page that owns the dialog, and there is no theme-toggle event to wire, so "Toggle theme" is omitted.
- 3.1: the toaster is one region mounted in the app layout; toasts pause on hover/focus, dismiss on Escape or the X, and an error tone announces assertively. `pushStageUndo` reverses a board move through `moveDealAction` with the updatedAt the forward move returned (a stale one shows "Couldn't undo: the deal changed since"); `pushDeleteUndo` restores through `restoreItemAction` for deal, person, organization and activity, including the activity and contact bulk deletes. The forecast and project-board inline alerts became error toasts; the remaining in-dialog field alerts in the projects dialogs stay as inline validation copy (checklist item 13 explains them). Two real-Postgres cases prove the move-back and the stale-CAS refusal, and the toast store keeps the tone. The board pushes the toast from `useDealMove` with the stage name from `Board`.
- 2.4: organizations have no parent column, so the guard sits in `addOrgRelation` for a `parent`/`parents` relation type (case-insensitive). A recursive CTE follows target-side parent links from the proposed parent up to 50 levels and returns `E_ORGREL_001` when the child is among the ancestors; self-parenting keeps the earlier `CONTACT_RELATION_SELF` refusal. Three real-Postgres cases pass (loop refused, legal re-parent, self refused). The plan's A-to-B-to-C wording is implemented with target-is-parent direction (the label on A names A's parent), so the loop case makes A the parent of C.
- 2.3: Part 1's filter flow was already target-generic (`aiFilterInputSchema` takes deal, person, organization and lead and validates with that target's saved-filter schema), so this task covered the fake, the module path and the inputs. `fakeProvider` returns a valid definition per target (people by name, organizations by name, leads by title, deals by value); `src/features/ai/filters/{aiFilter,prompts}.ts` re-export the Part 1 implementation at the documented path. The people list, the organizations toolbar and the leads filter controls mount `AiFilterBox`, and each parses the returned definition with `savedFilterDefinitionSchema` for its target before applying it. Unit tests prove every target's fake passes its schema and that a person definition using the deal-only `value` field is rejected with `E_AI_005`. (The review found the organizations and leads inputs were missing from round 1; they were added in 4.3.)
- 2.2: People and organizations gained bulk change owner alongside the existing bulk delete. Both lists call one `bulkContactAction` that loops `updatePerson`/`updateOrg` or `deletePerson`/`deleteOrg`, so every row keeps its own permission check, and a partial batch returns `E_BULK_002` with the failed ids and the applied count; more than `BULK_MAX` ids is `E_BULK_001` before any write. The three real-Postgres cases pass (owner partial with two applied, delete then restore through `restoreItem`, over-limit). The per-row delete buttons were left as they were.
- 2.1: the finder fetches at most 5000 non-deleted candidates per entity, applies `canSee` in memory, and groups them by normalised keys: people by primary email, phone key and name plus orgId (name_org), organizations by normalised name and domain. Dismissals are stored with sorted ids and filtered before paging (`DUPLICATE_PAGE_SIZE`), pairs sort by reason strength then name, and the page has People/Organizations tabs, side-by-side cards, reason badges, Merge through `BulkMergeDialog` and "Not duplicates". The page is linked from both list headers. The eight real-Postgres cases pass.
- 1.4: the activities filters now live in the URL (`ownerId`, `done`, `from`, `to`, `typeKey`) while the hook keeps an in-memory copy so the toolbar re-renders at once; a bare URL is normalised once to the visible defaults so the export link carries them. Bulk mark done, reschedule, change owner and delete go through one `bulkActivityAction` that loops the existing services, returns `E_BULK_002` with the failed ids on a partial batch and `E_BULK_001` above `BULK_MAX`; the bar exposes the four contract testids (the delete undo toast waits for the toaster in 3.1). The column picker reuses the deals `useColumns` model and the new `activitiesView` user preference, and the row/head render from the visible order. Adding the export case exposed a Part 8 bug: the `by()` helper in exports.ts returned the original rows for an absent param, so each later filter discarded the earlier ones; it now accumulates, and the activities export understands the list's URL keys.
- 1.3: RecurrenceField sits in both activity dialogs (Add for create, Edit prefilled through getForEdit/toEditableActivity) with weekly day toggles, end date or count, and the describeRule preview; ActivityRow and ActivityCard render RecurrenceBadge. Calendar drag uses dnd-kit PointerSensor (8px): week chips drop on hour lanes (day and hour), month chips on day cells (day only, time kept), and an all-day item stays on the day. The activity update schema has no expectedUpdatedAt CAS field, so a drop calls editActivityAction and refetches on success; a refused write shows an inline alert (toast wiring lands in 3.1). The drag listeners sit on the existing timed-block wrapper so the grid DOM and its pixel assertions are unchanged.
- 1.2: the call type is the first active type whose key or name matches "call" (the seeded `call` type); `logCall` validates with a strict Zod schema, then calls `createActivity` with done, the "Outbound call: No answer" subject, `ceil(seconds/60)` minutes and an optional fifth `CallMeta` argument that inserts the `activity_calls` row in the same transaction. Four real-Postgres cases pass (activity plus row, `E_CALL_001`, the timeline outcome, an invisible deal refused). The form is a Dialog with RadioGroup chips, direction, minutes and seconds, a note and the `E_CALL_001` settings link; the trigger sits in SharedComposeBar for deal, person and org scopes. `calendarRange` and `listActivitiesForEntity` left-join `activity_calls`, and ActivityCard renders `CallOutcomeChip`.
- 1.1: all eight recurrence cases (weekly copy, assignee time zone, concurrent double-complete, count end, ending the series, editing occurrence 2, deleted occurrence, activity.created) were written first and pass on real Postgres. The hook runs inside completeActivity's transaction; the false-to-true claim is a conditional UPDATE (`WHERE done = false`), so two concurrent completes create one next occurrence. `setRecurrence` starts a series with a random `series_id` and the activity's local anchor day; null marks the row ended. The next activity copies type, subject, links, owner, assignee, duration, all-day, note, location and custom fields, shifts `end_at` by the same delta, and emits `activity.created` with the same `emitDomainEvent` insert the create service uses (no nested transaction).
- 0.4: the six test files were written and run before their modules: the first run failed at import in all six, then the implemented modules passed 39 new cases (90/90 in those folders with the existing shortcut tests). `rule.ts` validates the 6.5 shape (interval 1..99, count 2..500, weekdays weekly-only and unique); `nextOccurrence` keeps the local wall clock through `zonedToUtc`/`utcToZoned`, clamps monthly and yearly with `anchorDay` (Jan 31 to Feb 28 to Mar 31, Feb 29 2028 to Feb 28 2029) and keeps 09:00 London across the 2026-03-29 DST change; `normalize.ts` folds NFKD diacritics and trailing legal suffixes; `toastStore` caps at 3, runs an action once and pauses/resumes with the remaining time; `visibleCommands` filters on the admin type or a `PermissionFlagKey`; `createSequenceMatcher` resets on a modifier and times out at 1200 ms. The eight new error IDs (RECUR, CALL, DUP, BULK, ORGREL) are appended with those domains in the test allow-list. `Result` takes two type arguments, so `ToastAction.run` is `Promise<Result<unknown, unknown>>`.

- 4.3: review round 1 blockers fixed: the organizations toolbar and the leads filter controls now mount `AiFilterBox` (the plan's three lists); `ActivityEditModal.save` treats a recurrence-only change as a change and calls `setRecurrenceAction` (the early return no longer drops it); and `pushDeleteUndo` moved from save to the real Delete path, so an edit no longer claims a delete. Majors: the deal-header stage control pushes the same "Moved to" undo toast as the board, the palette gained the five deal commands (Mark won/lost through the existing close actions, Log call through a `warpdrive:open-log-call` event the composer bar handles, quote/project navigation, project only on a won deal), and "Audit log" points at `/settings/audit-log`. Minors fixed: duplicates take a page offset, the AI filter facade modules exist at the documented path, the org loop CTE follows both "parent" and "parents", contact bulk delete goes through `bulkContactAction` with E_BULK_002/E_BULK_001, bulk reschedule keeps the local time in the assignee's zone, and calendar drag failures use an error toast. Not fixed (Open issues): activities search/assignee URL filters (listRows has no search; ownerId already filters the assignee) and the n-sequences navigating to the list that owns the create dialog instead of opening it.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; commands that load `.env` carry `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` until then.
- TODO(owner): rebuild the dev stack so its app image reads migrations 0089, 0090 and 0091: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.

## Open issues
- The activities URL filter covers owner (the assignee), done, type, from and to, but not free-text search; the list query has no search parameter. The plan's 6.6 lists search, so this is recorded for Part 10 (a list search would be a read change).
- The n-prefixed shortcut sequences navigate to the list page that owns the create dialog rather than opening the dialog from anywhere; the palette's Create commands behave the same way. Opening a dialog globally would need a create-dialog provider.
- The five remaining `role="alert"` hits in `src/features/projects` are in-dialog field validation (TaskDialog, PhasesPopover, NewProjectDialog, DealProjectsSection); the Part 8 board alert that Task 3.1 names was replaced by an error toast.
- The smoke round trip compares 0 deals because the smoke seed creates only an admin; the dump/archive/restore/count/drop path is exercised.
- The Docker-disk blocker was cleared by the owner before the Task 0.1 baseline (35.0 GB free of 95.0 GB).

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2). Recreate it with `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` if `/tmp` was cleared.
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211. Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312), with `COMPOSE_PARALLEL_LIMIT=1`.
- Docker 24.0.5 is up with 35.0 GB free in the VM (95.0 GB total) as of 2026-10-21 17:24; the dev stack provides Postgres on 5433 and MinIO on 9000/9001 (`pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left" after Task 0.1, record the step SKIPPED and end `COMPLETE WITH OPEN ISSUES` (section 10).
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report

### Checklist
1. PASS - `git status --porcelain` was empty after the 4.3 commit.
2. PASS - `pnpm install --frozen-lockfile` exit 0; `package.json`/`pnpm-lock.yaml` unchanged since the Phase 0 base.
3. PASS - `pnpm typecheck` exit 0.
4. PASS - `pnpm lint` exit 0 (15 pre-existing warnings).
5. PASS - `pnpm test:unit` 5320/5320 in 828 files, above the 5269 baseline.
6. PASS - `pnpm test:integration` 2077/2077 in 410 files on the final tree.
7. PASS - `pnpm build` exit 0 and the build lists `/contacts/duplicates`.
8. PASS - `pnpm e2e` 23/23 (specs 00 to 13).
9. PASS - 77 screenshots in `e2e/screenshots`, 7 of them `p9-*`.
10. PASS - smoke printed `SMOKE PASS` and `backup round trip ok (0 deals)`, with no leftover compose resources.
11. PASS - `drizzle/0091_dealflow_activity_extras.sql` creates exactly the three tables of 6.4.
12. PASS - PROGRESS.md QA log has the `Part 8 proof` line.
13. PASS - no `role="alert"` under `src/features/forecast`; the four remaining under `src/features/projects` are in-dialog field validation (DealProjectsSection, NewProjectDialog, PhasesPopover, TaskDialog), not the board alert Task 3.1 replaced.
14. PASS - no `dangerouslySetInnerHTML` under `src/features/duplicates`, `src/features/feedback` or `src/components/ui/toaster.tsx`.
15. PASS - no em dash in any file changed since the Phase 0 base.
16. PASS - `docs/dealflow/PRODUCTIVITY.md` exists and `docs/dealflow/UPSTREAM.md` has the Part 9 section.
17. PASS - `pnpm check:progress --final` passes (Task 4.5).
