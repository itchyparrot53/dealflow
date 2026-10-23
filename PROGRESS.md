# PROGRESS: dealflow-wd-p12-v1

STATUS: IN PROGRESS
Current: 2.5 · Last updated: 2026-10-23 03:00

## Phase base commits
- Phase 0: 3ef72635f7a31c2863c3e0a3b1f2e88e186769ac
- Phase 1: d6cd01e746f13095fa09b221f12d140414296ae6
- Phase 2: fae8ad915127f39b5171ed80a91cb599d659f9eb

## Tasks
- [x] 0.1 Start Part 12: progress files, kit, baseline and environment
- [x] 0.2 Polish e2e spec and the two check-design rules
- [x] 0.3 Phase 0 QA gate
- [x] 1.1 Dialog, alert dialog and sheet anatomy, every dialog migrated (U1)
- [x] 1.2 Scrolling Select, searchable Combobox, one trigger style (U2, U3, U9)
- [x] 1.3 FormField and FormGrid on create dialogs and settings forms (U8)
- [x] 1.4 Number and money formatting (U10)
- [x] 1.5 Tables, empty states and the bell badge (U29, U30)
- [x] 1.6 AI JSON reliability and the humane error (U7)
- [x] 1.7 Phase 1 QA gate
- [x] 2.1 Expandable rail with labels (U4)
- [x] 2.2 Hide install, offline and push UI behind NEXT_PUBLIC_PWA_UI (U5)
- [x] 2.3 One heading per page and the settings layout (U11, U12)
- [x] 2.4 Contacts view switcher (U13)
- [ ] 2.5 Toolbar order and the Ask AI popover (U14, U15)
- [ ] 2.6 Phase 2 QA gate
- [ ] 3.1 Add deal dialog (U6)
- [ ] 3.2 Board column header and card score (U16, U17)
- [ ] 3.3 Forecast header and calendar (U18, U19)
- [ ] 3.4 Stage track, person and organization records (U20, U27)
- [ ] 3.5 Document editor (U21)
- [ ] 3.6 Inbox list and thread reader (U22, U23)
- [ ] 3.7 Leads, dashboard, Insights index and projects (U24, U25, U26, U28)
- [ ] 3.8 Phase 3 QA gate
- [ ] 4.1 User guide update and PDFs
- [ ] 4.2 End-to-end and gallery
- [ ] 4.3 Integration suite and smoke
- [ ] 4.4 Independent review
- [ ] 4.5 Final checklist
- [ ] 4.6 Final report and completion

## QA log
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (13 warnings, 1 info) · build ok · unit 5356/5356 in 843 files · check-design 0 violations, 12 opt-outs · after the two new 6.10 rules: 9 violations (dialog-anatomy 4, select-long-list 5), 12 opt-outs
- Phase 1 gate: commands green · typecheck ok · lint ok (13 warnings) · build ok · unit 5392/5392 · check:design 0 violations, 13 opt-outs · polish subset "dialog anatomy|long list" 2/2 · AI integration 26/26 in 4 files
- Phase 0 gate: commands green · typecheck ok · lint ok (13 warnings) · build ok · unit 5356/5356 in 843 files · check:design 9 violation(s) in 7 file(s): dialog-anatomy 4 (the two primitive margins and two headerless dialogs), select-long-list 5, 12 opt-outs, and no other rule reports · check:progress ok

