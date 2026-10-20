# Products, currencies and forecast

Part 3 adds a product catalog, deal line items that drive the deal value, a currency per deal with
manual exchange rates, stage probabilities, converted and weighted totals, and a forecast board.

## Data model

Migration `0080_dealflow_sales` creates five tables in `src/db/schema/sales.ts`:

- `products`: name, optional code (unique only when present, partial index `products_code_uq`),
  unit, price `numeric(14,2)`, currency `char(3)`, tax percent, active flag, `created_by`.
- `deal_products`: one row per line on a deal, with position, quantity `numeric(12,3)`, item
  price in the deal currency, discount and tax percents, optional comments. The product FK is
  `on delete restrict`, so a used product must be archived instead of deleted.
- `deal_terms`: per-deal currency and optional probability override. A deal without a row is in
  the base currency with no override.
- `stage_probabilities`: optional probability per stage.
- `currency_rates`: one row per non-base code; `rate_to_base` is how many base units one unit of
  the code is worth, `numeric(18,8)`.

`deals.value` keeps `numeric(14,2)` and now means "value in the deal's currency". A deal without a
`deal_terms` row reads as the base currency, so existing rows need no migration.

## Money

`src/features/currency/money.ts` is pure and never imports the database. Amounts are `bigint`
minor units (`Cents`), quantities are `Milli` (three decimals), percents are `Bp` (hundredths of a
percent: 12.5% = 1250n) and rates are `Rate` scaled by 1e8. No money value is ever a JS float.

- `parseCents`, `parseMilli`, `parseBp`, `parseRate` turn pre-validated decimal strings into those
  integers; junk is a programmer error (`E_CURRENCY_005`).
- `roundDiv` rounds half away from zero, so `5/2 = 3` and `-5/2 = -3`.
- `lineNet` applies quantity, price and discount with one rounding step; `lineTax` taxes the net;
  `dealTotals` rounds per line and sums.
- `toBase` and `convertBetween` convert with the stored rates; `weighted` applies the effective
  probability.
- `formatCents` produces the database string (`"2160.00"`); `formatMoney` is display only and
  builds the locale layout from `Intl` parts without converting the amount to a float.

Input shapes live in `src/features/currency/schemas.ts` (`moneyString`, `quantityString`,
`percentString`, `rateString`, `currencyCode`). The currency catalog comes from
`Intl.supportedValuesOf("currency")`; labels from `Intl.DisplayNames`.

## Rates and base currency

Settings > Currencies (`/settings/currencies`) edits the base currency and the manual rates. A rate
for the base code is refused (`E_CURRENCY_003`). Changing the base updates `settings.base_currency`
and deletes every rate in one transaction; re-selecting the same base is a no-op. Rates use the same
permission as the existing base-currency setting (`permissions.manage`).

`loadRateMap` reads the base and every rate once; the board, deals list and forecast all convert
through the same `summarize` in `src/features/currency/totals.ts`. A deal whose currency has no rate
is listed as excluded, never added unconverted.

## Products and deal lines

Settings > Products (`/settings/products`) lists, creates, edits, archives and deletes products.
Only holders of `products.manage` (admins by default) can change the catalog; anyone signed in can
read it. Deletes of a used product are refused with `E_PRODUCT_002` (archive instead); duplicate
codes return `E_PRODUCT_003`.

The deal page has a Products sidebar section. Adding a product inserts a line, recomputes the net
total from every line and writes `deals.value` through the same change-log and realtime path as a
manual edit. A product priced in another currency is converted once, at add time, with the stored
rates; a missing rate refuses the add with `E_CURRENCY_001` and writes nothing. Removing the last
line leaves the value at its last total.

While a deal has lines its value field shows "Calculated from products" and a manual value edit is
refused (`E_PRODUCT_004`). A currency change with lines is refused (`E_CURRENCY_004`). The
probability input overrides the stage probability; empty means "use the stage".

## Probability

Effective probability = `deal_terms.probability` when set, else `stage_probabilities` for the
deal's stage, else 100. Stage probabilities are edited in the pipeline stage editor and need
`pipeline.manage`. Weighted value = value converted to base, multiplied by the probability and
rounded per deal.

## Forecast

`/forecast` is a client board over `forecast.get`:

- Input: optional `pipelineId`, `startMonth` (`YYYY-MM`, default current UTC month), `months` 1 to
  12 (default 6), `includeWon` (default true).
- Open deals with a close date in the window bucket by that month; earlier ones go to the first
  month flagged `overdue`; later ones are not returned. Open deals without a date go to the no-date
  list (first 100 by title plus the full count).
- Won deals bucket by their won timestamp in UTC when `includeWon` is on; `wonTotal` sums them and
  they are never part of `total` or `weighted`.
- `total` and `weighted` use `summarize`; each month lists the deals whose currency lacks a rate as
  `excluded`.
- Each list sorts by close date then title; `open` is capped at 200 per month while `openCount` is
  the real count. Month labels use `Intl.DateTimeFormat("en-US", { month: "short", year: "numeric",
  timeZone: "UTC" })`.
- Dragging a card to another month calls `moveDealToMonth`, which keeps the day of month clamped to
  the target month's last day (or the 15th for an undated deal) and writes through `updateDeal`, so
  the change log, CAS and realtime event are the same as any close-date edit. Won and lost deals
  cannot be moved.

Visibility reuses `dealVisibilityClause`, the predicate the deals list uses.

## Permissions

| Capability | Who |
|---|---|
| `permissions.manage` | base currency and rates (same as the existing setting) |
| `products.manage` | product catalog mutations (admins by default) |
| `deal.edit` | deal lines, deal currency and probability |
| `pipeline.manage` | stage probabilities |

## Tests

`src/features/currency` holds the pure money and totals tests plus the rates integration suite;
`src/features/products` holds the product/line/terms integration suite; `src/features/forecast`
holds the forecast and move integration suite. The demo seed (`pnpm db:seed:demo`) adds six
products (two in EUR), rates EUR 1.08 and GBP 1.27, stage probabilities 10/25/50/75/90, lines on
five deals, one EUR and one GBP deal with lines, one JPY deal with no rate, two overdue close dates
and three undated deals.
