# PLAN: Dealflow on warpdrive, Part 3: Products, multi-currency, forecast

> Plan ID: dealflow-wd-p3-v1 · Written: 2026-10-20 · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 4, fast verification profile, no human in the loop · Type: change to existing project

Parts 1 and 2 are finished (`PROGRESS-P1.md`, and `PROGRESS.md` until Task 0.1 renames it to `PROGRESS-P2.md`): Dealflow branding, local sign-in, the AI layer, and a provider-neutral mail layer with IMAP/SMTP. At the end of Part 2 there were 4,979 unit tests, 1,820 integration tests and e2e specs `00` to `06`, all passing. Part 3 adds products and deal line items, a currency per deal with manual rates, stage probabilities, converted and weighted totals, and a forecast board. This plan is deliberately compact: where it says "find" or "reuse", locate the existing warpdrive code, reuse it, and log the file you used as a Decision.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 4** in fresh-context sessions, one phase per session. Parts 1 and 2 (`PLAN-PART1.md`, `PLAN-PART2.md`) are finished; their code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART3.md` in full and PROGRESS.md (open `PLAN-PART1.md`/`PLAN-PART2.md` only where this plan points to them). If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p3-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 2's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 4.5, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 4.2.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.4, 1.5, 2.6, 3.4):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). The one independent review is Task 4.3.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (the deal value now derived from product lines, converted totals), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs only. This part needs no external service; e2e uses the fake mail transport.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove or recreate the owner's running Compose project `warpdrive-main`, never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack 3001/5433/8080/9000/9001 (owner's). Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `PLAN-PART3.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 2's file to `PROGRESS-P2.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p3-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 3: progress files, kit and baseline
(every task through 4.5, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 4990/4990 · currency/products 30/30

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

Add a product catalog with deal line items that drive the deal value, a currency per deal with manual exchange rates and converted totals, stage probabilities with weighted totals, and a forecast board by expected close month (drag a card to re-date the deal). Everything stays inside warpdrive's stack and conventions; the old Dealflow app is not touched.

## 2. Definition of done

1. Migration `0080_dealflow_sales` adds the five tables in 6.4 and nothing else; existing deals are unchanged and read as base currency.
2. `src/features/currency/money.ts` does all money math on `bigint` minor units with half-away-from-zero rounding; its unit tests pass and no `parseFloat`/`Number(` touches a money value in the new features.
3. Settings → Currencies lets an admin set the base currency and manual rates; a rate for the base code is refused; changing the base currency clears all rates in the same transaction.
4. Settings → Products lists, creates, edits, archives and deletes products; a product used on a deal cannot be deleted (archive instead).
5. The deal page has a Products section: add, edit and remove lines; net, tax and gross totals; the deal value equals the net total, goes through the change log and realtime, and cannot be edited by hand while lines exist.
6. A deal has a currency and an optional probability override; each stage has a probability (default 100); a product priced in another currency is converted at add time, and a missing rate refuses the add with no write.
7. Board column headers and the deals list show totals converted to the base currency, plus the weighted total on the board; deals without a rate are listed as excluded, never silently dropped or summed unconverted.
8. `/forecast` shows open deals by expected close month (overdue ones in the first month, flagged), won deals by won month, total, weighted and won per month, a "No close date" list, respects deal visibility and the pipeline filter, and dragging a card to another month changes the close date.
9. The demo seed has products, lines, stage probabilities, a EUR and a GBP deal and their rates.
10. typecheck, lint, build, unit and the full integration suite pass; e2e specs `00` to `07` pass; the 6 `p3-*` screenshots exist; smoke passes; one independent review ran.

## 3. Decisions already made

- Stack unchanged (Part 1 section 3). No new runtime dependency. Currency names and the code list come from `Intl` (`Intl.supportedValuesOf("currency")`, `Intl.DisplayNames`), formatting from `Intl.NumberFormat`.
- `deals.value` keeps its type `numeric(14,2)` and now means "value in the deal's currency". A deal without a `deal_terms` row is in the base currency, so no data migration is needed. Update the schema comment on `deals.value` accordingly (the only edit to `src/db/schema/deals.ts`).
- Side tables instead of new columns on upstream tables (`deal_terms`, `stage_probabilities`), so the upstream diff stays small.
- Base currency is the existing `settings.base_currency` (not the `BASE_CURRENCY` env default, which only seeds a fresh install).
- Rates are manual (no rate API, no network). `rate_to_base` = how many base units one unit of the code is worth.
- Deal value with lines = sum of line nets (before tax). Tax is shown, not added to the value.
- A line's `item_price` is in the deal's currency. Adding a product priced in another currency converts once, at add time. Changing a deal's currency while it has lines is refused (`E_CURRENCY_004`).
- Effective probability = `deal_terms.probability` if set, else the stage's probability, else 100. Weighted value = value × probability / 100 (rounded per deal).
- Forecast dates are calendar dates (`expected_close_date` is a `date`); won months use the won timestamp in UTC.
- Forecast drag keeps the day of month, clamped to the target month's last day.
- Products management: admins only, through the permission system (6.7). Rates and base currency: the permission the existing base-currency setting already uses. Deal lines, deal currency and probability: the same permission as editing the deal's value.
- No changes to the AI assistant, MCP server, CSV import or the mail layer in this part.

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | `git --no-optional-locks log -1 --format=%h` is Part 2's last commit or later; PROGRESS.md says `dealflow-wd-p2-v1` and `STATUS: COMPLETE` | log a Decision describing what you found; continue |
| Kit location | `PLAN-PART3.md` and the kit at the repo root, or in `PLAN AND EXECUTE/dealflow-wd-part3-kit/` | kit in a subfolder: root symlink `PLAN-PART3.md`, copy the kit's `scripts/check-progress.mjs` over the root one (byte-identical), log a Decision |
| Next migration number | `ls drizzle/*.sql | tail -1` is `0079_dealflow_mail_tables.sql` | use the next free number and log it |
| Stages have no probability | `grep -n probab src/db/schema/stages.ts` prints nothing | if a probability column exists, use it instead of `stage_probabilities` (`CONTRACT CHANGE:`) |
| Won timestamp | `src/db/schema/deals.ts` has a won timestamp column (`wonAt` or similar) | use the status-change timestamp warpdrive records for won; log which |
| pnpm 9, Docker | as in Part 2 | as in Part 2 (`PLAN-PART2.md` section 4) |
| Subagent tool | the harness offers `subagent` | Task 4.3 falls back to `qa.sh`, then to the evidenced self-review |

**Known environment (copy into PROGRESS.md → Environment):**
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store`
- Test scripts already set `TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`; run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`) need the three Google variables (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_WORKSPACE_DOMAIN`) set to empty in front, exactly as Part 2 did, unless the owner has fixed `.env` (check emptiness only, never print values).
- Build: if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host DB commands: prefix `DATABASE_URL=$DEV_DB_URL`, where `DEV_DB_URL` is exported to the host database URL recorded in `PROGRESS-P2.md` → Environment (localhost:5433).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers`; ports 3210/3211. Smoke: `DOCKER_BUILDKIT=0 pnpm smoke`.
- Docker's VM disk is tight: never prune; if a build fails with "no space left", log `TODO(owner): free Docker disk space` and mark the step SKIPPED.

**Fatal (STOP with `STATUS: BLOCKED`):** pnpm cannot be installed, or `pnpm install --frozen-lockfile` fails for a registry reason.

## 5. Target structure

```
src/db/schema/sales.ts                         # 6.4 tables (exported from src/db/schema/index.ts)
drizzle/0080_dealflow_sales.sql                # generated
src/features/currency/
  money.ts, money.test.ts                      # 6.5, pure
  totals.ts, totals.test.ts                    # 6.6, pure
  rates.ts                                     # load/save rates, base currency change
  actions.ts, router.ts                        # server actions, tRPC reads
  rates.integration.test.ts
  ui/CurrenciesSettings.tsx
src/features/products/
  products.ts, dealProducts.ts, dealTerms.ts   # services
  actions.ts, router.ts
  dealProducts.integration.test.ts
  ui/ProductsSettings.tsx, ui/ProductDialog.tsx, ui/DealProductsSection.tsx, ui/DealTermsFields.tsx
src/features/forecast/
  forecast.ts, router.ts, actions.ts
  forecast.integration.test.ts
  ui/ForecastBoard.tsx, ui/ForecastColumn.tsx, ui/ForecastCard.tsx
src/app/(app)/forecast/page.tsx                # route group: use the one /deals lives in
src/app/(app)/settings/currencies/page.tsx, src/app/(app)/settings/products/page.tsx
e2e/07-sales.spec.ts
docs/dealflow/SALES.md
```

Match the existing route group and settings layout (look at how `/settings/email-sync` and `/deals` are laid out and copy that pattern; log the actual paths).

## 6. Contracts

### 6.1 Scripts and env

No new scripts or env keys.

### 6.2 Error IDs (append to `src/constants/errorIds.ts`; add the `PRODUCT` and `CURRENCY` domains if the file keeps a domain list)

| ID | Cause | User copy |
|---|---|---|
| `E_PRODUCT_001` | product not found or not visible | "That product no longer exists." |
| `E_PRODUCT_002` | delete of a product used on a deal | "This product is used on deals. Archive it instead." |
| `E_PRODUCT_003` | product code already taken | "Another product already uses this code." |
| `E_PRODUCT_004` | manual value edit on a deal with lines | "This value is calculated from the deal's products." |
| `E_PRODUCT_005` | deal line not found | "That line no longer exists." |
| `E_CURRENCY_001` | no rate for a needed currency | "Add an exchange rate for {code} first." |
| `E_CURRENCY_002` | unknown currency code | "Unknown currency code." |
| `E_CURRENCY_003` | rate submitted for the base currency | "The base currency always has a rate of 1." |
| `E_CURRENCY_004` | currency change on a deal with lines | "Remove the products before changing the currency." |

### 6.3 Test hooks

`data-testid`: `currencies-base-select`, `currency-rate-row` (with `data-code`), `currency-rate-input`, `currency-rate-save`, `products-table`, `product-row` (with `data-product-id`), `product-new`, `product-dialog`, `deal-products-section`, `deal-product-add`, `deal-product-row` (with `data-line-id`), `deal-products-net`, `deal-products-tax`, `deal-products-gross`, `deal-currency-select`, `deal-probability-input`, `stage-probability-input`, `board-column-total`, `board-column-weighted`, `totals-excluded`, `forecast-board`, `forecast-column` (with `data-month`), `forecast-card` (with `data-deal-id`), `forecast-month-total`, `forecast-month-weighted`, `forecast-month-won`, `forecast-no-date`.

Screenshots (`e2e/screenshots/`): `p3-settings-currencies`, `p3-settings-products`, `p3-product-dialog`, `p3-deal-products`, `p3-board-totals`, `p3-forecast`.

### 6.4 Schema (`src/db/schema/sales.ts`)

Column types for ids and foreign keys match the referenced columns (warpdrive uses `uuid` with `defaultRandom()`; check `deals.ts`). Timestamps `timestamptz` like the rest of the schema.

```ts
products: id, name text not null, code text null (unique where not null: partial unique index products_code_uq),
  unit text null, price numeric(14,2) not null default '0', currency char(3) not null,
  tax_percent numeric(5,2) not null default '0', active boolean not null default true,
  created_by -> users.id (on delete set null, nullable), created_at, updated_at
  check: price >= 0, tax_percent between 0 and 100
deal_products: id, deal_id -> deals.id on delete cascade, product_id -> products.id on delete restrict,
  position integer not null, quantity numeric(12,3) not null default '1', item_price numeric(14,2) not null,
  discount_percent numeric(5,2) not null default '0', tax_percent numeric(5,2) not null default '0',
  comments text null, created_at, updated_at
  index (deal_id, position); checks: quantity > 0, item_price >= 0, both percents between 0 and 100
deal_terms: deal_id primary key -> deals.id on delete cascade, currency char(3) not null,
  probability integer null (check 0..100), updated_at
stage_probabilities: stage_id primary key -> stages.id on delete cascade, probability integer not null (check 0..100)
currency_rates: code char(3) primary key, rate_to_base numeric(18,8) not null (check > 0),
  updated_by -> users.id on delete set null (nullable), updated_at
```

Generate with `pnpm drizzle-kit generate --name dealflow_sales` (with the env prefixes from section 4); expect `drizzle/0080_dealflow_sales.sql` containing only these tables. Apply to the dev database with `pnpm db:migrate:dev` (DATABASE_URL override).

### 6.5 Money (`src/features/currency/money.ts`, pure, no imports from `@/db`)

All amounts are `bigint` in minor units (cents). Decimal strings come from Postgres `numeric` and from Zod-validated input. Never use floating point for money.

```ts
export type Cents = bigint;           // 2 decimals
export type Milli = bigint;           // quantity, 3 decimals
export type Bp = bigint;              // percent in hundredths: 12.5% = 1250n, 100% = 10000n
export type Rate = bigint;            // rate scaled by 1e8

export function parseCents(s: string): Cents;     // "12.3" → 1230n, "-0.5" → -50n; more than 2 decimals or junk → AppError (programmer error: input is pre-validated)
export function formatCents(c: Cents): string;    // 1230n → "12.30", -50n → "-0.50" (DB/wire format, no grouping)
export function parseMilli(s: string): Milli;     // up to 3 decimals
export function parseBp(s: string): Bp;           // up to 2 decimals, 0..100
export function parseRate(s: string): Rate;       // up to 8 decimals, > 0
export function roundDiv(n: bigint, d: bigint): bigint;  // d > 0; rounds half away from zero: roundDiv(5n, 2n) = 3n, roundDiv(-5n, 2n) = -3n
export function lineNet(qty: Milli, price: Cents, discount: Bp): Cents;
  // = roundDiv(qty * price * (10000n - discount), 1000n * 10000n)
export function lineTax(net: Cents, tax: Bp): Cents;      // = roundDiv(net * tax, 10000n)
export function dealTotals(lines: { qty: Milli; price: Cents; discount: Bp; tax: Bp }[]): { net: Cents; tax: Cents; gross: Cents };
  // per-line rounding first, then sums; gross = net + tax
export function toBase(amount: Cents, rate: Rate): Cents;               // = roundDiv(amount * rate, 100_000_000n)
export function convertBetween(amount: Cents, from: Rate, to: Rate): Cents; // = roundDiv(amount * from, to)
export function weighted(amount: Cents, probability: number): Cents;    // = roundDiv(amount * BigInt(probability), 100n)
export function formatMoney(c: Cents, currency: string, locale?: string): string; // Intl.NumberFormat style "currency"; display only
```

Zod schemas for inputs live in `src/features/currency/schemas.ts`: `moneyString` (`/^\d{1,12}(\.\d{1,2})?$/`), `quantityString` (`/^\d{1,9}(\.\d{1,3})?$/`, > 0), `percentString` (`/^\d{1,3}(\.\d{1,2})?$/`, ≤ 100), `rateString` (`/^\d{1,10}(\.\d{1,8})?$/`, > 0), `currencyCode` (`/^[A-Z]{3}$/` and in `Intl.supportedValuesOf("currency")`, else `E_CURRENCY_002`).

### 6.6 Totals (`src/features/currency/totals.ts`, pure)

```ts
export type RateMap = { base: string; rates: ReadonlyMap<string, Rate> };   // base not in the map; treated as rate 1e8
export type MoneyDeal = { id: string; value: string | null; currency: string; probability: number };
export type Summary = { total: Cents; weighted: Cents; counted: number; excluded: { id: string; currency: string }[] };
export function rateFor(map: RateMap, code: string): Rate | null;
export function summarize(deals: readonly MoneyDeal[], map: RateMap): Summary;
// value null → counted, contributes 0. Currency without a rate → excluded (never added unconverted).
// Each deal converts to base first, then weighted() on the converted amount; sums last.
```

`rates.ts` exports `loadRateMap(db, signal): Promise<RateMap>` (base from `settings.base_currency`, rates from `currency_rates`). Reads always go through it so the board, list and forecast agree.

### 6.7 Services and actions

Every mutation is a server action following the existing pattern (`guardCsrf` → `createContext` → `can()` → Zod → service → `ActionResult`). Reads are tRPC procedures in the feature's `router.ts`, registered in the app router like the other feature routers.

- Permissions: add a `products.manage` capability to the permission registry the way an existing "manage" capability is declared (find one with `grep -rn "manage" src/features/permissions`), granted to the admin set only, with a migration-free default if the registry is code-defined (log what you did). Currency settings use the same check as the existing base-currency setting. Deal lines, `deal_terms` and the forecast drag use the deal-edit check that the value inline edit uses.
- `rates.ts`: `saveRate({ code, rate })` (refuse the base code with `E_CURRENCY_003`, upsert), `deleteRate(code)`, `setBaseCurrency(code)` (one transaction: update `settings.base_currency`, delete every `currency_rates` row; the UI warns first with an `AlertDialog`).
- `products.ts`: `listProducts({ search?, includeInactive? })` (name/code `ilike`, active first, name order, limit 200), `getProduct`, `createProduct`, `updateProduct`, `setProductActive`, `deleteProduct` (`E_PRODUCT_002` if any `deal_products` row references it; map the FK error too).
- `dealProducts.ts`: `listDealLines(dealId)`, `addDealLine({ dealId, productId, quantity?, itemPrice?, discountPercent?, taxPercent?, comments? })`, `updateDealLine({ lineId, ...same optional fields })`, `removeDealLine(lineId)`. Defaults on add: quantity `1`, item price = product price converted to the deal currency with `convertBetween` when the currencies differ (missing rate → `E_CURRENCY_001`, nothing written), tax = product tax, discount `0`, position = max + 1. Each call runs in one transaction: write the line, recompute `dealTotals` over all lines, and if the net differs from `deals.value`, update it through the same code path the value inline edit uses, so the change log entry and the realtime notification happen exactly as for a manual edit. Removing the last line leaves the value at its last total.
- The existing manual value update refuses with `E_PRODUCT_004` when the deal has lines (one check in the existing action or service; record the file in UPSTREAM.md).
- `dealTerms.ts`: `getDealTerms(dealId)` → `{ currency, probability, stageProbability, effectiveProbability }`, `setDealTerms({ dealId, currency?, probability?: number | null })` (currency change with lines → `E_CURRENCY_004`; same code path for the change log), `setStageProbability({ stageId, probability })` (pipeline-settings permission, the one the stage editor uses).

### 6.8 Totals on the board and list

Find where the board column header and the deals list compute value totals (`grep -rn "sum(" src/features/deals src/features/pipelines`). Replace the single sum with a query that groups open deals by currency (and needs the effective probability for the board), then `summarize` in TypeScript with `loadRateMap`. Display, formatted in the base currency: board column header shows the total (`board-column-total`) and "Weighted {amount}" (`board-column-weighted`); the list footer shows the total. When `excluded.length > 0`, show a muted "{n} excluded" (`totals-excluded`) with a `Tooltip` naming the currencies that lack a rate. If the existing totals are computed client-side from loaded cards, do the same conversion client-side with the rate map from a tRPC read; log which.

Deal cards and the deal header show the value in the deal's currency; when it differs from the base, the deal page also shows "≈ {base amount}" (nothing when the rate is missing).

### 6.9 Forecast (`src/features/forecast/forecast.ts`)

```ts
input (Zod): { pipelineId?: string; startMonth?: string /* YYYY-MM, default current UTC month */; months?: 1..12 /* default 6 */; includeWon?: boolean /* default true */ }
type ForecastDeal = { id: string; title: string; value: string | null; currency: string; valueBase: string | null;
  probability: number; expectedCloseDate: string | null; wonAt: string | null; overdue: boolean; ownerName: string | null; stageName: string };
type ForecastMonth = { month: string; label: string; open: ForecastDeal[]; won: ForecastDeal[]; openCount: number;
  total: string; weighted: string; wonTotal: string; excluded: ForecastDeal[] };
output: { baseCurrency: string; months: ForecastMonth[]; noDate: ForecastDeal[]; noDateCount: number }
```

Rules:
- Only deals the viewer may see: reuse the visibility filter the deals list uses (find it in `src/features/deals`; do not write a new one).
- Open deals with `expected_close_date` in the window go to their month; open deals dated before the window go to the first month with `overdue: true`; later ones are not returned. Open deals with no date go to `noDate` (first 100 by title, plus the count).
- Won deals (when `includeWon`) go to the month of their won timestamp in UTC; `wonTotal` sums them; they are not in `total`/`weighted`.
- `total` and `weighted` use `summarize`; `excluded` lists deals with no rate. Each list is sorted by close date, then title; `open` is capped at 200 per month with `openCount` the real count.
- `label` is `Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" })` ("Oct 2026").
- Action `moveDealToMonth({ dealId, month })`: new date = same day of month, clamped to the target month's last day (Jan 31 → Feb 28/29); a deal with no date gets the 15th; written through the code path that edits `expected_close_date` elsewhere (change log, realtime). Won and lost deals cannot be moved (Zod-valid but refused with the existing "deal not editable" error or `E_PRODUCT_004`'s pattern: log the choice).