## Decisions
- 0.1: starting point matches section 4: `PROGRESS.md` said `dealflow-wd-p11-v1` with `STATUS: COMPLETE` and the commits after it are `brand: 1..8`, `app: Docs button ...`, `docs: ...` (twice) and `website: ...`, so the run renames it to `PROGRESS-P11.md` and starts Part 12 at Task 0.1.
- 0.1: `docker compose ls` shows `dealflow-prod` running(5) and publishing 127.0.0.1:3001, 8080 and 9000; it was not touched.
- 0.1: ports 5433, 9100 and 9101 were free, so the dev stack keeps Postgres 5433 and runs MinIO on 9100 (console 9101); the recorded command is `DEV_PG_PORT=5433 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up`.
- 0.1: `scripts/e2e/e2e-env.mjs` reads `MINIO_PORT` and `DEV_PG_PORT` from the shell, so every e2e command is prefixed `MINIO_PORT=9100 DEV_PG_PORT=5433` (recorded in Environment).
- 0.1: Docker answers and `docker run --rm alpine df -h /` reports 17.6 GB available of 95.0 GB (81% used), above the 10 GB fatal threshold, so the baseline proceeds without pruning.
- 0.1: the kit arrived untracked at the repo root as `dealflow-wd-part12-kit`, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part12-kit` (the Part 2 to 11 layout), added the root `PLAN-PART12.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical, `PLAN_FILE` now `PLAN-PART12.md`).
- 0.1: `site/` is the untouched upstream landing page (its `site/public` build output is the owner's untracked work) and `website/` is the Dealflow site source; this part edits neither.
- 0.1: `src/components/ui/Combobox.tsx` exists (cmdk inside a Popover); Task 1.2 adds the max height and search if they are missing.
- 0.1: pnpm is 9.15.9 from `/tmp/dealflow-tools`, the Playwright browsers are in `/tmp/dealflow-pw-browsers` (chromium-1248), and the subagent tool is available in this harness.
- 0.2: the two 6.10 rules are file-level checks beside `page-title` (they need the whole file); a `design-ok` marker opts one out only when it sits within a few lines of the construct. The long-list matcher adds the local names the code actually uses (`codeOptions`, `rateOptions`, `TIMEZONES`, `zoneOptions`) to 6.10's examples, so the rule catches the five current long Selects. Baseline recorded in POLISH.md: 9 violations, `dialog-anatomy` 4, `select-long-list` 5, 12 opt-outs.
- 0.2: the `long list` test opens the quarter-hour booking time picker as its Select (`e2e/polish/routes.ts` LONG_LIST_SELECT): currency and time zone pickers become Comboboxes in Task 1.2, and the 96-entry time picker is the one long list that stays a Select, so it is what proves the new viewport scrolling.
- 0.2: `e2e/16-polish.spec.ts` identifies the dialog header, body and footer through `data-slot="dialog-header|body|footer"`, which Task 1.1 adds to the primitives (6.2 already uses `data-slot="start"` for the footer slot); the gallery captures both themes through the real appearance path, like spec 15.

- 1.1: the 6.2 anatomy is in the three primitives. `DialogContent` is a flex column with `p-0` and `max-h-[calc(100dvh-48px)]`, `DialogHeader` owns the close button (`data-testid="dialog-close"`) inside the header rule, `DialogBody` (`data-slot="dialog-body"`) is the only scroll container, and `DialogFooter` owns its border and the optional `data-slot="start"` left slot. The 40 body-wrapping migrations were made with a TypeScript-AST codemod and then formatted; `EntityCreateDialogShell` is now header, body (`bodyClassName` still applies) and footer on `size="lg"`.
- 1.1: `SheetContent` keeps the corner close by default (its existing custom sheets: the mobile reply sheet, the assistant panel, the detail drawer) and gains `SheetHeader`/`SheetBody`/`SheetFooter` with `closeButton="header"`; Part 10's mobile reply-sheet locator (`button.absolute.right-4`) and spec 15 still work, and the sheet contract is available without rebuilding layouts that are deliberately custom.
- 1.1: `AlertDialogContent` gains `closeButton` defaulting to `"none"` and the same header/body/footer parts; the six existing confirm dialogs keep their header-and-footer shape because their body is a single sentence that 6.2 puts in the header.
- 1.1: `MoveDealDialog` and `CommandPalette` are the two headerless dialogs, so both pass `closeButton="corner"` (the command palette's own comment already relied on the dialog's close X).
- 1.1: POLISH.md's "Closed in task" is filled per task; the Commit column is filled once in Task 4.5 from `git log --grep`, because a commit cannot contain its own hash.
- 1.1: changed tests (no weakened assertions): `QuickAddContact` and `GlobalContactModal` asserted the retired `max-w-3xl p-0` class pair on the entity shell; they now assert `data-size="lg"` plus `p-0`, which is the same width and padding contract through the new primitive.

- 1.2: `Select` scrolls inside the viewport (`max-h-[min(var(--radix-select-content-available-height),320px)]` on the content, `max-h-[inherit] overflow-y-auto` on the viewport) and gains the 24 px Radix scroll buttons. `Combobox` shares the new `SELECT_TRIGGER_CLASS` exported from `Select.tsx`, so the two triggers cannot drift; it uses `ChevronDown` with the open rotation, a `max-h-80` list, the "Search…" placeholder and a "No results" empty row.
- 1.2: converted to Combobox: the base and new-rate currencies (`CurrenciesSettings`), both deal-terms currency pickers (`DealTermsFields`), the product currency (`ProductDialog`) and the profile time zone. The booking time zone was already a Combobox. `check:design` `select-long-list` is 0.
- 1.2: the quarter-hour booking time picker (`AvailabilityEditor`, 96 options) stays a Select: a searchable combobox adds typing to a fixed grid, DoD item 3 only requires Selects to scroll, and 6.11's "long list" test needs a real long Select to prove that scrolling. It is the LONG_LIST_SELECT target in `e2e/polish/routes.ts`.
- 1.2: the Select unit test asserts the viewport's class contract rather than a computed `max-height`, because jsdom loads no Tailwind (the computed value is "none" for every class); the browser-level computed check is 16-polish.spec's "long list" test.
- 1.2: changed tests for the "Search…" wording (6.3): `Combobox.test` and the custom-field person picker use the new placeholder, and e2e specs 07 and 10 match the prefix `/^Search/`. No assertion was weakened; the e2e long-list test additionally proves the real scroll.

- 1.3: added `FormField` (grid gap-1.5, 14/500 label, required marker and `aria-required`, hint in `text-meta` muted, error as `role="alert"` in `text-destructive` and winning over the hint) and `FormGrid` (gap-4, two columns at sm, `data-span="full"` spans both). The required asterisk sits just outside the `<label>` element so an exact `getByLabelText("Value")` keeps matching.
- 1.3: applied to the twelve create surfaces (deal, person/organization, lead, product, project, task, booking page, form, webhook, API token, invite) and the six settings forms (Profile, Company, Documents, Currencies, Goals, AI), keeping every id, label text and `data-testid`.
- 1.3: `AddActivityModal` is deliberately unchanged: its fields are the composer's icon rows, labelled by aria-label/placeholder, and a FormField would introduce visible copy the composer does not have. The activity create surface still uses the 6.2 dialog anatomy from 1.1.
- 1.3: in `CurrenciesSettings` the base-currency picker keeps its card-header label rather than gaining a second FormField label; it is the only control there without a field label of its own.
- 1.3: no test assertions needed changing; `QuickAddContact`/`GlobalContactModal` were updated in 1.1 for the shell width. The two failures the migration agent saw were timezone/locale artefacts of running vitest without the project's `TZ=UTC` pin, not regressions.

- 1.4: `src/lib/format/number.ts` adds `formatMoney` (minor units, auto or currency-native decimals), `formatMoneyCompact` and `formatNumber`. Detailed money keeps the app's existing en-US display locale; the compact formatter also pins en-US because that is what spells the K/M suffixes in upper case (6.5's examples). The existing bigint `formatMoney` in `src/features/currency/money.ts` stays the exact-arithmetic source; the new helper builds its grouped integer part the same way, so no amount passes through a float.
- 1.4: "auto" uses the currency's own minor-unit digits: JPY keeps zero decimals even with `decimals: 2`, because a yen has no subunit; the `2` option means the currency-native digits for prices, documents, invoices and payments.
- 1.4: applied to the board/list totals (`formatCurrency` now delegates to auto), the forecast month totals, the products settings price (native decimals), chart axes (compact in the trend, goal and report charts) and tooltips (auto), plain numbers (custom numeric fields, AI caps) and report/tooltip counts.
- 1.4: the editable organization revenue/employee inline fields keep the raw stored string while editing; Task 3.4 renders the read-only record rows through `formatNumber`, which is where U10's 18500000.00 display lives.
- 1.4: changed test: `formatCurrency` used to round a fractional amount to whole dollars; it now keeps the cents, which is the 6.5 auto rule, so `1234567.89` expects `$1,234,567.89` instead of `$1,234,568`.

