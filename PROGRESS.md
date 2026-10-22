# PROGRESS: dealflow-wd-p10-v1

STATUS: IN PROGRESS
Current: 4.5 · Last updated: 2026-10-22 10:05

## Phase base commits
- Phase 0: de06153cc5eea0e1bcfbe6609da262cd90107fe3
- Phase 1: 93068017be4b4b47442fc9f0023b413bbfa90ef2
- Phase 2: 6551751
- Phase 3: 81139f1
- Phase 4: aabb1c7

## Tasks
- [x] 0.1 Start Part 10: progress files, kit and baseline
- [x] 0.2 Schema, dependencies, env and scripts
- [x] 0.3 Pure core (test-first)
- [x] 0.4 Phase 0 QA gate
- [x] 1.1 Manifest, icons, metadata and install
- [x] 1.2 Service worker, registration and update prompt
- [x] 1.3 Offline records and the offline page
- [x] 1.4 Phase 1 QA gate
- [x] 2.1 Subscriptions, preferences and the worker push handler (test-first)
- [x] 2.2 Delivery and settings UI (test-first)
- [x] 2.3 Phase 2 QA gate
- [x] 3.1 Mobile shell
- [x] 3.2 Key screens on mobile
- [x] 3.3 Create anywhere and activities search
- [x] 3.4 Smoke seed, demo and docs
- [x] 3.5 Phase 3 QA gate
- [x] 4.1 E2E PWA and mobile spec and screenshots
- [x] 4.2 Integration suite and smoke
- [x] 4.3 Independent review and hardening
- [x] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (15 warnings) · build ok · unit 5320/5320 in 828 files
- Phase 0 gate: commands green · typecheck ok · lint ok (15 warnings) · build ok · unit 5345/5345 in 832 files · no named integration files in this gate (DoD 1 to 4)
- Phase 1 gate: commands green · typecheck ok · lint ok (15 warnings) · build ok · unit 5350/5350 in 833 files · no named integration files in this gate (DoD 3 to 5)
- Phase 2 gate: commands green · typecheck ok · lint ok (15 warnings) · build ok · unit 5351/5351 in 833 files · push/notifications integration 67/67 (12 files)
- Phase 3 gate: commands green · typecheck ok · lint ok (15 warnings) · build ok · unit 5351/5351 in 833 files · activities/export/push integration 147/147 (36 files)
- Independent review: subagent (fresh context) round 1: QA RESULT FAIL · 1 blocker/4 majors/7 minors · fixed the blocker, all 4 majors and minors 7 to 12