### 6.10 UI

Use shadcn wrappers only (`Table`, `Dialog`, `AlertDialog`, `Select`, `Command`/`Popover` combobox, `Switch`, `Tooltip`, `Input`, `Button`, `Badge`). If a needed wrapper is missing but its Radix dependency is installed, add the standard shadcn wrapper first.

- Settings → Currencies (`/settings/currencies`, linked in the settings navigation): base currency `Select` (all `Intl` codes, label "EUR, Euro"); a table of rates (code, name, "1 {code} = {rate} {base}", updated, delete) with an "Add rate" row (code select + rate input + Save). Base change opens an `AlertDialog`: "Changing the base currency deletes all exchange rates. Continue?".
- Settings → Products (`/settings/products`): search, "Show archived" `Switch`, table (name, code, price with currency, tax %, status, actions), "New product" opens `ProductDialog` (name, code, unit, price, currency select defaulting to base, tax %), row menu (`DropdownMenu`): Edit, Archive/Restore, Delete (`AlertDialog`; show `E_PRODUCT_002` copy on refusal). Admin only; others see the read-only table.
- Deal page: a "Products" section in the deal workspace, placed with the other deal sections (follow how an existing section is registered). Table: product, quantity, price, discount %, tax %, net, remove. Cells edit inline with the project's inline-edit pattern; "Add product" opens a combobox of active products. Footer: Net, Tax, Gross (`deal-products-net/-tax/-gross`). Above it, `DealTermsFields`: currency `Select` (disabled with a `Tooltip` while lines exist) and "Probability" input (placeholder shows the stage value, empty = use stage). The value field shows "Calculated from products" while lines exist.
- Stage editor: a "Probability %" input per stage (`stage-probability-input`), wherever stages are edited in pipeline settings.
- Forecast (`/forecast`, main navigation item "Forecast" right after the deals/board item): header with pipeline `Select` (All pipelines first), months `Select` (3, 6, 12), "Include won" `Switch`, "Previous"/"Next" month buttons. Horizontal row of month columns (min width 280px, scrolls on small screens): header with label, Total, Weighted, Won; cards (title linking to `/deals/{id}`, value in deal currency and "≈ base" when different, probability %, owner, `Badge` "Overdue"); won cards muted with a "Won" badge; excluded note per column. dnd-kit drag of open cards between columns calls `moveDealToMonth` with an optimistic move and rollback on error (toast with the error copy). Below: "No close date ({count})" list. Empty state: "No open deals close in this period."

