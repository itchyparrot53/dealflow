# PLAN: Dealflow on warpdrive, Part 7: Insights

> Plan ID: dealflow-wd-p7-v1 · Written: 2026-10-21 · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 4, fast verification profile, no human in the loop · Type: change to existing project

Parts 1 to 6 are finished in code (`PROGRESS-P1.md` to `PROGRESS-P5.md`, and `PROGRESS.md` until Task 0.1 renames it to `PROGRESS-P6.md`). Part 6 ended `COMPLETE WITH OPEN ISSUES`: Docker was unresponsive, so its integration tests, e2e spec `10`, the `p6-*` screenshots and smoke never ran. Task 0.2 runs and fixes them before any new work. Part 6 left 5,197 unit tests passing. Part 7 adds Insights (reports, dashboards, AI explain), converts stats and goals to the base currency, and shows AI deal scores on the board. This plan is compact: where it says "find" or "reuse", locate the existing code, reuse it, and log the file you used as a Decision.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 4** in fresh-context sessions, one phase per session. Parts 1 to 6 (`PLAN-PART1.md` to `PLAN-PART6.md`) are finished; their code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART7.md` in full and PROGRESS.md (open earlier `PLAN-PART{N}.md` files only where this plan points to them). If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p7-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 6's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 4.5, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 4.2.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.5, 1.4, 2.3, 3.5):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). The one independent review is Task 4.3.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (stats and goal sums converted to the base currency, Part 6 fixes found in Task 0.2), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs only. This part needs no external service; e2e uses the fake mail transport; AI calls in tests use `AI_FAKE` or the scripted provider.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove or recreate the owner's running Compose project `warpdrive-main`, never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack 3001/5433/8080/9000/9001 (owner's). Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `PLAN-PART3.md`, `PLAN-PART4.md`, `PLAN-PART5.md`, `PLAN-PART6.md`, `PLAN-PART7.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 6's file to `PROGRESS-P6.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p7-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 7: progress files, kit and baseline
(every task through 4.5, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 4990/4990 · insights 20/20

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

First prove Part 6, whose integration, e2e and smoke runs were skipped because Docker was down. Then add Insights:
- a report builder over deals and activities (measure, grouping, segment, date range, filter, chart type) compiled to SQL with warpdrive's visibility rules and converted to the base currency;
- dashboards of reports and goals;
- an AI "Explain this report" insight;
- currency-correct stats and goals;
- the AI deal score as a badge on board cards, with bulk scoring.

## 2. Definition of done

1. Part 6 is proven: the forms and scheduling integration files, e2e specs `00` to `10` with the 7 `p6-*` screenshots, and smoke all pass, with fixes committed.
2. Migration `0087_dealflow_insights` adds the three tables of 6.4, and `0088` adds the `ai_bulk_score` notification kind; nothing else changes.
3. Report definitions, date-range resolution and time bucketing are pure, unit-tested functions.
4. The report engine compiles a definition to one grouped SQL query per run, with the viewer's deal or activity visibility applied. It converts money to the base currency (rate-less currencies reported as excluded), caps groups and segments, and buckets dates in the viewer's time zone.
5. The funnel chart matches warpdrive's existing stats funnel for the same pipeline and range.
6. Stats and goal actuals that sum deal values convert to the base currency and report excluded currencies, instead of adding mixed currencies.
7. Users create private or shared reports and dashboards. A shared report shows each viewer only the data they may see. Reports export to CSV. A default "Sales overview" dashboard exists on first visit.
8. "Explain this report" sends only the aggregated rows to the Part 1 AI layer (caps, rate limit, fake mode) and shows 3 to 5 insights.
9. Board cards show the AI score badge when a score exists. Bulk scoring of up to 200 selected deals runs as a job, stops cleanly at the AI cap, and notifies the requester with the count.
10. typecheck, lint, build, unit and the full integration suite pass. e2e specs `00` to `11` pass and the 6 `p7-*` screenshots exist. Smoke passes. One independent review ran.

## 3. Decisions already made

- **Stack:** unchanged, no new dependency. Charts use the installed `recharts` through the existing shadcn `chart.tsx` wrapper (find it under `src/components/ui/`; if it is missing, add the standard shadcn chart wrapper first).
- **Entities:** deals and activities only. Persons, organizations, leads, documents and projects are later work.
- **Money:**
  - SQL groups by currency, and TypeScript converts with Part 3's `toBase` and `summarize`, so the database never adds mixed currencies.
  - Averages are computed after conversion: converted sum divided by counted deals.
- **Visibility:**
  - deals use the same `dealVisibilityClause` the forecast and documents list use;
  - activities use `src/features/stats/activityVisibilitySql.ts`.
  - A report never bypasses them, even for its owner.
- **Time zone for buckets:** the viewer's `user_preferences.timezone`, else `UTC`. `date` columns (`expected_close_date`) are not shifted.
- **Weeks:** ISO weeks (Monday start). Quarters are calendar quarters.
- **Caps:** at most 50 groups (the rest roll into "Other") and at most 12 segments (likewise). Tables cap at 500 rows with a `truncated` flag.
- **Permissions:**
  - any user creates their own reports and dashboards;
  - only the owner or an admin edits or deletes;
  - shared items are readable by every signed-in user.
- **AI insight:**
  - the prompt carries the definition summary and at most 60 aggregated rows, never record names, emails or notes;
  - the output is Zod-validated JSON `{ insights: string[] (3..5, each <= 240 chars) }`;
  - there is no cache table.
- **Bulk scoring:** reuses the Part 1 score function and storage. The job runs as the requester, one deal at a time, and stops at the first cap error.
- **Existing stats:** the stats pages stay. Insights is a new area, and the stats fixes are only the currency conversion.

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | PROGRESS.md says `dealflow-wd-p6-v1` and `STATUS: COMPLETE WITH OPEN ISSUES` | log a Decision describing what you found; continue |
| Docker | `docker info` answers within 30 s and `docker ps` lists containers | **fatal**: Part 6 is unproven and this part depends on integration tests. Log `TODO(owner): restart Docker Desktop, then relaunch the builder`, set `STATUS: BLOCKED`, end |
| Kit location | `PLAN-PART7.md` and the kit at the repo root, or in `PLAN AND EXECUTE/dealflow-wd-part7-kit/` | root symlink plus the byte-identical checker copy; log a Decision |
| Next migration | the last file in `drizzle/` is `0086_dealflow_forms_booking_notifications.sql` | next free numbers; log them |
| Chart wrapper | `src/components/ui/chart.tsx` exists | add the standard shadcn chart wrapper; log it |
| Stats money sums | list every stats/goals function that sums `deals.value` (`grep -rn "value" src/features/stats src/features/goals` and read the SQL) | convert each one; log the list |
| AI score | find where Part 1 stores a deal score (`src/features/ai`) | read the score from there; log the column or table |
| pnpm 9, subagent | as in Part 6 | as in Part 6 |

**Known environment:** after Task 0.1 renames it, copy `PROGRESS-P6.md` → Environment into PROGRESS.md → Environment and follow it.

**Fatal (STOP with `STATUS: BLOCKED`):**
- pnpm cannot be installed;
- `pnpm install --frozen-lockfile` fails for a registry reason;
- Docker is unresponsive at Task 0.1 (above).

## 5. Target structure

```
src/db/schema/insights.ts                       # 6.4
drizzle/0087_dealflow_insights.sql, drizzle/0088_dealflow_insights_notifications.sql
src/features/insights/
  definition.ts, definition.test.ts             # 6.5 Zod + summaries (pure)
  dateRange.ts, dateRange.test.ts               # presets, buckets (pure)
  compile/deals.ts, compile/activities.ts, compile/shared.ts
  run.ts, convert.ts, funnel.ts, csv.ts, csv.test.ts
  reports.ts, dashboards.ts, defaultDashboard.ts, explain.ts
  actions.ts, router.ts, insights.integration.test.ts
  ui/{InsightsHome,ReportBuilder,ReportConfigPanel,ReportChart,ReportTable,KpiTile,FunnelChart,DashboardView,DashboardWidget,AddWidgetDialog,ExplainPanel}.tsx
src/features/ai/bulkScore.ts, bulkScoreJob.ts   # + test cases in insights.integration.test.ts
src/app/(app)/insights/page.tsx, insights/reports/[id]/page.tsx, insights/dashboards/[id]/page.tsx
e2e/11-insights.spec.ts
docs/dealflow/INSIGHTS.md
```

## 6. Contracts

### 6.1 Constants and env

No new env keys. `src/constants/insights.ts`:

```ts
INSIGHT_MAX_GROUPS = 50; INSIGHT_MAX_SEGMENTS = 12; INSIGHT_TABLE_MAX_ROWS = 500;
INSIGHT_EXPLAIN_MAX_ROWS = 60; BULK_SCORE_MAX = 200; REPORT_QUERY_TIMEOUT_MS = 15_000
```

### 6.2 Error IDs (append; add the `INSIGHT` domain to the registry and its test allow-list)

| ID | Cause | User copy |
|---|---|---|
| `E_INSIGHT_001` | report or dashboard not found or not readable | "That report no longer exists." |
| `E_INSIGHT_002` | invalid definition (context: Zod issues) | (inline) |
| `E_INSIGHT_003` | query timed out | "This report took too long. Narrow the date range or add a filter." |
| `E_INSIGHT_004` | AI insight unavailable (context: cause id) | "Couldn't explain this report right now." |
| `E_INSIGHT_005` | edit or delete by someone other than the owner or an admin | "Only the owner can change this." |
| `E_INSIGHT_006` | action input failed Zod | (inline) |

Copy lives in `src/constants/insightsStrings.ts`.

### 6.3 Test hooks and screenshots

`data-testid` values:
- **Home:** `insights-home`, `insights-tab-dashboards`, `insights-tab-reports`, `report-row` (`data-report-id`), `report-new`, `dashboard-row`, `dashboard-new`.
- **Report builder:**
  - `report-builder`, `report-entity`, `report-measure`, `report-group-by`, `report-interval`, `report-segment-by`, `report-date-preset`, `report-chart-type`, `report-filter`;
  - `report-save`, `report-share`;
  - `report-chart` (with `data-chart`), `report-table`, `report-total`, `report-excluded`;
  - `report-export-csv`, `report-explain`, `explain-insights`, `explain-item`.
- **Dashboard:** `dashboard-view`, `dashboard-widget` (`data-widget-id`), `dashboard-add-widget`.
- **Deal score:** `deal-score-badge` (`data-score`), `bulk-score`.

Screenshots: `p7-insights-home`, `p7-report-builder`, `p7-report-segmented`, `p7-dashboard`, `p7-explain`, `p7-board-scores`.

### 6.4 Schema (`src/db/schema/insights.ts`)

Id and FK types match the referenced tables; timestamps are `timestamptz`.

```ts
reports: id, name text not null (1..120), description text null (<= 500), definition jsonb not null,
  shared boolean not null default false, owner_id -> users.id on delete cascade not null, created_at, updated_at
  index (owner_id), index (shared) where shared
dashboards: id, name text not null (1..120), shared boolean not null default false, is_default boolean not null default false,
  owner_id -> users.id on delete cascade not null, created_at, updated_at
  partial unique index dashboards_default_uq on (is_default) where is_default
dashboard_widgets: id, dashboard_id -> dashboards.id on delete cascade, position integer not null,
  kind text not null check in ('report','goal'), report_id -> reports.id on delete cascade null,
  goal_id -> goals.id on delete cascade null, size text not null default 'half' check in ('half','full'), created_at
  check: (kind = 'report' and report_id is not null and goal_id is null) or (kind = 'goal' and goal_id is not null and report_id is null)
  index (dashboard_id, position)
```

Migration `0088` runs `ALTER TYPE notification_type ADD VALUE 'ai_bulk_score'` and updates the notification maps, labels and tests as Part 6 did.

### 6.5 Definition (`definition.ts`, Zod, pure)

```ts
type DealGroupField = "stage" | "pipeline" | "owner" | "status" | "label" | "lost_reason" | "source_channel" | "currency"
  | "created_at" | "won_at" | "lost_at" | "expected_close_date";
type ActivityGroupField = "activity_type" | "owner" | "assignee" | "done" | "due_at" | "created_at" | "done_at";
type Interval = "day" | "week" | "month" | "quarter" | "year";
type DatePreset = "this_month" | "last_month" | "this_quarter" | "last_quarter" | "this_year" | "last_year"
  | "last_30_days" | "last_90_days" | "last_12_months" | "all_time" | "custom";

type ReportDefinition =
  | { entity: "deal";
      measure: { kind: "count" } | { kind: "sum_value" } | { kind: "avg_value" } | { kind: "weighted_value" };
      groupBy: { field: DealGroupField; interval?: Interval } | null;      // interval required for date fields, forbidden otherwise
      segmentBy: { field: Exclude<DealGroupField, "created_at" | "won_at" | "lost_at" | "expected_close_date"> } | null;
      dateRange: { field: "created_at" | "won_at" | "lost_at" | "expected_close_date"; preset: DatePreset; from?: string; to?: string };
      filter: FilterDefinition | null;                                      // saved-filter deal AST
      chart: "bar" | "stacked_bar" | "line" | "area" | "pie" | "table" | "kpi" | "funnel";
      funnelPipelineId?: string }                                           // required when chart = "funnel"
  | { entity: "activity";
      measure: { kind: "count" } | { kind: "sum_duration" };
      groupBy: { field: ActivityGroupField; interval?: Interval } | null;
      segmentBy: { field: "activity_type" | "owner" | "assignee" | "done" } | null;
      dateRange: { field: "due_at" | "created_at" | "done_at"; preset: DatePreset; from?: string; to?: string };
      filter: { ownerIds?: string[]; activityTypeIds?: string[]; done?: boolean } | null;
      chart: "bar" | "stacked_bar" | "line" | "area" | "pie" | "table" | "kpi" };

export const reportDefinitionSchema: z.ZodType<ReportDefinition>;
export function describeDefinition(d: ReportDefinition, names: NameLookup): string;   // "Won value by month, this year" (used in lists and the AI prompt)
```

Rules enforced by the schema:
- `pie` needs a non-date group and no segment;
- `kpi` needs no group and no segment;
- `stacked_bar` needs a segment;
- `line` and `area` need a date group;
- `custom` needs `from` and `to` (`YYYY-MM-DD`, `from <= to`, at most 3 years apart);
- `funnel` is deal-only and ignores group and segment;
- the field names must match the column names warpdrive actually uses (`won_at`, `lost_at`, `lost_reason`, `source_channel`). Map each one and log the mapping.

`dateRange.ts`:
- `resolveRange(range, now: Date, tz: string): { from: Date | null; to: Date | null }` (half-open `[from, to)` in UTC instants; `all_time` is null/null; date-column ranges return day boundaries);
- `bucketKey(at: Date, interval, tz): string` (`2026-10-21`, `2026-W43`, `2026-10`, `2026-Q4`, `2026`);
- `bucketLabel(key, interval): string` ("21 Oct 2026", "Week 43, 2026", "Oct 2026", "Q4 2026", "2026");
- `fillBuckets(from, to, interval, tz): string[]` (every bucket in range, so charts show zeros).

### 6.6 Engine

`compile/deals.ts` and `compile/activities.ts` build one SQL query per run:
- `SELECT {group key expr} AS g, {segment key expr} AS s, d.currency_code AS c, count(*), sum(value), sum(value * prob / 100.0)`;
- the deal currency comes from `deal_terms`, else the base currency, and the effective probability from Part 3's rule;
- `FROM` the entity with its usual joins;
- `WHERE` the visibility clause AND the date range AND the compiled filter AND `deleted_at IS NULL`;
- `GROUP BY g, s, c`.

Date group keys use `to_char(date_trunc('{interval}', col AT TIME ZONE $tz), ...)` producing the same keys as `bucketKey` (ISO week: `IYYY-"W"IW`). Labels and names (stage, pipeline, owner, label, lost reason, activity type) are resolved in one batched lookup after the query.

`run.ts`:
- `runReport(db, actor, def, signal): Promise<Result<ReportResult>>`, using `SET LOCAL statement_timeout` to `REPORT_QUERY_TIMEOUT_MS` (timeout → `E_INSIGHT_003`);
- converts with `convert.ts`, which sums per `(g, s)` with `toBase` per currency and lists rate-less currencies in `excluded`;
- rolls the 51st and later groups (ordered by value descending, or by key for date groups) and the 13th and later segments into "Other";
- fills empty date buckets with zero.

```ts
type ReportResult = { baseCurrency: string; measure: string; rows: { g: string; gLabel: string; s: string | null; sLabel: string | null; value: string; count: number }[];
  total: { value: string; count: number }; excluded: { currency: string; count: number }[]; truncated: boolean; generatedAt: string };
```

Money values are decimal strings in the base currency; counts and durations are numbers.

`funnel.ts`: for `chart = "funnel"`, return the stage-by-stage counts and conversion from warpdrive's `src/features/stats/funnel.ts` (or `stageConversion.ts`) for `funnelPipelineId` and the range, under the same visibility. Reuse that function; do not reimplement the funnel.

`csv.ts`: `toCsv(result, def)` gives RFC 4180 output (quoted fields, CRLF, formula-injection guard: prefix `'` to cells starting with `=`, `+`, `-`, `@`, tab or carriage return).

### 6.7 Services, AI and jobs

**Reports** (`reports.ts`): `listReports(actor)` (own plus shared), `getReport`, `createReport`, `updateReport`, `duplicateReport`, `deleteReport`, `setShared`. Owner-or-admin rules (`E_INSIGHT_005`).

**Dashboards** (`dashboards.ts`): `listDashboards`, `getDashboard` (widgets in order; a widget whose report the viewer cannot read is omitted), `createDashboard`, `updateDashboard` (name, shared), `addWidget`, `moveWidget(id, direction)`, `resizeWidget`, `removeWidget`, `deleteDashboard`.

**Default dashboard** (`defaultDashboard.ts`): `ensureDefaultDashboard(db, signal)` runs on the first Insights visit. If no `is_default` dashboard exists, it creates "Sales overview" (shared, owned by the first active admin) with these shared reports:
1. Won value by month (`won_at`, last 12 months, bar);
2. Open pipeline by stage, weighted (status open, all time, bar);
3. Deals won vs lost by month (`count`, segment `status`, filter won or lost, stacked bar);
4. Activities by type this month (pie);
5. Win/loss funnel for the first pipeline, this year;
6. KPI: won value this quarter.

Reports reads return results through `insights.run({ reportId } | { definition })`, so the builder previews unsaved definitions. Reads are tRPC; mutations are server actions with CSRF (`readCsrfToken()` on the client).

**CSV:** route `GET /insights/reports/{id}/export.csv` (inside the app, session required) streams `toCsv`. File name `{slugified report name}-{YYYY-MM-DD}.csv`.

**Explain** (`explain.ts`): `explainReport(actor, reportId | definition)`:
1. run the report;
2. build the prompt from `describeDefinition`, the base currency, the total, excluded currencies and at most 60 rows (labels plus values only);
3. call the Part 1 JSON helper as the actor (caps, rate limit, usage logging) with schema `{ insights: string[] }`;
4. with `AI_FAKE`, return three deterministic insights built from the largest group, the smallest group and the total;
5. failures → `E_INSIGHT_004`, with the AI error id in the context.

**Score badge:** the board card query and the deals list include the latest AI score (from Part 1's storage). The card shows `deal-score-badge` with the score (0 to 100), coloured by band: 0 to 39 muted, 40 to 69 amber, 70 to 100 green, with text so colour is never the only signal. There is no badge when no score exists.

**Bulk score** (`src/features/ai/bulkScore.ts`, job `ai.bulk-score`):
- the action `bulkScoreDeals({ dealIds: 1..200 })` takes only deals the actor may edit (silently dropping others) and enqueues one job;
- the job scores sequentially as the requester and stops at the first cap or rate-limit error;
- then it creates one `ai_bulk_score` notification: "Scored {n} of {m} deals" plus " (AI limit reached)" when stopped early.

### 6.8 UI

All screens use shadcn wrappers only. Money is shown with `formatMoney` in the base currency.

- **Navigation:** a main navigation item "Insights" after "Documents".
- **`/insights`:** `Tabs` for Dashboards and Reports.
  - Dashboards: a list (name, owner, shared badge) plus "New dashboard"; the default dashboard is first.
  - Reports: a list (name, description from `describeDefinition`, owner, shared) plus "New report".
- **`/insights/reports/{id}` (builder):**
  - Left panel (`ReportConfigPanel`):
    - entity `Select`;
    - measure `Select`;
    - group by `Select` (date fields show an interval `Select`);
    - segment by `Select`;
    - date field and preset `Select`s (custom shows two date inputs, using the date picker wrapper already in the project);
    - filter (deal: reuse Part 5's `ConditionEditor` or the saved-filter builder; activity: owner, type and done `Select`s);
    - chart type as `ToggleGroup` icons (disabled options get a `Tooltip` with the reason from the schema rules).
  - Right panel: the live chart (debounced 400 ms tRPC run) and the table below it.
    - Total line (`report-total`).
    - Excluded note (`report-excluded`): "{n} deals in {currencies} excluded: no exchange rate".
    - "Truncated" note when set.
  - Header: name (inline edit), "Save", a "Shared" `Switch`, "Duplicate", "Export CSV", "Explain".
  - Unsaved changes are kept in local state.
- **Chart mapping:**
  - **bar, stacked_bar:** recharts `BarChart` (stacked bars use `stackId`), x = group label, y = value.
  - **line, area:** recharts `LineChart` and `AreaChart`, with one series per segment.
  - **pie:** `PieChart` (top 8 slices plus "Other").
  - **table:** `ReportTable`, with group, segment, count and value columns.
  - **kpi:** `KpiTile` with a large value, the count, and the range label.
  - **funnel:** `FunnelChart`, horizontal bars by stage with the conversion percentage between stages.
  - Colours come from the chart wrapper's CSS variables; there are no hard-coded hex colours.
  - Each chart has an accessible `aria-label` from `describeDefinition`, and a "View as table" toggle.
- **`ExplainPanel`:** a `Sheet` with a loading state, 3 to 5 bullet insights, the note "Generated from the aggregated numbers above", and error copy.
- **`/insights/dashboards/{id}`:**
  - a responsive grid with two columns on desktop and one on mobile; `half` widgets take one column and `full` widgets take two;
  - each widget shows its title, chart and a `DropdownMenu` (Open report, Move up, Move down, Make full or half width, Remove);
  - goal widgets reuse the existing goal progress component;
  - "Add widget" opens a `Dialog` to pick a report (own plus shared) or a goal;
  - a "Shared" `Switch` and a rename option for the owner;
  - widgets load in parallel, each with its own loading and error state.
- **Board:** cards show the score badge.
- **Deals list:** the bulk action bar gains "Score with AI" (`bulk-score`), which opens a confirm `AlertDialog` ("Score {n} deals with AI? This uses your AI allowance.") and then shows a toast-free inline note: "Scoring started. You'll get a notification when it's done."

### 6.9 Demo seed

- Call `ensureDefaultDashboard`.
- Add one private report "My activities by week" for the first admin.
- Add one shared dashboard "Team activity" with two widgets: activities by type, and a goal widget when a goal exists.

## 7. Conventions

Same as Parts 1 to 6 (CLAUDE.md is the authority).
- Reports never bypass visibility, never add mixed currencies, and never send record-level data to the AI.
- Every client action passes the CSRF token.
- Tests for definitions, date ranges, bucketing, CSV, compile and run results, conversion, visibility, the funnel parity, stats and goals conversion, explain and bulk scoring are written first.

## 8. Phases and tasks

### Phase 0: Start, Part 6 proof, schema and pure core

#### Task 0.1 - Start Part 7: progress files, kit and baseline

**Goal:** A Part 7 PROGRESS.md, a working Docker, and a green baseline.

**Files:** create `PROGRESS.md`; rename `PROGRESS.md` → `PROGRESS-P6.md`; possibly root symlink `PLAN-PART7.md`, `scripts/check-progress.mjs`

**Steps:**
1. Check section 4's table and log each result as a Decision. If Docker does not answer, follow the fatal row and stop.
2. `git mv PROGRESS.md PROGRESS-P6.md`, then create PROGRESS.md in the section 0 format with every task unchecked:
   - record the Phase 0 base commit;
   - copy `PROGRESS-P6.md` → Environment;
   - carry over still-open owner actions (drop the Docker one once Docker answers).
3. If the kit is in a subfolder, add the root symlink plus the byte-identical checker copy.
4. Baseline: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`. Log `- Baseline: ...`.
5. Commit `0.1: Start Part 7: progress files, kit and baseline`, tick.

**Verify:** `pnpm check:progress` → OK

**Done when:** PROGRESS.md lists all tasks, Docker answers, and the baseline line exists.

#### Task 0.2 - Prove Part 6

**Goal:** Run every Part 6 check that was skipped, and fix what fails.

**Files:** modify `PROGRESS.md`; any Part 6 files the fixes need (`src/features/forms/`, `src/features/scheduling/`, `e2e/10-forms-booking.spec.ts`, the public routes and pages)

**Steps:**
1. `pnpm exec vitest run --project integration src/features/forms src/features/scheduling src/features/events src/features/automations src/features/leads src/features/activities`. Fix until green, keeping Part 6's contracts; never weaken an assertion.
2. Make sure the dev stack and migrations are current (`pnpm db:migrate:dev` with the Environment prefixes). Then run `pnpm e2e` (specs `00` to `10`) and fix until green. Confirm the 7 `p6-*` screenshots exist.
3. `DOCKER_BUILDKIT=0 pnpm smoke` → SMOKE PASS, with no `dealflow-smoke` container or volume left.
4. Log `- Part 6 proof: integration {p}/{t} · e2e {p}/{t} · p6 screenshots {n}/7 · smoke {result}` in the QA log, and one Decision per fix.
5. Commit fixes as `0.2: Part 6 fixes round {r}`, then `0.2: Prove Part 6`, tick.

**Verify:** `ls e2e/screenshots/p6-*.png | wc -l` → `7`

**Done when:** all three runs are green and logged.

#### Task 0.3 - Insights schema and migrations

**Goal:** The tables of 6.4 and the notification kind.

**Files:** create `src/db/schema/insights.ts`, `drizzle/0087_dealflow_insights.sql`, `drizzle/0088_dealflow_insights_notifications.sql` (+ meta); modify `src/db/schema/index.ts`, `src/constants/notificationTypes.ts` and the per-kind maps, labels, defaults and their tests

**Steps:**
1. Write the schema exactly as 6.4 and generate both migrations (the second with `--custom`).
2. Apply them to the dev database.
3. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** both migrations are applied and typecheck passes.

#### Task 0.4 - Definition, date ranges, buckets, CSV (test-first)

**Goal:** `definition.ts`, `dateRange.ts`, `csv.ts`, and the error IDs.

**Files:** create those files and their tests; modify the error registry and its test allow-list; create `src/constants/insights.ts`, `src/constants/insightsStrings.ts`

**Steps:**
1. Write the tests first and see them fail. Cover:
   - every chart rule in 6.5 (valid and refused);
   - a custom range longer than 3 years refused;
   - every preset resolved at `2026-10-21T10:00:00Z` in `Europe/London` and in `America/New_York`;
   - `last_quarter` resolves to Jul 1 to Oct 1;
   - week keys across a year boundary (`2026-12-31` → `2026-W53`, `2027-01-04` → `2027-W01`);
   - month keys at a time-zone boundary (`2026-10-31T23:30:00Z` in London is `2026-10`, in `Asia/Tokyo` is `2026-11`);
   - `fillBuckets` counts;
   - CSV quoting, CRLF and the formula guard.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run src/features/insights` → passes

**Done when:** all cases pass.

#### Task 0.5 - Phase 0 QA gate

**Goal:** Prove the start of Part 7.

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
- `pnpm exec vitest run --project integration src/features/forms src/features/scheduling` → passes

**QA focus:** Definition of done items 1 to 3.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: Report engine and currency-correct stats

#### Task 1.1 - Deal reports (test-first)

**Goal:** `compile/deals.ts`, `compile/shared.ts`, `run.ts`, `convert.ts`.

**Files:** create those files and `src/features/insights/insights.integration.test.ts`

**Steps:**
1. Write the cases first (real Postgres, seeded deals in USD, EUR and JPY with a USD base and an EUR rate):
   - count by stage;
   - won value by month converts EUR and lists JPY as excluded;
   - average value divides by counted deals only;
   - weighted value uses override, then stage, then 100;
   - segment by status stacks correctly;
   - the 51st group rolls into "Other";
   - empty months are filled with zero;
   - a month boundary in the viewer's time zone puts a deal in the right bucket;
   - a regular user does not see a private deal of another owner in a shared report;
   - a filter (saved-filter AST) narrows the rows;
   - a statement timeout returns `E_INSIGHT_003` (set a tiny timeout in the test).
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/insights` → passes

**Done when:** every case passes.

#### Task 1.2 - Activity reports and the funnel

**Goal:** `compile/activities.ts` and `funnel.ts`.

**Files:** create those files; modify `run.ts`, `insights.integration.test.ts`

**Steps:**
1. Add cases:
   - activities by type and by week;
   - sum of duration;
   - the done filter;
   - activity visibility for a regular user;
   - the funnel output equals warpdrive's stats funnel for the same pipeline and range (call both and compare).
2. Implement.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/insights` → passes

**Done when:** the cases pass.

#### Task 1.3 - Currency-correct stats and goals

**Goal:** Every stats and goals sum of deal value converts to the base currency.

**Files:** modify the stats and goals functions found in section 4 (for example `src/features/stats/{dealPerformance,wonDealStats,stageSums,wonTrend}.ts`, `src/features/goals/goalActual.ts`), their result types and UI where an "excluded" note is needed, and their tests

**Steps:**
1. For each function, group by currency in SQL and convert with `toBase`/`summarize`. Add `excluded` to the result. Show a muted "{n} excluded: no exchange rate" note where the stats UI shows a money total.
2. Existing single-currency tests must keep passing unchanged. Add one mixed-currency case per function (in that function's existing test file), plus one goal case where a EUR won deal counts toward a USD goal at the rate.
3. List the changed files in UPSTREAM.md.
4. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/stats src/features/goals` → passes

**Done when:** every listed function converts and the new cases pass.

#### Task 1.4 - Phase 1 QA gate

**Goal:** Prove the engine and the stats fixes.

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
- `pnpm exec vitest run --project integration src/features/insights src/features/stats src/features/goals` → passes

**QA focus:** Definition of done items 4 to 6; no SQL adds values across currencies.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: Services, AI insight and bulk scoring

#### Task 2.1 - Reports, dashboards, default dashboard, CSV export

**Goal:** `reports.ts`, `dashboards.ts`, `defaultDashboard.ts`, the reads, actions and CSV route.

**Files:** create those files plus `actions.ts`, `router.ts`, `src/app/(app)/insights/reports/[id]/export.csv/route.ts`; modify the app router, `insights.integration.test.ts`

**Steps:**
1. Add cases:
   - owner-or-admin rules (`E_INSIGHT_005`);
   - a shared report is listed for another user;
   - a dashboard omits a widget the viewer cannot read;
   - `ensureDefaultDashboard` is idempotent under two concurrent calls (warm the pool);
   - the CSV route returns `text/csv` with the guard applied.
2. Implement.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/insights` → passes

**Done when:** the cases pass.

#### Task 2.2 - Explain, score data and bulk scoring

**Goal:** `explain.ts`, the score in board and list queries, `bulkScore.ts` and its job.

**Files:** create `src/features/insights/explain.ts`, `src/features/ai/{bulkScore.ts,bulkScoreJob.ts}`; modify the AI fake responses, the board card and deals list queries, the worker, `jobNames.ts`, `insights.integration.test.ts`

**Steps:**
1. Add cases:
   - explain with `AI_FAKE` returns 3 insights;
   - the prompt sent to a `ScriptedAiProvider` contains no deal titles, person names or emails (assert on the captured prompt);
   - an AI cap error gives `E_INSIGHT_004`;
   - bulk scoring 3 deals stores 3 scores and one notification "Scored 3 of 3 deals";
   - with the company cap set so only 1 call fits, it stops after 1 and the notification says "(AI limit reached)";
   - deals the actor cannot edit are dropped.
2. Implement.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/insights src/features/ai` → passes

**Done when:** the cases pass.

#### Task 2.3 - Phase 2 QA gate

**Goal:** Prove the services.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 3 base commit, commit `2.3: Phase 2 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/insights src/features/ai src/features/notifications` → passes

**QA focus:** Definition of done items 7 to 9 (server side); the AI prompt carries aggregates only.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: Screens

#### Task 3.1 - Insights home and report builder

**Goal:** `/insights` and `/insights/reports/{id}` (6.8).

**Files:** create `InsightsHome.tsx`, `ReportBuilder.tsx`, `ReportConfigPanel.tsx`, `ReportChart.tsx`, `ReportTable.tsx`, `KpiTile.tsx`, `FunnelChart.tsx`, `ExplainPanel.tsx`, the route pages; modify the main navigation

**Steps:**
1. Build per 6.8: the debounced live preview, every chart type, the excluded and truncated notes, export, explain, and the hooks.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** both pages render and save.

#### Task 3.2 - Dashboards

**Goal:** `/insights/dashboards/{id}` (6.8).

**Files:** create `DashboardView.tsx`, `DashboardWidget.tsx`, `AddWidgetDialog.tsx`, the route page

**Steps:**
1. Build the grid, widget menu, add dialog, goal widgets and parallel loading. Call `ensureDefaultDashboard` from the Insights home server page.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the default dashboard renders its six widgets.

#### Task 3.3 - Score badge and bulk scoring UI

**Goal:** The badge on board cards and "Score with AI" in the deals list.

**Files:** modify the board card component, the deals list bulk action bar; create a small `DealScoreBadge.tsx` in `src/features/ai/ui/`

**Steps:**
1. Add the badge per 6.7 and the bulk action with its confirm dialog and inline note.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** a scored deal shows its badge and the bulk action enqueues a job.

#### Task 3.4 - Demo seed and docs

**Goal:** 6.9 and `docs/dealflow/INSIGHTS.md`.

**Files:** modify the demo seed; create `docs/dealflow/INSIGHTS.md`; modify `docs/dealflow/UPSTREAM.md`, `README.md`

**Steps:**
1. Extend the seed per 6.9, and run `pnpm db:seed:demo` on the dev database (with the Environment prefixes) to check it.
2. Write INSIGHTS.md: measures, groupings, segments, date ranges and time zones, charts, caps, currency conversion and excluded deals, visibility, sharing, the default dashboard, CSV, explain (what is sent), the score badge and bulk scoring.
3. Update UPSTREAM.md (every upstream file changed) and add a short README section.
4. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the docs exist and the seed ran.

#### Task 3.5 - Phase 3 QA gate

**Goal:** Prove the screens build.

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
- `pnpm exec vitest run --project integration src/features/insights src/features/stats src/features/goals src/features/ai` → passes

**QA focus:** Definition of done items 7 and 9; shadcn-only UI; charts use the wrapper's colour variables; every client action sends the CSRF token.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Hardening and hand-off

#### Task 4.1 - E2E insights spec and screenshots

**Goal:** `e2e/11-insights.spec.ts` and the 6 screenshots.

**Files:** create `e2e/11-insights.spec.ts`; modify `e2e/helpers.ts` only if a helper is missing

**Steps:**
1. As the admin (saved session):
   - open `/insights` and expect "Sales overview" (`p7-insights-home`), then open it and expect six widgets (`p7-dashboard`);
   - create a report: deals, sum value, group by `won_at` month, last 12 months, bar; expect `report-chart` with `data-chart="bar"` and a total (`p7-report-builder`);
   - add segment by owner, switch to stacked bar, save (`p7-report-segmented`);
   - click "Explain" (the e2e env uses `AI_FAKE=true`) and expect 3 `explain-item` (`p7-explain`);
   - export CSV and expect a download whose first line is the header;
   - on the board, expect at least one `deal-score-badge` after bulk scoring two deals from the deals list (wait for the notification) (`p7-board-scores`).
2. Run the full `pnpm e2e` (specs `00` to `11`); fix until green.
3. Commit, tick.

**Verify:** `pnpm e2e` → passes; `ls e2e/screenshots/p7-*.png | wc -l` → `6`

**Done when:** e2e is green and 6 screenshots exist.

#### Task 4.2 - Integration suite and smoke

**Goal:** The once-per-part full runs.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. `pnpm test:integration` (full). Fix failures caused by this part; pre-existing ones get `PRE-EXISTING:` Open issues.
2. `DOCKER_BUILDKIT=0 pnpm smoke` → SMOKE PASS, with no `dealflow-smoke` container or volume left.
3. Log both results as Decisions, commit, tick.

**Verify:** `pnpm test:integration` passes and `DOCKER_BUILDKIT=0 pnpm smoke` prints SMOKE PASS (or SKIPPED with the reason from section 10)

**Done when:** both ran and are logged.

#### Task 4.3 - Independent review and hardening

**Goal:** One fresh-context review of Part 7, then fix what it finds.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is the full `.dsh/qa.md`, a blank line, then `Final review of PLAN-PART7.md. Base commit {Phase 0 base}.` Wait for `QA RESULT: PASS` or the numbered list. Fallbacks: `qa.sh` with the same request, then an evidenced self-review (log `qa unavailable (qa.sh failed) - self-review`).
2. Fix every blocker and major and commit `4.3: QA fixes round {r}`. Re-run the gate commands of Task 3.5, then review again. At most 3 rounds. Minors: fix when cheap, else Open issues.
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

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least 16.

**Done when:** every checklist item has a line.

#### Task 4.5 - Final report and completion

**Goal:** Hand the owner a short, truthful report and finish.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report, short (the owner reads it on a phone):
   - Definition of done: items 1 to 10, one line each.
   - Checklist: from 4.4.
   - Owner actions: numbered, with exact commands, including the dev stack rebuild for migrations 0085 to 0088.
   - Decisions worth reviewing: only `CONTRACT CHANGE:` lines and changed tests.
   - Open issues.
   - Notes for Part 8: new routes and screenshots, the report engine's entry points, and the upstream files changed.

   Do not repeat the Decisions list.
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `4.5: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`.

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- Reports on persons, organizations, leads, documents, emails or projects.
- Scheduled report emails, report subscriptions, public dashboard links.
- Drag-and-drop dashboard layout (up/down and width only).
- Custom formulas, calculated fields, cohort or retention analysis.
- Drill-down from a chart into a filtered deal list.
- Changes to the existing stats pages beyond currency conversion.

## 10. ASK and STOP triggers

This plan has no ASK triggers. The only STOP cases are the fatal ones in section 4 (including Docker being unresponsive at Task 0.1).

| Situation | Safe default | Owner action to log |
|---|---|---|
| Docker stops responding after Task 0.1 | record the step SKIPPED, finish the remaining non-Docker tasks, final status `COMPLETE WITH OPEN ISSUES` | "Restart Docker Desktop, then run `pnpm test:integration`, `pnpm e2e`, `DOCKER_BUILDKIT=0 pnpm smoke`" |
| Subagent tool unavailable | `qa.sh`, then the evidenced self-review | "Run the review yourself in a new harness session with `.dsh/qa.md` and the request from Task 4.3" |
| A pre-existing upstream test fails | leave it, log `PRE-EXISTING:` | "Review the pre-existing failures in PROGRESS.md" |
| A stats function cannot group by currency without a large rewrite | convert its total only and list it as an Open issue | none |
| The saved-filter builder cannot be embedded in the report panel | reuse Part 5's `ConditionEditor` | none |
| Google env in `.env` still partial | keep the Environment prefixes | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty.
2. `pnpm install --frozen-lockfile` exits 0 and `package.json` gained no dependency.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes (count ≥ the baseline).
6. `pnpm test:integration` passes (Task 4.2).
7. `pnpm build` exits 0 and lists `/insights`, `/insights/reports/[id]`, `/insights/dashboards/[id]`.
8. `pnpm e2e` passes, specs `00` to `11`.
9. 6 `e2e/screenshots/p7-*.png` and 7 `p6-*.png` exist, and the Part 1 to 5 screenshots are still present.
10. Smoke printed SMOKE PASS and left no `dealflow-smoke` container or volume.
11. `drizzle/0087_dealflow_insights.sql` creates exactly the 3 tables of 6.4.
12. `git grep -nE "sum\\((d\\.)?value\\)" -- src/features/insights src/features/stats src/features/goals` shows only sums that are also grouped by currency (list each hit with its GROUP BY).
13. `git grep -nE "#[0-9a-fA-F]{6}" -- src/features/insights/ui` prints nothing (charts use the wrapper's variables).
14. The explain prompt test asserts no titles, names or emails (cite the test name).
15. No em dash in any file added or changed in this part (`git diff --name-only {Phase 0 base} | xargs perl -CSD -ne 'print "$ARGV\n" if /\x{2014}/' | sort -u` prints nothing, kit files excepted).
16. `docs/dealflow/INSIGHTS.md` exists, and `UPSTREAM.md` lists this part's upstream files.
17. `pnpm check:progress --final` passes.

## 12. Report back

No mid-run reporting. The run ends with the final report (Task 4.5). The owner pastes PROGRESS.md → Final report back to the planner (the Decisions list is not needed).

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

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md to PLAN-PART7.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

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
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; money is computed on integer minor units with no floats, converted totals never add unconverted amounts or drop deals silently (excluded deals are listed), the forecast reuses the deals visibility filter; document public routes take only the publicId and a validated body, never render HTML, issued documents are immutable; domain events are written inside the mutation's transaction, automation actions go through existing services and respect the loop guard, webhook delivery checks every resolved address inside the DNS lookup with no redirects, webhook secrets are encrypted and never returned after creation; public form and booking handlers write nothing on spam paths, bookings re-check the slot under a per-host lock in the same transaction, only `/f/*` and `/book/*` may be framed; reports apply the deals or activities visibility clause, never add values across currencies in SQL, and send only aggregated rows to the AI; no em dashes in new files.
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
# Usage: ./qa.sh "Final review of PLAN-PART7.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
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

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART7.md";
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
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART[1-7]\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
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
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART7.md (dealflow-wd-p7-v1) is finished.
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
PROMPT='Read PLAN-PART7.md in this folder in full and PROGRESS.md, then follow PLAN-PART7.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p7-v1; earlier parts are finished) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p7-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p7-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
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
- Otherwise you are the builder: read `PLAN-PART7.md` in full (Parts 1 to 6 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART7.md rule 18.
```
