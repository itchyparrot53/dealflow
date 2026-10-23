# Design polish worklist: U1 to U30

Every improvement in PLAN-PART12.md section 6.1, with the task and commit that closed it.
The table is mirrored from the plan at Task 0.1; the two right-hand columns are filled as each task lands.

## check-design baseline (Task 0.2)

`pnpm check:design --json /tmp/polish-baseline.json` with the two new 6.10 rules active, before the
fixes: **9 violation(s) in 7 file(s); 12 opt-out(s)**.

- `dialog-anatomy`: 4. The negative header/footer margins in `dialog.tsx` and `alert-dialog.tsx`,
  plus `MoveDealDialog` and `CommandPalette` with no `DialogHeader` and no `closeButton` choice.
- `select-long-list`: 5. `CurrenciesSettings` (base and new-rate), `DealTermsFields` (two currency
  pickers) and `ProductDialog` (product currency).

| ID | Where | Problem found | Fix (contract) | Task | Closed in task | Commit |
|---|---|---|---|---|---|---|---|
| U1 | All dialogs (Owner) | `DialogHeader` uses `-mx-6 -mt-6` while dialogs like `EntityCreateDialogShell` set `p-0`, so the title is pushed 24 px above the box and clipped ("Add deal" cut off). The close button is absolutely placed at `top-4` and lands on the header rule. | 6.2 anatomy | 1.1 | | | |
| U2 | Every Select (Owner: currencies) | `Select` content is `position="popper"` with `overflow-hidden` and no max height, so long lists run off screen and cannot scroll | 6.3 Select | 1.2 | | | |
| U3 | Currency and time zone pickers | 160 currencies and 400+ zones in a plain list | searchable `Combobox` (6.3) | 1.2 | | | |
| U4 | Rail (Owner) | Icons only, with no way to see labels | expandable rail, 6.4 | 2.1 | | | |
| U5 | Install, offline, push (Owner) | The owner does not use install, offline or push, and wants every mention hidden | `NEXT_PUBLIC_PWA_UI` flag, 6.4 | 2.2 | | | |
| U6 | Add deal dialog (Owner) | Stage chevrons truncate to "Qual…", "Cont…"; the right "Person" column is unbalanced; the currency and owner pickers use different chevrons | 6.7.1 | 3.1 | | | |
| U7 | AI drafts (Owner) | "The AI reply could not be understood". Reasoning models spend the 800-token budget thinking (empty or cut content), and the fence regex only accepts a whole-string fence | 6.9 | 1.6 | | | |
| U8 | Forms everywhere | Label sizes, gaps and widths differ per dialog and settings page | `FormField` + `FormGrid` (6.3) | 1.3 | | | |
| U9 | Selects and comboboxes | `Select` uses `ChevronDown` while Combobox (Owner field) uses up/down chevrons, and heights differ | one trigger style (6.3) | 1.2 | | | |
| U10 | Money and numbers | Chart axes show `$380,000.00`; products show `1200.00 USD`; org revenue shows `18500000.00` | 6.5 helpers everywhere | 1.4 | | | |
| U11 | Index pages | Documents, Insights and Projects repeat the top-bar title as a large H1 | 6.6 heading rule | 2.3 | | | |
| U12 | Settings | Content is capped near 520 to 700 px in a 1440 window; the nav is a long unscrolled list; pages must always scroll | 6.6 settings layout | 2.3 | | | |
| U13 | Contacts | People, Organizations and Timeline sit in a 180 px left panel on every list and record | view switcher in the toolbar (6.6) | 2.4 | | | |
| U14 | Toolbars | Activities puts Export CSV on its own row; Projects uses full-width selects; the control order differs per page | 6.6 toolbar order | 2.5 | | | |
| U15 | AI filter box | "Describe a filter" is a tall card wedged into the toolbar, and its placeholder talks about deals on Leads, People and Organizations | "Ask AI" popover, entity placeholders (6.6) | 2.5 | | | |
| U16 | Board column header | "W. 1 excluded" and "Weighted $8…" truncate | 72 px, three lines (6.7.2) | 3.2 | | | |
| U17 | Board cards | Solid green "AI 72" pills shout on every card | calm score pill (6.7.2) | 3.2 | | | |
| U18 | Forecast | Total, Weighted and Won values overlap in each month header | stacked grid (6.7.3) | 3.3 | | | |
| U19 | Calendar | The day starts at 00:00, so working hours are below the fold; the grid is flat | 6.7.3 | 3.3 | | | |
| U20 | Deal stage track | Every future stage says "0 days" | 6.7.4 | 3.4 | | | |
| U21 | Document editor | The raw template (`# Quote {{document.number}}`) is the main field; actions mix filled, outline and plain text; "Send" looks disabled | 6.7.5 | 3.5 | | | |
| U22 | Email thread | White message boxes in dark mode, a narrow centred column, an unlabeled follow-up select | 6.7.6 | 3.6 | | | |
| U23 | Inbox list | Sender, subject and snippet run together | grid row (6.7.6) | 3.6 | | | |
| U24 | Leads list | An orange "No activity" warning on every row; source values like "manually created" | 6.7.7 | 3.7 | | | |
| U25 | Dashboard | The dashboard name is a form input at the top; actions are scattered | 6.7.7 | 3.7 | | | |
| U26 | Insights index | A bare two-line list under a duplicate H1 | table plus empty state (6.7.7) | 3.7 | | | |
| U27 | Person and organization | The follower count wraps under "0 followers"; detail labels are right-aligned; numbers are raw | 6.7.4 | 3.4 | | | |
| U28 | Projects | Full-width filter selects; "Start date" label with "Start date" placeholder | 6.7.7 | 3.7 | | | |
| U29 | Tables | "Showing 50 of 107" floats top-left; empty cells mix "-" and blanks; headers do not stick | 6.8 | 1.5 | | | |
| U30 | Empty states and top bar | Empty pages show bare text; the bell badge shows "16" at full width | 6.8 | 1.5 | | | |
