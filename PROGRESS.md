# PROGRESS: dealflow-wd-p11-v1

STATUS: IN PROGRESS
Current: 2.2 · Last updated: 2026-10-22 09:55

## Phase base commits
- Phase 0: 18e1dffa85996e1ec988dcb2e24f9b25faa35425
- Phase 1: 993185503417f6d74fcd36d46c446dd2e006f988
- Phase 2: fc5eab66f691ad5ca160f8ea710cacb60704997a

## Tasks
- [x] 0.1 Start Part 11: progress files, kit, baseline and design worklist
- [x] 0.2 Tokens and global styles
- [x] 0.3 Primitives and layout components
- [x] 0.4 Design e2e harness
- [x] 0.5 Phase 0 QA gate
- [x] 1.1 Shell
- [x] 1.2 Pipeline board
- [x] 1.3 Deal workspace and StageTrack
- [x] 1.4 Lists and person/organization detail
- [x] 1.5 Phase 1 QA gate
- [x] 2.1 Inbox, thread and mobile reply sheet
- [ ] 2.2 Calendar and forecast
- [ ] 2.3 Documents and the public document page
- [ ] 2.4 Insights and dashboards
- [ ] 2.5 Projects
- [ ] 2.6 Phase 2 QA gate
- [ ] 3.1 Settings
- [ ] 3.2 Auth and public pages
- [ ] 3.3 Empty, loading and error states
- [ ] 3.4 Remaining worklist, wording and docs
- [ ] 3.5 Phase 3 QA gate
- [ ] 4.1 Full e2e and the gallery
- [ ] 4.2 Integration suite and smoke
- [ ] 4.3 Independent review with a computed-style critique
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Phase 1 gate: commands green · typecheck ok · lint ok (13 warnings) · build ok · unit 5346/5346 in 840 files · check-design 203 violations in 130 files, 9 opt-outs · design 8/8 · existing e2e 4/4
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (15 warnings, 1 info) · build ok · unit 5351/5351 in 833 files · check-design 289 violations in 184 files, 0 opt-outs
- Phase 0 gate: commands green · typecheck ok · lint ok (15 warnings) · build ok · unit 5364/5364 in 840 files · check-design 285 violations in 182 files, 0 opt-outs · design login 1/1

