# PLAN: Dealflow on warpdrive, Part 10: PWA, offline, push and mobile

> Plan ID: dealflow-wd-p10-v1 · Written: 2026-10-22 · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 4, fast verification profile, no human in the loop · Type: change to existing project

Parts 1 to 9 are finished (`PROGRESS-P1.md` to `PROGRESS-P8.md`, and `PROGRESS.md` until Task 0.1 renames it to `PROGRESS-P9.md`). Part 9 left 5,320 unit tests, 2,077 integration tests and e2e specs `00` to `13`, all passing, and proved Part 8's backups. Part 10 makes Dealflow an installable PWA with offline read-only records, web push and mobile layouts, and closes Part 9's three small leftovers. This plan is compact: where it says "find" or "reuse", locate the existing code, reuse it, and log the file you used as a Decision.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 4** in fresh-context sessions, one phase per session. Parts 1 to 9 (`PLAN-PART1.md` to `PLAN-PART9.md`) are finished; their code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART10.md` in full and PROGRESS.md (open earlier `PLAN-PART{N}.md` files only where this plan points to them). If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p10-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 9's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 4.5, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 4.2.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.4, 1.4, 2.3, 3.5):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). The one independent review is Task 4.3.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (the build script gaining `build:sw`, the notification path gaining push, the shell gaining mobile navigation), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs only. This part needs no external service; e2e uses the fake mail transport; push in tests uses `PUSH_FAKE` or an injected sender, never a real push service.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove or recreate the owner's running Compose project `warpdrive-main`, never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack 3001/5433/8080/9000/9001 (owner's). Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `PLAN-PART3.md`, `PLAN-PART4.md`, `PLAN-PART5.md`, `PLAN-PART6.md`, `PLAN-PART7.md`, `PLAN-PART8.md`, `PLAN-PART9.md`, `PLAN-PART10.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 9's file to `PROGRESS-P9.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p10-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 10: progress files, kit and baseline
(every task through 4.5, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 4990/4990 · push 20/20

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

Make Dealflow an installable progressive web app. It needs:
- a manifest, icons and a hand-written service worker;
- an offline fallback that shows read-only copies of the records the user viewed recently (stored per user in IndexedDB and wiped on sign-out);
- web push notifications through `web-push` with VAPID keys, per-type preferences and a `PUSH_FAKE` capture mode;
- mobile-first layouts for the key screens.

It also closes Part 9's small leftovers:
- free-text search on the activities list;
- create dialogs that open from anywhere (`n` sequences and palette);
- a smoke seed with deals, so the backup round trip compares a non-zero count.

## 2. Definition of done

1. Migration `0092_dealflow_push` adds the two tables of 6.4 and nothing else. `web-push@3.6.7` and `@types/web-push@3.6.4` are the only new dependencies.
2. The service worker routing rules, the offline-cache trimming and snapshot shapes, and the push payload builder are pure, unit-tested functions.
3. The app is installable: a valid web manifest (name, icons 192/512 plus maskable, theme and background colours, `display: standalone`, `start_url`, `scope`), an apple touch icon and meta tags, and an "Install app" entry (Chromium prompt, or iOS instructions).
4. The service worker:
   - caches only static assets (`/_next/static/*`, icons, fonts) and the `/offline` page;
   - never caches authenticated HTML, API or tRPC responses;
   - ignores the public and embed routes;
   - serves `/offline` when a navigation fails;
   - removes old caches on activation;
   - offers "New version available" with a reload.
5. Offline records:
   - viewing a deal, person or organization (and the activities list for today) stores a compact snapshot in IndexedDB, keeping the last 50 of each per user;
   - `/offline` lists and shows them read-only, with the time each was saved;
   - signing out, or a different user signing in, wipes them;
   - an app-wide banner shows when the browser is offline.
6. Push:
   - users enable push per device and choose push per notification type;
   - notifications are delivered through VAPID web push, or captured to a folder when `PUSH_FAKE=true`;
   - expired subscriptions (404/410) are removed;
   - clicking a push opens the notification's link;
   - nothing is sent when VAPID keys are missing.
7. Mobile at 390×844:
   - a bottom navigation and safe-area insets;
   - the deal board, deal workspace, activities list and calendar agenda, people and organization lists, inbox thread, documents list, projects board and insights dashboard have no horizontal page scroll and keep primary controls at least 40px tall.
8. The activities list has free-text search, carried in the URL and the CSV export. `n` sequences and palette Create commands open their dialog in place. The smoke seed creates deals and the round trip compares more than 0.
9. typecheck, lint, build, unit and the full integration suite pass. e2e specs `00` to `14` pass and the 8 `p10-*` screenshots exist. Smoke passes. One independent review ran.

## 3. Decisions already made

- **Service worker.** It is written by hand in TypeScript (`src/features/pwa/sw/sw.ts`) and bundled to `public/sw.js` by esbuild (already a dev dependency; it builds the workers) in a new `build:sw` step that `build` runs first. We use no Serwist or next-pwa, which avoids a Turbopack plugin risk. The routing decision lives in a pure module that both the worker and the tests import.
- **What the service worker caches.**
  - It caches no HTML except `/offline`. Records offline come from IndexedDB, written by the app from data it already loaded, never by caching server responses. This keeps one user's pages out of another user's cache on a shared device.
  - The cache name includes the build id (`dealflow-static-{buildId}`, injected at bundle time).
- **The `/offline` page.** It lives outside the `(app)` route group, so it needs no session and renders statically. It is client-rendered from IndexedDB.
- **IndexedDB.** The database is named `dealflow-offline-{userId}`, accessed through a tiny promise wrapper with no `idb` library. A `localStorage` key `dealflow-offline-user` holds the last user id. On sign-in with a different id, or on sign-out, every `dealflow-offline-*` database and every `dealflow-*` cache is deleted. Every read and write is wrapped in try/catch, so private windows and blocked storage simply disable the feature.
- **Push.**
  - Uses the `web-push` package with env-only VAPID keys. `pnpm push:vapid` prints a new key pair for the owner to paste into `.env` (the script never writes `.env`).
  - The push body is the notification's title plus its short text, and its link. No more data than the in-app notification already shows.
  - Preferences live in a side table (one row per user and type, missing means default). Defaults are on for `mention`, `project_task_assigned`, `booking_created`, `document_accepted`, `form_submission` and assignment-type notifications (find warpdrive's assignment kinds; log them), and off for the rest.
- **Mobile.** Below 768px the left navigation is replaced by a bottom navigation with five items: Deals, Activities, Inbox, Contacts and More. More opens a `Sheet` with the remaining items. Layout changes use Tailwind breakpoints on existing components; there is no separate mobile app.
- **Create anywhere.** A `CreateDialogProvider` in the app shell owns the deal, person, organization, activity and project create dialogs (reusing the existing dialog components). `n` sequences, palette commands and existing buttons all call `openCreate(kind, defaults?)`.

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | PROGRESS.md says `dealflow-wd-p9-v1` and `STATUS: COMPLETE` | log a Decision describing what you found; continue |
| Docker | `docker info` answers and `docker run --rm alpine df -h /` shows at least 10 GB free | if Docker is down: `open -a Docker`, wait up to 3 minutes, `pnpm dev:up`. If it is still down or low on disk: fatal, `STATUS: BLOCKED` with an Owner action. Never prune |
| Kit location | `PLAN-PART10.md` and the kit at the repo root, or in `PLAN AND EXECUTE/dealflow-wd-part10-kit/` | root symlink plus the byte-identical checker copy; log a Decision |
| Next migration | the last file in `drizzle/` is `0091_dealflow_activity_extras.sql` | next free number; log it |
| Packages | `npm view web-push version` prints 3.6.7 | pin the version it prints within 3.x and log it |
| Icons | `src/app/icon.png` and `src/app/apple-icon.png` exist | generate the PWA icons from the largest existing brand icon with macOS `sips` (no new dependency); log the source |
| Notification hook | find where `createNotification` inserts and where the email channel is decided (`notificationDefaults.ts`) | push hooks in the same place after commit; log the file |
| Shell layout | find the left navigation and top bar components | add the bottom navigation beside them; log the files |
| esbuild | `esbuild` is in devDependencies and used by the worker build | use the same version for `build:sw` |
| pnpm 9, subagent | as in Part 9 | as in Part 9 |

**Known environment:** after Task 0.1 renames it, copy `PROGRESS-P9.md` → Environment into PROGRESS.md → Environment and follow it.

**Fatal (STOP with `STATUS: BLOCKED`):**
- pnpm cannot be installed;
- `pnpm install` fails for a registry reason;
- Docker is down or low on disk at Task 0.1 (above).

## 5. Target structure

```
src/db/schema/push.ts                                   # 6.4
drizzle/0092_dealflow_push.sql
src/features/pwa/
  sw/sw.ts, sw/routes.ts, sw/routes.test.ts             # worker + pure routing
  register.ts, UpdatePrompt.tsx, InstallButton.tsx, OfflineBanner.tsx
  offline/{db.ts,snapshots.ts,snapshots.test.ts,trim.ts,trim.test.ts,remember.tsx,wipe.ts}
  offline/ui/{OfflineApp,OfflineList,OfflineRecord}.tsx
src/features/push/
  payload.ts, payload.test.ts, vapid.ts, subscriptions.ts, deliver.ts, prefs.ts
  actions.ts, router.ts, push.integration.test.ts, ui/{PushSettings,EnablePushButton}.tsx
src/features/navigation/mobile/{BottomNav,MoreSheet}.tsx
src/features/create/CreateDialogProvider.tsx
src/app/manifest.ts, src/app/offline/page.tsx
public/icons/{icon-192.png,icon-512.png,icon-maskable-512.png}
scripts/dealflow/{build-sw.mjs,push-vapid.mjs}
e2e/14-pwa-mobile.spec.ts
docs/dealflow/PWA.md
```

## 6. Contracts

### 6.1 Env, dependencies and scripts

Add to `src/config/env.ts` and to `.env.example` under a new `# Web push` section:

| Key | Type | Default |
|---|---|---|
| `VAPID_PUBLIC_KEY` | string | empty (push disabled) |
| `VAPID_PRIVATE_KEY` | string | empty |
| `VAPID_SUBJECT` | `mailto:` or `https:` URL | empty |
| `PUSH_FAKE` | boolean | `false` |
| `PUSH_FAKE_DIR` | string | `.push-capture` |

- Push is enabled only when all three VAPID keys are set (all-or-nothing, like Google) or when `PUSH_FAKE` is true. The e2e env sets `PUSH_FAKE=true`, with fake test keys generated once into `e2e/fixtures/vapid.json`; those are public test values only.
- Add the dependencies `web-push@3.6.7` and dev dependency `@types/web-push@3.6.4`.
- Scripts:
  - `build:sw`: `node scripts/dealflow/build-sw.mjs`, which bundles `src/features/pwa/sw/sw.ts` to `public/sw.js` with the build id from `git rev-parse --short HEAD` or a timestamp.
  - `build`: becomes `pnpm build:sw && ALLOW_FIRST_LOGIN_ADMIN=false next build`.
  - `push:vapid`: prints `VAPID_PUBLIC_KEY=` and `VAPID_PRIVATE_KEY=` lines to stdout.
- Add `public/sw.js` to `.gitignore`. It is a build output, and the Docker build runs `build:sw` through `build`.

Constants (`src/constants/pwa.ts`):

```ts
OFFLINE_KEEP_PER_TYPE = 50
OFFLINE_DB_PREFIX = "dealflow-offline-"
CACHE_PREFIX = "dealflow-"
PUSH_TTL_SECONDS = 86_400
PUSH_MAX_FAILURES = 5
MOBILE_BREAKPOINT_PX = 768
```

### 6.2 Error IDs (append; add the `PUSH` domain)

| ID | Cause |
|---|---|
| `E_PUSH_001` | push not configured (no VAPID keys and not fake) |
| `E_PUSH_002` | invalid subscription (endpoint not https, or keys missing) |
| `E_PUSH_003` | delivery failed (context: status code) |
| `E_PUSH_004` | action input failed Zod |

### 6.3 Test hooks and screenshots

`data-testid` hooks:
- `install-app`, `update-available`, `update-reload`, `offline-banner`;
- `offline-app`, `offline-tab` (`data-type`), `offline-record` (`data-id`), `offline-saved-at`;
- `push-settings`, `push-enable`, `push-status`, `push-pref` (`data-type`);
- `bottom-nav`, `bottom-nav-item` (`data-href`), `more-sheet`;
- `activities-search`.

Screenshots:
- `p10-mobile-board`
- `p10-mobile-deal`
- `p10-mobile-activities`
- `p10-mobile-contacts`
- `p10-mobile-more`
- `p10-offline`
- `p10-push-settings`
- `p10-install`

### 6.4 Schema (`src/db/schema/push.ts`)

```ts
push_subscriptions: id, user_id -> users.id on delete cascade, endpoint text not null unique, p256dh text not null,
  auth text not null, user_agent text null (<= 300), failures integer not null default 0,
  last_success_at timestamptz null, created_at
  index (user_id)
notification_push_prefs: user_id -> users.id on delete cascade, type notification_type not null, enabled boolean not null,
  primary key (user_id, type)
```

### 6.5 Pure helpers

**`sw/routes.ts`:**

```ts
type SwDecision = { kind: "bypass" } | { kind: "cache-first" } | { kind: "navigate-fallback" };
export function decide(req: { url: string; method: string; mode: string; origin: string }): SwDecision;
```

Rules, applied in order:
1. Non-GET requests → bypass.
2. A different origin → bypass.
3. Paths starting with `/api/`, `/_ws`, `/trpc`, `/t/`, `/d/`, `/f/`, `/book/`, `/auth/`, `/oauth/`, `/export/`, or `/insights/reports/` with `export.csv` → bypass.
4. `/_next/static/`, `/icons/`, `/fonts/`, `/manifest.webmanifest` → cache-first.
5. `mode === "navigate"` → navigate-fallback (network, falling back to cached `/offline` on failure, with no caching of the response).
6. Everything else → bypass.

**`offline/snapshots.ts`:**

```ts
type DealSnapshot = { type: "deal"; id; title; value: string | null; currency; stage; status; personName; orgName; ownerName;
  nextActivity: { subject; dueAt } | null; recentActivities: { subject; dueAt; done }[] /* <= 5 */; savedAt: string };
type PersonSnapshot = { type: "person"; id; name; emails: string[]; phones: string[]; orgName; ownerName; savedAt };
type OrgSnapshot = { type: "organization"; id; name; address: string | null; peopleCount: number; ownerName; savedAt };
type TodaySnapshot = { type: "today"; items: { id; subject; dueAt; done; dealTitle: string | null }[]; savedAt };
export function toDealSnapshot(workspaceData): DealSnapshot;   // likewise for person and org, from the props those pages already have
```

Snapshots hold no notes bodies, emails or custom fields beyond the listed fields.

**`offline/trim.ts`:** `trimToNewest(records, keep)` keeps the newest by `savedAt`. Re-saving an id replaces the old copy.

**`push/payload.ts`:**

```ts
buildPushPayload(n: { title: string; body: string | null; href: string; id: string }): string
// JSON {title, body (<= 140 chars, ellipsised), url (same-origin path only; absolute or foreign URLs become "/notifications"), tag: id}
```

### 6.6 PWA core

**Manifest** (`src/app/manifest.ts`, Next's typed manifest):
- name "Dealflow", short_name "Dealflow";
- `start_url: "/deals?source=pwa"`, `scope: "/"`, `display: "standalone"`;
- `background_color` and `theme_color` from the design tokens (log the values);
- icons 192, 512 and maskable 512, plus `categories: ["business","productivity"]`.

Add `appleWebApp` metadata and `themeColor` to the root layout metadata, and keep the existing icons.

**Registration** (`register.ts`, a client component mounted in the app shell only):
- In production builds, register `/sw.js` with scope `/`.
- When a new worker reaches `waiting`, show `UpdatePrompt`, a toast with "New version available" and a "Reload" action. Reload posts `SKIP_WAITING`, then reloads on `controllerchange`.
- In development, unregister any worker, so dev never serves stale assets.

**Worker** (`sw.ts`):
- `install` precaches `/offline` and the icons.
- `activate` deletes caches with the `dealflow-` prefix whose name is not the current one, then calls `clients.claim()`.
- `fetch` follows `decide()`.
- `message` `SKIP_WAITING` calls `skipWaiting()`.
- `push`: show a notification from the payload (icon 192, badge, tag).
- `notificationclick`: focus an existing client and navigate it to `url`, or open a new window.

**Install** (`InstallButton.tsx`, in the user menu and in Settings → Profile):
- It listens for `beforeinstallprompt` and shows "Install app".
- On iOS Safari (detected by user agent, not standalone) it shows "Add to Home Screen: tap Share, then Add to Home Screen".
- It is hidden when the app already runs standalone.

**Offline banner:** when `navigator.onLine` is false, a slim top banner `role="status"` reads "You're offline. Changes can't be saved until you reconnect."

### 6.7 Offline records

- **`offline/db.ts`:** `openOfflineDb(userId)` opens an object store per type, keyed by id. Helpers: `put`, `getAll`, `get`, `deleteAllOfflineData()`. All return `Result` and never throw into the UI.
- **`offline/remember.tsx`:** `<RememberRecord snapshot={...} />` is a client component that writes the snapshot after mount, then trims to 50. Mount it on the deal workspace, the person and organization detail pages, and the activities list for today, using the data those pages already received.
- **`offline/wipe.ts`:** on sign-out (the sign-out action's client side), and in the app shell when the signed-in user id differs from `localStorage["dealflow-offline-user"]`, delete all offline databases and `dealflow-` caches, then store the new id.
- **`/offline` page** (`OfflineApp`):
  - `Tabs` for Deals, People, Organizations and Today, each a list of names with their saved time;
  - a read-only detail view;
  - a header reading "You're offline" with a "Try again" button (`location.reload()`);
  - an empty state: "Nothing saved yet. Records you open while online appear here."
  - It works with no session, but reads only the IndexedDB of the last stored user id, which belongs to whoever last used this browser profile. This is the documented trade-off; sign-out wipes it.

### 6.8 Push

- **`vapid.ts`:** `pushConfigured()` and `vapidDetails()` from env. The public key is exposed to the client through a tRPC read `push.config` returning `{ enabled, publicKey }`. Never expose the private key.
- **`subscriptions.ts`:**
  - `subscribe(actor, { endpoint, keys: { p256dh, auth }, userAgent })` validates an https endpoint and upserts by endpoint, moving it to this user if it existed.
  - `unsubscribe(actor, endpoint)`.
  - `listMine(actor)`.
- **`prefs.ts`:** `getPushPrefs(actor)` merges the defaults; `setPushPref(actor, type, enabled)`.
- **`deliver.ts`:** `deliverPush(db, notification, signal)` runs after the notification commits, from the same place the email channel is decided.
  1. If push is not configured, or the user's preference for this type is off, do nothing.
  2. For each of the user's subscriptions, send `buildPushPayload` with `web-push` (TTL `PUSH_TTL_SECONDS`, `urgency: "normal"`, 10 s timeout).
  3. On 404 or 410, delete the subscription.
  4. On other failures, increment `failures`, and delete the subscription after `PUSH_MAX_FAILURES`.
  5. On success, reset `failures` and set `last_success_at`.
  6. With `PUSH_FAKE`, write `{ endpoint, payload }` as JSON to `PUSH_FAKE_DIR/{timestamp}-{id}.json` instead of sending.

  Push delivery is best-effort and never fails the notification. Run sends in a pg-boss job `push.deliver` when a queue is available, otherwise inline after commit; log which.
- **UI** (`PushSettings`, in the notification preferences page):
  - a status line: "Push is on for this device", "Push is off", "Not supported in this browser" or "Not set up on this server";
  - `EnablePushButton`, which asks for permission, subscribes with the VAPID public key and calls `subscribe`, plus "Turn off on this device";
  - a `Switch` per notification type in a "Push" column beside the existing email column.

  On iOS it explains that push needs the app installed to the Home Screen (iOS 16.4 or later).

### 6.9 Mobile

- **Shell:** below 768px, hide the left navigation and show `BottomNav` (fixed, `pb-[env(safe-area-inset-bottom)]`) with Deals, Activities, Inbox, Contacts and More. More opens `MoreSheet`, a `Sheet` listing every other main navigation item and Settings. The top bar compacts: search icon, notifications, avatar. Content gets bottom padding equal to the navigation height.
- **Key screens:**
  - **Board:** horizontally scrolling columns inside their own container, with `snap-x` and column width `85vw`. The page itself does not scroll sideways.
  - **Deal workspace:** a single column, with sidebar sections stacked below the main panel; the composer bar is sticky at the bottom above the navigation.
  - **Activities list:** rows become cards below 768px. The calendar defaults to agenda (day list) view on mobile.
  - **People and organization lists:** card rows with name, organization or people count, and owner.
  - **Inbox thread:** full width with the reply composer as a sheet.
  - **Documents list, projects board, insights dashboard:** one column, with charts width-constrained.
- Primary controls are at least 40px tall (`min-h-10`) on mobile.
- Do not restyle beyond these layout changes; Part 11 is the design pass.

### 6.10 Leftovers

- **Activities search:** add `search` (`ilike` on subject and note, trimmed, at most 100 characters) to the activities list query, its URL state and the Part 8 activities export, with an input `activities-search`.
- **Create anywhere:** `CreateDialogProvider` with `openCreate(kind: "deal" | "person" | "organization" | "activity" | "project" | "call", defaults?)` mounts the existing dialogs. The `n` sequences and palette Create commands call it. "Log call" from the palette uses the current deal or person context when on such a page, else the dialog asks for a record. Existing page buttons may keep their local dialogs.
- **Smoke seed:** the smoke seed creates 3 deals (in a pipeline and stage it creates if missing) so the backup round trip compares 3.

## 7. Conventions

Same as Parts 1 to 9 (CLAUDE.md is the authority). In addition:
- The service worker never caches authenticated responses.
- Offline storage is per user and wiped on sign-out.
- Push never fails the notification, and never sends anything the in-app notification does not show.
- Every client action passes the CSRF token.
- Write tests first for routing decisions, snapshot shapes, trimming, the payload builder, subscriptions and delivery (fake, 410 cleanup, preference off, not configured).

## 8. Phases and tasks

### Phase 0: Start, schema, dependencies and pure core

#### Task 0.1 - Start Part 10: progress files, kit and baseline

**Goal:** A Part 10 PROGRESS.md and a green baseline.

**Files:** create `PROGRESS.md`; rename `PROGRESS.md` → `PROGRESS-P9.md`; possibly root symlink `PLAN-PART10.md`, `scripts/check-progress.mjs`

**Steps:**
1. Check section 4's table and log each result as a Decision.
2. `git mv PROGRESS.md PROGRESS-P9.md`, then create PROGRESS.md in the section 0 format with every task unchecked:
   - record the Phase 0 base commit;
   - copy `PROGRESS-P9.md` → Environment;
   - carry over still-open owner actions.
3. If the kit is in a subfolder, add the root symlink and the byte-identical checker copy.
4. Baseline: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`. Log `- Baseline: ...`.
5. Commit `0.1: Start Part 10: progress files, kit and baseline`, tick.

**Verify:** `pnpm check:progress` → OK

**Done when:** PROGRESS.md lists all tasks and the baseline line exists.

#### Task 0.2 - Schema, dependencies, env and scripts

**Goal:** 6.1 and 6.4.

**Files:** create `src/db/schema/push.ts`, `drizzle/0092_dealflow_push.sql` (+ meta), `scripts/dealflow/build-sw.mjs`, `scripts/dealflow/push-vapid.mjs`, a placeholder `src/features/pwa/sw/sw.ts`, `e2e/fixtures/vapid.json`; modify `src/db/schema/index.ts`, `package.json`, `pnpm-lock.yaml`, `src/config/env.ts`, `.env.example`, `.gitignore`, the e2e env

**Steps:**
1. Write the schema, generate the migration and apply it to the dev database.
2. `pnpm add web-push@3.6.7` and `pnpm add -D @types/web-push@3.6.4`, using the Environment's pnpm.
3. Add the env keys with the all-or-nothing VAPID rule, the scripts, and the build change. Generate the e2e VAPID pair with `pnpm push:vapid` into `e2e/fixtures/vapid.json`, which holds only test keys.
4. Commit, tick.

**Verify:** `pnpm build:sw && test -f public/sw.js && pnpm typecheck` → exits 0

**Done when:** the migration is applied, the dependencies are pinned, and the service worker bundles.

#### Task 0.3 - Pure core (test-first)

**Goal:** `sw/routes.ts`, `offline/snapshots.ts`, `offline/trim.ts`, `push/payload.ts`, and the error IDs.

**Files:** create those files and their tests; modify the error registry and its test allow-list; create `src/constants/pwa.ts`

**Steps:**
1. Write the tests first and see them fail. Cover:
   - every bypass prefix, non-GET, cross-origin, static cache-first, navigation fallback, and `/api/v1/deals` bypass;
   - each snapshot keeps only its listed fields (no note bodies), and `recentActivities` is capped at 5;
   - trimming keeps the newest 50 and a re-save replaces the old copy;
   - the payload truncates the body to 140 characters with an ellipsis, and rewrites a foreign URL to `/notifications`.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run src/features/pwa src/features/push` → passes

**Done when:** all cases pass.

#### Task 0.4 - Phase 0 QA gate

**Goal:** Prove the schema, dependencies and pure core.

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

**QA focus:** Definition of done items 1 and 2.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: PWA core and offline records

#### Task 1.1 - Manifest, icons, metadata and install

**Goal:** 6.6's manifest, icons, metadata and `InstallButton`.

**Files:** create `src/app/manifest.ts`, `public/icons/*.png`, `InstallButton.tsx`; modify the root layout metadata, the user menu, Settings → Profile

**Steps:**
1. Generate the icons with `sips` from the brand icon (the maskable icon gets about 20% padding on the brand background), write the manifest and metadata, and build the install entry.
2. Commit, tick.

**Verify:** `pnpm build` → exits 0 and the build lists `/manifest.webmanifest`

**Done when:** the manifest is served and the install entry renders.

#### Task 1.2 - Service worker, registration and update prompt

**Goal:** 6.6's worker, `register.ts`, `UpdatePrompt.tsx`, `OfflineBanner.tsx`, and the `/offline` page shell.

**Files:** modify `src/features/pwa/sw/sw.ts`; create `register.ts`, `UpdatePrompt.tsx`, `OfflineBanner.tsx`, `src/app/offline/page.tsx` (shell only); modify the app shell layout

**Steps:**
1. Implement the worker on `decide()`, the registration (production only), the update toast through Part 9's toaster, and the banner.
2. Check `next.config.ts` headers so `/sw.js` is served with `Cache-Control: no-cache` and `Service-Worker-Allowed: /`, and so the strict CSP still allows the worker script (`worker-src 'self'`). Log the change.
3. Commit, tick.

**Verify:** `pnpm build` → exits 0

**Done when:** the worker builds and registers in a production build.

#### Task 1.3 - Offline records and the offline page

**Goal:** 6.7.

**Files:** create `offline/{db.ts,remember.tsx,wipe.ts}`, `offline/ui/*`; modify `src/app/offline/page.tsx`, the deal workspace, the person and organization detail pages, the activities list, the sign-out client path, the app shell

**Steps:**
1. Build the IndexedDB wrapper, the remember component on the four surfaces, the wipe on sign-out and on user change, and the offline app.
2. Add unit tests for `wipe.ts` user-change logic with a fake `indexedDB` (`fake-indexeddb` is not installed: test the decision function separately from the IndexedDB calls).
3. Commit, tick.

**Verify:** `pnpm exec vitest run src/features/pwa` → passes

**Done when:** records are saved on view and shown on `/offline`.

#### Task 1.4 - Phase 1 QA gate

**Goal:** Prove the PWA core.

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

**QA focus:** Definition of done items 3 to 5; the worker never caches HTML except `/offline`; wipe on sign-out.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: Push notifications

#### Task 2.1 - Subscriptions, preferences and the worker push handler (test-first)

**Goal:** `vapid.ts`, `subscriptions.ts`, `prefs.ts`, the actions and reads, and the `push`/`notificationclick` handlers.

**Files:** create those files plus `actions.ts`, `router.ts`, `push.integration.test.ts`; modify `sw.ts`, the app router

**Steps:**
1. Write the cases first:
   - subscribe upserts by endpoint, and the same endpoint from another user moves to that user;
   - a non-https endpoint gives `E_PUSH_002`;
   - preferences merge the defaults, and setting one persists;
   - `push.config` returns `enabled: false` with no keys and never includes the private key.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/push` → passes

**Done when:** the cases pass.

#### Task 2.2 - Delivery and settings UI (test-first)

**Goal:** `deliver.ts`, the hook after notifications, and `PushSettings` with `EnablePushButton`.

**Files:** create `deliver.ts`, `ui/PushSettings.tsx`, `ui/EnablePushButton.tsx`; modify the notification creation path, the worker job registry (`push.deliver`), the notification preferences page, `push.integration.test.ts`

**Steps:**
1. Add cases:
   - with `PUSH_FAKE`, a mention notification writes one capture file per subscription with the expected payload;
   - with the preference off, nothing is written;
   - not configured, nothing is written and no error is raised;
   - a stubbed sender returning 410 deletes the subscription;
   - 5 failures delete it;
   - success resets `failures`.

   Inject the sender so no network is used.
2. Implement, and build the settings UI.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/push src/features/notifications` → passes

**Done when:** the cases pass and the settings show the push column.

#### Task 2.3 - Phase 2 QA gate

**Goal:** Prove push.

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
- `pnpm exec vitest run --project integration src/features/push src/features/notifications` → passes

**QA focus:** Definition of done item 6; the private key stays server-side; push is best-effort.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: Mobile and leftovers

#### Task 3.1 - Mobile shell

**Goal:** `BottomNav`, `MoreSheet`, the compact top bar and safe areas (6.9).

**Files:** create `src/features/navigation/mobile/{BottomNav,MoreSheet}.tsx`; modify the app shell layout, the left navigation and top bar components

**Steps:**
1. Build per 6.9, sharing the navigation items with the left navigation (one source).
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** below 768px the bottom navigation replaces the left navigation.

#### Task 3.2 - Key screens on mobile

**Goal:** 6.9's screen changes.

**Files:** modify the board, deal workspace, activities list and calendar, people and organization lists, inbox thread, documents list, projects board and insights dashboard components

**Steps:**
1. Apply the layout rules with Tailwind breakpoints only.
2. Run the existing unit and component tests for those features.
3. Commit, tick.

**Verify:** `pnpm test:unit` → passes

**Done when:** each screen meets 6.9 (checked by e2e in Task 4.1).

#### Task 3.3 - Create anywhere and activities search

**Goal:** 6.10's first two items.

**Files:** create `src/features/create/CreateDialogProvider.tsx`; modify the app shell, the shortcut registry, the palette commands, the activities list query, URL state and toolbar, the Part 8 activities export, and its test (add a search case)

**Steps:**
1. Build the provider and wire the `n` sequences and palette Create commands to `openCreate`.
2. Add `search` to the activities list and export, with the integration case.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/activities src/features/export` → passes

**Done when:** `n d` opens the deal dialog in place and search filters both the list and the export.

#### Task 3.4 - Smoke seed, demo and docs

**Goal:** The 6.10 smoke seed change, and `docs/dealflow/PWA.md`.

**Files:** modify the smoke seed in `scripts/dealflow/smoke.mjs` (or its seed helper); create `docs/dealflow/PWA.md`; modify `docs/dealflow/UPSTREAM.md`, `README.md`, `.env.example` comments

**Steps:**
1. Make the smoke seed create 3 deals.
2. Write PWA.md, covering:
   - installing on desktop, Android and iOS;
   - what works offline and what is stored, and the shared-device note;
   - how updates appear;
   - push setup (`pnpm push:vapid`, the three env keys, `PUSH_FAKE`), preferences, and the iOS Home Screen requirement;
   - the mobile layout.
3. Add the UPSTREAM.md list and a README section.
4. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the docs exist and the seed change is in.

#### Task 3.5 - Phase 3 QA gate

**Goal:** Prove the mobile work and leftovers.

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
- `pnpm exec vitest run --project integration src/features/activities src/features/export src/features/push` → passes

**QA focus:** Definition of done items 7 and 8; shadcn-only (the `Sheet` wrapper for More); no horizontal scroll.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Hardening and hand-off

#### Task 4.1 - E2E PWA and mobile spec and screenshots

**Goal:** `e2e/14-pwa-mobile.spec.ts` and the 8 screenshots.

**Files:** create `e2e/14-pwa-mobile.spec.ts`; modify `e2e/helpers.ts` only if a helper is missing

**Steps:**
1. **Desktop context** (the e2e server is a production build, so the worker registers):
   - `GET /manifest.webmanifest` returns the required fields;
   - wait for `navigator.serviceWorker.controller` after one reload;
   - open a seeded deal and a person, so their snapshots are saved;
   - `context.setOffline(true)`, navigate to `/deals`, and expect the `/offline` app with the deal and person listed (`p10-offline`); open the deal record;
   - set the context online again and expect `offline-banner` gone;
   - sign out, sign in as another user, and expect `/offline` to be empty (wiped).
2. **Push** (e2e env `PUSH_FAKE=true`):
   - in Settings → notifications, grant notifications with `context.grantPermissions(["notifications"])` and click "Enable push" (`p10-push-settings`);
   - trigger a mention to this user from another session;
   - expect a capture file in `.push-capture/` with the title.
3. **Mobile context** (390×844, touch):
   - for `/deals` board, a deal page, `/activities/list`, `/contacts/people`, `/contacts/organizations`, `/inbox`, `/documents`, `/projects/{seeded}` and `/insights/dashboards/{default}`, assert `document.documentElement.scrollWidth <= window.innerWidth + 1` and that every visible `button` inside `main` with a `data-testid` is at least 40px tall;
   - screenshots `p10-mobile-board`, `p10-mobile-deal`, `p10-mobile-activities`, `p10-mobile-contacts`;
   - open More (`p10-mobile-more`);
   - capture `p10-install` from Settings → Profile (the install entry or the iOS instructions).
4. **Create anywhere:** on `/insights`, press `n` `d` and expect the deal dialog.
5. Run the full `pnpm e2e` (specs `00` to `14`); fix until green.
6. Commit, tick.

**Verify:** `pnpm e2e` → passes; `ls e2e/screenshots/p10-*.png | wc -l` → `8`

**Done when:** e2e is green and 8 screenshots exist.

#### Task 4.2 - Integration suite and smoke

**Goal:** The once-per-part full runs.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. `pnpm test:integration` (full). Fix failures caused by this part; pre-existing ones get `PRE-EXISTING:` Open issues.
2. `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke` → SMOKE PASS with "backup round trip ok (3 deals)". Leave no `dealflow-smoke` container or volume.
3. Log both results as Decisions, commit, tick.

**Verify:** `pnpm test:integration` passes and the smoke prints SMOKE PASS with `backup round trip ok (3 deals)` (or SKIPPED with the reason from section 10)

**Done when:** both ran and are logged.

#### Task 4.3 - Independent review and hardening

**Goal:** One fresh-context review of Part 10, then fix what it finds.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is the full `.dsh/qa.md`, a blank line, then `Final review of PLAN-PART10.md. Base commit {Phase 0 base}.` Wait for `QA RESULT: PASS` or the numbered list.
   - Fallbacks: `qa.sh` with the same request, then an evidenced self-review (log `qa unavailable (qa.sh failed) - self-review`).
2. Fix every blocker and major and commit `4.3: QA fixes round {r}`.
   - Re-run the gate commands of Task 3.5.
   - After the last fix round, re-run the full integration suite and e2e so the final tree has fresh evidence.
   - Review again, at most 3 rounds.
   - Minors: fix when cheap, else Open issues.
3. Log `- Independent review: subagent (fresh context) round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n}`.
4. Commit `4.3: Independent review and hardening`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`.

**Done when:** the review ran (or the logged fallback), blockers and majors are fixed or logged, and the final tree has green integration and e2e evidence.

#### Task 4.4 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order; write one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `4.4: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least 17.

**Done when:** every checklist item has a line.

#### Task 4.5 - Final report and completion

**Goal:** Hand the owner a short, truthful report and finish.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report, short (the owner reads it on a phone). Do not repeat the Decisions list. Include:
   - **Definition of done:** items 1 to 9, one line each.
   - **Checklist:** from 4.4.
   - **Owner actions:** numbered, with exact commands, including:
     - running `pnpm push:vapid` and adding the three VAPID keys to `.env` (with `VAPID_SUBJECT=mailto:{your address}`);
     - rebuilding the dev stack for migration 0092;
     - installing the app on your phone;
     - testing a push.
   - **Decisions worth reviewing:** only `CONTRACT CHANGE:` lines and changed tests.
   - **Open issues.**
   - **Notes for Part 11 (design pass):** every screen with its route and latest screenshot name, the mobile breakpoints, and the components touched for layout.
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `4.5: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`.

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- Offline editing or a sync queue (offline is read-only).
- Background sync and periodic background sync.
- Native app wrappers (Capacitor, TWA) and app store listings.
- Push for public visitors (forms, bookings).
- Rich push actions (reply or mark done from the notification).
- Visual redesign beyond layout (Part 11).
- Caching any authenticated page or API response in the service worker.

## 10. ASK and STOP triggers

This plan has no ASK triggers. The only STOP cases are the fatal ones in section 4.

| Situation | Safe default | Owner action to log |
|---|---|---|
| Docker stops or fills up after Task 0.1 | try `open -a Docker` and `pnpm dev:up` once. If it still fails: SKIPPED, finish the non-Docker tasks, end `COMPLETE WITH OPEN ISSUES` | "Give Docker Desktop more disk or restart it, then run `pnpm test:integration`, `pnpm e2e`, `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke`" |
| Subagent tool unavailable | `qa.sh`, then the evidenced self-review | "Run the review yourself in a new harness session with `.dsh/qa.md` and the request from Task 4.3" |
| A pre-existing upstream test fails | leave it, log `PRE-EXISTING:` | "Review the pre-existing failures in PROGRESS.md" |
| The worker cannot register in the e2e production build (CSP or headers) | fix the headers for `/sw.js` only, and log it | none |
| `web-push` cannot be installed | push stays disabled and the rest of the part continues | "Install web-push and re-run Phase 2" |
| VAPID keys missing in the owner's `.env` | push shows "Not set up on this server" | "Run `pnpm push:vapid` and add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT to .env" |
| Google env in `.env` still partial | keep the Environment prefixes | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty.
2. `pnpm install --frozen-lockfile` exits 0; the only added dependencies are `web-push` and `@types/web-push` (`git diff {Phase 0 base} -- package.json`).
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes (count ≥ the baseline).
6. `pnpm test:integration` passes on the final tree.
7. `pnpm build` exits 0 and lists `/manifest.webmanifest` and `/offline`; `public/sw.js` exists after the build and is git-ignored.
8. `pnpm e2e` passes, specs `00` to `14`, on the final tree.
9. 8 `e2e/screenshots/p10-*.png` exist and the Part 1 to 9 screenshots are still present.
10. Smoke printed SMOKE PASS and `backup round trip ok (3 deals)`, and left no `dealflow-smoke` container or volume.
11. `drizzle/0092_dealflow_push.sql` creates exactly the 2 tables of 6.4.
12. `git grep -n "VAPID_PRIVATE_KEY" -- src` shows the key read only in `src/config/env.ts` and `src/features/push/vapid.ts`, and never in a client file or a tRPC output.
13. `git grep -nE "cache\\.put|caches\\.open" -- src/features/pwa/sw` hits only the static and offline-page caching paths (cite them).
14. `git grep -n "dangerouslySetInnerHTML" -- src/features/pwa src/features/push src/features/navigation/mobile` prints nothing.
15. No em dash in any file added or changed in this part (`git diff --name-only {Phase 0 base} | xargs perl -CSD -ne 'print "$ARGV\n" if /\x{2014}/' | sort -u` prints nothing, kit files excepted).
16. `docs/dealflow/PWA.md` exists and `UPSTREAM.md` lists this part's upstream files.
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

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md to PLAN-PART10.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

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
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; money is computed on integer minor units with no floats, converted totals never add unconverted amounts or drop deals silently (excluded deals are listed), the forecast reuses the deals visibility filter; document public routes take only the publicId and a validated body, never render HTML, issued documents are immutable; domain events are written inside the mutation's transaction, automation actions go through existing services and respect the loop guard, webhook delivery checks every resolved address inside the DNS lookup with no redirects, webhook secrets are encrypted and never returned after creation; public form and booking handlers write nothing on spam paths, bookings re-check the slot under a per-host lock in the same transaction, only `/f/*` and `/book/*` may be framed; reports apply the deals or activities visibility clause, never add values across currencies in SQL, send only aggregated rows to the AI; API calls authenticate only by hashed bearer token and run as the token's user through existing services, exports reuse list visibility, backups keep secrets out of argv and logs, download routes refuse path traversal; bulk actions and undo call the existing services, the next recurring occurrence is created once inside the completion transaction, duplicates respect visibility; the service worker never caches authenticated HTML or API responses, offline data is per user and wiped on sign-out, and the VAPID private key never reaches the client; no em dashes in new files.
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
# Usage: ./qa.sh "Final review of PLAN-PART10.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
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

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART10.md";
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
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART(?:10|[1-9])\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
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
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART10.md (dealflow-wd-p10-v1) is finished.
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
PROMPT='Read PLAN-PART10.md in this folder in full and PROGRESS.md, then follow PLAN-PART10.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p10-v1; earlier parts are finished) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p10-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p10-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
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
- Otherwise you are the builder: read `PLAN-PART10.md` in full (Parts 1 to 9 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART10.md rule 18.
```
