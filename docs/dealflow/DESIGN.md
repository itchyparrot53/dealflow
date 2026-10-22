# Dealflow design system (Pipedrive parity)

Dealflow's look matches Pipedrive's live web app one to one, as measured by the planner from
full-resolution captures on 2026-10-22 (1280x720, values converted to CSS px). The parity covers
the look only: Dealflow keeps its own name, logo mark and lucide icon set. No Pipedrive logo,
wordmark, icon SVG, illustration or font file is copied. Inter is the typeface, vendored and
loaded with `next/font/local`.

The values below are the contract. `scripts/dealflow/check-design.mjs` proves every file follows
it, `e2e/15-design.spec.ts` proves the computed values in a browser, and the screenshot gallery in
`e2e/screenshots/design/` is the owner's side-by-side review.

## Brand

The Dealflow logo and icon masters live in the brand kit: [brand/README.md](../../brand/README.md)
and [brand-guidelines.html](../../brand/brand-guidelines.html). The leaf is green `#2D8548` with a
white up-right arrow; the wordmark is indigo `#211C52` "Deal" plus green "flow". The reverse files
use the light green `#58CC85` leaf, indigo arrow and white "Deal" on dark surfaces such as the
indigo rail and the mobile More sheet header.

Rules:

- Use the SVG masters for every in-app logo, copied into `public/brand` and rendered through
  `BrandLogo`. Use PNGs only where a format requires them: app icons, favicons, email and social
  previews.
- Never recolour, redraw, stretch, rotate or retype the logo. Do not force a raster icon white
  with `brightness-0 invert`; use the reverse artwork instead.
- Keep the clear space and minimum sizes from the guidelines: the horizontal logo is at least
  96 px wide on screen, the mark at least 16 px.

## Tokens

Light is the parity theme; dark is the derived palette. Every key is declared in both themes in
`src/app/globals.css`. Shadcn tokens use HSL channels; raw values are used where the role is not
colour-converted.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#FFFFFF` | `#1B1D22` | page canvas |
| `--canvas-subtle` | `#F5F5F5` | `#15171B` | board columns, activity side, public ground |
| `--card`, `--popover` | `#FFFFFF` | `#24272E` | cards, composer, menus, dialogs |
| `--muted`, `--secondary`, `--accent` | `#F4F4F4` | `#2C3038` | hover fills, skeletons |
| `--foreground` | `#21232C` | `#E8E9EC` | primary text |
| `--muted-foreground` | `#65686F` | `#A3A6AD` | secondary text, meta |
| `--placeholder` | `#929196` | `#7D8088` | placeholders, disabled text |
| `--border` | `#E3E3E3` | `#353943` | card borders, dividers |
| `--border-strong`, `--input` | `#CACACA` | `#4A4F5A` | control borders, search pill |
| `--grid` | `#E5E5E5` | `#30343D` | table lines, chart grid |
| `--topbar-border` | `#E8E8E8` | `#30343D` | top bar rule |
| `--primary`, `--success`, `--action`, `--save` | `#2D8548` | `#2D8548` | primary buttons, Won, passed stages |
| `--primary-hover` | `#256F3C` | `#256F3C` | primary hover |
| `--link-record` | `#017737` | `#52C27A` | record links |
| `--link`, `--info`, `--ring` | `#1168C9` | `#5EA2F0` | links, active tab, focus |
| `--info-soft` | `#EFF6FF` | `#1E2A3D` | active tab, selected chip |
| `--info-soft-strong` | `#E1EEFF` | `#233552` | selected filter chip |
| `--destructive` | `#D73C38` | `#D73C38` | Lost, overdue, delete |
| `--warning` / `--warning-soft` / `--warning-soft-foreground` | `#F5A623` / `#FFF6D5` / `#7A3E0C` | `#F5B547` / `#3A3320` / `#F5B547` | rotting, tips, warning chips |
| `--track` / `--track-foreground` | `#E4E4E4` / `#5E6066` | `#30343D` / `#A3A6AD` | progress track, future stages |
| `--next-green` / `--next-grey` / `--next-red` | `#58CC85` / `#CBCCCE` / `#D73C38` | same / `#5A5E66` / `#EE6461` | next-activity dot |
| `--rail` / `--rail-active` / `--rail-hover` / `--rail-foreground` | `#211C52` / `#6250E2` / `#2E2868` / `#FFFFFF` | `#16133A` / `#6F5FE8` / `#221E52` / `#FFFFFF` | navigation |
| `--tooltip` / `--tooltip-foreground` | `#20232C` / `#FFFFFF` | `#3A3E48` / `#FFFFFF` | tooltips, toasts |
| `--ai` / `--ai-soft` | `#6250E2` / `#F6F4FF` | `#9C90F5` / `#26224A` | the assistant |
| `--badge-plan-*` | `#EDF2FF` / `#AFC1EF` / `#2A53C5` | `#1E2A4D` / `#3B5291` / `#AFC1EF` | plan tags |
| `--badge-new` | `#2677EA` | `#4C8EF0` | NEW pill |
| `--avatar` / `--avatar-foreground` | `#EBEBEB` / `#5E6066` | `#3A3E48` / `#C7C9CE` | initials |
| `--chart-1` to `--chart-6` | `#2D8548` `#1168C9` `#6250E2` `#F5A623` `#D73C38` `#65686F` | `#3FA864` `#5EA2F0` `#8E80F0` `#F5B547` `#EE6461` `#A3A6AD` | chart series |

