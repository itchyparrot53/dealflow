# PROGRESS: dealflow-wd-p7-v1

STATUS: IN PROGRESS
Current: 4.5 · Last updated: 2026-10-21 16:02

## Phase base commits
- Phase 0: 8957a53e58b608f1d30dd9e46d05080439bd4b98
- Phase 1: 4d77639
- Phase 2: b1d3d81
- Phase 3: 64a1153
- Phase 4: 2bee558

## Tasks
- [x] 0.1 Start Part 7: progress files, kit and baseline
- [x] 0.2 Prove Part 6
- [x] 0.3 Insights schema and migrations
- [x] 0.4 Definition, date ranges, buckets, CSV (test-first)
- [x] 0.5 Phase 0 QA gate
- [x] 1.1 Deal reports (test-first)
- [x] 1.2 Activity reports and the funnel
- [x] 1.3 Currency-correct stats and goals
- [x] 1.4 Phase 1 QA gate
- [x] 2.1 Reports, dashboards, default dashboard, CSV export
- [x] 2.2 Explain, score data and bulk scoring
- [x] 2.3 Phase 2 QA gate
- [x] 3.1 Insights home and report builder
- [x] 3.2 Dashboards
- [x] 3.3 Score badge and bulk scoring UI
- [x] 3.4 Demo seed and docs
- [x] 3.5 Phase 3 QA gate
- [x] 4.1 E2E insights spec and screenshots
- [x] 4.2 Integration suite and smoke
- [x] 4.3 Independent review and hardening
- [x] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (14 warnings) · build ok · unit 5197/5197 in 810 files
- Part 6 proof: integration 249/249 (51 files) · e2e 20/20 (specs 00 to 10) · p6 screenshots 7/7 · smoke PASS
- Phase 0 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5237/5237 · forms/scheduling integration 17/17
- Phase 1 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5237/5237 · insights/stats/goals integration 119/119
- Phase 2 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5237/5237 · insights/ai/notifications integration 104/104
- Phase 3 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5237/5237 · insights/stats/goals/ai integration 156/156
- Independent review: subagent (fresh context) round 1: QA RESULT FAIL · 1 blocker/2 majors/3 minors · fixed 6
- Independent review: subagent (fresh context) round 2: QA RESULT FAIL · 0 blockers/0 majors/1 minor · fixed 1
- Independent review: subagent (fresh context) round 3: QA RESULT PASS · 0 blockers/0 majors/0 minors · fixed 0

## Decisions
- 0.1: section 4 starting point matches: PROGRESS.md said `dealflow-wd-p6-v1` with `STATUS: COMPLETE WITH OPEN ISSUES`, so section 0 rule 1 starts this run fresh at Task 0.1.
- 0.1: Docker answers (`docker info` returns 24.0.5 in under a second and `docker ps` returns within the 30 s budget), so the fatal row does not apply. No containers are running, so the owner's dev stack is down; Task 0.2 brings up only the throwaway resources it needs.
- 0.1: the kit arrived untracked as `dealflow-wd-part7-kit/` at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part7-kit` (matching the Part 1 to 6 layout), added the root `PLAN-PART7.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical; `PLAN_FILE` is now `PLAN-PART7.md`).
- 0.1: the last migration is `0086_dealflow_forms_booking_notifications.sql`, so the next free numbers are 0087 and 0088 and Part 7 keeps the planned names `0087_dealflow_insights` and `0088_dealflow_insights_notifications`.
- 0.1: `src/components/ui/chart.tsx` exists (with `chart.test.tsx`), so Part 7 uses the installed shadcn chart wrapper and adds no dependency.
- 0.1: the stats and goals functions that sum `deals.value` and must convert are `stats/dealPerformance.ts` (added/won/lost/open value), `stats/lostReasons.ts` (value per reason), `stats/stageSums.ts` (total per stage), `stats/wonTrend.ts` (value per month), `stats/wonDealStats.ts` (avg and median value), `goals/goalActual.ts` (actual) and `goals/goalSeries.ts` (series). `stats/funnel.ts` and `stats/stageConversion.ts` count deals only, so they need no conversion. The conversion building blocks are `src/features/currency/money.ts` (`toBase`, `parseCents`, `weighted`) and `src/features/currency/totals.ts` (`summarize`, `loadRateMap`).
- 0.1: the AI deal score is stored on `deal_ai_insights.score` (integer, with `score_reasons` jsonb and `scored_at`), read and written by `src/features/ai/dealInsights.ts`, so the board badge and bulk scoring read that column instead of a new table.
- 0.1: `/tmp/dealflow-tools` and the pnpm store had been cleared since Part 6, so I reinstalled pnpm 9.15.9 into `/tmp/dealflow-tools` (npm needed `--cache /tmp/npm-cache` because `~/.npm/_logs` is not writable for this shell). The `subagent` tool is available for Task 4.3.

