# PROGRESS: dealflow-wd-p3-v1

STATUS: IN PROGRESS
Current: 4.1 · Last updated: 2026-10-20 21:17

## Phase base commits
- Phase 0: 15ff072bad756d4e64d00cbfd89521ba472ca651
- Phase 1: 7e9e458
- Phase 2: 644b036
- Phase 3: 3418b2a
- Phase 4: f112b1e

## Tasks
- [x] 0.1 Start Part 3: progress files, kit and baseline
- [x] 0.2 Sales schema and migration
- [x] 0.3 Money and totals (test-first)
- [x] 0.4 Phase 0 QA gate
- [x] 1.1 Rates, base currency and permissions
- [x] 1.2 Product catalog service
- [x] 1.3 Deal lines and the value sync (test-first)
- [x] 1.4 Deal terms and stage probabilities
- [x] 1.5 Phase 1 QA gate
- [x] 2.1 Settings → Currencies
- [x] 2.2 Settings → Products
- [x] 2.3 Deal Products section and terms fields
- [x] 2.4 Stage probability in the stage editor
- [x] 2.5 Converted and weighted totals on the board and list
- [x] 2.6 Phase 2 QA gate
- [x] 3.1 Forecast service (test-first)
- [x] 3.2 Forecast page and navigation
- [x] 3.3 Demo seed and docs
- [x] 3.4 Phase 3 QA gate
- [ ] 4.1 E2E sales spec and screenshots
- [ ] 4.2 Integration suite and smoke
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: typecheck ok · lint ok (14 warnings, 0 errors) · build ok (a first attempt hit the known `ENOTEMPTY` race on `.next`; cleared and retried) · unit 4979/4979
- Phase 0 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5004/5004 · currency 25/25
- Phase 1 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5004/5004 · currency/products/deals integration 159/159
- Phase 2 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5004/5004 · currency/products/deals/pipelines integration 179/179
- Phase 3 gate: commands green · typecheck ok · lint ok (15 warnings) · build ok (a first attempt hit the known `ENOTEMPTY` on `.next`; cleared and retried) · unit 5004/5004 · forecast/currency/products integration 37/37

