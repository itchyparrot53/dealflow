# PROGRESS: dealflow-wd-p11-v1

STATUS: IN PROGRESS
Current: 0.4 · Last updated: 2026-10-22 07:58

## Phase base commits
- Phase 0: 18e1dffa85996e1ec988dcb2e24f9b25faa35425

## Tasks
- [x] 0.1 Start Part 11: progress files, kit, baseline and design worklist
- [x] 0.2 Tokens and global styles
- [x] 0.3 Primitives and layout components
- [ ] 0.4 Design e2e harness
- [ ] 0.5 Phase 0 QA gate
- [ ] 1.1 Shell
- [ ] 1.2 Pipeline board
- [ ] 1.3 Deal workspace and StageTrack
- [ ] 1.4 Lists and person/organization detail
- [ ] 1.5 Phase 1 QA gate
- [ ] 2.1 Inbox, thread and mobile reply sheet
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
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (15 warnings, 1 info) · build ok · unit 5351/5351 in 833 files · check-design 289 violations in 184 files, 0 opt-outs

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