- 0.2: the forms and scheduling integration files called the public route handlers directly, and those handlers bind the shared app pool at import, so they were querying the placeholder `localhost:5432` instead of the Testcontainers clone. Both files now mock only the `@/db/client` binding with a getter that returns the per-test Drizzle client (still real Postgres, no database mock), which is why all 249 cases in the six named directories pass.
- 0.2: the e2e spec builds "Website enquiry" by adding a phone field and then expects organization and message inputs on the public page, but a new form draft carried only name and email. The draft now starts with name, email, organization and message (the same four fields as the demo seed's contact form), so the spec passes unedited and a new form is usable out of the box.
- 0.2: the dev stack was down after Part 6, so I ran `pnpm dev:up` (Postgres on 5433, MinIO on 9000/9001) and applied every migration with `DATABASE_URL=$DEV_DB_URL pnpm db:migrate:dev`; the owner's compose project was started, never stopped, removed or recreated.
- 0.2: `DOCKER_BUILDKIT=0 pnpm smoke` failed once at `build-and-up` with exit 137: compose v2 builds the four app services in parallel, three concurrent Turbopack builds exhausted the Docker VM and one was OOM-killed. Rerunning with `COMPOSE_PARALLEL_LIMIT=1` built them one at a time and printed SMOKE PASS; the project removed its containers and volumes, so no `dealflow-smoke` resource remains.

- 0.3: `drizzle-kit generate` also emitted the three Part 6 `notification_type` values, because `0086` was a `--custom` migration whose snapshot still lists 14 values. I removed those three lines from `0087` (they are already in `0086` and in the dev database) so `0087` creates exactly the three tables; its snapshot now records all 17 values, and I added `ai_bulk_score` to `0088`'s snapshot by hand so the next `db:generate` does not try to add a label that already exists.
- 0.3: `ai_bulk_score` defaults to in-app only (email off), like `automation`: it reports a job the requester started and can watch in the app, so it should not interrupt by email.
- 0.3: the three tables carry the 6.4 columns plus database guards for the rules the services enforce: name length 1 to 120 on both tables, description at most 500, `kind`/`size` value lists, and the `kind` to `report_id`/`goal_id` pairing check. `dashboards_default_uq` is the partial unique index from 6.4, so two first visits cannot create two defaults.

- 0.4: the definition, date-range and CSV tests were written before their modules; the first green run needed one honest fix in the test (the Part 5 filter operators are keys like `eq`, not the UI label "is"), and the other 39 cases passed as written.
- 0.4: a preset resolves in the viewer's zone to a half-open range. Rolling windows are whole local days or months: last 30 days is today plus the 29 days before it, last 90 days likewise, last 12 months is the current month plus the 11 before it, and a custom end date is inclusive (the returned `to` is the next local midnight, which is what a date column compares against).
- 0.4: `describeDefinition` lives in `describe.ts` and `definition.ts` re-exports it, and the custom-range calendar rules live in `rangeRules.ts`, so both stay near the file-size convention while the plan's `definition.ts` export stays valid. `result.ts` holds the 6.6 `ReportResult` shape so the CSV encoder and the Task 1.1 engine share one type instead of duplicating it.
- 0.4: DST and zone arithmetic reuses Part 6's pure `zonedToUtc`/`utcToZoned` from `src/features/scheduling/zonedTime.ts` rather than a second implementation.

- 1.1: grouping by label uses the deal's first label (`d.labels[1]`), because deals store an unordered array of label names: grouping per label would count one deal in several groups and double-count money. One row per deal keeps counts and totals honest; the first label is the primary one.
- 1.1: a report follows the stats and forecast conventions, so deleted and archived deals and archived pipelines are out, and the query joins `stages` and `organizations` as the deals list does, which lets the whole saved-filter AST (rotting, orgName, stage) compile unchanged.
- 1.1: `runReport` accepts an optional `{ timeoutMs, now }` used by tests only; production uses `REPORT_QUERY_TIMEOUT_MS` and the request time. The timeout is set with `set_config('statement_timeout', $1, true)` (SET cannot bind a value) inside the query's transaction, and Postgres 57014 maps to `E_INSIGHT_003`.
- 1.1: caps run after conversion: groups are ordered by value descending (bucket key ascending for a date group), segments by value descending, the rolled remainder becomes "Other" and sorts last, and the table caps at 500 rows with `truncated` set. Averages divide the converted sum by the counted included deals, so an excluded currency never enters the denominator.

- 1.2: the funnel reuses `stageConversion` rather than `funnel`, because it is the only stats funnel that takes a date range: it windows a cohort on deals created in the range and reuses the deals visibility predicate inside its query. A funnel report therefore ignores its own date field, group, segment and saved filter (the stats funnel has no filter input), and an all-time funnel widens the cohort from 1970-01-01 to today's local date.
- 1.2: `ReportResult` gained an additive `funnel` field (stage id, name, order, reached, conversion, median days) because 6.6's rows have no conversion column; the rows mirror the stages so tables and CSV still work.
- 1.2: activity queries select a constant empty currency and never load rates, since counts and minutes have no currency; durations are `sum(coalesce(duration_minutes, 0))` in minutes.
- 1.2: the three activity filter inputs (owner ids, type ids, done) are ANDed into the one query with the range and the activity visibility SQL from Part 5.

- 1.3: the new `excluded` field is optional on every money result, so an absent list means none and the existing single-currency fixtures and assertions stay untouched; only the trend router test changed, and only to add `excluded: []` to its expected point.
- 1.3: the SQL groups by currency for `dealPerformance` (all four windows in one scan), `lostReasonBreakdown`, `stageSums`, `wonTrend`, `goalActual` and `goalSeries`, and the values convert with `toBase` in TypeScript. `wonDealStats` fetches one row per won deal (value, currency, cycle days) and computes the converted mean and the interpolated median in integer cents, because SQL `avg`/`percentile_cont` cannot span currencies.
- 1.3: a count column counts the deals in an excluded currency (they exist); only the money total leaves them out, and the note says how many. Activity goals and the funnel are unaffected.
- 1.3: one `ExcludedNote` component renders "{n} excluded: no exchange rate" under each money total: the four deal counters, the average-deal tile, lost reasons, stage sums, the won trend and each value goal.
- 1.3: `docs/dealflow/UPSTREAM.md` gained the Part 7 section listing every upstream stats, goals, UI and constant file touched here.

- 2.1: reads are tRPC (`insights.listReports`, `getReport`, `run`, `listDashboards`, `getDashboard`) and mutations are server actions behind `guardCsrf`; every owner-or-admin rule lives in the service and returns `E_INSIGHT_005`. An unshared report of someone else reads as `E_INSIGHT_001`, never as a permission error, so existence does not leak.
- 2.1: `run` accepts either a saved `reportId` (whose stored definition is re-read through `getReport`, so visibility applies) or an unsaved `definition` for the builder preview, and both go through the same engine.
- 2.1: `ensureDefaultDashboard` takes a transaction-scoped advisory lock, then checks for an existing default; the partial unique index is the backstop. It creates "Sales overview" (shared, owned by the first active admin) with six shared reports: five when the install has no pipeline, because the funnel report needs one.
- 2.1: a dashboard read omits a report widget the viewer cannot read and a widget whose goal is soft-deleted; adding a widget validates that the report is readable or the goal exists. Duplicating a report makes a private "(copy)" owned by the duplicator; moving a widget swaps positions in a transaction.
- 2.1: the CSV route requires a session, re-reads the report through the service (404 when unreadable), maps a timeout to 504, and names the file `{slug}-{YYYY-MM-DD}.csv`; the formula guard is the one in `toCsv`.
- 2.1: the route integration test mocks only the `@/db/client` binding and `createContext` so the handler runs against the per-test Postgres and actor; tables and SQL are real.

- 2.2: explain returns deterministic insights when the effective provider is the fake one (`AI_FAKE`), building them from the largest group, the smallest group and the total, exactly as section 6.7 step 4 says; the real path goes through `chatJson` with `insight_explain`, so caps, usage logging and the per-minute limiter all apply. The prompt carries the definition summary, base currency, total, excluded list and at most 60 rows of labels/values/counts; the privacy test asserts no deal title or email appears.
- 2.2: AI failures map to `E_INSIGHT_004` with the AI error id in `context.cause`; a report's own error (timeout, not found) passes through unchanged.
- 2.2: `bulkScoreDeals` narrows ids through the deals visibility predicate and then `can(actor, "deal.edit", ...)`, silently dropping the rest (and returning `queued: 0` when none survive); it enqueues one `ai.bulk-score` job and returns `E_JOBS_001` when no job queue is running rather than dropping the promise silently.
- 2.2: the job hydrates the requester, scores one deal at a time, and stops at the first cap, disabled-AI or rate-limit refusal; any other per-deal failure is skipped so the batch continues. It always creates one `ai_bulk_score` notification: "Scored {n} of {m} deals" plus " (AI limit reached)" when it stopped early.
- 2.2: the board and deals-list reads LEFT JOIN `deal_ai_insights` and return `score`, so the card badge (Task 3.3) reads it from the same rows; the aggregate money query stays lean and does not select it.
- 2.2: `AI_FEATURES` gained `insight_explain` so usage rows record the feature; the fake provider needs no new branch because the fake path is resolved in `explain.ts`.

- 3.1: the chart-type picker is a fieldset of icon `Button`s with `aria-pressed`, because no Radix ToggleGroup is installed and section 3 forbids a new dependency; a disabled option is wrapped in a Tip carrying the exact 6.5 rule, and the fieldset keeps the group semantics without a hand-rolled control.
- 3.1: the builder holds the unsaved definition in local state and previews it after a 400 ms debounce through `insights.run({ definition })`; Save writes name, definition and the shared flag in one action. The description is recomputed client-side (with the pipeline name lookup) and feeds the chart's aria-label.
- 3.1: the deal filter reuses `ConditionRowsBuilder` with `dealFilterFields`/`OP_LABELS`, so the report filter offers exactly the deals-list field and operator allow-list; activity filters are the three allowed Selects (owner, type, done).
- 3.1: chart series colours come from the token palette (`hsl(var(--primary))`, ring, muted-foreground, destructive, accent-foreground), never hex. Every chart carries an aria-label and a view-as-table toggle; a table chart drops the image role so the table stays in the accessibility tree.
- 3.1: main navigation gained "Insights" after Documents. `InsightsHome` lists dashboards first (default first) and reports with their `describeDefinition` line; "New" creates through the server action and opens the new row.

- 3.2: each report widget owns its `insights.run({ reportId })` query, so widgets load and fail independently; the dashboard itself uses `getDashboard` with server `initialData` and invalidates it after every widget action. The grid is two columns on desktop (`md:grid-cols-2`) and one below, with `full` widgets spanning both columns.
- 3.2: goal widgets reuse the stats `GoalRow` (exported for this), so a goal on a dashboard looks and behaves exactly like the one in the performance widget; `AddWidgetDialog` offers the viewer's reports and goals with `goalLabel`, and the service re-checks readability/existence on add.
- 3.2: rename and the shared Switch go through `updateDashboardAction` and render only for the owner or an admin; the widget DropdownMenu offers Open report, Move up/down, Make full/half and Remove.

- 3.3: the board card shows `DealScoreBadge` only when the card row carries a numeric score. The badge uses three token bands (muted under 40, attention 40 to 69, success 70 and above) and always prints the number, so colour is never the only signal; its tooltip uses the sanctioned Tip primitive (no native title).
- 3.3: "Score with AI" (`bulk-score`) sits in the deals bulk bar, confirms through the existing ConfirmDialog with "Score {n} deals with AI? This uses your AI allowance.", then calls `bulkScoreDealsAction` with the selected ids and shows the inline note "Scoring started. You'll get a notification when it's done." The selection stays, because scoring changes no rows.
- 3.3: the action returns after enqueueing, so the note is truthful even before the job runs; failures still surface through the app-wide action error reporter.

- 3.4: the demo seed runs `ensureDefaultDashboard` through a Drizzle handle built on the seed's own pool, then recreates its two named reports and the "Team activity" dashboard by name, so a re-run never duplicates. The demo has no goal, so the dashboard gets the activities-by-type widget only; the goal widget is added the moment a demo goal exists, exactly as 6.9 says.
- 3.4: `pnpm db:seed:demo` ran against the dev database and printed `demo_insight_reports=2 demo_insight_dashboards=1 demo_insight_widgets=1`; a query confirmed "Sales overview" is the only default with 6 widgets, "Team activity" is shared with 1 widget, and "My activities by week" is private.
- 3.4: `docs/dealflow/INSIGHTS.md` covers measures, groupings, segments, ranges and time zones, charts, caps, currency conversion and excluded deals, visibility, sharing, the default dashboard, CSV, explain (what is sent) and the score badge plus bulk scoring; the README gained a short "Insights" section and UPSTREAM.md lists every upstream file this part touched.

- 4.1: `e2e/11-insights.spec.ts` drives the real screens: it lists "Sales overview" on `/insights`, opens it and sees six widgets, builds a won-value-by-month report through the Select wrappers, switches the segment and chart, saves, reads three explain items with `AI_FAKE`, checks the CSV download header and bulk-scores two deals before reading the completion notification and the board badge.
- 4.1: the first run failed because `getByRole("checkbox", { name: /^Select / })` also matches "Select all deals", so the bulk action scored 34 deals and the job correctly stopped at the per-minute AI rate limit ("Scored 20 of 34 deals (AI limit reached)"). The spec now skips the header checkbox and scores exactly two, after which the job reports "Scored 2 of 2 deals"; this also confirmed the rate-limit stop works in the real stack.
- 4.1: the full `pnpm e2e` run is green, 21 tests including spec 11, and the 6 `p7-*` screenshots exist.

- 4.2: the full `pnpm test:integration` run is green on the final tree: 400 files, 2004 tests. `DOCKER_BUILDKIT=0 pnpm smoke` printed SMOKE PASS with `COMPOSE_PARALLEL_LIMIT=1` (four concurrent image builds exceed the Docker VM, as in Task 0.2) and left no `dealflow-smoke` container or volume.
- 4.2: reviewing the `p7-report-builder` screenshot exposed a real bug: a date group over an all-time range had no date filter, so rows with a NULL date (an unwon deal in a "won by month" report) produced a NULL group key that the cap rolled into "Other". Both compilers now add `AND <date column> IS NOT NULL` when the group field is a date, and two integration cases pin it (deals and activities). The full integration suite was re-run after the fix (2004/2004) and `pnpm e2e` was re-run too (21/21), so both runs describe the final tree.
- 4.2: `e2e/11-insights.spec.ts` now closes the select popover and waits out the 400 ms preview debounce before its builder screenshot, so the refreshed `p7-report-builder` shows the wired chart instead of a stale preview and an open dropdown.

- 4.3: round 1 fixed six findings: the formatter errors Biome found (the blocker); `listDashboards` now orders the default dashboard first; Explain became a CSRF-guarded server action (`explainReportAction` with `readCsrfToken()`) and the unguarded tRPC mutation was removed, since 6.7 says mutations are server actions with CSRF; dashboard report charts carry `role="img"` and an aria-label; the 6.2 copy now maps through `insightErrorMessage` instead of raw ids; and chart axes and tooltips format money with `formatMoney` in the base currency rather than bare numbers.
- 4.3: round 2 fixed the last minor (AddWidgetDialog also maps its error id through `insightErrorMessage`) and the `p7-explain` screenshot now waits for the Sheet slide to finish. Round 3 returned QA RESULT PASS.
- 4.3: Docker Desktop's daemon died during a round 2 e2e run (the dev Postgres container stopped with it). I restarted Docker Desktop, ran `pnpm dev:up` to bring the dev stack back, and reran the full e2e green; nothing was removed or pruned.
- 4.3: the round 1 review ran `typecheck`, `lint` (which exposed the formatter blocker), `test:unit` and `build`; after each fix round the Task 3.5 gate commands and the full e2e were re-run on that tree, and every review passed with the builder's evidence.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on every command that loads `.env`.
- TODO(owner): rebuild the dev stack so it reads migrations 0085 to 0088 once they are applied: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2). Recreate it with `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` if `/tmp` was cleared.
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211. Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312).
- Docker 24.0.5 is up and the dev stack is running (Postgres on 5433, MinIO on 9000/9001; `pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left", log `TODO(owner): free Docker disk space` and mark the step SKIPPED.
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report

### Checklist

1. PASS - `git --no-optional-locks status --porcelain` printed nothing immediately before this record.
2. PASS - `pnpm install --frozen-lockfile` exited 0 in 1s, and `git diff 8957a53..HEAD -- package.json pnpm-lock.yaml` printed nothing: no dependency changed.
3. PASS - `pnpm typecheck` exited 0 on the final tree.
4. PASS - `pnpm lint` exited 0 (biome checked 3055 files; 14 pre-existing warnings, 0 errors).
5. PASS - `pnpm test:unit` passed 5237/5237 in 813 files (baseline 5197; the 40 new pure definition/range/CSV cases).
6. PASS - `pnpm test:integration` passed 400 files and 2004 tests on the final tree.
7. PASS - `pnpm build` exited 0 and lists `/insights`, `/insights/reports/[id]` and `/insights/dashboards/[id]` (plus `/insights/reports/[id]/export.csv`).
8. PASS - `pnpm e2e` passed 21/21, specs `00` to `11`.
9. PASS - 6 `p7-*` and 7 `p6-*` screenshots exist; the earlier sets are intact: 23 `p1-*`, 8 `p2-*`, 6 `p3-*`, 7 `p4-*`, 6 `p5-*`.
10. PASS - `DOCKER_BUILDKIT=0 pnpm smoke` printed SMOKE PASS and left no `dealflow-smoke` container or volume.
11. PASS - `drizzle/0087_dealflow_insights.sql` creates exactly `dashboard_widgets`, `dashboards` and `reports`; `0088` adds the one `ai_bulk_score` enum value.
12. PASS - every `sum(value)` hit is grouped by currency: `compile/deals.ts` GROUP BY 1,2,3 (g,s,currency), `dealPerformance` GROUP BY 1 (currency), `lostReasons` 1,2,3 (reason,name,currency), `stageSums` 1,2,3,4 (stage,name,order,currency), `wonTrend` 1,2 (month,currency), `goalActual` 1 (currency), `goalSeries` 1,2 (day,currency); `wonDealStats` has no SQL sum (it converts one row per deal).
13. PASS - `git grep -nE "#[0-9a-fA-F]{6}" -- src/features/insights/ui` printed nothing; colours come from the token palette and chart wrapper variables.
14. PASS - the explain prompt test `sends only aggregated rows to the model` (in `insights.integration.test.ts`) asserts the prompt carries aggregated rows and no deal title or email.
15. PASS - the em dash scan over every changed non-kit file printed nothing.
16. PASS - `docs/dealflow/INSIGHTS.md` exists and `UPSTREAM.md` lists the Part 7 upstream files plus the demo/docs subsection.
17. PASS - `pnpm check:progress --final` was run in Task 4.5 on the completed file.
