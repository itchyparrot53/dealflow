# Insights

Insights is the reporting area: `/insights` lists dashboards and saved reports, `/insights/reports/{id}`
is the report builder, and `/insights/dashboards/{id}` is a dashboard. Everything is scoped by the
viewer's existing deal and activity visibility; a report is a saved view, not a way around them.

## Entities

A report covers **deals** or **activities**. Persons, organizations, leads, documents, emails and
projects are later work.

## Measures

| Entity | Measure | Meaning |
|---|---|---|
| Deal | Count | Number of deals in the group. |
| Deal | Sum of value | Deal value in the deal's currency, converted to base. |
| Deal | Average value | Converted value divided by the counted deals. |
| Deal | Weighted value | Value times the effective probability (deal override, then stage, then 100). |
| Activity | Count | Number of activities. |
| Activity | Duration | Sum of `duration_minutes` (minutes). |

The value measures never add two currencies in SQL: the query groups by currency and TypeScript
converts each currency's sum with the stored rate. A currency with no rate is left out and reported
under the chart as "{n} deals in {currencies} excluded: no exchange rate". Averages are computed after
conversion, and an excluded currency never enters the denominator.

## Grouping and segments

Deal groupings: stage, pipeline, owner, status, label, lost reason, source channel, currency, created,
won, lost, expected close date. Activity groupings: activity type, owner, assignee, done, due, created,
done date.

Date groupings need an interval (day, week, month, quarter, year). Weeks are ISO weeks (Monday start),
quarters are calendar quarters, and buckets use the viewer's time zone (`user_preferences.timezone`,
else UTC). A `date` column such as expected close date is never shifted.

Deals can be segmented by stage, pipeline, owner, status, label, lost reason, source channel or
currency; activities by type, owner, assignee or done. Grouping by label uses the deal's first label,
so a deal with several labels still counts once instead of double-counting money.

## Date ranges

Presets: this month, last month, this quarter, last quarter, this year, last year, last 30 days,
last 90 days, last 12 months, all time, and a custom range. Rolling windows are whole local days or
months (last 30 days includes today and the 29 days before it). A custom end date is inclusive. A
custom range may span at most three years.

## Charts

Bar, stacked bar, line, area, pie, table, KPI and funnel. Line and area need a date group; a stacked
bar needs a segment; a pie needs a non-date group and no segment; a KPI takes neither; a funnel is
deal-only. Every chart carries an accessible label from the report description and a "table" view.
Colours come from the design-system tokens, never hard-coded hex values.

The funnel reuses the stats stage-conversion cohort: deals created in the range, counted by how far
they got through the selected pipeline. It ignores the report's date field, group, segment and filter,
because the stats funnel has no filter input either.

## Caps

At most 50 groups and 12 segments; the rest roll into "Other". Tables show at most 500 rows and set
`truncated`. The explain prompt carries at most 60 rows.

## Filters

Deal filters reuse the deals-list condition builder: the same field and operator allow-list. Activity
filters are owner, activity type and done.

## Visibility

Deal reports apply `dealVisibilityClause`; activity reports apply the Part 5 activity visibility SQL.
They are applied inside the single SQL query on every run, including the report owner's own runs. A
shared report shows each viewer only the rows they may see.

## Sharing

Any user creates their own reports and dashboards. Only the owner or an admin edits, shares or deletes
one. A shared report or dashboard is readable by every signed-in user. An unshared item reads as "not
found" to anyone else, so its existence does not leak. A dashboard omits a report widget the viewer may
not read, and a widget whose goal was deleted.

## The default dashboard

The first Insights visit creates "Sales overview", shared, owned by the first active admin, with six
shared reports: won value by month (last 12 months), open pipeline by stage (weighted), deals won vs
lost by month (stacked), activities by type this month (pie), a win/loss funnel for the first pipeline
this year, and won value this quarter (KPI). When the install has no pipeline the funnel report is
skipped, leaving five widgets. Creation is serialized by an advisory lock, so two concurrent first
visits cannot create two defaults.

## CSV

`GET /insights/reports/{id}/export.csv` streams the saved report as RFC 4180 CSV: quoted fields, CRLF
line endings, and a leading apostrophe on any cell a spreadsheet could execute as a formula (a cell
starting with `=`, `+`, `-`, `@`, tab or carriage return). The session is required and the report is
re-read through the service, so the route cannot export a report the viewer may not read. The file is
named `{slugified report name}-{YYYY-MM-DD}.csv`.

## Explain this report

"Explain" sends only the aggregated result to the Part 1 AI layer: the definition summary, the base
currency, the total, the excluded currencies and at most 60 rows of group/segment labels, values and
counts. It never sends deal titles, person names, emails, notes or record ids. The reply is
Zod-validated as 3 to 5 insights of at most 240 characters. AI caps, the per-user rate limiter and
usage logging all apply; a failure shows "Couldn't explain this report right now." and records the AI
error id. With `AI_FAKE` the answer is three deterministic insights built from the largest group, the
smallest group and the total.

## AI score badge and bulk scoring

A deal's latest AI score (0 to 100, from `deal_ai_insights`) appears on its board card as a badge,
coloured by band (muted under 40, amber 40 to 69, green 70 and above) with the number printed so
colour is never the only signal. No badge means the deal was never scored.

"Score with AI" in the deals list bulk bar takes up to 200 selected deals, keeps only the ones the
actor may edit, and enqueues one `ai.bulk-score` job. The job scores the deals one at a time as the
requester and stops at the first company cap, per-user cap or rate-limit refusal. It always ends with
one notification: "Scored {n} of {m} deals", plus " (AI limit reached)" when it stopped early.
