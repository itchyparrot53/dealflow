# PROGRESS: dealflow-wd-p7-v1

STATUS: IN PROGRESS
Current: 3.1 · Last updated: 2026-10-21 13:29

## Phase base commits
- Phase 0: 8957a53e58b608f1d30dd9e46d05080439bd4b98
- Phase 1: 4d77639
- Phase 2: b1d3d81
- Phase 3: 64a1153

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
- [ ] 3.1 Insights home and report builder
- [ ] 3.2 Dashboards
- [ ] 3.3 Score badge and bulk scoring UI
- [ ] 3.4 Demo seed and docs
- [ ] 3.5 Phase 3 QA gate
- [ ] 4.1 E2E insights spec and screenshots
- [ ] 4.2 Integration suite and smoke
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (14 warnings) · build ok · unit 5197/5197 in 810 files
- Part 6 proof: integration 249/249 (51 files) · e2e 20/20 (specs 00 to 10) · p6 screenshots 7/7 · smoke PASS
- Phase 0 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5237/5237 · forms/scheduling integration 17/17
- Phase 1 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5237/5237 · insights/stats/goals integration 119/119
- Phase 2 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5237/5237 · insights/ai/notifications integration 104/104

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
- Docker 24.0.5 answers, but no container is running: the owner's `warpdrive-main` stack (dev Postgres on 5433, MinIO on 9000/9001) is stopped, so `db:migrate:dev` and `db:seed:demo` need it started first. Never prune; if a build fails with "no space left", log `TODO(owner): free Docker disk space` and mark the step SKIPPED.
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).
