# Health check: the untouched warpdrive export

Baseline recorded 2026-10-19 on this machine before any Dealflow product change, as Task 0.4 of
PLAN-PART1.md requires.

## Environment

| Tool | Version |
|---|---|
| OS | macOS Darwin 25.5.0 (arm64) |
| Node | v24.16.0 |
| pnpm | 9.15.9 (temporary install outside the project, see PROGRESS.md Decisions) |
| TypeScript | 6.0.3 |
| Docker | 24.0.5 (daemon running) |
| git | 2.50.1 (Apple Git-155) |
| Postgres for dev | the already-running `postgres:16-alpine` container on `localhost:5433` |
| MinIO for dev | the already-running `pgsty/minio` container on `localhost:9000` |

Two environment sensitivities are recorded rather than fixed in the code, because they are machine
settings and the plan forbids changing tests:

- The suite asserts **en-US** date and money formatting and **UTC** local dates. Under the machine
  default (`Europe/London`, en-GB) 13 untouched tests fail on formatting alone. Running the suite
  with `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` makes all of them pass.
- `.env` carries `ALLOW_FIRST_LOGIN_ADMIN=true` for local dev, which `src/config/env.ts` rejects at
  build time in production mode, so `pnpm build` was run with `ALLOW_FIRST_LOGIN_ADMIN=false` in the
  shell (the value the e2e harness uses too).

## Results

| # | Step | Command | Result | Count | Duration |
|---|---|---|---|---|---|
| 1 | Install | `pnpm install --frozen-lockfile` | pass | 1,398 packages | 27s |
| 2 | Typecheck | `pnpm typecheck` | pass | 0 errors | 16s |
| 3 | Lint | `pnpm lint` | pass | Biome 2,663 files / 13 warnings, ESLint 0 problems | 174s + 60s |
| 4 | Unit tests | `pnpm test:unit` (TZ=UTC, en-US) | pass | 4,889 tests in 783 files | 100s |
| 4b | Unit tests, machine default | `pnpm test:unit` | 13 failures (locale only, see below) | 4,876 passed / 13 failed | 164s |
| 5 | Integration tests | `pnpm test:integration` (real Postgres container) | pass | 1,758 tests in 381 files | 204s |
| 6 | Production build | `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build` | pass after the flag override | all routes compiled | 58s |
| 7 | Demo seed | `pnpm db:seed:demo` on a fresh scratch database | pass | 50 orgs, 100 people, 50 deals, 411 activities, 125 emails, 51 notes | 16s |

Notes on the two red results that were fixed in this task rather than logged as pre-existing:

- **Lint, first run.** Biome flagged the kit's own `scripts/check-progress.mjs` (console use, format)
  and ESLint could not type-parse `scripts/dealflow/env-sync.mjs` because the project service did not
  include its folder. Fixed by excluding the kit folder and the stray `DEALFLOW/` copy from Biome and
  ESLint, and adding `scripts/dealflow/*.mjs` to `allowDefaultProject`. No app file was touched.
- **Build, first run.** Failed while collecting page data with
  `Invalid environment: ALLOW_FIRST_LOGIN_ADMIN: ALLOW_FIRST_LOGIN_ADMIN must be false in production`,
  because `next build` runs with `NODE_ENV=production` while `.env` holds the dev value. Fixed by
  passing `ALLOW_FIRST_LOGIN_ADMIN=false` for the build; `.env` was not edited.

## Pre-existing failures

These fail in the untouched export on a machine whose default locale is not en-US. The tests are
correct for the code as written; they are environment-sensitive. Per task instruction no test was
edited, and the environment is set when the suite runs. Gate rule: they count as green only when
they are exactly these names and the environment fix is applied.

| Test file | Test | Error excerpt | What was done |
|---|---|---|---|
| `src/features/email/inboxDate.test.ts` | 4 tests (`formatInboxListDate`, `formatReaderDate`) | `expected '2 Jul' to match /^Jul\s+2$/` under en-GB | environment: run with en-US locale |
| `src/features/stats/ui/trendTooltip.test.ts` | 3 tests | money rendered `US$1,500` instead of `$1,500` | environment: run with en-US locale |
| `src/features/stats/ui/widgets.test.tsx` | 2 tests (`keeps the deal count beside the reason name`, `right-aligns both numeric columns`) | `$418,500` not found (rendered `US$418,500`) | environment: run with en-US locale |
| `src/features/stats/ui/TrendWidget.test.tsx` | 1 test (`carries every plotted number in an accessible table`) | `Unable to find an element with the text: $1,500` (rendered `US$1,500`) | environment: run with en-US locale |
| `src/features/deals/DealList.test.tsx` | 1 test (`renders the Expected close date column with a locale-formatted date`) | locale-formatted date mismatch | environment: run with en-US locale |
| `src/features/email/ThreadRow.test.tsx` | 1 test (`renders the row date at the larger font`) | `Unable to find` the localised date cell | environment: run with en-US locale |
| `src/features/activities/AddActivityModal.test.tsx` | 1 test (`submits with the leadId and dueAt when a date is provided`) | `expected "vi.fn()" to be called with arguments`; passes under `TZ=UTC` | environment: run with UTC |

With `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` the whole suite passes: 4,889/4,889.

## Click-through

Filled in Task 0.5 (Playwright, production build on port 3210, seeded `dealflow_e2e` database).

## Notes for Part 2

- The mail probe result is recorded in `docs/dealflow/mail-probe-result.json` (Task 0.6).
- The demo seeder requires a clean database: re-running it against a database that holds activities
  owned by non-demo users aborts on `activities_deal_id_deals_id_fk` because its wipe only removes
  demo-owned activities. The baseline seeded a fresh scratch database instead.
- `docker-compose.local.yml` (shipped in the export) documents this machine's constraints: port 3000
  is taken, quay.io MinIO images are unavailable here (the local file uses `pgsty/minio`), and Caddy
  is disabled. PLAN-PART1.md 6.11 is written for a box without those constraints.