## Decisions
- 0.1: starting point is `15ff072` (`5.6: Final report and completion`, Part 2) and the previous PROGRESS.md said `dealflow-wd-p2-v1` with `STATUS: COMPLETE`, so this run starts fresh at Task 0.1 as section 4 expects.
- 0.1: the kit arrived untracked as `dealflow-wd-part3-kit/` at the repo root; moved it to `PLAN AND EXECUTE/dealflow-wd-part3-kit` to match the Part 1 and Part 2 layout, added the root `PLAN-PART3.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical, `PLAN_FILE` now `PLAN-PART3.md`), per section 4's "kit in a subfolder" row.
- 0.1: the next free migration number is 0080 (the last file is `0079_dealflow_mail_tables.sql`), so the sales schema migration keeps the planned name.
- 0.1: `src/db/schema/stages.ts` has no probability column, so `stage_probabilities` is used as section 6.4 specifies.
- 0.1: the won timestamp is `deals.wonTime` (`won_time` timestamptz), so forecast won months use it.
- 0.1: pnpm 9.15.9 from `/tmp/dealflow-tools`, Node 24.16.0 and Docker 24.0.5 are available; `.env` still has a partial Google configuration (client id and secret set, workspace domain empty), so commands that load `.env` keep the three overrides.
- 0.3: added `E_CURRENCY_005` beside the nine IDs of 6.2, because 6.5 requires the pure parsers and `roundDiv` to throw `AppError` on a malformed pre-validated input or non-positive divisor and the contract names no ID for that cause; the nine named IDs are added unchanged in this commit so later tasks only use them.
- 0.3: `parseMilli` accepts a negative decimal (only `quantityString` enforces greater than zero), because the parser is also used by line math where a correction can be negative while user input stays positive.
- 0.3: `formatMoney` assembles the locale layout from `Intl.NumberFormat.formatToParts` around the exact integer digits, so a displayed money value is never converted to a JS float.
- 0.4: `src/constants/errorIds.test.ts` gained `PRODUCT` and `CURRENCY` in its domain allow-list, because the registry now carries those domains per 6.2; the per-ID format and uniqueness assertions are unchanged.

- 1.1: the rate permission check lives in `rates.ts` (`can(actor, "permissions.manage")`, the gate the existing base-currency setting uses) and the server actions own only CSRF and the session, so the integration test can prove a non-admin is refused; this mirrors the pipelines services rather than the goals actions.
- 1.1: added the `products.manage` global capability (granted to admins by default, listed as high-risk so only an admin can hand it to a permission set) and the code-defined registry needed no migration; existing stored sets simply do not carry it yet.
- 1.1: `setBaseCurrency` is a no-op when the submitted code already is the base, so re-selecting the same currency cannot silently delete every manual rate; a real change updates settings and deletes all rates in one transaction.
- 1.1: `listRates` returns the Postgres numeric string unchanged (`1.10000000`) for the settings table, while `loadRateMap` parses to the scaled `Rate` bigint for arithmetic; the two never mix formats.
- 1.1: added `E_PRODUCT_006` and `E_CURRENCY_006` (input failed Zod) beside the named IDs, following every other feature's `_INPUT_INVALID` convention for malformed action input.

- 1.2: catalog reads are open to any signed-in user (the deal page's add-product combobox needs them) while every mutation requires `products.manage`; the check lives in `products.ts` for the same testability reason as rates.
- 1.2: product prices and tax stay decimal strings end to end (`moneyString`/`percentString` into numeric columns); no product code converts them to a JS number.
- 1.2: the `ilike` search escapes `%`, `_` and `\` with a backslash so a search term cannot widen the pattern, and archived products sort after active ones.
- 1.2: `deleteProduct` checks `deal_products` first and still maps a foreign-key violation to `E_PRODUCT_002`, because a line can be added between the check and the delete.

- 1.3: reused `loadEditableDeal` for the deal-edit gate and added `recordDealValueChange` beside `updateDeal` in `dealUpdate.ts`, because the inline-edit input accepts a JS number while line totals are decimal strings; the new writer takes the string and writes the same `CHANGE_FIELD_VALUE` row and `dealUpdated` board event, so no money value becomes a float. `updateDeal` now refuses a manual value edit while lines exist with `E_PRODUCT_004`.
- 1.3: every line mutation locks the deal row (`FOR UPDATE`) before reading the lines, so two concurrent line edits cannot compute totals from different snapshots.
- 1.3: adding or editing a line recomputes net from all lines with per-line rounding; removing the last line skips the sync so the value keeps its last total, exactly as 6.7 specifies.
- 1.3: a product priced in another currency converts with `convertBetween` at add time using `loadRateMap`; if either side has no rate the add fails with `E_CURRENCY_001` before any insert.
- 1.3: archived products cannot be added (the lookup filters `active`), and the line read gates the parent deal with `canSee` plus the shared `toVisibleDeal`, not a new visibility predicate.
- 1.3: the test reads change-log rows through `listChangeLog` rather than a raw jsonb select, because raw selects double-decode a stored string like "2160.00" into the number 2160.

- 1.4: effective probability is resolved in one place (`getDealTerms`): override, then the stage row, then 100; `setDealTerms` returns the same view after its write, so the two can never disagree.
- 1.4: `setDealTerms` locks the deal row, refuses a currency change while lines exist (`E_CURRENCY_004`) before any write, logs currency/probability changes through `recordChange` with the new `CHANGE_FIELD_CURRENCY`/`CHANGE_FIELD_PROBABILITY` fields, and publishes `dealUpdated` because cards render the value in the deal currency.
- 1.4: submitting the identical terms is a no-op: no upsert and no change-log row, so an untouched form does not create history.
- 1.4: stage probabilities use `pipeline.manage` (the stage editor's permission), pre-check the stage so a stale id returns `E_STAGE_NOT_FOUND`, and write no change-log row (the stage editor has no deal history).

- 2.1: the settings page reads `listRates` in the server component and calls `router.refresh()` after each action, matching every other settings page; the `currency.*` tRPC reads remain for the board, list and forecast.
- 2.1: a base change goes through the shared `ConfirmDialog` (AlertDialog) with the exact warning copy, and the rates table uses the existing `SETTINGS_TABLE_*` tokens because the repo has no shadcn Table wrapper: settings tables are plain semantic tables with those tokens.
- 2.1: currency labels come from `Intl.DisplayNames(["en"], { type: "currency" })` as "EUR, Euro", and the table trims the database's eight decimals for display only (`1.08000000` reads `1.08`).

- 2.2: the page loads all products once (bounded at 200) and the client filters the search and the archived toggle locally, so toggling needs no round trip; every mutation refreshes the server component.
- 2.2: `ProductDialog` is remounted on each open (a key from the parent) instead of resetting state in an effect, which the react-hooks lint rule forbids; the form therefore always starts from the selected row.
- 2.2: users without `products.manage` get the same product table without the New button and the row menu, matching 6.10's read-only requirement.

- 2.3: Products is a new sidebar section appended to the registry (rather than inserted after Summary), keeping the existing section-order preference test and stored preferences valid; it renders only when the server supplies `productSummary`, so pre-Part-3 fixtures still render without a tRPC provider.
- 2.3: `getWorkspace` now returns an optional `productSummary` (line count, deal currency, stage and effective probability, base-converted value) from one server helper, so the Summary value row and the section do not each open their own read for the header.
- 2.3: the Summary value row shows "Calculated from products" while lines exist and an "≈ base" amount when the deal currency differs; the displayed value uses the deal currency.
- 2.3: line cells commit on blur or Enter, restore the previous text when the server refuses the write, and every mutation invalidates the lines and terms reads plus refreshes the RSC tree so the header value follows.
- 2.3: the terms currency select is disabled with a Tooltip while lines exist, the probability input uses the stage value as its placeholder, and both save through `setDealTermsAction`.

- 2.4: a stage probability saves immediately through `setStageProbabilityAction` on blur instead of joining the page's stage diff, because it lives in its own table with no ordering or deletion semantics; the edit page preloads the rows and defaults a missing one to 100.
- 2.4: a newly added, not-yet-saved stage has no id, so its probability input is disabled until the page Save creates the stage (the value is then 100 until edited).

- 2.5: board totals are derived client-side from the loaded cards, which 6.8 explicitly allows: the board query now selects each deal's currency and effective probability, and `useBoardDerived` runs the shared `summarize` with a rate map passed from the pipeline page, so the column header and board total never sum unconverted amounts.
- 2.5: the deals list total and weighted total are computed server-side over the full filtered set by selecting one money row per deal and calling `summarize`; the footer shows `totals-excluded` with a Tooltip naming the currencies that lack a rate.
- 2.5: `DealListClient` reuses the rate list supplied by the server for the client-side owner-filtered subset instead of opening a new tRPC read, which keeps the existing list tests' tRPC mocks valid.
- 2.5: `resolveDealListFooter` gained an `excluded` field; the two existing expectations were updated to include `excluded: []` (new contract field, no assertion weakened), and a new integration case proves a mixed USD/EUR set converts and lists the JPY deal as excluded.

- 3.1: forecast visibility reuses `dealVisibilityClause`, the exact predicate the deals list uses, so a hidden deal can never appear in a month or the no-date list.
- 3.1: one SQL read feeds TypeScript bucketing (overdue into the first month, won by UTC won month, later dates dropped), the month lists are sorted and capped at 200 with the real `openCount`, and `summarize` produces `total`/`weighted` while deals without a rate land in `excluded`.
- 3.1: `moveDealToMonth` loads the deal, refuses won/lost with `E_DEAL_PRECONDITION` (the plan allowed the existing "not editable" error; no new ID), clamps the day of month, and calls `updateDeal` so CAS, the change log and the realtime event are exactly the manual close-date path.
- 3.1: the currency coalesce in the forecast, board and list SQL gained a `'USD'` fallback: a fresh database has no settings row and `readBaseCurrency` then returns USD, so without the fallback every deal read as rate-less and the totals were zero. The first forecast test run caught this.
- 3.1: the forecast test file was written after the first draft of the service rather than before it; the first run still exposed the settings fallback bug above, after which the cases were completed. Logged rather than claimed as test-first.

- 3.2: the forecast is a client board reading `forecast.get` through tRPC with its filters in component state, so changing pipeline, month count, include-won or the month range never reloads the RSC tree; the page only loads the visible pipelines.
- 3.2: dragging uses dnd-kit with an optimistic `moves` overlay; the card leaves its old month immediately, a refused action removes the override (rollback) and shows copy, and the totals catch up when `forecast.get` invalidates.
- 3.2: the Forecast item sits after Pipeline in `NAV_ITEMS` with a TrendingUp glyph; the number-key shortcuts shift by one because they index that same list by design.
- 3.2: the no-date section shows the service's first 100 titles with the real count in its heading.

- 3.3: demo sales data lives in `scripts/seed-demo-sales.ts` so `seed-demo.ts` stays within its size and the seed stays re-runnable: products upsert by code, lines are replaced per deal, and the EUR/GBP/JPY deals are matched by title instead of duplicating.
- 3.3: the seed keeps the USD base that `seedSettings` creates; if an install already uses another base, the rate for that code is skipped (the API refuses a base rate) and the same numbers are used against the existing base.
- 3.3: close dates are assigned by a title ranking: the first two open deals go 10 and 20 days into the past (overdue), the next three lose their date, and the rest are spread over the next six months.
- 3.3: `docs/dealflow/SALES.md` documents the model, money rules, rates, probability, forecast rules, permissions and tests; `UPSTREAM.md` lists every upstream file this part edits, and the README gained a short Products/currencies/forecast section.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on every command that loads `.env`.
- TODO(owner): rebuild the dev stack so it reads the Part 2 migrations and the Part 3 schema once migration 0080 is applied: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2).
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers`; ports 3210/3211. Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312).
- Docker 24.0.5 is up; the owner's `warpdrive-main` stack holds 5433/9000/9001. Never prune; if a build fails with "no space left", log `TODO(owner): free Docker disk space` and mark the step SKIPPED.
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report
(written in Task 4.5)
