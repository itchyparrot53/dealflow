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
| 3 | Lint | `pnpm lint` | pass after environment fixes | Biome 2,672 files / 12 warnings, ESLint 0 problems | 54s |
| 4 | Unit tests | `pnpm test:unit` (TZ=UTC, en-US) | pass | 4,889 tests in 783 files | 100s |
| 4b | Unit tests, machine default | `pnpm test:unit` | 13 failures (locale only, see below) | 4,876 passed / 13 failed | 164s |
| 5 | Integration tests | `pnpm test:integration` (real Postgres container) | pass | 1,758 tests in 381 files | 204s |
| 6 | Production build | `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build` | pass after the flag override | all routes compiled | 58s |
| 7 | Demo seed | `pnpm db:seed:demo` on a fresh scratch database | pass | 50 orgs, 100 people, 50 deals, 411 activities, 125 emails, 51 notes | 16s |

Notes on the two red results that were fixed in this task rather than logged as pre-existing:

- **Lint, first runs.** Biome flagged the kit's own `scripts/check-progress.mjs` (console use, format),
  the generated `docs/dealflow/mail-probe-result.json` (its JSON formatting), and an unused variable
  in `src/components/ui/DatePicker.tsx`; ESLint could not type-parse `scripts/dealflow/env-sync.mjs`
  or `scripts/e2e/*.mjs` because the project service did not include those folders, and then exceeded
  its default-project file cap. Fixed by ignoring the kit folder, the stray `DEALFLOW/` copy and the
  generated probe JSON; adding `scripts/dealflow/*.mjs` and `scripts/e2e/*.mjs` to
  `allowDefaultProject` with a cap of 20; and turning the DatePicker `??=` into an explicit null check
  that reads the cached chunk (same behaviour). No test or assertion was touched.
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

Playwright 1.64.1, Chromium, production build on port 3210 (WebSocket server on 3211), throwaway
`dealflow_e2e` database seeded with the demo data, signed in as `demo1@example.com` through a real
session row. Spec: `e2e/00-health.spec.ts`; result: 9 passed in 16.2s (`pnpm e2e`, 51s including the
build). Every page: HTTP 200 after redirects, URL never contains `/login`, no boundary error
heading. Screenshots are full page, 1440x900, in `e2e/screenshots/` (ignored by git).

| # | Page | Route | HTTP status | Screenshot |
|---|---|---|---|---|
| 1 | Pipeline | `/pipeline` | 307 to `/pipeline/{pipelineId}`, then 200 | `p1-00-pipeline.png` |
| 2 | Deal workspace | `/deals/{dealId}` | 200 | `p1-00-deal.png` |
| 3 | People | `/contacts/people` | 200 | `p1-00-people.png` |
| 4 | Organizations | `/contacts/orgs` | 200 | `p1-00-orgs.png` |
| 5 | Leads | `/leads` | 200 | `p1-00-leads.png` |
| 6 | Activities | `/activities` | 200 | `p1-00-activities.png` |
| 7 | Inbox | `/inbox` | 200 | `p1-00-inbox.png` |
| 8 | Dashboard | `/dashboard` | 200 | `p1-00-dashboard.png` |
| 9 | Settings (profile) | `/settings/profile` | 200 | `p1-00-settings.png` |

Harness notes for later parts:

- `pnpm e2e` = `pnpm e2e:build` (Next build with the e2e env inlined) then `playwright test`, which
  starts `scripts/e2e/e2e-server.mjs` (it recreates and seeds `dealflow_e2e`, writes
  `.e2e/admin.json`, `.e2e/rep.json` and `.e2e/fixtures.json`, then runs the app and the ws server).
- Chromium is installed outside the project (`PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers`
  in this run) because the harness file sandbox cannot write to the default browser cache.
- `src/entrypoints/ws.ts` runs through tsx in the harness, so its startup moved into an async
  `main()`: tsx treats a `.ts` file in a CommonJS package as CJS, where top-level await does not
  compile.

## Notes for Part 2

- The mail probe result is recorded in `docs/dealflow/mail-probe-result.json` (Task 0.6) and says
  `status: ok`. It ran against Purelymail (`d***@umev.co.uk`) with owner credentials:
  - SMTP send works: `250 2.6.0 Message received`, and the message arrives at the recipient.
  - IMAP IDLE works, but the server push is not instant: measured latency was 8.3s and 11.1s on two
    runs. Part 2 must not assume sub-second delivery.
  - The host does **not** save SMTP-sent messages into `\Sent` (`autoSaved: false`), so the app must
    `APPEND` a copy after sending. `APPEND` itself works and returns a uid (`appendWorked: true`).
  - `MOVE` from INBOX to `\Trash` works.
  - The IMAP SEARCH index lags behind `APPEND` by more than five seconds: a message appended right
    now is not findable by SEARCH yet. Verify appends with `STATUS` counts or the APPEND uid, never
    with an immediate SEARCH.
  - Capabilities: `IMAP4rev1 IDLE QRESYNC CONDSTORE MOVE UIDPLUS ESEARCH SORT SORT=DISPLAY`
    (`ESORT`), `SEARCHRES NAMESPACE CHILDREN COMPRESS=DEFLATE LITERAL+ SASL-IR ENABLE WITHIN
    AUTH=PLAIN I18NLEVEL=1 RIGHTS= ANNOTATION`; QRESYNC and CONDSTORE are enabled on the session.
  - Special-use folders all exist: `INBOX`, `Sent`, `Drafts`, `Archive`, `Junk`, `Trash`.
