# Frontend review: the 2026/27 SaaS bar

An independent review of the Dealflow frontend, run as three fresh-context audits plus a pass
over the rendered gallery, followed by the fixes that shipped in the same loop. It is deliberately
opinionated: the goal is a product a design-literate buyer recognises as current, not a restyle for
its own sake.

## Design read

- Mode: **Operate**. People are in a task, not being persuaded. Familiarity, density and speed beat
  expression; brand lives in the details.
- Audience: a small sales team, often on a laptop, increasingly on a phone before a call.
- Existing world: indigo rail, green action colour, slate surfaces, shadcn primitives. Keep it;
  refine the grammar rather than replace the identity.

## What "2026/27" means here

The current reference points (Linear, Stripe, Vercel, Attio, Height) converge on a few things: the
table or board is the product, chrome is quiet, colour is reserved for state and action, AI is a
designed surface rather than a badge, and the keyboard is a first-class input. Sources:

- [10 best SaaS dashboard design examples and 2026 trends](https://adminlte.io/blog/saas-dashboard-design-examples/):
  dark-first restraint, tables as the primary interface, AI summaries as components, colour only
  for meaning.
- [The 2026 B2B SaaS AI design system playbook](https://www.theskinsfactory.com/uiux-design-blog/b2b-saas-ai-design-system-playbook):
  one AI visual language, auditability, consistency with the rest of the system.
- [WCAG 2.2 SC 2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
  and [SC 2.4.13 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html).
- [Core Web Vitals](https://web.dev/articles/vitals): LCP 2.5 s, INP 200 ms, CLS 0.1 at p75.

## The rules this codebase follows now

1. **Density is the feature.** Tables and boards carry the page. Controls sit at 32 px, rows at
   33 to 44 px, and a two-line cell is allowed when it removes a column.
2. **One accent.** Primary green is for actions and current selection only. Status is a dot plus a
   label, never a filled pill that competes with the Create button.
3. **A fixed type scale.** 12 px meta, 14 px body, 20/24 px headings, tabular numerals for money,
   counts and dates. No fluid headings inside the product.
4. **Dates are calendar dates in UTC.** Format once through `src/lib/format/date.ts`; pair the date
   with urgency in words ("Overdue by 3 days", "Due today", "In 30 days"); only overdue turns
   destructive.
5. **Progress is a bar plus numbers.** Zero-task projects say "No tasks", never an empty track.
   No progress rings or sparklines as decoration.
6. **Every mutation speaks.** A toast confirms it; reversible changes (status) offer Undo; a
   destructive change confirms with its consequence ("3 tasks will move to No phase").
7. **Targets and focus.** 24 by 24 px minimum, a visible 2 px focus ring with 3:1 contrast including
   on the indigo rail, a skip link, one `main` landmark, and error copy tied to its field with
   `aria-describedby`.
8. **Forms.** Label above input, hint below, error below and announced, `text-danger` for error
   copy (the destructive fill stays for buttons), placeholder text at 4.5:1 or better.
9. **Motion is state, not theatre.** 100 to 200 ms, transform/opacity, and reduced-motion variants
   that still communicate.
10. **AI is one surface with provenance.** The same visual language everywhere, sources cited,
    feedback available, and no score without a trail.
11. **Lists are URL-owned.** Filters live in the query string, the input resyncs with Back, the
    count is live, "no results" differs from "no data", and phones get card rows, not a clipped
    table.
12. **Speed is design.** No blocking third-party import behind a feature guard, skeletons that match
    the final layout, navigation before non-critical writes, and optimistic updates with rollback
    where the action is safe.

## What the audits found

Three independent reviewers (Projects, shell and screens, accessibility and performance) worked
read-only against the code and the 1440/375 light and dark gallery. The highest-impact findings:

| Area | Finding | Severity | Status |
|---|---|---|---|
| Projects | Any task assignee could delete or rename the project | Blocker for enterprise review | **Backlog 1** |
| Projects | No overview: `description` stored but never shown or editable | Major | Fixed |
| Projects | No task list view, no completed collapse, no per-phase progress | Major | Fixed |
| Projects | ISO dates and no overdue signal on the list and cards | Major | Fixed |
| Projects | Mobile list clipped columns behind an unmarked scroll | Major | Fixed |
| Projects | Filter state not resynced, empty state lied when filtered | Major | Fixed |
| Projects | Phase delete was one unconfirmed click | Major | Fixed |
| Projects | Touch drag hijacked scrolling; no keyboard sensor | Major | Fixed |
| Projects | Loading and not-found missing; gallery captured a 404 | Major | Fixed |
| Shell | No skip link; rail focus ring 2.84:1 | Major | Fixed |
| Shell | `h-screen` under iOS chrome; duplicate `main` in skeletons | Major | Fixed |
| Shell | Placeholder 3.1:1; dark error copy 3.3:1 | Major | Fixed |
| Shell | Form errors not associated with the control | Major | Fixed |
| Shell | Command palette listbox is not a valid combobox | Serious (axe) | **Backlog 2** |
| Shell | Mobile inbox rail, deal header and board toolbar collide | Major | **Backlog 3** |
| Speed | `posthog-js` in the shared bundle behind a guard | Major | Fixed |
| Speed | Notification click waited on the mark-read action | Major | Fixed |
| Analytics | No filter bar or freshness stamp; totals truncate | Major | **Backlog 4** |

## What shipped in this batch

**Projects**

- `src/lib/format/date.ts`: UTC calendar formatting, relative due labels and tones, with tests.
- Quiet status (dot and label) and a shared progress bar, plus a due-date block that names urgency.
- Projects index: an at-a-glance strip (active, completion, due soon, overdue), a quieter table with
  avatar owners, whole-row links and formatted dates, a live search that syncs with the URL, a real
  filtered-empty state, and card rows below `md`.
- Project page: a back link, a status menu by the title, progress, owner, due date and an overdue
  count in the header, an editable description, a Board/List toggle, a task list view, and an
  all-done banner with a "Complete project" action.
- Board: wider flexible columns that fill the canvas, per-phase done/total and a 2 px progress line,
  completed tasks collapsed behind a disclosure, real empty columns, and a touch sensor that does
  not steal a swipe.
- Task cards: formatted due dates, unique checkbox labels, a border hover that works in dark mode,
  and a focus ring inside the card.
- Safety: status changes offer Undo, phase deletion confirms with the task count it will move, the
  task dialog focuses the title and disables Save on an empty title, and read-only viewers no
  longer get live date pickers.
- Route states: `loading.tsx` for both routes and a project-specific `not-found` with a way back.
- Gallery: fixtures resolve per navigation (a stale id used to photograph a 404), and the design
  spec now fails if an app screen renders the not-found copy.

**App-wide**

- Skip link, `main` landmark target, `h-dvh`, and scroll padding for the mobile bar.
- A white focus ring on the indigo rail and bottom nav (15.5:1), a 24 px hit area for the notification
  "Mark all read" and board filter chip remove button, and an inset focus ring on the stage track.
- Placeholder text token at 4.9:1 light and 5.4:1 dark; `--danger-text` for error copy at 4.6:1 and
  5.5:1; form errors wired with `aria-invalid` and `aria-describedby`.
- Toasts use `alert` for errors and `status` otherwise, with no nested live region.
- Buttons expose `aria-busy` and a screen-reader "Loading" cue; the spinner respects reduced motion.
- Skeletons no longer render nested `main` landmarks.
- Notifications navigate first and mark read in the background.
- `posthog-js` is imported only after the telemetry and DNT guard, so self-hosted installs never
  download it.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm check:design`: green (lint 15 warnings, 0
  errors; design 0 violations, 17 documented opt-outs).
- `pnpm test:unit`: the full suite passes (see the final run log), including the new date tests and
  the updated stage-track and form-field suites.
- E2E: the affected specs (`06`, `07`, `08`, `12`, `15`, `16`) passed 40/40, then the complete
  suite passed 60/60 at the final tree.
- Gallery: `projects` and `project` recaptured at 1440 and 375 in both themes; the project screen is
  a real board, not the 404 that was shipped before this review.

## Backlog, in order

1. **Split project management from task editing.** `canEditProject` currently lets any assignee
   delete the project. Introduce `canManageProject` (owner or admin) for rename, status, phases,
   dates and delete, keep assignee-level task editing, and cover it in the visibility integration
   tests. This is the one finding that should block an enterprise security review.
2. **Make the command palette a real combobox.** `role=combobox` with `aria-controls` and
   `aria-activedescendant`, options with `aria-selected`, grouped sections, keyboard-reachable
   commands and a "Create person" fallback on no match.
3. **Phone layouts for the inbox, deal header and pipeline toolbar.** The folder rail should become
   a sheet, the deal header should stack, and the board toolbar should collapse secondary controls
   into a View menu below `md`.
4. **Analytics controls.** One filter bar (date range, pipeline, owner) and a freshness stamp on the
   dashboard and forecast, windows that contain data, and totals that never truncate.
5. **Saved views everywhere.** Adopt the existing `SavedViewControl` on Activities, Deals and Inbox,
   with the screen-specific filters inside it.
6. **Two-pane inbox at xl and a sticky reply bar.** Keep the queue mounted while reading; put Reply,
   Reply all and Forward in a bar that is always visible.
7. **Optimistic mutations.** Stage moves and activity completion should update immediately, with
   rollback and a toast, then revalidate in the background.
8. **Dark elevation.** A dark-specific shadow and hairline system; today floating surfaces keep
   black shadows that disappear on the dark canvas.
9. **Widen the axe sweep.** Add `wcag21aa`, `wcag22aa` and the landmark and heading rules, and a
   second pass with a dialog, menu, palette, toast and invalid form open.
10. **People table interaction model.** Reuse the activities row cursor (`j`/`k`, Enter), add a hover
    overflow for peek and edit, and load more on scroll.