### 6.11 Demo seed

Extend the existing demo seed (the script behind `pnpm db:seed:demo`; follow its style and determinism): 6 products (two in EUR), stage probabilities on the default pipeline by stage order 10, 25, 50, 75, 90 (stages beyond five: 90), rates EUR 1.08 and GBP 1.27 against a USD base (if the seed's base is not USD, use the same numbers against it and log it), lines on 5 open deals, one open EUR deal and one open GBP deal with lines, one open deal in JPY with no rate (so the excluded state appears), and expected close dates spread over the next 6 months including 2 overdue and 3 undated.

## 7. Conventions

Same as Parts 1 and 2 (CLAUDE.md is the authority): feature folders, files under ~200 lines, `Result` types, `AppError` IDs, Zod at the boundary, `AbortSignal` threaded through I/O, shadcn only, no em dashes. Money strings cross the wire as decimal strings, never as JS numbers. Tests for money, totals, conversion, permissions and forecast bucketing are written first (they fail before the code exists).

## 8. Phases and tasks

### Phase 0: Start, schema and money

Kick off Part 3, add the tables and the pure money layer.

#### Task 0.1 - Start Part 3: progress files, kit and baseline

**Goal:** A Part 3 PROGRESS.md and a green baseline.

**Files:** create `PROGRESS.md`; rename `PROGRESS.md` → `PROGRESS-P2.md`; possibly root symlink `PLAN-PART3.md`, `scripts/check-progress.mjs`

**Steps:**
1. Check section 4's table and log each result as a Decision.
2. `git mv PROGRESS.md PROGRESS-P2.md`; create PROGRESS.md in the section 0 format with every task of section 8 unchecked; record the Phase 0 base commit; copy the Known environment into Environment; carry over Part 2's still-open owner actions (Google env, dev stack rebuild) as `TODO(owner):` lines.
3. Kit in a subfolder: root symlink plus the byte-identical checker copy (section 4). Add `dealflow-wd-part3-kit.zip` to `.git/info/exclude` if it is in the tree.
4. Baseline: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`. Log `- Baseline: typecheck {r} · lint {r} · build {r} · unit {p}/{t}` in the QA log. No integration run here (fast profile; it runs in Task 4.2).
5. Commit `0.1: Start Part 3: progress files, kit and baseline`, tick.

**Verify:** `pnpm check:progress` → OK

**Done when:** PROGRESS.md lists all tasks and the baseline line exists.

#### Task 0.2 - Sales schema and migration

**Goal:** The five tables of 6.4.

**Files:** create `src/db/schema/sales.ts`, `drizzle/0080_dealflow_sales.sql` (+ meta snapshot/journal); modify `src/db/schema/index.ts`, the `deals.value` comment in `src/db/schema/deals.ts`

**Steps:**
1. Write the schema exactly as 6.4, export it from the index.
2. Generate the migration (6.4), check the SQL creates only these tables, indexes and checks, apply it to the dev DB.
3. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0; `pnpm db:migrate:dev` with the section 4 prefixes → exits 0

**Done when:** the migration is applied and typecheck passes.

#### Task 0.3 - Money and totals (test-first)

**Goal:** 6.5 and 6.6 with tests written before the code.

**Files:** create `src/features/currency/{money.ts,money.test.ts,totals.ts,totals.test.ts,schemas.ts}`

**Steps:**
1. Write `money.test.ts` and `totals.test.ts` first, run them, see them fail. Cover at least: parse/format round trips including negatives and `"0"`; `roundDiv` half away from zero both signs; `lineNet` for qty `2`, price `1200.00`, discount `10` → `216000n`; `lineNet` for qty `0.333`, price `10.00`, discount `0` → `333n`; `lineTax(216000n, 2000n)` → `43200n`; `dealTotals` rounding per line; `toBase(10000n, parseRate("1.08"))` → `10800n`; `convertBetween` EUR→GBP via base; `weighted(10001n, 50)` → `5001n`; `summarize` with a null value, an excluded currency and the base currency.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run src/features/currency` → passes

**Done when:** both test files pass and contain the cases above.

#### Task 0.4 - Phase 0 QA gate

**Goal:** Prove the schema and money layer.

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

### Phase 1: Server: rates, products, lines, terms

All services, actions and reads, proven by integration tests.

#### Task 1.1 - Rates, base currency and permissions

**Goal:** `rates.ts`, its actions and reads, and the `products.manage` capability.

**Files:** create `src/features/currency/{rates.ts,actions.ts,router.ts,rates.integration.test.ts}`; modify the error registry, the app router, the permission registry

**Steps:**
1. Error IDs from 6.2.
2. Write `rates.integration.test.ts` first (real Postgres via `@/test/db`): base code rejected with `E_CURRENCY_003`; upsert then read through `loadRateMap`; `setBaseCurrency` clears rates in one transaction; a non-admin cannot save a rate.
3. Implement `rates.ts`, the actions, `currency.rates` and `currency.codes` tRPC reads, the capability (6.7).
4. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/currency` → passes

**Done when:** the test passes.

#### Task 1.2 - Product catalog service

**Goal:** `products.ts`, actions and the `products.list`/`products.get` reads.

**Files:** create `src/features/products/{products.ts,actions.ts,router.ts}`; modify the app router

**Steps:**
1. Implement 6.7's product functions, the actions (admin via `products.manage`) and the reads.
2. Map the unique-code violation to `E_PRODUCT_003` and the FK restrict to `E_PRODUCT_002`.
3. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** typecheck passes and the reads are registered.

#### Task 1.3 - Deal lines and the value sync (test-first)

**Goal:** `dealProducts.ts` with the value sync through the existing edit path.

**Files:** create `src/features/products/{dealProducts.ts,dealProducts.integration.test.ts}`; modify `src/features/products/actions.ts`, `router.ts`; the existing value update (one guard)

**Steps:**
1. Find the value inline-edit path and log the function you reuse.
2. Write `dealProducts.integration.test.ts` first: add a line → value `2160.00` and one change-log entry; update and remove lines → value follows; removing the last line keeps the value; EUR product on a USD deal converts with the rate; missing rate → `E_CURRENCY_001` and no line, no value change; manual value edit with lines → `E_PRODUCT_004`; deleting a used product → `E_PRODUCT_002`; a user without edit rights on the deal is refused.
3. Implement until green.
4. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/products` → passes

**Done when:** the test passes with every case above.

#### Task 1.4 - Deal terms and stage probabilities

**Goal:** `dealTerms.ts`, its actions and reads.

**Files:** create `src/features/products/dealTerms.ts`; modify `actions.ts`, `router.ts`, `dealProducts.integration.test.ts` (add cases)

**Steps:**
1. Implement 6.7's terms functions.
2. Add test cases: currency change with lines → `E_CURRENCY_004`; effective probability is override, then stage, then 100.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/products` → passes

**Done when:** the new cases pass.

#### Task 1.5 - Phase 1 QA gate

**Goal:** Prove the server layer.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 2 base commit, commit `1.5: Phase 1 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/currency src/features/products src/features/deals` → passes

**QA focus:** Definition of done items 3 to 6 (server side); value changes go through the change log.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: Screens and converted totals

#### Task 2.1 - Settings → Currencies

**Goal:** The currencies page of 6.10.

**Files:** create `src/features/currency/ui/CurrenciesSettings.tsx`, the settings route page; modify the settings navigation

**Steps:**
1. Build the page with the hooks of 6.3; wire the actions; show error copy from 6.2.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the page renders under the settings layout.

#### Task 2.2 - Settings → Products

**Goal:** The products page and dialog of 6.10.

**Files:** create `src/features/products/ui/{ProductsSettings.tsx,ProductDialog.tsx}`, the settings route page; modify the settings navigation

**Steps:**
1. Build the table, dialog, row menu and confirmations; non-admins read only.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the page renders and every action is wired.

#### Task 2.3 - Deal Products section and terms fields

**Goal:** Lines, totals, currency and probability on the deal page.

**Files:** create `src/features/products/ui/{DealProductsSection.tsx,DealTermsFields.tsx}`; modify the deal workspace section registry and the value field

**Steps:**
1. Section, inline edits, add combobox, totals footer; terms fields; "Calculated from products" on the value field; "≈ {base}" next to the header value.
2. After each mutation, invalidate the deal and lines queries so the header value updates.
3. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the section renders on a deal and typecheck passes.

#### Task 2.4 - Stage probability in the stage editor

**Goal:** Edit a probability per stage.

**Files:** modify the pipeline stage editor component

**Steps:**
1. Add the input (`stage-probability-input`), default display 100 when no row; save through `setStageProbability`.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the input saves.

#### Task 2.5 - Converted and weighted totals on the board and list

**Goal:** 6.8.

**Files:** modify the board column header and deals list totals and their queries; `src/features/currency/totals.ts` only if a helper is missing

**Steps:**
1. Find the totals code, log it, replace per 6.8, show excluded counts.
2. Add one integration case (in `src/features/currency/rates.integration.test.ts` or the deals feature's existing totals test) proving a mixed-currency column converts and lists an excluded deal.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/currency` → passes

**Done when:** the case passes and typecheck is clean.

#### Task 2.6 - Phase 2 QA gate

**Goal:** Prove the screens build and the totals hold.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 3 base commit, commit `2.6: Phase 2 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/currency src/features/products src/features/deals src/features/pipelines` → passes

**QA focus:** Definition of done items 3 to 7; shadcn-only UI; no native form controls.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: Forecast

#### Task 3.1 - Forecast service (test-first)

**Goal:** 6.9's read and the move action.

**Files:** create `src/features/forecast/{forecast.ts,router.ts,actions.ts,forecast.integration.test.ts}`; modify the app router

**Steps:**
1. Write `forecast.integration.test.ts` first: month bucketing; overdue into the first month; undated into `noDate`; won by won month and excluded from totals; weighted with override vs stage; excluded currency; pipeline filter; a deal the viewer may not see is absent; `moveDealToMonth` clamps Jan 31 to Feb 28 (2027) and writes a change-log entry; moving a won deal is refused.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/forecast` → passes

**Done when:** every case above passes.

#### Task 3.2 - Forecast page and navigation

**Goal:** `/forecast` per 6.10.

**Files:** create `src/features/forecast/ui/{ForecastBoard.tsx,ForecastColumn.tsx,ForecastCard.tsx}`, the route page; modify the main navigation

**Steps:**
1. Board, filters, cards, drag with optimistic update and rollback, no-date list, empty state.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the page renders and typecheck passes.

#### Task 3.3 - Demo seed and docs

**Goal:** 6.11 and `docs/dealflow/SALES.md`.

**Files:** modify the demo seed; create `docs/dealflow/SALES.md`; modify `docs/dealflow/UPSTREAM.md`, `README.md` (one short "Products, currencies and forecast" section)

**Steps:**
1. Extend the seed per 6.11.
2. SALES.md: data model, money rules (minor units, rounding, conversion at add time), rates meaning, probability rules, forecast rules, permissions. UPSTREAM.md: every upstream file changed in this part.
3. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the docs exist and the seed compiles (it runs in e2e).

#### Task 3.4 - Phase 3 QA gate

**Goal:** Prove the forecast.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 4 base commit, commit `3.4: Phase 3 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/forecast src/features/currency src/features/products` → passes

**QA focus:** Definition of done items 8 and 9; visibility reused, not reimplemented.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Hardening and hand-off

#### Task 4.1 - E2E sales spec and screenshots

**Goal:** `e2e/07-sales.spec.ts` and the 6 screenshots.

**Files:** create `e2e/07-sales.spec.ts`; modify `e2e/helpers.ts` only if a helper is missing

**Steps:**
1. As the admin from the earlier specs (reuse the saved session): add a EUR rate `1.08` (`p3-settings-currencies`); create product "Onboarding package", price `1200.00` USD, tax `20` (`p3-product-dialog`, then `p3-settings-products`); open a seeded open USD deal with no lines, add the product, set quantity `2` and discount `10`; expect net `2,160.00`, tax `432.00`, gross `2,592.00` and the header value `2,160.00` (`p3-deal-products`); open the board and expect a column total and weighted total plus an excluded note for the JPY deal (`p3-board-totals`); open `/forecast`, expect the deal in its month column, drag it to the next month and expect it there after a reload (`p3-forecast`).
2. Run the whole e2e suite `pnpm e2e` (specs `00` to `07`); fix until green. Earlier screenshots must stay unchanged in name.
3. Commit, tick.

**Verify:** `pnpm e2e` → passes; `ls e2e/screenshots/p3-*.png | wc -l` → `6`

**Done when:** e2e is green and 6 screenshots exist.

#### Task 4.2 - Integration suite and smoke

**Goal:** The once-per-part full runs.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. `pnpm test:integration` (full); fix failures caused by this part; pre-existing ones get `PRE-EXISTING:` Open issues.
2. `DOCKER_BUILDKIT=0 pnpm smoke` → SMOKE PASS, and no `dealflow-smoke` container or volume left.
3. Log both results as Decisions, commit, tick.

**Verify:** `pnpm test:integration` passes and `DOCKER_BUILDKIT=0 pnpm smoke` prints SMOKE PASS (or SKIPPED with the reason from section 10)

**Done when:** both ran and are logged.

#### Task 4.3 - Independent review and hardening

**Goal:** One fresh-context review of Part 3, then fix what it finds.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is the full `.dsh/qa.md`, a blank line, then `Final review of PLAN-PART3.md. Base commit {Phase 0 base}.` Wait for `QA RESULT: PASS` or the numbered list. Fallbacks: `qa.sh` with the same request, then an evidenced self-review (log `qa unavailable (qa.sh failed) - self-review`).
2. Fix every blocker and major; commit `4.3: QA fixes round {r}`; re-run the phase gate commands of Task 3.4; review again. At most 3 rounds. Minors: fix when cheap, else Open issues.
3. Log `- Independent review: subagent (fresh context) round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n}`.
4. Commit `4.3: Independent review and hardening`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`.