- Probe artifacts left in the mailbox (safe to delete): the `Dealflow mail probe ...` messages in
  `\Sent` and `\Trash`, plus one `append diagnostic` message from a one-off APPEND check.
- The demo seeder requires a clean database: re-running it against a database that holds activities
  owned by non-demo users aborts on `activities_deal_id_deals_id_fk` because its wipe only removes
  demo-owned activities. The baseline seeded a fresh scratch database instead.
- `docker-compose.local.yml` (shipped in the export) documents this machine's constraints: port 3000
  is taken, quay.io MinIO images are unavailable here (the local file uses `pgsty/minio`), and Caddy
  is disabled. PLAN-PART1.md 6.11 is written for a box without those constraints.

## Part 1 end

- Integration suite (`pnpm test:integration`, `TZ=UTC` locale env): **1788/1790 passed** across 385
  files. The two failures are `src/features/release/router.test.ts`; the box's `.env` sets
  `DISABLE_UPDATE_CHECK=true` (the fork default), which makes `version.get` return no release, while
  the upstream test asserts the enabled default. With `DISABLE_UPDATE_CHECK=false` the file passes
  2/2. Recorded as a PRE-EXISTING/environmental failure in Open issues instead of editing an
  upstream test.
- Container smoke (`pnpm smoke`): **SMOKE PASS**. The stack built and booted, `/api/health` returned
  200, a magic-link request answered 303 to `/login?sent=1`, an app restart kept the health check
  green, and the seeded admin row read back as `1`. Cleanup left `0` `dealflow-smoke` containers
  and `0` volumes.
- In this harness the smoke build runs with `DOCKER_BUILDKIT=0`: buildx keeps refs under
  `~/.docker/buildx`, which is outside the harness file sandbox (the Docker daemon itself is fine).
  On a normal host plain `pnpm smoke` works.

## Part 2 live check (2026-10-20)

`pnpm mail:live-check` against the owner's Purelymail mailbox returned `status: ok`:
SMTP send, Sent APPEND, inbound arrival in 5.7 s, no `Bcc` on the received copy, the
reply parsed with `In-Reply-To`/`References` pointing at the first message, Message-ID search in
Sent found the copy, and both inbound copies moved to Trash. Total 30.2 s. The re-run after the
SPECIAL-USE fix reported `inbox`, `sent`, `drafts`, `archive`, `junk` and `trash` for the six
folders.
Result: `docs/dealflow/mail-live-check.json`.

Purelymail facts the check confirmed or added:
- **SPECIAL-USE flags are sent with a leading backslash.** The first live check read them through a
  mapper that compared the raw value (`\Sent`) with `sent`, so every folder looked unflagged. The
  mapper now strips the backslash (unit-tested for `\Inbox`, `\Sent`, `\Junk`, `\Trash`,
  `\Archive` and an unknown `\All`); folder discovery still falls back to the folder name for
  servers that send no flags at all.
- SMTP-sent mail is still not saved by the server; the APPEND is required.
- A new message is in INBOX about 6 s after the SMTP send, which matches the earlier 8 to 11 s
  IDLE observation closely enough for the poll cadence.

## Part 2 end (2026-10-20)

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 (14 warnings, 0 errors) |
| `pnpm build` | exit 0 |
| `pnpm test:unit` | 4979/4979 in 795 files |
| `pnpm test:integration` | 1819/1819 in 389 files, 161.7 s |
| `pnpm e2e` | 16/16 across specs 00 to 06; 8 `p2-*` screenshots, 23 Part 1 screenshots intact |
| `DOCKER_BUILDKIT=0 pnpm smoke` | SMOKE PASS; no `dealflow-smoke` container or volume left |
| `pnpm mail:live-check` | status ok (see the live check section above) |
| `pnpm db:seed:demo` | succeeded on a throwaway `dealflow_seed_p2` database (7 users, 54 deals, 125 messages), dropped afterwards |

Operational notes:
- Container builds in this sandbox need `DOCKER_BUILDKIT=0`; buildx refs under `~/.docker/buildx` are blocked.
- `next build` can fail with `ENOTEMPTY` on `.next` if a build starts while the directory is being
  touched; remove `.next` and retry.
- Purelymail reports no SPECIAL-USE flags, so folder discovery falls back to folder names (fixed in
  Task 5.2 after the live check exposed it).
- The e2e demo data seeds Gmail rows without refresh tokens, so the worker logs expected
  `[email.sync] failed ... no usable refresh token` noise during e2e; spec 06 disconnects demo1's
  mailbox before connecting IMAP.
