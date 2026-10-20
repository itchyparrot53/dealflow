# PROGRESS: dealflow-wd-p3-v1

STATUS: IN PROGRESS
Current: 1.4 · Last updated: 2026-10-20 20:35

## Phase base commits
- Phase 0: 15ff072bad756d4e64d00cbfd89521ba472ca651
- Phase 1: 7e9e458

## Tasks
- [x] 0.1 Start Part 3: progress files, kit and baseline
- [x] 0.2 Sales schema and migration
- [x] 0.3 Money and totals (test-first)
- [x] 0.4 Phase 0 QA gate
- [x] 1.1 Rates, base currency and permissions
- [x] 1.2 Product catalog service
- [x] 1.3 Deal lines and the value sync (test-first)
- [ ] 1.4 Deal terms and stage probabilities
- [ ] 1.5 Phase 1 QA gate
- [ ] 2.1 Settings → Currencies
- [ ] 2.2 Settings → Products
- [ ] 2.3 Deal Products section and terms fields
- [ ] 2.4 Stage probability in the stage editor
- [ ] 2.5 Converted and weighted totals on the board and list
- [ ] 2.6 Phase 2 QA gate
- [ ] 3.1 Forecast service (test-first)
- [ ] 3.2 Forecast page and navigation
- [ ] 3.3 Demo seed and docs
- [ ] 3.4 Phase 3 QA gate
- [ ] 4.1 E2E sales spec and screenshots
- [ ] 4.2 Integration suite and smoke
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: typecheck ok · lint ok (14 warnings, 0 errors) · build ok (a first attempt hit the known `ENOTEMPTY` race on `.next`; cleared and retried) · unit 4979/4979
- Phase 0 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5004/5004 · currency 25/25

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