**Done when:** the review ran (or the logged fallback), and blockers and majors are fixed or logged with reasons.

#### Task 4.4 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order; one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `4.4: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least 14.

**Done when:** every checklist item has a line.

#### Task 4.5 - Final report and completion

**Goal:** Hand the owner a short, truthful report and finish.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report, kept short (the owner reads it on a phone): Definition of done (items 1 to 10, PASS/FAIL/NOT VERIFIED, one line each); Checklist (from 4.4); Owner actions (numbered, exact commands, including the dev stack rebuild to pick up migration 0080); Decisions worth reviewing (only `CONTRACT CHANGE:` lines and changed tests); Open issues; Notes for Part 4 (new routes and screenshot names, the money helpers' file, upstream files changed). Do not repeat the Decisions list in the report.
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `4.5: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`.

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- Quotes and invoices (Part 4).
- Automatic rate fetching, per-line currencies, price books or tiered pricing.
- Product images, variants, categories or custom fields; recurring revenue.
- Forecast by owner or team.
- AI or MCP tools for products; CSV import or export of products.
- Changes to the mail layer.

## 10. ASK and STOP triggers

This plan has no ASK triggers; the only STOP case is the fatal one in section 4.

| Situation | Safe default | Owner action to log |
|---|---|---|
| Subagent tool unavailable | `qa.sh`, then the evidenced self-review | "Run the review yourself in a new harness session with `.dsh/qa.md` and the request from Task 4.3" |
| Docker not running or out of disk | skip integration, e2e and smoke (SKIPPED) | "Start Docker Desktop / free Docker disk, then run `pnpm test:integration`, `pnpm e2e`, `DOCKER_BUILDKIT=0 pnpm smoke`" |
| A pre-existing upstream test fails | leave it, log `PRE-EXISTING:` | "Review the pre-existing failures in PROGRESS.md" |
| The permission registry cannot take a new capability without a large change | gate products management on the existing admin check | "Decide whether non-admins should manage products" |
| Totals code is shared with a feature this plan does not name | change only the deals board and list paths | none |
| Google env in `.env` still partial | keep the overrides from section 4 | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty.
2. `pnpm install --frozen-lockfile` exits 0 and `package.json` gained no dependency.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes (count ≥ the baseline).
6. `pnpm test:integration` passes (Task 4.2).
7. `pnpm build` exits 0.
8. `pnpm e2e` passes, specs `00` to `07`.
9. 6 `e2e/screenshots/p3-*.png` exist and the Part 1 and Part 2 screenshots are still present.
10. Smoke printed SMOKE PASS and left no `dealflow-smoke` container or volume.
11. `ls drizzle/0080_dealflow_sales.sql` exists and the file creates exactly the 5 tables.
12. `git grep -nE "parseFloat|Number\\(" -- src/features/currency src/features/products src/features/forecast` shows no money value parsed as a float (list any hit and why it is not money).
13. `git grep -n "E_PRODUCT_00[1-5]\|E_CURRENCY_00[1-4]" src/constants/errorIds.ts` lists all 9 IDs.
14. No em dash in any file added or changed in this part (`git diff --name-only {Phase 0 base} | xargs perl -CSD -ne 'print "$ARGV\n" if /\x{2014}/' | sort -u` prints nothing, kit files excepted).
15. `docs/dealflow/SALES.md` exists; `docs/dealflow/UPSTREAM.md` lists this part's upstream files.
16. `pnpm check:progress --final` passes.

## 12. Report back

No mid-run reporting. The run ends with the final report (Task 4.5). The owner pastes PROGRESS.md → Final report back to the planner (the Decisions list is not needed).

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

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md to PLAN-PART3.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

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
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; money is computed on integer minor units with no floats, converted totals never add unconverted amounts or drop deals silently (excluded deals are listed), the forecast reuses the deals visibility filter; no em dashes in new files.
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
# Usage: ./qa.sh "Final review of PLAN-PART3.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
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

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART3.md";
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
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART[123]\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
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
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART3.md (dealflow-wd-p3-v1) is finished.
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
PROMPT='Read PLAN-PART3.md in this folder in full and PROGRESS.md, then follow PLAN-PART3.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p3-v1; PLAN-PART1.md and PLAN-PART2.md are finished) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p3-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p3-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
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
- Otherwise you are the builder: read `PLAN-PART3.md` in full (Parts 1 and 2 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART3.md rule 18.
```