Contrast: `#2D8548` and `#D73C38` with white text measure 4.6:1; `#65686F` on white 5.6:1. Where
axe required a change, it is logged as a `CONTRACT CHANGE` in `PROGRESS-P11` history: the dark
action and destructive fills keep the light values (white on `#3FA864` is 3.0:1), the future-stage
label uses `--track-foreground` (4.98:1), and the calendar's overdue chip uses primary ink.

## Type

| Use | Size / line-height / weight |
|---|---|
| Body, controls, table cells (`text-sm`) | 14 / 20 / 400 |
| Buttons and table headers (`text-sm` + `font-semibold`) | 14 / 20 / 600 |
| Meta and secondary (`text-meta`) | 13 / 18 / 400 |
| Badges and captions (`text-xs`), badges 700 | 12 / 16 |
| Top-bar page title, section titles (`text-base` + `font-semibold`) | 16 / 24 / 600 |
| Record titles (`text-title`) | 24 / 32 / 400 |
| Mobile nav labels (`text-caption`) | 11 / 14 / 600 |

Body letter-spacing is 0. `.tabular` (`font-variant-numeric: tabular-nums`) is used for values,
counts and dates in tables and cards. There is no `text-display` step; page titles live in the top
bar.

## Spacing, radius, shadows, motion, focus

- Content padding 16 (24 on the deal page); toolbar row 64 (16 + 32 + 16); filter row 40; board
  column inner padding 8; card padding 8 vertical, 10 horizontal; deal header 24 horizontal, 20
  top; sidebar rows 0 24; activity side 24; form field gap 16 with labels 6 above.
- Radius: `rounded-sm` 2 (checkboxes), `rounded-md` 4 (controls, cards, chips, badges), `rounded-lg`
  8 (columns, composer, menus, dialogs), `rounded-xl` 8 (sheets), `rounded-full` (search pill, round
  add, AI pill, avatars, dots, status pills).
- Shadows only on floating surfaces: `--shadow-card-hover` (board card hover), `--shadow-pop`
  (menus, popovers, toasts), `--shadow-dialog` (dialogs, sheets), `--shadow-drag` (lifted card).
  Static cards, panels and columns have none.
- Motion: colour transitions 100 ms ease-out, overlays 150 ms, nothing else; `prefers-reduced-motion`
  collapses animation and transition durations.
- Focus: `:focus-visible` draws a 2 px blue outline (`#1168C9`) at 2 px offset everywhere, with
  `!important` so primitives that rely on a ring cannot suppress it.

## Layout and components

- **Shell:** 56 px full-height indigo rail (44 px tiles, tooltips, violet active tile); 56 px white
  top bar with the page title, the 240x40 search pill, the round add button, the AI pill,
  notifications, help and the 40 px avatar; mobile bottom nav in rail colours.
- **Page title:** every app page publishes it through `PageTitle`/`usePageTitle`, rendered by the top
  bar; `PageToolbar` is the 64 px row under it.
- **Primitives** (`src/components/ui/`): Button (28/32/40, split, round), ViewSwitcher, fields
  (32 px, strong border, 1 px blue focus), Checkbox/Radio/Switch, chips, tabs (40 px, info-soft
  active with a 2 px underline), overlays (menus, popover, tooltip, dialog, sheet, toast), EmptyState,
  Skeleton (shimmer), Progress, Avatar, StatusBadge, Kbd, ErrorRow, Panel, PageToolbar,
  `tableStyles`.
- **Lists:** `tableStyles` gives 33 px rows, a strong header rule, light grid lines, green record
  links and right-aligned tabular numbers.

## Opt-out policy

`check-design` allows at most 40 lines carrying `design-ok: <reason>`. An opt-out is legitimate
only where the rule does not apply (a redirect-only route, an intercepted modal that has no title
of its own, the drag bar's upper-case labels that mirror `StatusBadge`). The current 12 are listed
in `DESIGN-WORKLIST.md`. Never opt out to hide a restyle.

## Commands

```bash
pnpm check:design                 # 0 violations expected; exits 1 above 40 opt-outs
pnpm check:design src/features/deals --json /tmp/design.json
DESIGN_SCREENS=board pnpm exec playwright test e2e/15-design.spec.ts   # one screen
DESIGN_CHECKS=0 DESIGN_SCREENS=login pnpm exec playwright test e2e/15-design.spec.ts
pnpm exec playwright test e2e/15-design.spec.ts                        # all 26 screens + axe + parity
```

The design spec writes `e2e/screenshots/design/{screen}-{width}-{theme}.png`: 26 screens at 1440 and
375 in light, and the 21 app screens at 1440 in dark.
