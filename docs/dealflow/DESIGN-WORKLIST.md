# Design worklist (Part 11)

Baseline (Task 0.1, 2026-10-22, Phase 0 base `18e1dff`): **289 violations in 184 files**, 0 opt-outs.
Final (Task 3.4): **0 violations in 0 files, 12 opt-outs**.

`pnpm check:design` is the referee: it scans `src/**/*.tsx` for arbitrary font sizes, off-scale
radii, shadows on non-floating elements, all caps outside `StatusBadge`, hand-rolled overlays,
raw colours and Tailwind palette steps, and requires every app `page.tsx` to publish its top-bar
title. A line carrying `design-ok: <reason>` is skipped and counted.

## Final state

```
check-design: 0 violation(s) in 0 file(s); 12 opt-out(s)
```

### Opt-outs (all 12, with the reason on the line)

| File | Line | Reason |
|---|---:|---|
| `src/app/(app)/settings/page.tsx` | 1 | the settings index only redirects by role. |
| `src/app/(app)/pipeline/page.tsx` | 10 | this page only redirects to the first visible pipeline board. |
| `src/app/(app)/deals/page.tsx` | 3 | this route only redirects to the pipeline board. |
| `src/app/(app)/activities/page.tsx` | 3 | this route only redirects to the activities list. |
| `src/app/(app)/leads/@modal/(..)leads/[leadId]/page.tsx` | 1 | intercepted modal route; the page underneath owns the top-bar title. |
| `src/app/(app)/contacts/orgs/@modal/(..)orgs/[orgId]/page.tsx` | 1 | intercepted modal route; the page underneath owns the top-bar title. |
| `src/app/(app)/contacts/people/@modal/(..)people/[personId]/page.tsx` | 1 | intercepted modal route; the page underneath owns the top-bar title. |
| `src/app/(app)/activities/@modal/(..)contacts/orgs/[orgId]/page.tsx` | 1 | intercepted modal route; the page underneath owns the top-bar title. |
| `src/app/(app)/activities/@modal/(..)contacts/people/[personId]/page.tsx` | 1 | intercepted modal route; the page underneath owns the top-bar title. |
| `src/app/(app)/activities/@modal/(..)deals/[dealId]/page.tsx` | 1 | intercepted modal route; the page underneath owns the top-bar title. |
| `src/app/(app)/activities/@modal/(..)leads/[leadId]/page.tsx` | 1 | intercepted modal route; the page underneath owns the top-bar title. |
| `src/features/deals/DragDropZones.tsx` | 41 | Pipedrive's drag labels are upper case. |

Classes of opt-out: seven intercepted `@modal` routes (the underlying page owns the title), four
redirect-only routes, and the drag action bar's upper-case labels (they mirror `StatusBadge`).
No opt-out hides a restyle.

## Baseline totals (Task 0.1)

| Rule | Violations |
|---|---:|
| `palette` | 88 |
| `page-title` | 75 |
| `uppercase` | 52 |
| `shadow` | 39 |
| `font-size` | 31 |
| `raw-colour` | 4 |
| **Total** | **289** |

## Section 6.1 differences, closed

| # | Area | Closed in |
|---|---|---|
| 1 | Rail | 1.1 |
| 2 | Top bar | 1.1 |
| 3 | Page title | 0.3, 1.1 to 3.2 (content h1s removed in 4.3) |
| 4 | Buttons | 0.3 |
| 5 | Text colours | 0.2 |
| 6 | Links | 0.2, screens (breadcrumb blue + underline in 4.3) |
| 7 | Canvas | 0.2, 1.2, 1.3 |
| 8 | Board columns | 1.2 |
| 9 | Deal cards | 1.2 |
| 10 | Deal stage bar | 1.3 |
| 11 | Deal sidebar | 1.3 (AI insights made a flush row in 4.3) |
| 12 | Deal activity side | 1.3 |
| 13 | Deal header | 1.3 |
| 14 | Lists | 1.4 (every list table on `tableStyles` after 4.3; activity/type chips 24 px) |
| 15 | Badges | 0.3 |
| 16 | Notes | 1.3 (warning-soft cards on the dashed 40 px rail in 4.3) |
| 17 | Mobile nav | 1.1 |

## How the final zero was reached

Tasks 0.2 to 0.4 built the tokens, primitives and checker; Tasks 1.1 to 1.4 closed the shell and
the core screens; Phase 2 closed the secondary screens; Task 3.1 restyled every settings page and
Task 3.2 the public pages. Task 3.4 closed the remaining files: 36 violations in 25 files (palette
steps, shadows on static cards, all caps section labels, arbitrary 10/11 px sizes, one raw colour
in the composer tab underline, three page-title hooks).