- 1.5: `tableStyles.th` is sticky inside its scroll container with an opaque `bg-background`, and `tableStyles` gains the `footer` bar and `emptyCell` classes. New `EmptyCell` (muted dash plus an sr-only "Empty") and `TableFooter` (count left, paging control right) live in `src/components/ui/table-parts.tsx`. The deals list's "Showing n filtered deals" moved from above the table into that footer row, keeping its `role="status"` and `aria-label` hook.
- 1.5: `EmptyState` now renders the icon in a 40 px muted circle (`size-10`, 20 px glyph) with the title, one sentence and the action it describes. The 13 U30 surfaces all use it: activities (with the toolbar's "+ Activity" repeated in the empty state), inbox, Insights, goals, recycle bin, audit log, webhooks, API tokens, connected apps, projects, documents, forms and booking pages (the last one gained its missing empty state).
- 1.5: empty table cells use `EmptyCell` in the activities table, the leads value cell and the participants dialog; read-only detail rows keep the field-row/muted convention that Task 3.4's grid finishes.
- 1.5: the notification badge reads `9+` above nine through `notificationBadgeText`, is a 16 px minimum circle at `text-[10px] font-semibold` with the `design-ok: badge digit` opt-out, and sits at `-right-1 -top-1` so it cannot cover the bell's centre.
- 1.5: changed test: `ActivitiesTable` now sees two "+ Activity" buttons (toolbar and empty state) when the view is empty; it asserts both and clicks the toolbar one, which is the same action.

- 1.6: `extractJson` (new `src/features/ai/extractJson.ts`) parses bare JSON, then a fenced block anywhere in the reply, then the first object to its matching brace with braces inside strings skipped; it never evaluates the text. `chatJson` uses it and treats `finishReason: "length"` or an empty reply as the new `E_AI_012`, then retries once with the token budget doubled (capped at 4000) and the JSON-only nudge; a schema mismatch keeps the existing single retry.
- 1.6: the plan suggested `E_AI_014` but asked for the next free id; `errorIds.ts` was at `E_AI_011`, so the truncation error is `E_AI_012` (`AI_EMPTY_OR_TRUNCATED`).
- 1.6: `AiChatResult.finishReason` is filled by the OpenRouter provider from `choice.finish_reason` (fake reports "stop", the scripted provider takes it from its queued item). JSON requests send OpenRouter's `reasoning: { effort: "low", exclude: true }`, and a JSON reply that is empty or cut off logs `{ feature, finishReason, contentLength }` at `warn`, never the content. `emailDraft` defaults to `maxTokens: 1500`.
- 1.6: there is no logger module in this repo, so the provider's metadata-only failure uses `console.warn` (the lint-allowed warn channel); the feature travels on `AiChatRequest.feature` so the log line names it.
- 1.6: the five AI surfaces (email draft, AI filter, notes to activities, automation describe, report explain) show "The AI couldn't finish that reply. Try again, or shorten your request." (explain keeps its specific line) and a "Try again" button that resubmits the same input.
- 1.6: changed tests: the `chatJson` suite gains prose-wrapped JSON, the doubled-budget retry, the two-truncation `E_AI_012` failure, the schema-mismatch retry and the feature passthrough; the usage integration literal gained `finishReason`.

- 1.7: gate fixes with no app behaviour change: the polish spec settles a dialog after its data queries before measuring (the Add deal dialog was still growing), the notes-to-activities retry key is read in its effect so the exhaustive-deps rule sees it as intentional, the 10 px badge class sits on the line carrying its `design-ok: badge digit` marker, and biome reflowed the files the 1.1 to 1.6 migrations touched.
- 1.7: the gate ran on the committed Phase 1 tree (the Phase 2 rail and hidden-UI work was set aside and restored afterwards), so the evidence belongs to this phase.

- 2.1: the rail is `w-[232px]` expanded and `w-14` collapsed, animating `transition-[width]` over 200 ms with `motion-reduce:transition-none`. The preference is the `wd_rail` cookie (path `/`, one year, SameSite=Lax), read by the app layout on the server and passed to `LeftNav` as `initialRail` so the first paint has the right width; the default is expanded.
- 2.1: expanded rows are 40 px (`mx-2 h-10 gap-3 rounded-lg px-3`) with 20 px icons and `text-sm font-medium` labels at 80% white (100% active); collapsed keeps Part 11's 56 px rail with 44 px tiles, 24 px icons, the 28 px reverse mark and tooltips. The header is 56 px: the reverse horizontal logo at 24 px in expanded, the mark in collapsed.
- 2.1: the toggle is the last rail row, 40 px: `ChevronsLeft` + "Collapse" expanded, `ChevronsRight` with the "Expand sidebar" tooltip collapsed, `aria-expanded` and `aria-controls="app-nav"` on both. `[` is in the shortcut registry (Navigation group, "Toggle sidebar"), handled by GlobalShortcuts and ignored while typing or in an overlay, and it toggles through the same `warpdrive:toggle-rail` event as the button.
- 2.1: `e2e/design/styleChecks.ts` `railCheck` is now the new contract: fill unchanged, 232 expanded, 56 after the toggle, 232 again so the rest of the gallery keeps the default; the Decision is logged here because the Part 11 check expected a fixed 56.
- 2.1: changed tests: `LeftNav.test` is rewritten for the two states (widths, logo/mark, visible labels, toggle ARIA, cookie write, server-provided initial state); `railState.test` covers parsing and the cookie; `GlobalShortcuts.test` gains the `[` key and its typing guard.

- 2.2: `clientEnv.PWA_UI` is `process.env.NEXT_PUBLIC_PWA_UI === "true"` (default false), `.env.example` documents `NEXT_PUBLIC_PWA_UI=false`, and the e2e env sets it true so spec 14 keeps testing the real feature.
- 2.2: the 6.4 grep found four user-visible surfaces and all are gated: the account-menu Install app item and the Profile "Install app" card (`InstallButton` itself returns null), the Settings > Notifications "Push notifications" card and its Push column (`PushSettings` and `PreferencesForm`'s `showPush`), and the `OfflineBanner`. Other hits are the offline store (`RememberRecord`, snapshots) and code comments, which are not user-facing and stay.
- 2.2: the service worker, the `/offline` page, the offline store, push code, routes and tests are untouched; only rendering is gated.

- 2.3: removed the content H1s that repeated the top-bar title on the Documents, Insights and Projects index pages, and also on the Import wizard and the compose page (the 6.6 one-h1 rule has no exception for them); record pages keep their record-name H1. Every app page now has exactly one visible H1, in the top bar.
- 2.3: the settings layout is the 240 px nav column plus a content scroller. The nav is sticky and scrolls its own long list; the content publishes `data-testid="settings-scroll"` (used by spec 16), is `max-w-[960px] px-8 py-6`, and every settings page scrolls inside it. `SettingsPage` no longer caps itself at 800 px or pads, so panels fill the content width.
- 2.3: the settings group labels are `text-meta font-semibold uppercase tracking-wide text-muted-foreground` with the `design-ok: settings group label` opt-out 6.6 requires, 16 px above each group.
- 2.3: the sticky nav and the scroller are `h-[calc(100dvh-88px)]` rather than the contract's `calc(100dvh-56px)`: the shell's `main` adds 16 px padding on each side, so 88 is the real available height, and the shorter box keeps `main` itself from scrolling. Logged because it is the one number in 6.6 that had to follow the shell.

- 2.4: the People / Organizations / Timeline rail is replaced by a `ViewSwitcher` (`ContactsViewSwitcher`) in each page's top toolbar, with the same three routes as links and the current view marked `aria-current="page"`. The contacts layout is now a pass-through, so person and organization records use the full width.
- 2.4: `ContactsNav.tsx` and its test are deleted because the panel they tested is deliberately removed by U13; `ContactsViewSwitcher.test` covers the new control (three links, routes, active state). Nothing else imported the old nav.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; commands that load `.env` carry `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` until then.
- TODO(owner): rebuild the live install so it serves Part 12: `docker compose down && pnpm dev:up && pnpm dev` (Part 11's final report carries the same step for its stylesheet).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.
- TODO(owner): push is still off because `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are empty. Run `pnpm push:vapid`, add all three to `.env`, then restart the app and worker.

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2). Recreate it with `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` if `/tmp` was cleared.
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- `npm view` in this sandbox needs `--cache /tmp/npm-cache --logs-dir=/tmp/npm-logs` (writing `~/.npm/_logs` is blocked).
- Build: `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN= ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once. Part 10 wraps this as `build:sw && ALLOW_FIRST_LOGIN_ADMIN=false next build`.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- Dev stack: `DEV_PG_PORT=5433 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up` (Postgres 5433, MinIO S3 9100, MinIO console 9101). Never bind 3001, 8080 or 9000 (the owner's `dealflow-prod`) and never touch port 3333 or 3000.
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211; every run is `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` (and `... pnpm exec playwright test ...`). Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312), with `COMPOSE_PARALLEL_LIMIT=1`.
- Docker 24.0.5 is up with 17.6 GB free in the VM (95.0 GB total) as of 2026-10-23 01:38; the dev stack provides Postgres on 5433 and MinIO on 9100/9101 (`pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left" after Task 0.1, record the step SKIPPED and end `COMPLETE WITH OPEN ISSUES` (section 10).
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report
(written in Task 4.5)
