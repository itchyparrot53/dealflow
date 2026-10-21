# PLAN: Dealflow on warpdrive, Part 9: Productivity parity

> Plan ID: dealflow-wd-p9-v1 · Written: 2026-10-21 · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 4, fast verification profile, no human in the loop · Type: change to existing project

Parts 1 to 8 are finished in code (`PROGRESS-P1.md` to `PROGRESS-P7.md`, and `PROGRESS.md` until Task 0.1 renames it to `PROGRESS-P8.md`). Part 8 ended `COMPLETE WITH OPEN ISSUES`: the Docker VM ran out of disk, so its smoke run (with the backup round trip) never passed and the full integration and e2e suites were not re-run after its review fixes. Task 0.2 proves them before any new work. Part 8 left 5,269 unit tests passing. Part 9 closes the remaining parity items from the roadmap's old Part 8. This plan is compact: where it says "find" or "reuse", locate the existing code, reuse it, and log the file you used as a Decision.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 4** in fresh-context sessions, one phase per session. Parts 1 to 8 (`PLAN-PART1.md` to `PLAN-PART8.md`) are finished; their code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART9.md` in full and PROGRESS.md (open earlier `PLAN-PART{N}.md` files only where this plan points to them). If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p9-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 8's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 4.5, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 4.2.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.5, 1.5, 2.5, 3.5):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). The one independent review is Task 4.3.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (the activity completion hook for recurrence, inline alerts replaced by toasts, the audit writer's redaction), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs only. This part needs no external service; e2e uses the fake mail transport; AI calls in tests use `AI_FAKE` or the scripted provider.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove or recreate the owner's running Compose project `warpdrive-main`, never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack 3001/5433/8080/9000/9001 (owner's). Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `PLAN-PART3.md`, `PLAN-PART4.md`, `PLAN-PART5.md`, `PLAN-PART6.md`, `PLAN-PART7.md`, `PLAN-PART8.md`, `PLAN-PART9.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 8's file to `PROGRESS-P8.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p9-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 9: progress files, kit and baseline
(every task through 4.5, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 4990/4990 · activities 20/20

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

First prove Part 8: its smoke run with the backup round trip, and its final-tree integration and e2e runs, were blocked by a full Docker disk. Then close the remaining parity gaps:
- recurring activities;
- call logging with outcomes;
- calendar drag to reschedule;
- an activities list with column picker, URL filters and bulk actions;
- a duplicate finder for people and organizations that feeds the existing merge;
- bulk actions on people and organizations;
- AI filters on people, organizations and leads;
- an organization parent-loop guard;
- undo toasts for stage moves and deletes;
- command palette commands;
- `g`/`n` shortcut sequences with a `?` help sheet.

## 2. Definition of done

1. Part 8 is proven on the final tree: the full integration suite, e2e specs `00` to `12`, and smoke with "backup round trip ok" all pass, with fixes committed.
2. Migration `0091_dealflow_activity_extras` adds the three tables of 6.4 and nothing else.
3. The audit writer redacts secret-looking keys before storing; the reader-side filter from Part 8 stays.
4. Recurrence rules, the next-occurrence calculation, duplicate normalisation, the command registry filter, the shortcut sequence parser and the toast store are pure, unit-tested functions.
5. Recurring activities: an activity can repeat daily, weekly (with weekdays), monthly or yearly, with an interval and an optional end (date or count). Completing one creates exactly the next occurrence (once, even under double-complete). Editing or ending the series affects future occurrences only.
6. Call logging: "Log call" on deals and people records a done call activity with outcome, direction, duration and notes; outcomes show as chips on the timeline.
7. The calendar supports drag to reschedule (verified or added). The activities list has a column picker, URL-backed filters (so its CSV export carries them), and bulk mark done, reschedule, change owner and delete.
8. The duplicate finder lists likely duplicate people (email, phone, or name plus organization) and organizations (name or domain). It opens warpdrive's merge for a pair, and "Not duplicates" hides a pair for good.
9. People and organizations have bulk change owner and bulk delete. AI filters work on people, organizations and leads through the Part 1 AI layer. An organization cannot become its own ancestor.
10. Undo toasts:
    - A stage move or a delete (deal, person, organization, activity) shows a toast with "Undo" for 8 seconds.
    - Undo reverses the change through the existing services.
    - A toast region (`aria-live`) replaces the ad-hoc inline alerts where Part 3 and Part 8 noted none existed.
11. The command palette gains Create, Go to and Action commands, filtered by permission. `g`/`n` sequences work, and `?` opens a help sheet listing every shortcut.
12. typecheck, lint, build, unit and the full integration suite pass. e2e specs `00` to `13` pass and the 7 `p9-*` screenshots exist. Smoke passes. One independent review ran.

## 3. Decisions already made

- Stack unchanged, no new dependency.
  - The toast is our own small component: a Zustand store plus a fixed `role="status"` `aria-live="polite"` region, in `src/components/ui/toaster.tsx`. It is not a hand-rolled menu or dialog, so the shadcn rule is respected. Escape dismisses the focused toast, and hover or focus pauses the timer.
  - The palette keeps the installed `cmdk`.
- Recurrence lives in a side table keyed by activity, so `activities` is untouched.
  - Each occurrence is a normal activity. A series shares a `series_id`.
  - The next occurrence is created on completion only, never in advance.
  - Dates are computed in the assignee's time zone (`user_preferences.timezone`, else `UTC`), keeping the local time of day.
  - Monthly rules anchor to the series' original day of month, clamped to the month's length (31st → 28th/29th/30th, then back to the 31st when the month allows).
- Calls are activities of the install's call type (the first active type named like "call"; log which) with a side row for outcome, direction and duration. There is no telephony integration.
- Duplicate detection is pure SQL over normalised keys, with no fuzzy-matching library:
  - People: lower-cased trimmed email, digits-only phone (last 9 or more digits), or normalised name plus the same organization.
  - Organizations: normalised name (lower case, punctuation and legal suffixes such as "ltd", "limited", "inc", "llc", "gmbh", "plc", "co" removed), or the same website domain.
  - Merging always goes through warpdrive's existing merge (`src/features/contacts/merge*`).
- Undo uses the existing reverse operations:
  - Stage move: `changeStage` back to the previous stage, with the fresh `updatedAt` for CAS. A CAS failure shows "Couldn't undo: the deal changed since".
  - Delete: Part 8's `restoreItem`.
  - No new undo log table.
- The AI filter reuses Part 1's deal AI-filter flow with the person, organization and lead filter fields as the allow-list.
- Docker disk: this part cannot verify anything without Docker disk space, so low disk at start is fatal (section 4).

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | PROGRESS.md says `dealflow-wd-p8-v1` and `STATUS: COMPLETE WITH OPEN ISSUES` | log a Decision describing what you found; continue |
| Docker disk | `docker info` answers, and `docker run --rm alpine df -h /` reports at least 15 GB available in the VM | **fatal**: log `TODO(owner): give Docker Desktop more disk (Settings > Resources > Disk usage limit) and relaunch`, set `STATUS: BLOCKED`, end. Never prune |
| Kit location | `PLAN-PART9.md` and the kit at the repo root, or in `PLAN AND EXECUTE/dealflow-wd-part9-kit/` | root symlink plus the byte-identical checker copy; log a Decision |
| Next migration | the last file in `drizzle/` is `0090_dealflow_projects_notifications.sql` | next free number; log it |
| Calendar drag | find whether the activities calendar (`src/features/activities/calendar*`) already reschedules by drag | verified → log it; missing → Task 1.3 adds it |
| Org relations | find the parent/child relation write (`src/db/schema/organizationRelations.ts` and its service) and whether it rejects cycles | guard present → log it and add one test; missing → Task 2.4 adds it |
| Palette and shortcuts | find the Cmd+K palette (the `warpdrive:open-search` event) and the shortcut registry (`src/features/shortcuts`) | extend them; log the files |
| Merge | find the person and organization merge entry points | the duplicate finder links to them; log the routes |
| AI filter | find Part 1's deal AI filter (`src/features/ai/actions/filterActions.ts`) | generalise it by target; log the files |
| pnpm 9, subagent | as in Part 8 | as in Part 8 |

**Known environment:** after Task 0.1 renames it, copy `PROGRESS-P8.md` → Environment into PROGRESS.md → Environment and follow it.

**Fatal (STOP with `STATUS: BLOCKED`):** pnpm cannot be installed; `pnpm install --frozen-lockfile` fails for a registry reason; or Docker is down or low on disk at Task 0.1 (above).

## 5. Target structure

```
src/db/schema/activityExtras.ts                          # 6.4
drizzle/0091_dealflow_activity_extras.sql
src/features/activities/recurrence/
  rule.ts, rule.test.ts, next.ts, next.test.ts           # pure
  series.ts, recurrence.integration.test.ts
  ui/RecurrenceField.tsx
src/features/activities/calls/
  calls.ts, calls.integration.test.ts, ui/{LogCallForm,CallOutcomeChip}.tsx
src/features/activities/list/                            # column picker, URL filters, bulk actions
src/features/duplicates/
  normalize.ts, normalize.test.ts, find.ts, dismiss.ts, duplicates.integration.test.ts, ui/DuplicatesPage.tsx
src/features/contacts/bulk/                              # people and organizations bulk actions
src/features/ai/filters/                                 # target-generic AI filter
src/components/ui/toaster.tsx, src/features/feedback/{toastStore.ts,toastStore.test.ts,undo.ts}
src/features/palette/{commands.ts,commands.test.ts}      # or inside the existing palette feature folder
src/features/shortcuts/{sequences.ts,sequences.test.ts,ShortcutHelp.tsx}
src/app/(app)/contacts/duplicates/page.tsx               # match the contacts route layout
e2e/13-productivity.spec.ts
docs/dealflow/PRODUCTIVITY.md
```

## 6. Contracts

### 6.1 Constants

No new env keys. Constants (`src/constants/productivity.ts`):

```ts
TOAST_UNDO_MS = 8000
TOAST_MAX = 3
RECURRENCE_MAX_COUNT = 500
RECURRENCE_MAX_INTERVAL = 99
DUPLICATE_PAGE_SIZE = 50
BULK_MAX = 500
CALL_OUTCOMES = ["connected", "no_answer", "left_voicemail", "busy", "wrong_number"] as const
CALL_DIRECTIONS = ["outbound", "inbound"] as const
SHORTCUT_SEQUENCE_MS = 1200
```

### 6.2 Error IDs

Append these and add the `RECUR`, `CALL`, `DUP`, `BULK` and `ORGREL` domains to the registry and its test allow-list:

| ID | Cause |
|---|---|
| `E_RECUR_001` | invalid rule (context: Zod issues) |
| `E_RECUR_002` | series not found |
| `E_CALL_001` | no call activity type exists (context: hint to create one) |
| `E_CALL_002` | call input invalid |
| `E_DUP_001` | pair not found or not visible |
| `E_BULK_001` | more than `BULK_MAX` ids |
| `E_BULK_002` | partial failure (context: per-id error ids; the successful ones stay applied) |
| `E_ORGREL_001` | parent assignment would create a loop |

Copy goes in `src/constants/productivityStrings.ts`.

### 6.3 Test hooks and screenshots

`data-testid` values:

- **Recurrence:** `recurrence-field`, `recurrence-freq`, `recurrence-interval`, `recurrence-weekday` (`data-day`), `recurrence-end`, `recurrence-badge`
- **Calls:** `log-call`, `log-call-form`, `call-outcome` (`data-outcome`), `call-direction`, `call-duration`, `call-save`, `call-outcome-chip`
- **Activities list:** `activities-columns`, `activities-bulk-bar`, `bulk-mark-done`, `bulk-reschedule`, `bulk-owner`, `bulk-delete`
- **Calendar:** `calendar-event` (`data-activity-id`)
- **Duplicates:** `duplicates-page`, `duplicate-pair` (`data-entity`), `duplicate-merge`, `duplicate-dismiss`
- **Contacts bulk:** `contacts-bulk-bar`
- **AI filter:** `ai-filter-input` (on people, organizations and leads)
- **Toasts:** `toast`, `toast-undo`
- **Palette and shortcuts:** `palette-command` (`data-command-id`), `shortcut-help`

Screenshots: `p9-recurrence`, `p9-log-call`, `p9-activities-list`, `p9-duplicates`, `p9-undo-toast`, `p9-palette`, `p9-shortcut-help`.

### 6.4 Schema (`src/db/schema/activityExtras.ts`)

```ts
activity_recurrence: activity_id primary key -> activities.id on delete cascade, series_id uuid not null,
  rule jsonb not null, anchor_day integer not null (1..31), occurrence integer not null default 1,
  ended boolean not null default false, created_at
  index (series_id)
activity_calls: activity_id primary key -> activities.id on delete cascade,
  outcome text not null check in ('connected','no_answer','left_voicemail','busy','wrong_number'),
  direction text not null check in ('outbound','inbound'), duration_seconds integer null (0..86400), created_at
duplicate_dismissals: id, entity text not null check in ('person','organization'), a_id uuid not null, b_id uuid not null,
  dismissed_by -> users.id on delete set null, created_at
  unique (entity, a_id, b_id), check (a_id < b_id)
```

### 6.5 Pure helpers

**`rule.ts`**

```ts
type RecurrenceRule = { freq: "daily" | "weekly" | "monthly" | "yearly"; interval: number /* 1..99 */;
  byWeekday?: ("mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun")[] /* weekly only, non-empty when present */;
  end: { type: "never" } | { type: "until"; date: string /* YYYY-MM-DD */ } | { type: "count"; count: number /* 2..500 */ } };
export const recurrenceRuleSchema; export function describeRule(r): string;   // "Every 2 weeks on Mon, Thu until 31 Dec 2026"
```

**`next.ts`**

```ts
export function nextOccurrence(rule, current: { dueAt: Date; allDay: boolean }, anchorDay: number, occurrence: number, tz: string): Date | null;
```

- Returns null when the end is reached (`count` reached, or the next date is after `until`).
- Keeps the local time of day in `tz`.
- Weekly with weekdays returns the next listed weekday, jumping `interval` weeks after the last listed day.
- Monthly and yearly use `anchorDay` clamped to the month's length.
- Reuse Part 6's `zonedToUtc` and `utcToZoned`.

**`normalize.ts`**

```ts
normalizeEmail(s): string
normalizePhone(s): string | null   // digits only; null when fewer than 7 digits
phoneKey(s): string | null         // last 9 digits
normalizePersonName(s): string     // lower, NFKD without diacritics, collapse spaces
normalizeOrgName(s): string        // as above, drop punctuation and trailing legal suffixes
domainOf(url): string | null       // host without "www."
```

**`toastStore.ts`** (Zustand):

```ts
push({ message, action?: { label, run: () => Promise<Result<unknown>> }, durationMs? }): id
dismiss(id)
pause(id)
resume(id)
```

At most `TOAST_MAX` toasts are visible; the oldest is dropped first. `run` is called once; a second click is ignored.

**`commands.ts`**

```ts
type Command = { id: string; group: "Create" | "Go to" | "Actions"; label: string; keywords: string[]; shortcut?: string;
  requires?: GlobalAction | "admin"; run: (ctx: { router; openDialog }) => void };
export function visibleCommands(all: Command[], actor: { type; flags }): Command[];
```

**`sequences.ts`**

```ts
export function createSequenceMatcher(map: Record<string, string /* command id */>, timeoutMs): {
  press(key: string, now: number): string | null; reset(): void };
// "g" then "d" within 1200 ms → "go.deals"; ignored while focus is in an input, textarea, select or contenteditable
// (the caller checks focus); modifier keys reset the sequence
```

### 6.6 Activities

**Recurrence service (`series.ts`)**

- `setRecurrence(activityId, rule | null)`:
  - Creating a rule makes a new `series_id`, with `anchor_day` from the activity's local due day.
  - `null` ends the series: `ended = true` on this occurrence. Earlier occurrences are untouched.
  - Editing the rule on an occurrence updates only that row, so future occurrences follow the new rule.
- Hook into the existing activity completion service: inside its transaction, when the completed activity has a recurrence row that is not ended and `nextOccurrence` returns a date, insert the next activity.
  - The next activity copies type, subject, links, assignee, owner, duration, all-day and note. It gets the new due date (and end time shifted by the same amount).
  - It also gets a recurrence row with the same series, the same rule, `occurrence + 1`, and the same anchor.
  - Guard against double-complete: create the next occurrence only on the false-to-true transition, which Part 5's `completeActivity` already detects.
  - Emit `activity.created` through the create service.
- Deleting an occurrence does not create the next one.

**Calls service (`calls.ts`)**

- `logCall({ dealId?, personId?, organizationId?, outcome, direction, durationSeconds?, note?, at?: ISO })`:
  1. Resolve the call type (`E_CALL_001` if none).
  2. Create a done activity with subject "{Outbound|Inbound} call: {outcome label}", `due_at = at ?? now`, `duration_minutes = ceil(seconds/60)`, linked records and the note.
  3. Insert the `activity_calls` row in the same transaction.
- The timeline and activity reads include the outcome, shown as `CallOutcomeChip`.

**Calendar**

- If drag is missing, add dnd-kit dragging of timed events between days and times in week view, and between days in month view (keeping the time).
- Each drop calls the existing activity update with CAS, with optimistic update and rollback (toast on error).
- All-day items move between days only.

**Activities list (`list/`)**

- A column picker using the deal list's pattern (find it), stored the same way.
- Filters (type, owner, assignee, done, date range, search) move into the URL, so reloads, shared links and Part 8's export carry them. Update the export link accordingly.
- Bulk bar (selection checkboxes, max `BULK_MAX`):
  - Mark done: through `completeActivity` per id, so recurrence and events fire.
  - Reschedule: a date picker; keep each activity's time.
  - Change owner.
  - Delete: soft, followed by one undo toast for the batch.
- Each bulk action loops the existing services in one server action, collects per-id results, and returns `E_BULK_002` with the failures when some fail.

### 6.7 Contacts and AI

**Duplicates**

- `find.ts`:
  - `findDuplicatePairs({ entity, page })` builds candidate pairs with SQL over normalised keys (expression indexes are not required), restricted to records the viewer can see, excluding soft-deleted records and dismissed pairs.
  - Each pair is `{ a, b, reasons: ("email"|"phone"|"name_org"|"name"|"domain")[] }`, ordered by reason strength (email/domain first) then name, `DUPLICATE_PAGE_SIZE` per page.
  - Normalisation that SQL cannot express exactly (legal suffixes, diacritics) runs in TypeScript over candidates pre-grouped by a looser SQL key (`lower(left(name, 4))`). The candidate fetch is capped at 5,000 rows per run; log it.
- `dismiss.ts`: `dismissPair(entity, aId, bId)` stores ids in sorted order.
- Page `/contacts/duplicates` (linked from the people and organizations list headers):
  - `Tabs` for People and Organizations.
  - Pair cards show both records' key fields side by side and the reason `Badge`s.
  - "Merge" opens the existing merge flow with both ids pre-selected (or navigates to its route).
  - "Not duplicates" dismisses the pair.

**Bulk actions on people and organizations** (`contacts/bulk/`): change owner and delete (soft, one undo toast), with the same partial-failure rules. Respect `can()` per record.

**AI filter** (`ai/filters/`):

- Generalise Part 1's flow to `aiFilter({ target: "deal"|"person"|"organization"|"lead", text })`.
- The prompt lists the target's filter fields from the saved-filter field registry. The result is validated with that target's filter schema, then applied as the list's filter (and can be saved as a saved filter).
- Caps, rate limit, usage logging and `AI_FAKE` behave as in Part 1, with a deterministic fake per target.
- `ai-filter-input` appears on the people, organizations and leads lists, placed like the deals one.

**Org loop guard:** when setting an organization's parent (or creating a parent relation), walk up the proposed parent's ancestors with a recursive CTE, limited to 50 levels. If the child appears, refuse with `E_ORGREL_001` ("That would make the organization its own parent"). Self-parenting is also refused.

### 6.8 Feedback and navigation

**Toaster**

- `<Toaster />` is mounted once in the app layout. Toasts sit bottom-right on desktop and bottom-centre on mobile, using semantic tokens.
- Replace Part 3's forecast inline alert and Part 8's project board inline alert with error toasts (`role="status"` region; errors also set `aria-live="assertive"` on their item).

**Undo (`undo.ts`)**

- Helpers return a toast action for each case:
  - Deal stage move on the board and in the deal header: "Moved to {stage}" plus Undo, which calls `changeStage` back to the old stage with the fresh `updatedAt`.
  - Delete of a deal, person, organization, activity or bulk selection: "{n} deleted" plus Undo, which calls `restoreItem` for each.
- An Undo that fails shows the error copy in a new toast.

**Palette commands**

- **Create:** deal, person, organization, activity, log call, quote (requires a deal context, otherwise opens the deal picker), project.
- **Go to:** every main navigation item and every settings page the actor can open.
- **Actions:**
  - "Find duplicates";
  - "Toggle theme" (if a theme toggle exists);
  - "Keyboard shortcuts" (opens the help sheet);
  - on a deal page: "Mark won", "Mark lost", "Log call", "Create quote", "Create project" (won only).
- Commands appear as cmdk groups alongside the existing record search, filtered by `visibleCommands`.

**Shortcuts**

- Sequences:
  - `g d` deals, `g p` people, `g o` organizations, `g a` activities, `g l` leads, `g i` insights, `g j` projects, `g f` forecast, `g m` inbox;
  - `n d` new deal, `n p` new person, `n o` new organization, `n a` new activity, `n c` log call.
- `?` (Shift+/) opens `ShortcutHelp`, a `Dialog` with a two-column table grouped by Navigation, Create, Lists and Palette, generated from the same registry that drives the matcher plus the existing number-row and Cmd+K shortcuts.
- Sequences are ignored inside text inputs.

### 6.9 Demo seed

- One weekly recurring activity (Mon and Thu) and one monthly one (anchored on the 31st).
- Three logged calls with different outcomes.
- Two duplicate person pairs (same email in a different case; same name and organization) and one duplicate organization pair ("Acme Ltd" and "ACME Limited").

## 7. Conventions

Same as Parts 1 to 8 (CLAUDE.md is the authority).

- Bulk actions and undo always call the existing services, so permissions, CAS, change logs and events apply.
- Every client action passes the CSRF token.
- Write these tests first: recurrence rules and next dates (DST, month-end, weekly sets, count and until), the completion hook (once only), calls, duplicates (each reason, dismissals, visibility), bulk partial failures, the AI filter per target, the org loop guard, the toast store, the command filter and sequences.

## 8. Phases and tasks

### Phase 0: Start, Part 8 proof, schema and pure core

#### Task 0.1 - Start Part 9: progress files, kit and baseline

**Goal:** A Part 9 PROGRESS.md, a healthy Docker with disk, and a green baseline.

**Files:** create `PROGRESS.md`; rename `PROGRESS.md` → `PROGRESS-P8.md`; possibly root symlink `PLAN-PART9.md`, `scripts/check-progress.mjs`

**Steps:**
1. Check section 4's table and log each result as a Decision. If Docker or its disk fails the fatal row, stop.
2. `git mv PROGRESS.md PROGRESS-P8.md`, then create PROGRESS.md in the section 0 format with every task unchecked:
   - record the Phase 0 base commit;
   - copy `PROGRESS-P8.md` → Environment;
   - carry over still-open owner actions (drop the Docker disk one once disk is available).
3. If the kit is in a subfolder, add the root symlink plus the byte-identical checker copy.
4. Baseline: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`. Log `- Baseline: ...`.
5. Commit `0.1: Start Part 9: progress files, kit and baseline`, tick.

**Verify:** `pnpm check:progress` → OK

**Done when:** PROGRESS.md lists all tasks, Docker has disk, and the baseline line exists.

#### Task 0.2 - Prove Part 8

**Goal:** Run the Part 8 checks that the full disk blocked, and fix what fails.

**Files:** modify `PROGRESS.md`; any Part 8 files the fixes need

**Steps:**
1. `pnpm test:integration` (full) on the current tree. Fix until green, keeping Part 8's contracts and never weakening an assertion.
2. Bring the dev stack and migrations up to date, then run `pnpm e2e` (specs `00` to `12`) and fix until green.
3. `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke` → SMOKE PASS with "backup round trip ok", leaving no `dealflow-smoke` container or volume.
4. Log `- Part 8 proof: integration {p}/{t} · e2e {p}/{t} · smoke {result} · backup round trip {result}` in the QA log, plus one Decision per fix.
5. Commit fixes as `0.2: Part 8 fixes round {r}`, then `0.2: Prove Part 8`, tick.

**Verify:** the smoke output contains `backup round trip ok`

**Done when:** all three runs are green and logged.

#### Task 0.3 - Schema, migration and audit redaction

**Goal:** The tables of 6.4, and secret redaction in the audit writer.

**Files:** create `src/db/schema/activityExtras.ts`, `drizzle/0091_dealflow_activity_extras.sql` (+ meta); modify `src/db/schema/index.ts`, the audit writer (`recordAudit`) and its test

**Steps:**
1. Write the schema exactly as 6.4, generate the migration, and apply it to the dev database.
2. Make `recordAudit` run the same recursive redaction the Part 8 reader uses: move the helper to a shared module and use it in both places. Add a test that a `password` key is stored as `[redacted]`.
3. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the migration is applied and the redaction test passes.

#### Task 0.4 - Pure core (test-first)

**Goal:** `rule.ts`, `next.ts`, `normalize.ts`, `toastStore.ts`, `commands.ts` (`visibleCommands`), `sequences.ts`, and the error IDs.

**Files:** create those files and their tests; modify the error registry and its test allow-list; create `src/constants/productivity.ts`, `src/constants/productivityStrings.ts`

**Steps:**
1. Write the tests first and see them fail. Cover:
   - **Daily:** every 3 days.
   - **Weekly:** Mon and Thu every 2 weeks, from a Thursday → the Monday 11 days later.
   - **Monthly:** anchored 31 from Jan 31 → Feb 28 2026 → Mar 31.
   - **Yearly:** Feb 29 2028 → Feb 28 2029.
   - **Ends:** count 3 stops after the third; until is inclusive.
   - **Time of day:** 09:00 London is kept across the March DST change.
   - **Normalisation:** "Acme Ltd." equals "ACME Limited"; "Café Noir" equals "cafe noir"; phone keys; domains with `www.` and a path.
   - **Toasts:** the toast store caps at 3, runs the action once, and pause/resume works.
   - **Commands:** `visibleCommands` hides admin commands from a regular user.
   - **Sequences:** `g` then `d` within 1200 ms matches; after 1300 ms it does not; a modifier resets.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run src/features/activities/recurrence src/features/duplicates src/features/feedback src/features/palette src/features/shortcuts` → passes

**Done when:** all cases pass.

#### Task 0.5 - Phase 0 QA gate

**Goal:** Prove the start of Part 9.

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

**QA focus:** Definition of done items 1 to 4.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: Activities

#### Task 1.1 - Recurrence service and the completion hook (test-first)

**Goal:** `series.ts` and the hook in the activity completion service.

**Files:** create `series.ts`, `recurrence.integration.test.ts`; modify the activity completion service, the activity actions (set or clear the rule)

**Steps:**
1. Write the cases first:
   - completing a weekly occurrence creates exactly one next activity with copied fields and the right local time;
   - completing it twice concurrently (warm the pool) still creates one;
   - completing the last occurrence (count reached) creates none;
   - ending the series stops creation;
   - editing the rule on occurrence 2 changes occurrence 3's date;
   - deleting an occurrence creates nothing;
   - the next occurrence emits `activity.created`.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/activities` → passes

**Done when:** every case passes.

#### Task 1.2 - Call logging (test-first)

**Goal:** `calls.ts`, `LogCallForm`, `CallOutcomeChip`, and the "Log call" entry points.

**Files:** create those files and `calls.integration.test.ts`; modify the deal and person composer tabs or action menus (wherever "Add activity" lives), the timeline item renderer, and the activity reads

**Steps:**
1. Write the cases first:
   - logging a call creates a done activity of the call type plus the call row;
   - a missing call type gives `E_CALL_001`;
   - the timeline read includes the outcome;
   - a user who cannot see the deal is refused.
2. Build the form: outcome chips as a `RadioGroup` styled as chips, direction, a duration in minutes and seconds, a note, and "Save".
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/activities` → passes

**Done when:** calls log and show on the timeline.

#### Task 1.3 - Recurrence field and calendar drag

**Goal:** `RecurrenceField` in the activity dialog, a recurrence badge on activity rows, and calendar drag-to-reschedule (verified or added).

**Files:** create `RecurrenceField.tsx`; modify the activity dialog, the activity row and calendar components

**Steps:**
1. Add the field: frequency, interval, weekday toggles (`Checkbox` wrappers) and end type, with a live preview from `describeRule`.
2. Show the badge with a tooltip giving the rule description.
3. Verify the calendar drag. If it is missing, add it per 6.6.
4. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** a rule can be set and seen, and the calendar reschedules by drag.

#### Task 1.4 - Activities list: columns, URL filters, bulk actions

**Goal:** 6.6's activities list work.

**Files:** modify the activities list components and query; create `src/features/activities/list/{bulk.ts,bulkActions.ts}`; modify the Part 8 export link for activities, and its test in `exports.integration.test.ts` (add a case: a filter from the URL narrows the export)

**Steps:**
1. Add the column picker and URL filters.
2. Add the bulk bar and actions, with partial-failure reporting and an undo toast for delete.
3. Add the export filter case.
4. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/activities src/features/export` → passes

**Done when:** the list keeps filters in the URL, and bulk actions and the export carry them.

#### Task 1.5 - Phase 1 QA gate

**Goal:** Prove the activities work.

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
- `pnpm exec vitest run --project integration src/features/activities src/features/export src/features/events` → passes

**QA focus:** Definition of done items 5 to 7; the next occurrence is created once, inside the completion transaction.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: Contacts and AI filters

#### Task 2.1 - Duplicate finder (test-first)

**Goal:** `find.ts`, `dismiss.ts` and the duplicates page.

**Files:** create those files, `duplicates.integration.test.ts`, `DuplicatesPage.tsx`, the route page; modify the people and organizations list headers (link)

**Steps:**
1. Write the cases first:
   - the same email in a different case pairs with reason `email`;
   - phones differing only in formatting pair;
   - the same name at the same organization pairs, and the same name at a different organization does not;
   - "Acme Ltd" and "ACME Limited" pair;
   - the same website domain pairs;
   - a dismissed pair is hidden;
   - a soft-deleted record is excluded;
   - a regular user sees no pair involving a record they cannot see.
2. Build the page. "Merge" opens the existing merge flow.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/duplicates` → passes

**Done when:** every case passes and the page renders pairs.

#### Task 2.2 - People and organizations bulk actions

**Goal:** Bulk change owner and delete on both lists.

**Files:** create `src/features/contacts/bulk/{bulk.ts,actions.ts}`, a bulk bar component; modify `PeopleList.tsx`, `OrgsList.tsx` (or their tables), and the integration tests in the contacts feature (add cases)

**Steps:**
1. Add cases:
   - bulk owner change on 3 people where one is not editable → 2 applied plus `E_BULK_002` naming the third;
   - bulk delete followed by restore through the undo helper brings them back;
   - more than `BULK_MAX` ids → `E_BULK_001`.
2. Implement, and build the bars.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/contacts` → passes

**Done when:** the cases pass and both lists show the bar.

#### Task 2.3 - AI filters on people, organizations and leads

**Goal:** The target-generic AI filter and its inputs.

**Files:** create `src/features/ai/filters/{aiFilter.ts,prompts.ts}`; modify the Part 1 deal filter flow to call it, the AI fake responses, the three list toolbars, and the AI integration tests (add cases)

**Steps:**
1. Add cases:
   - with `AI_FAKE`, each target returns a filter that passes its schema;
   - a scripted provider returning a field outside the target's allow-list is rejected;
   - the deal AI filter's existing tests still pass unchanged.
2. Implement, and add the inputs.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/ai` → passes

**Done when:** the cases pass and the inputs work on all three lists.

#### Task 2.4 - Organization parent-loop guard

**Goal:** 6.7's guard (verified or added).

**Files:** modify the organization relation service; add cases to its integration test

**Steps:**
1. Add cases: A→B→C, then setting C as A's parent → `E_ORGREL_001`; self-parent refused; a legal re-parent allowed.
2. Add or confirm the guard.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/contacts` → passes

**Done when:** the cases pass.

#### Task 2.5 - Phase 2 QA gate

**Goal:** Prove the contacts work.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 3 base commit, commit `2.5: Phase 2 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/duplicates src/features/contacts src/features/ai src/features/leads` → passes

**QA focus:** Definition of done items 8 and 9; duplicates respect visibility; bulk actions go through services.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: Feedback and navigation

#### Task 3.1 - Toaster and undo

**Goal:** `toaster.tsx`, `undo.ts`, undo on stage moves and deletes, and the inline-alert replacements.

**Files:** create `src/components/ui/toaster.tsx`, `src/features/feedback/undo.ts`; modify the app layout, the board and deal-header stage move, the delete actions of deal, person, organization and activity, Part 3's forecast inline alert, and Part 8's project board inline alert

**Steps:**
1. Build the toaster per 6.8: keyboard and screen-reader friendly, timer paused on hover or focus, Escape to dismiss.
2. Wire undo per 6.8.
3. Add an integration case: a stage move followed by the undo helper returns the deal to the old stage; an undo after another edit changed `updatedAt` returns the CAS error copy.
4. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/deals src/features/recycle` → passes

**Done when:** both undo paths work and the two inline alerts are toasts.

#### Task 3.2 - Palette commands

**Goal:** 6.8's command groups in the existing palette.

**Files:** create the commands registry; modify the existing palette component

**Steps:**
1. Register the commands, filter them with `visibleCommands`, and add the deal-page context commands.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the palette shows Create, Go to and Actions groups.

#### Task 3.3 - Shortcut sequences and the help sheet

**Goal:** `g`/`n` sequences and `?` help.

**Files:** create `ShortcutHelp.tsx`; modify the shortcuts provider

**Steps:**
1. Wire the matcher to the registry (ignoring text inputs), and build the help `Dialog` generated from the registry.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** sequences navigate and create, and `?` opens the sheet.

#### Task 3.4 - Demo seed and docs

**Goal:** 6.9 and `docs/dealflow/PRODUCTIVITY.md`.

**Files:** modify the demo seed; create `docs/dealflow/PRODUCTIVITY.md`; modify `docs/dealflow/UPSTREAM.md`, `README.md`

**Steps:**
1. Extend the seed per 6.9 and run `pnpm db:seed:demo` on the dev database.
2. PRODUCTIVITY.md covers recurrence rules, calls, the calendar, the activities list, duplicates, bulk actions, AI filters, undo, palette commands and the full shortcut list.
3. Add the UPSTREAM.md list and a README line.
4. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the docs exist and the seed ran.

#### Task 3.5 - Phase 3 QA gate

**Goal:** Prove the feedback and navigation work.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 4 base commit, commit `3.5: Phase 3 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/activities src/features/duplicates src/features/contacts src/features/deals` → passes

**QA focus:** Definition of done items 10 and 11; the toaster is accessible; shortcuts never fire inside inputs.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Hardening and hand-off

#### Task 4.1 - E2E productivity spec and screenshots

**Goal:** `e2e/13-productivity.spec.ts` and the 7 screenshots.

**Files:** create `e2e/13-productivity.spec.ts`; modify `e2e/helpers.ts` only if a helper is missing

**Steps:**
1. As the admin (saved session):
   - **Recurrence:** create an activity repeating weekly on two weekdays (`p9-recurrence`), mark it done, and expect the next occurrence in the list.
   - **Calls:** on a deal, log an outbound "no answer" call (`p9-log-call`) and expect the chip on the timeline.
   - **Activities list:** filter by type through the UI, reload, and expect the filter to persist. Select two rows and mark them done (`p9-activities-list`).
   - **Duplicates:** open the duplicates page and expect the seeded pairs (`p9-duplicates`); dismiss one.
   - **Undo:** on the board, drag a deal to the next stage, expect the toast (`p9-undo-toast`), click Undo, and expect the deal back in its stage after a reload.
   - **Palette:** press Cmd/Ctrl+K, type "new project", and expect the command (`p9-palette`).
   - **Shortcuts:** press Escape, then `g` `j`, and expect `/projects`. Press `?` and expect the help sheet (`p9-shortcut-help`).
2. Run the full `pnpm e2e` (specs `00` to `13`) and fix until green.
3. Commit, tick.

**Verify:** `pnpm e2e` → passes; `ls e2e/screenshots/p9-*.png | wc -l` → `7`

**Done when:** e2e is green and 7 screenshots exist.

#### Task 4.2 - Integration suite and smoke

**Goal:** The once-per-part full runs.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. `pnpm test:integration` (full). Fix failures caused by this part; pre-existing ones get `PRE-EXISTING:` Open issues.
2. `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke` → SMOKE PASS with "backup round trip ok", leaving no `dealflow-smoke` container or volume.
3. Log both results as Decisions, commit, tick.

**Verify:** `pnpm test:integration` passes and the smoke prints SMOKE PASS (or SKIPPED with the reason from section 10)

**Done when:** both ran and are logged.

#### Task 4.3 - Independent review and hardening

**Goal:** One fresh-context review of Part 9, then fix what it finds.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is the full `.dsh/qa.md`, a blank line, then `Final review of PLAN-PART9.md. Base commit {Phase 0 base}.` Wait for `QA RESULT: PASS` or the numbered list.
   - Fallbacks: `qa.sh` with the same request, then an evidenced self-review (log `qa unavailable (qa.sh failed) - self-review`).
2. Fix every blocker and major, and commit `4.3: QA fixes round {r}`.
   - Re-run the gate commands of Task 3.5. **Re-run the full integration suite and e2e after the last fix round**, so the final tree has fresh evidence (Part 8 lacked it).
   - Review again, at most 3 rounds.
   - Minors: fix when cheap, else Open issues.
3. Log `- Independent review: subagent (fresh context) round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n}`.
4. Commit `4.3: Independent review and hardening`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`.

**Done when:** the review ran (or the logged fallback), blockers and majors are fixed or logged with reasons, and the final tree has green integration and e2e evidence.

#### Task 4.4 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order. Write one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `4.4: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least 16.

**Done when:** every checklist item has a line.

#### Task 4.5 - Final report and completion

**Goal:** Hand the owner a short, truthful report and finish.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report, short (the owner reads it on a phone). Do not repeat the Decisions list. Include:
   - Definition of done: items 1 to 12, one line each.
   - Checklist: from 4.4.
   - Owner actions: numbered, exact commands, including the dev stack rebuild for migration 0091.
   - Decisions worth reviewing: only `CONTRACT CHANGE:` lines and changed tests.
   - Open issues.
   - Notes for Part 10 (PWA): routes, the key screens on mobile, offline-relevant reads, and the upstream files changed.
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `4.5: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`.

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- Telephony, click-to-call, call recording.
- Calendar sync.
- Fuzzy-matching libraries, and automatic merging (merging is always a user action).
- Undo for anything other than stage moves and deletes. A general undo history.
- Custom user-defined shortcuts.
- Bulk actions on leads beyond what warpdrive has.
- Recurrence exceptions (skipping a single date) and editing all future occurrences at once.

## 10. ASK and STOP triggers

This plan has no ASK triggers. The only STOP cases are the fatal ones in section 4, including Docker without disk at Task 0.1.

| Situation | Safe default | Owner action to log |
|---|---|---|
| Docker stops or fills up after Task 0.1 | try `open -a Docker` and `pnpm dev:up` once. If it is still failing, record the step SKIPPED, finish the non-Docker tasks, and end with `COMPLETE WITH OPEN ISSUES` | "Give Docker Desktop more disk or restart it, then run `pnpm test:integration`, `pnpm e2e`, `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke`" |
| Subagent tool unavailable | `qa.sh`, then the evidenced self-review | "Run the review yourself in a new harness session with `.dsh/qa.md` and the request from Task 4.3" |
| A pre-existing upstream test fails | leave it, log `PRE-EXISTING:` | "Review the pre-existing failures in PROGRESS.md" |
| No activity type named like "call" exists | logging a call shows `E_CALL_001` copy with a link to activity type settings | "Add a Call activity type in Settings if your install has none" |
| The existing merge flow cannot take two preselected ids | link to the first record's merge entry and log it | none |
| Google env in `.env` still partial | keep the Environment prefixes | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty.
2. `pnpm install --frozen-lockfile` exits 0, and `package.json` gained no dependency.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes (count ≥ the baseline).
6. `pnpm test:integration` passes on the final tree (after the last review fix).
7. `pnpm build` exits 0 and lists the duplicates route.
8. `pnpm e2e` passes, specs `00` to `13`, on the final tree.
9. 7 `e2e/screenshots/p9-*.png` exist, and the Part 1 to 8 screenshots are still present.
10. Smoke printed SMOKE PASS and "backup round trip ok", and left no `dealflow-smoke` container or volume.
11. `drizzle/0091_dealflow_activity_extras.sql` creates exactly the 3 tables of 6.4.
12. Part 8's proof line is in the QA log, with integration, e2e and smoke green.
13. `git grep -n "role=\"alert\"" -- src/features/forecast src/features/projects` prints nothing (both now use toasts), or each remaining hit is explained.
14. `git grep -n "dangerouslySetInnerHTML" -- src/features/duplicates src/features/feedback src/components/ui/toaster.tsx` prints nothing.
15. No em dash in any file added or changed in this part (`git diff --name-only {Phase 0 base} | xargs perl -CSD -ne 'print "$ARGV\n" if /\x{2014}/' | sort -u` prints nothing, kit files excepted).
16. `docs/dealflow/PRODUCTIVITY.md` exists, and `UPSTREAM.md` lists this part's upstream files.
17. `pnpm check:progress --final` passes.

## 12. Report back

No mid-run reporting. The run ends with the final report (Task 4.5). The owner pastes PROGRESS.md → Final report back to the planner; the Decisions list is not needed.

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

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md to PLAN-PART9.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

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
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; money is computed on integer minor units with no floats, converted totals never add unconverted amounts or drop deals silently (excluded deals are listed), the forecast reuses the deals visibility filter; document public routes take only the publicId and a validated body, never render HTML, issued documents are immutable; domain events are written inside the mutation's transaction, automation actions go through existing services and respect the loop guard, webhook delivery checks every resolved address inside the DNS lookup with no redirects, webhook secrets are encrypted and never returned after creation; public form and booking handlers write nothing on spam paths, bookings re-check the slot under a per-host lock in the same transaction, only `/f/*` and `/book/*` may be framed; reports apply the deals or activities visibility clause, never add values across currencies in SQL, send only aggregated rows to the AI; API calls authenticate only by hashed bearer token and run as the token's user through existing services, exports reuse list visibility, backups keep secrets out of argv and logs, download routes refuse path traversal; bulk actions and undo call the existing services, the next recurring occurrence is created once inside the completion transaction, and duplicates respect visibility; no em dashes in new files.
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
# Usage: ./qa.sh "Final review of PLAN-PART9.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
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

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART9.md";
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
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART[1-9]\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
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
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART9.md (dealflow-wd-p9-v1) is finished.
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
PROMPT='Read PLAN-PART9.md in this folder in full and PROGRESS.md, then follow PLAN-PART9.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p9-v1; earlier parts are finished) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p9-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p9-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
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
- Otherwise you are the builder: read `PLAN-PART9.md` in full (Parts 1 to 8 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART9.md rule 18.
```