## Decisions
- 0.1: section 4 starting point matches: `PROGRESS.md` said `dealflow-wd-p10-v1` with `STATUS: COMPLETE`, so the run renames it to `PROGRESS-P10.md` and starts Part 11 at Task 0.1.
- 0.1: Docker 24.0.5 answers and `docker run --rm alpine df -h /` reports 28.5 GB available of 95.0 GB (68% used), above the 10 GB fatal threshold, so the baseline proceeds without pruning.
- 0.1: the kit arrived untracked at the repo root as `dealflow-wd-part11-kit 2`, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part11-kit` (the Part 2 to 10 layout), added the root `PLAN-PART11.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical, `PLAN_FILE` now `PLAN-PART11.md`).
- 0.1: the theme switch already applies `.dark` on `<html>` through `src/features/theme/AppearanceSync.tsx`, so Task 0.2 only adds the public light lock.
- 0.1: the three style guards (`src/paletteTokens.test.ts`, `src/typeScale.test.ts`, `src/app/globalsDarkVariant.test.ts`) exist and pass in the baseline, so Task 0.2 updates their allow-lists to the new contract.
- 0.1: Inter is loaded by `next/font/local` from `src/app/fonts/inter-latin-var.woff2` in `src/app/layout.tsx`, so no font work is needed.
- 0.1: `npm view @axe-core/playwright version` prints 4.14.0, so the planned pin holds for Task 0.4.
- 0.1: pnpm is 9.15.9 from `/tmp/dealflow-tools`, matching Part 10's environment; the subagent tool is available in this harness.
- 0.1: `check-design.mjs` is 6.3 verbatim; `biome check --write` only reflowed its whitespace (no rule, threshold or message changed) so `pnpm lint` stays green, and the baseline it reports (289/184) matches the planner's dry run exactly.
- 0.2: every 6.4 token is a CSS variable in `globals.css` in both themes (HSL channels for the shadcn-style roles, raw hex where the role is not colour-converted), with the measured radius scale 2/4/8/8, `--text-meta` 13/18, `--text-title` 24/32, the four floating shadows, 100 ms ease-out default transitions, the global 2 px blue focus outline, `.tabular`, `.board-column` and the 16/24 page paddings. `scripts/dealflow/hex-to-hsl.mjs` produced the channel values.
- 0.2: `--text-display` is gone: its 27 heading uses became `text-title` (24/32/400) and the two composer Subject inputs became `text-sm` (controls are 14/20), so no surface keeps a 25 px step. `cn` registers `text-title`/`text-meta` as font sizes, otherwise tailwind-merge drops the size when a colour class follows it.
- 0.2: the typeScale guard's second case now requires every painted h1 to name `text-title` or `text-base` (the type table's two heading steps) instead of the removed `text-display`; it still fails on an unnamed size. Tests updated for the class contract: `PageHeading`, `LeadHeader`, `EditableTitle`, `ActivityComposerInline.fields`, `lib/utils`.
- 0.2: the public light lock is `[data-theme-lock="light"]`, which re-declares the light palette in the same rule as `:root`, so its subtree stays light even with `.dark` on `<html>`; `AppearanceSync` and `useAppearanceChoice` also refuse to add `.dark` while the attribute is present (checked on mount, when the page tree is already committed).
- 0.3: every 6.6 primitive is restyled at the token level while keeping its props, roles and test ids: controls 28/32/40 with `SplitButton` added to `Button.tsx`, fields 32 with the strong border and a 1 px blue focus ring, 18 px checkbox/radio with the blue checked fill, 32x18 switch on green, 20 px status badges, 40 px tabs with the blue underline, overlays on `shadow-pop`/`shadow-dialog` and the 50% foreground scrim, dark toasts, a shimmering skeleton and the 4 px progress bar. The dialog and sheet chrome keeps the 56/64 header/footer rhythm with full-bleed rules via negative margins, so the body padding stays 24 and no call site changed.
- 0.3: added a `--track` token (#E4E4E4 light, #30343D dark) for the progress track and the future StageTrack segments; 6.4 gives that value but no token name, and `bg-track` keeps both surfaces on one value.
- 0.3: `Avatar` now uses the measured `--avatar` / `--avatar-foreground` neutral pair instead of a per-name colour swatch; initials stay 600 and the 20/32/40 sizes come from the caller's size classes.
- 0.3: new `Panel`, `Kbd`, `StatusBadge`, `ViewSwitcher`, `PageToolbar`, `tableStyles` and `shell/pageTitle.tsx`, each with a unit test. The switcher is a `fieldset` of `aria-pressed` buttons because no Radix toggle-group is installed and Part 11 allows only `@axe-core/playwright` as a new dependency.
- 0.3: changed tests for the new primitive contract: Input focus ring (ConditionRows, SavedViewControl), the disabled neutral pair on every Button variant, the Checkbox strong border, and the Switch track/on tokens. No assertion was loosened.
- 0.4: `@axe-core/playwright@4.14.0` is installed as a dev dependency, the only new package this part adds.
- 0.4: `e2e/15-design.spec.ts` splits the gallery into public and app groups (the login screen must run signed out, the other 21 with the seeded admin), writes the fixed `{screen}-{width}-{theme}.png` names to `e2e/screenshots/design/`, runs axe at `wcag2a`/`wcag2aa` with zero serious or critical violations, checks `scrollWidth <= innerWidth + 1` at 375, and switches to night through the real appearance path: the seeded users default to `system`, so `emulateMedia({ colorScheme: "dark" })` plus a reload goes through `AppearanceSync` rather than faking the class.
- 0.4: the gallery's `{id}` routes read one seeded record per detail screen, so `scripts/e2e/seed-session.ts` now also writes the pipeline, organization, lead, project, document (and its public id), dashboard, report, thread, automation, form public id and booking public id into `.e2e/fixtures.json`. Resolving them by clicking through lists would tie the harness to list markup that is about to be restyled.
- 0.4: `e2e/design/styleChecks.ts` implements the 6.10 table from computed styles and is scoped to the four named screens. It reads test ids the screen tasks add (`app-rail`, `top-bar`, `page-title`, `primary-action`, `search-pill`, `board-column`, `deal-card`, `deal-card-title`, `stage-track`, `deal-sidebar`, `sidebar-row`, `deal-title`, `activity-side`, `table-row`), so the checks fail loudly rather than silently passing if a hook disappears.
- 0.4: the task verify ran green: `DESIGN_SCREENS=login DESIGN_CHECKS=0 pnpm exec playwright test e2e/15-design.spec.ts` passed 1/1 and wrote `login-1440-light.png` and `login-375-light.png`.
- 1.1: the rail is now a 56 px full-height `app-rail` of 44 px tiles with a tooltip per item, indigo ground and the violet active tile. The brand cell shows our app icon forced white with `brightness-0 invert` (no Pipedrive asset is used). The collapse control and its `NAV_PREF_COOKIE` read are gone; Settings moved to the avatar menu and help to the top bar, so the rail carries only destinations.
- 1.1: `TopBar` became a client component so it can read `usePageTitleValue`; it renders the 16/600 page title (with an info tooltip when the page supplies one), the 240x40 search pill (a 40 px round icon button below md), the round add button, the AI pill, the notifications bell, a help link and the 40 px initials avatar. Pages publish their titles from Task 1.2 onward, so the slot is empty until then.
- 1.1: the bottom nav is rail-coloured with 24 px white icons, a violet 32x32 active tile and 11/600 labels; the More sheet has a rail header strip over a card body. The 11 px label needed a new `--text-caption` token because check-design bans arbitrary `text-[Npx]` and 6.7 measures the label at 11/600.
- 1.1: `STRINGS.search.placeholder` is now "Search Dealflow" per 6.9, and the trigger reads it instead of hard-coding a second copy.
- 1.2: the board now uses `PageToolbar` (a four-view `ViewSwitcher`, the split "+ Deal", the count with its info toggle, the pipeline menu joined to a 32 px pencil, Filter and the actions overflow), a 40 px filter row (Pin filters, chips, the sort pill and arrow), 248 px `board-column`s with the chevron clip-path and canvas-subtle fill, white cards with the 3 px warning rot border, the score chip before the 16 px next-activity dot, and a drag bar of 64 px dashed zones. `PageTitle` publishes "Deals" for the board, list and archived pages, and the edit page's in-content h1 moved to the top bar.
- 1.2: the split button's caret repeats the primary action: Part 11 cannot add create entries to it (that would change behaviour), and Part 7 dropped the old caret for the same reason. The drag bar keeps its three real zones instead of the spec's four: delete is deliberately not a drop target (confirmed action on the menu), so a Delete zone would be a dead control.
- 1.2: dnd-kit's attributes and listeners moved off the wrapper div and onto the card's own button, because the wrapper rendered `role="button"` around a `<button>` and axe fails that as `nested-interactive`. The canvas role and drop targets are unchanged.
- 1.3: the deal header is the measured three-row block: 24/400 editable title with owner (32 avatar, 14/600 name, 13 secondary role), followers, presence, 32x62 Won/Lost, block visibility and the "..." menu; the new `StageTrack` (24 px, equal-width chevrons with a 2 px gap, green passed/current, track-grey future, stage-name tooltips, same `changeStageAction` and undo path); the blue "Pipeline > Stage" breadcrumb; a 1 px rule. The chevron `StageSelector` and its test were deleted (nothing else used them).
- 1.3: the body is a 400 px white sidebar with a right border and flush 64 px section rows (`CollapsibleSection` no longer draws a card), and the activity side is `canvas-subtle` with the composer in a white card, so the sidebar-row, deal-title, deal-sidebar and activity-side parity checks all read the measured values. Record links and completed-activity text use `--link-record` instead of `--primary`, which is both the 6.1 rule and the reason the dark pass contrast now passes.
- 1.3: the rail highlights the pipeline tile on `/deals/{id}` (`isNavActive`), so the deal page always has exactly one active rail tile, which the parity check requires.
- 1.3: three tab strips render only a strip (the editor/list lives outside a `TabsContent`), so Radix's generated `aria-controls` dangled and axe failed `aria-valid-attr-value`; each now mounts a hidden `TabsContent forceMount` target per value. No behaviour changed.
- 1.4: the six list/detail screens now publish `PageTitle` (Deals, People, Organizations, Leads, Activities, Calendar, Timeline), and the activities table uses `tableStyles` (33 px rows, strong header rule, light grid, green record links, sentence-case headers) with single-line cells so the measured 33 px row holds. `ActivityRow` carries `data-testid="table-row"` for the parity check.
- 1.4: record and navigation links across deals, contacts, leads and activities moved from `text-primary` to `text-link-record` (or `text-info` for controls), which is the 6.1 rule and fixes the dark-pass contrast; the priority warning chip and overdue row text use the new `--warning-soft-foreground` and `--next-red` tokens; the generic `Badge` success text uses `--link-record`.
- 1.4: the global `:focus-visible` outline is `!important` because Checkbox/Button-style primitives opt out with `outline-none` and rely on a ring; the design spec's focus check requires the 2 px blue outline on the first Tab target on every screen.
- 1.4: three more tab strips (ContactHistoryTabs, the contact detail tabs, LeadTimeline) got hidden `TabsContent forceMount` targets, like the deal ones, so Radix's `aria-controls` resolve; the activities list spec first switches to "To-do" and "All owners" because its default "Today for me" view is legitimately empty for the seeded admin.
- 1.4: changed tests: the overdue activity row asserts `text-next-red`, and the date picker's fullness dots assert the success/warning/destructive tokens.
- 1.4: `DESIGN_SCREENS=deals-list,people,person,organizations,leads,activities-list` passes 6/6 (axe light+dark, 375, activities parity).
- 2.1: the inbox follows 6.8.5: a 220 px white folder column with 32 px items and an info-soft active row, the list pane keeping its full-width conversation column (Part 7 chose a standalone reader route, not a two-pane split), 72 px thread rows at 12/16 padding with an info-soft selected state, a canvas-subtle reading pane with rounded-lg white message cards, and the 32 px reply footer. The inbox, thread and compose routes publish their top-bar titles.
- 2.1: the reply composer opens in a bottom `Sheet` on a phone (closing Part 10's open issue) and inline on desktop; the design spec now proves the 375 sheet opens and closes.
- 2.1 CONTRACT CHANGE: the dark `--avatar-foreground` is #C7C9CE (the planned value) instead of the muted-grey step that had been copied, because initials on the dark avatar measured 4.38:1; text-level error/red links in mail use `--next-red` / `--link-record` for the same reason.
- 2.1: the Avatar sets its ink with an inline `hsl(var(--avatar-foreground))` rather than a class, because tailwind-merge classified the custom colour token as a font size and dropped it when a caller passed `text-caption`.
- 2.1: changed tests for the new mail contract: the reply footer and reader card assert `rounded-lg`, label chips assert the caption size and sentence case. The design spec excludes sandboxed email-body iframes from axe (third-party documents), otherwise the thread analysis hangs.
- 2.1: `DESIGN_SCREENS=inbox,thread` passes 2/2 and the email/inbox unit suites 998/998.
- 1.5 fixes: the gate's full unit run caught two contract assertions from the restyle. `Board.test` still expected a stage lane to be `flex-1` (the measured column is fixed at 248 px and the board scrolls), and `NotificationsBell.test` expected the old `hover:bg-accent`/`text-link` classes (now `hover:bg-muted`/`text-info`). Both tests were updated to the new contract; no assertion was dropped. The gate then passed: typecheck, lint (13 warnings), build, unit 5346/5346, the eight design screens 8/8, and the board/deal/list e2e specs 01, 07, 13, 14 4/4.

- 1.3 CONTRACT CHANGE: the future-stage label uses a new `--track-foreground` token (#5E6066 light, #A3A6AD dark) because the measured #65686F on #E4E4E4 is 4.38:1 and axe AA needs 4.5; #5E6066 measures 4.98:1.
- 1.3: changed tests for the contract: the OVERDUE chip is now the filled StatusBadge, the stage parity check reads the current segment (the seeded deal can sit in the first stage, so no passed segment exists), the deal workspace test asserts the stage track's `aria-current="step"` option, and an open deal no longer renders an OPEN status badge.
- 1.2 CONTRACT CHANGE: the dark palette keeps the light action green `#2D8548` and destructive `#D73C38` instead of `#3FA864` / `#EE6461`: white on the lighter pair measures 3.0:1 and 3.1:1, and on the darker pair 4.6:1 (6.4's contrast note). The rot age text uses `--next-red` (dark `#EE6461`, 5.2:1 on the dark card) instead of `--destructive`.
- 1.2: changed tests for the board contract: rot is a warning border rather than a graded red fill, the owner avatar is the neutral token pair, the drag overlay uses `shadow-drag` + `rotate-2`, the next-activity dot uses the measured green/grey/red tokens, view segments are icon-only with names, lanes are 248 px with a 4 px gap and no divider, and "Move to" replaced "Move". The design spec now prints axe node targets, and its light pass pins `colorScheme: light` so a dark host OS cannot flip the gallery.
- 1.1: changed tests for the new shell contract: `LeftNav.test.tsx` rewritten for the icon-only rail (width, 44 px tiles, violet active tile, Settings absent, no collapse control); `SearchTrigger.test.tsx` now asserts the placeholder span truncates inside the pill; `paletteTokens.test.ts` lost its LeftNav fixed-palette exemption; the engagement skeleton dropped its static-card shadow so `check:design src/components/shell` is 0.
- 0.5 fixes: the gate's first unit run caught `Board.emptyState.test.tsx`, whose assertions scope to the empty state's title parent; my new EmptyState grouped the title and body in a wrapper div, which moved the action buttons outside that parent. The wrapper was removed (icon, title, body and action stay direct children of the role=status region), not the test. Lint's only error was an unnecessary `rows[0] as ...` assertion in `scripts/e2e/seed-session.ts` plus a Biome reflow in `SavedViewControl.test.tsx`; both fixed.





## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; commands that load `.env` carry `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` until then.
- TODO(owner): rebuild the dev stack so its app image reads the Part 10 migrations: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.
- TODO(owner): push is still off because `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are empty. Run `pnpm push:vapid`, add all three to `.env`, then restart the app and worker.

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2). Recreate it with `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` if `/tmp` was cleared.
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- `npm view` in this sandbox needs `--cache /tmp/npm-cache --logs-dir=/tmp/npm-logs` (writing `~/.npm/_logs` is blocked).
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once. Part 10 wraps this as `build:sw && ALLOW_FIRST_LOGIN_ADMIN=false next build`.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211. Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312), with `COMPOSE_PARALLEL_LIMIT=1`.
- Docker 24.0.5 is up with 28.5 GB free in the VM (95.0 GB total) as of 2026-10-22 07:31; the dev stack provides Postgres on 5433 and MinIO on 9000/9001 (`pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left" after Task 0.1, record the step SKIPPED and end `COMPLETE WITH OPEN ISSUES` (section 10).
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report
(written in Task 4.5)