## Decisions
- 0.1: section 4 starting point matches: `PROGRESS.md` said `dealflow-wd-p9-v1` with `STATUS: COMPLETE`, so the run renames it to `PROGRESS-P9.md` and starts Part 10 at Task 0.1.
- 0.1: Docker 24.0.5 answers and `docker run --rm alpine df -h /` reports 33.6 GB free of 95.0 GB (63% used), above the 10 GB fatal threshold, so the baseline proceeds without pruning.
- 0.1: the kit arrived untracked at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part10-kit` (the Part 2 to 9 layout), added the root `PLAN-PART10.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical, `PLAN_FILE` now `PLAN-PART10.md`).
- 0.1: the last migration is `0091_dealflow_activity_extras.sql`, so 0092 is the next free number and the planned `0092_dealflow_push` name holds.
- 0.1: `npm view web-push version` prints 3.6.7 and `@types/web-push` 3.6.4, so the planned pins hold; `esbuild` is already a dev dependency at `^0.28.1` and `build:sw` reuses it.
- 0.1: `src/app/icon.png` (512x512) and `src/app/apple-icon.png` (180x180) both exist, so Task 1.1 generates the PWA icons from `src/app/icon.png` with `sips` and no new dependency.
- 0.1: the notification producer is `src/features/notifications/produce.ts` (`createNotification`), called from `deliver()` in `src/features/notifications/wire.ts`; the email channel is decided in `src/features/notifications/emailDispatch.ts` through `resolveDelivery` in `preferences.ts` with the defaults in `src/constants/notificationDefaults.ts`. Task 2.2 hooks push into `deliver()` after the row commits.
- 0.1: the shell is `src/app/(app)/layout.tsx` with `src/components/shell/LeftNav.tsx`, `TopBar.tsx` and `UserMenu.tsx`; Task 3.1 adds the bottom navigation beside them and Task 1.1 mounts the install entry in the user menu and Settings > Profile.
- 0.2: `drizzle/0092_dealflow_push.sql` creates exactly `push_subscriptions` and `notification_push_prefs` (plus the user index) and is applied to the dev database (93 migration rows). `build:docker` and `e2e:build` also run `build:sw`, because the Docker image and the e2e production stack both serve the worker and neither runs the plain `build` script.
- 0.2: VAPID is all-or-nothing in `src/config/env.ts` (same rule as Google): one or two of the three set is a boot error, all empty is "push off". `PUSH_FAKE`/`PUSH_FAKE_DIR` are separate so capture mode works with no keys.
- 0.2: `public/sw.js` and `.push-capture/` are git-ignored and excluded from biome and eslint; the bundled worker is a build output and lint would otherwise try to type-check it outside the app tsconfig.
- 0.2: `e2e/fixtures/vapid.json` holds a generated test pair (public values only) and `scripts/e2e/e2e-env.mjs` reads it to set `VAPID_*`, `PUSH_FAKE=true` and `PUSH_FAKE_DIR=.push-capture`.
- 0.3: the 25 pure-core cases were written before their four modules; the first run failed with "Cannot find module" in all four test files, then the implementation passed. `decide` applies the six rules in order and exempts `/insights/reports/{id}/export.csv` while a report page itself is still a navigation fallback.
- 0.3: snapshot inputs list the fields that must not be stored (`note` on an activity, `notes` on a person) so the tests prove the body text is dropped; `toDealSnapshot` caps recent activities at 5 and all four builders take an injectable `now` for a deterministic `savedAt`.
- 0.3: `trimToNewest` dedupes by id keeping the newest `savedAt` (ties keep the later copy) and sorts newest first, so a re-saved record replaces its old copy.
- 0.3: `buildPushPayload` truncates the body to exactly 140 characters ending in "…" and only accepts links that start with `/` and not `//`; absolute, protocol-relative, `javascript:` and bare-relative links all become `/notifications`. The `PUSH` error domain (E_PUSH_001 to 004) is appended to the registry and its test allow-list.
- 1.1: the manifest colours come from the design tokens (light background #ffffff, primary #0f172a), `themeColor` is exported from the root layout's `viewport` (this Next version deprecates `metadata.themeColor`), and `viewportFit: "cover"` is set so safe-area insets work in an installed app.
- 1.1: the three icons are generated from `src/app/icon.png` with `sips`; the maskable one pads the 512 icon to 640 on the brand navy and scales back to 512 (20% total padding). No new dependency.
- 1.1: `installPrompt.ts` captures the single `beforeinstallprompt` event in a module-level store read through `useSyncExternalStore`; the account menu only shows "Install app" when the prompt is actionable (an instruction there would just close the menu), while Settings > Profile always shows an entry (prompt button, iOS Share instructions, or a browser-menu hint) and nothing once installed.
- 1.2: the worker is bundled to one classic script and imports app modules through the same `@` alias, so `scripts/dealflow/build-sw.mjs` gained an `alias` entry. It precaches only `/offline` plus the icons and manifest, caches static assets cache-first, serves navigations network-first with the offline page as fallback, never caches an HTML or API response, and deletes every other `dealflow-` cache on activate.
- 1.2: the toast store gained optional `testId` and `action.testId` (defaulting to `toast`/`toast-undo`) so the update prompt exposes `update-available`/`update-reload` without a second notification UI. The prompt stays for an hour instead of the 8s undo window, and reload waits for `controllerchange` after posting `SKIP_WAITING`.
- 1.2: `register.ts` takes a `production` prop from the server layout instead of reading `process.env` in a client component (the env boundary is server-only); development unregisters existing workers.
- 1.2: `next.config.ts` adds `worker-src 'self'` to the strict CSP and serves `/sw.js` with `Cache-Control: no-cache, no-store, must-revalidate` and `Service-Worker-Allowed: /`. The `/offline` shell is a client page because its "Try again" button reloads; Task 1.3 fills it from IndexedDB.
- 1.3: the offline store is one IndexedDB per user (`dealflow-offline-{userId}`) with one object store per type; `today` uses an out-of-line key because its snapshot has no id. Every helper resolves a `Result` and closes the connection, so blocked storage only disables offline mode.
- 1.3: the wipe rule is a pure `decideWipe(previous, current)` (record on first sign-in, keep for the same user, wipe for a different user or sign-out) with five unit cases; the IndexedDB calls are separate, as the plan allows without `fake-indexeddb`.
- 1.3: snapshots are written from the deal workspace, person and organization detail pages, and the activities table (today's due rows). The person and org pages gained one small owner-name read, and the org page reuses the visibility-scoped `listPeopleForOrg` for `peopleCount`.
- 1.3: `/offline` is now the tabbed read-only app (Deals, People, Organizations, Today) with saved times, a detail view and the empty state; the account menu's Log out wipes this device first and then follows `/auth/logout`, and the app shell wipes when the signed-in user differs from `dealflow-offline-user`.
- 1.4 fixes: the gate's first unit run caught three regressions from the install and offline work: the install store called `window.matchMedia` unguarded (jsdom has none), a new offline `h1` missed the `text-display` page-title rule, and `SignOutLink` needed `forwardRef` plus the prop spread so the Radix menu keeps its `menuitem` role. All three were fixed, not asserted around.
- 2.1: the 11 subscription/preference/config cases were written before the modules. `subscribePush` upserts on the unique endpoint so a re-subscribe (or another user on the same browser) moves the row instead of duplicating it; non-https or empty keys return `E_PUSH_002` and a Zod failure `E_PUSH_004`.
- 2.1: push defaults live beside the email defaults in `src/constants/notificationDefaults.ts`: on for mention, activity_assigned, project_task_assigned, booking_created, document_accepted and form_submission, off for the rest; a missing row always reads the map.
- 2.1: the tRPC router exposes reads only (`push.config`, `push.subscriptions`, `push.preferences`) and `config` returns `{ enabled, publicKey }` from the pure `pushConfigFrom`, so the private key cannot appear in a client payload; all mutations go through CSRF-checked server actions (`actions.ts`).
- 2.2: delivery is hooked into `deliver()` in `src/features/notifications/wire.ts` after the notification commits, and `enqueueOrDeliverPush` uses the `push.deliver` pg-boss queue when one is running (registered in `src/server/worker.ts`), otherwise delivers inline. Every failure is logged and swallowed, so push can never fail the notification or the email.
- 2.2: the notification label builder moved from the client `NotificationItem` into the server-safe `src/features/notifications/labels.ts`, so the push title is exactly the in-app text (body empty, never invented copy) and the link comes from the existing `notificationHref`.
- 2.2: six delivery cases pass on real Postgres (capture file per subscription, preference off, not configured, 410 removal, five failures, success reset). The tests inject `mode`/`sender` so no VAPID key or network is needed; production still reads `PUSH_FAKE`/web-push from env.
- 2.2: the settings page gained a Push card (`push-settings`, `push-status`, `push-enable`) and a third switch per type (`push-pref` with `data-type`); `PreferencesForm` now takes `push` in its row shape and its tests were updated for the new contract, plus one new push-toggle case.
- 2.2: on iOS the settings explain the Home Screen requirement; capture mode writes JSON to `PUSH_FAKE_DIR` and records a success, exactly as a real send would.
- 2.3 fixes: the gate's unit run caught the notifications settings page test whose tRPC mock predated the Push card (it had no `push.config`/`push.preferences`), so the page rendered nothing and the layout guard failed. The mock was extended to the page's real reads; no assertion was weakened.
- 3.1: nav icons moved into one `NAV_ICONS` map in `src/components/shell/NavIcons.tsx`; the rail, the new bottom bar and the More sheet all read it, so a new item cannot get a different glyph per surface. Below 768px the rail is hidden and `BottomNav` shows Deals, Activities, Inbox, Contacts and More; More is the shadcn `Sheet` listing every remaining nav item including Settings.
- 3.1: the shell adds `pb-24` to the content area below md so the fixed bar never covers the last row, and the bar pads itself with `env(safe-area-inset-bottom)`; the top bar drops the brand, quick-add and assistant below md, leaving search, notifications and the avatar.
- 3.2: the board becomes one 85vw snap column per swipe (its list still scrolls internally, never the page); the deal workspace puts the main panel first and the sidebar sections below it on a phone, keeping the two-column split at lg; the activities table renders cards below md (`useIsMobile`, which reads as desktop when `matchMedia` is missing so jsdom and the server keep the table markup); the documents table got an overflow container and the inbox context sidebar is hidden below md.
- 3.2: the mobile activities cards duplicate text in the DOM if rendered always, which broke 16 existing activities tests. They now render only when `useIsMobile()` is true, so the tests and the server see exactly the table markup they did before; no assertion was changed.
- 3.3: `CreateDialogProvider` owns the existing deal, person, organization, activity, project and call dialogs and is mounted once in the app shell. The `n` sequences and the palette's Create commands call `openCreate`; the shortcut registry now encodes actions as `navigate:<href>` or `create:<kind>` (the help sheet and the documented `href` per sequence are unchanged).
- 3.3: "Log a call" uses the deal/person/organization already on screen (path-derived); anywhere else a small person picker chooses the record before the existing `LogCallForm`. The project dialog opened from anywhere starts with empty optional deal/owner lists, which `createProject` already accepts; the projects page keeps its richer local dialog.
- 3.3: activities gained `search` (trimmed, max 100) in the filter schema, SQL `ilike` over subject and note, the URL-backed list state (`?search=`), and the toolbar input `activities-search`. The CSV export filters subject or note in `filterActivities`, and the generic subject-only search is skipped for activities so a note-only match is not dropped; `ActivityTableRow` carries the note for that.
- 3.3: three activity test files gained `search: null` in their filter literals (the changed filter contract), and new real-Postgres cases cover list search by subject and note plus the export's note-only match.
- 3.4: `scripts/dealflow/smoke.mjs` seeds three deals ("Smoke renewal", "Smoke expansion", "Smoke pilot") in a pipeline and stage it creates if missing, owned by the seeded admin, after the restart check and before the backup round trip, so the dump/restore comparison has a non-zero count.
- 3.4: `docs/dealflow/PWA.md` covers install on desktop/Android/iOS, exactly what is stored offline and the shared-device trade-off, the update prompt, push setup (`pnpm push:vapid`, the three keys, `PUSH_FAKE`), the per-type preferences and the iOS Home Screen requirement, and the mobile layout. `UPSTREAM.md` lists the Part 10 files and `README.md` gained a Part 10 section.
- 3.5 fixes: the gate's unit run caught `ActivitiesTable.sort.test.tsx`, whose expected `listRows` input predated the new `search` filter field; the expectation gained `search: null` (same changed-contract group as the other activity filter literals), and no assertion was relaxed.
- 4.1: the e2e spec proved the manifest and worker, offline snapshots and the SW-served /offline app, the wipe on sign-out and for a second user, push capture, and all nine mobile routes. It caught four real gaps, fixed rather than asserted around: push was hooked only in the notification wire, so form/booking/document/automation producers never pushed (it now runs in `createNotification` after the row commits, which every producer goes through); the precached `/offline` HTML pulled its hashed CSS/JS from the network, so offline the page was unstyled and never hydrated (the worker now precaches the static assets referenced by the shell); the offline banner trusted only `navigator.onLine` (the last online/offline event is now authoritative); and five controls with test ids were 32px tall (log call, the two document buttons, the create-project button and the CSV export link).
- 4.1: the spec stubs `ServiceWorkerRegistration.pushManager` so no real push service is contacted, and triggers a default-on push by submitting a public form from a visitor context instead of a mention from a second signed-in session; both still exercise the real subscribe action, preference gate and capture writer. Full suite: 24/24 (specs 00 to 14), 8 `p10-*` screenshots.
- 4.2: the full integration suite is green on the final tree: 2097/2097 tests in 412 files (baseline 2077/410). `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke` printed `SMOKE PASS` and `backup round trip ok (3 deals)`, and left no `dealflow-smoke` container or volume.
- 4.2: the first smoke run failed at the new seed with `column "probability" of relation "stages" does not exist` (Part 8 moved stage probability to `stage_probabilities`); the seed now inserts only `pipeline_id, name, order`, and the rerun passed with the three deals compared.
- 4.3: independent review round 1 (fresh-context subagent, `.dsh/qa.md`) returned FAIL: 1 blocker (two files Biome would reformat, so `pnpm lint` exited 1), 4 majors (contacts rail left ~110px and no cards; no mobile agenda; composer not sticky; primary controls under 40px) and 7 minors. The blocker, all 4 majors and minors 7 to 12 are fixed; minor 6 (inbox reply composer as a sheet) is an Open issue.
- 4.3: contacts below md now hide the contacts rail and render card rows with name, organization or people count, and owner (the owner name is a batched read in `listPeople`/`listOrgs`, optional on the row types so the desktop table is unchanged). The calendar gained a `day` view and shows the agenda below md; the composer is sticky above the bottom nav; a mobile media rule raises every `main` button and test-id link to 40px, and the e2e now measures every control in `main`, not only ones with a test id.
- 4.3: minor fixes: the search input is capped at 100 characters in the field, capture files include the subscription id, the enqueue-vs-inline push path is logged, the settings rail is hidden below md, and the install and More screenshots wait or scroll before capture. `UPSTREAM.md` lists the extra files the review named.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; commands that load `.env` carry `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` until then.
- TODO(owner): rebuild the dev stack so its app image reads the new migrations: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.

## Open issues
- The inbox thread hides its context sidebar below md but the reply composer stays inline; the plan's "reply composer as a sheet" on mobile is not implemented (independent review round 1, minor 6).

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2). Recreate it with `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` if `/tmp` was cleared.
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- `npm view` in this sandbox needs `--cache /tmp/npm-cache --logs-dir=/tmp/npm-logs` (writing `~/.npm/_logs` is blocked).
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once. Part 10 wraps this as `build:sw && ALLOW_FIRST_LOGIN_ADMIN=false next build`.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211. Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312), with `COMPOSE_PARALLEL_LIMIT=1`.
- Docker 24.0.5 is up with 33.6 GB free in the VM (95.0 GB total) as of 2026-10-22 00:36; the dev stack provides Postgres on 5433 and MinIO on 9000/9001 (`pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left" after Task 0.1, record the step SKIPPED and end `COMPLETE WITH OPEN ISSUES` (section 10).
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report

### Checklist
1. PASS - `git --no-optional-locks status --porcelain` was empty at the 4.3 commit.
2. PASS - `pnpm install --frozen-lockfile` exit 0; the only added dependencies are `web-push@3.6.7` and `@types/web-push@3.6.4` (`git diff de06153 -- package.json`).
3. PASS - `pnpm typecheck` exit 0.
4. PASS - `pnpm lint` exit 0 (15 warnings, 1 info).
5. PASS - `pnpm test:unit` 5351/5351 in 833 files, above the 5320 baseline.
6. PASS - `pnpm test:integration` 2097/2097 in 412 files on the final tree.
7. PASS - `pnpm build` exit 0, lists `/manifest.webmanifest` and `/offline`; `public/sw.js` exists and is git-ignored.
8. PASS - `pnpm e2e` 24/24 (specs 00 to 14) on the final tree.
9. PASS - 8 `p10-*` screenshots exist and all 77 Part 1 to 9 screenshots remain (85 total).
10. PASS - smoke printed `SMOKE PASS` and `backup round trip ok (3 deals)`, with no `dealflow-smoke` container or volume left.
11. PASS - `drizzle/0092_dealflow_push.sql` creates exactly `push_subscriptions` and `notification_push_prefs`.
12. PASS - `git grep "VAPID_PRIVATE_KEY" -- src` reads it only in `src/config/env.ts` and `src/features/push/vapid.ts` (the integration test names the env key as a fixture value); it is never in a client file or a tRPC output.
13. PASS - `cache.put`/`caches.open` appear only in the service worker's precache (`sw.ts:60`, static assets plus `/offline` and its assets) and cache-first path (`sw.ts:80-81`, `/_next/static`, icons, fonts, manifest).
14. PASS - `dangerouslySetInnerHTML` under `src/features/pwa`, `src/features/push` and `src/features/navigation/mobile` prints nothing.
15. PASS - the em-dash scan over every changed non-kit file printed nothing.
16. PASS - `docs/dealflow/PWA.md` exists and `UPSTREAM.md` has the Part 10 section with this part's upstream files.
17. PASS - `pnpm check:progress --final` passes.

