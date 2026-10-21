# Productivity: recurrence, calls, duplicates and shortcuts

Part 9 adds the remaining day-to-day productivity surfaces. Everything here runs through the
existing services, so permissions, change logs and domain events apply as they do elsewhere.

## Repeating activities

An activity can repeat daily, weekly, monthly or yearly, with an interval of 1 to 99. Weekly rules
can name the weekdays (for example Monday and Thursday); monthly and yearly rules anchor to the
series' original day of month, clamped to the month's length (the 31st becomes the 28th or 29th in
February and returns to the 31st in March).

- The rule is set in the Add activity or Edit activity dialog; the preview under the fields is the
  same sentence the row badge shows, for example "Every 2 weeks on Mon, Thu".
- **Completing** an occurrence creates exactly the next one. The next activity copies the type,
  subject, links, owner, assignee, duration, all-day flag, note and location, and keeps the local
  time of day in the assignee's time zone (`user_preferences.timezone`, else UTC). Nothing is
  created in advance, and completing the same occurrence twice creates one.
- The end can be a date (inclusive), a count (2 to 500 occurrences) or never. Ending a series marks
  the current occurrence ended; earlier occurrences stay as they were.
- Editing the rule on an occurrence changes only that occurrence's row, so the following
  occurrences use the new rule.
- Deleting an occurrence does not create the next one. Deleting the whole activity (or its deal)
  removes the series rows by cascade.

## Logging calls

"Log call" sits next to the activity tabs on a deal, person or organization. It records a done
activity of the install's call type (the first active activity type whose key or name mentions
"call") with the outcome, direction, duration and an optional note. The outcome appears as a chip on
the timeline: Connected, No answer, Left voicemail, Busy or Wrong number.

If no call type exists, saving shows the `E_CALL_001` copy with a link to the activity type
settings. There is no telephony integration; a call is always a record you create.

## Calendar

The week and month calendars support drag to reschedule. In the week view a timed event can move to
another day and hour; in the month view it moves between days and keeps its time of day. All-day
items stay on the day they are dropped on. A drop calls the normal activity update, and the calendar
refreshes only after the write succeeds, so a refused change leaves the grid untouched.

## Activities list

- Filters (owner, status, date range, type, search) live in the URL, so reloading, sharing a link
  and the CSV export all use the same filter.
- A column picker chooses which columns are visible and their order; the choice is stored per user
  (`user_preferences.ui.activitiesView`).
- Selecting rows shows a bulk bar with Mark done, Reschedule, Change owner and Delete. Bulk actions
  run through one server action that loops the existing services and reports partial failures: the
  rows that failed stay selected.

## Duplicates

`Contacts > Find duplicates` (also linked from the People and Organizations headers) lists likely
duplicate pairs:

- People by email, by phone (last nine digits, formatting ignored) or by the same name at the same
  organization.
- Organizations by normalized name (punctuation, diacritics and legal suffixes such as Ltd or
  Limited are ignored) or by website domain.

Pairs respect record visibility and skip soft-deleted records. "Merge" opens the existing merge
dialog with both records selected; "Not duplicates" hides the pair for good. One scan looks at up to
5,000 contacts per kind and says so when the cap is reached.

## Bulk actions on people and organizations

Both lists support bulk change owner (alongside the existing bulk delete and merge). Each row keeps
its own permission check; if some rows fail, the successful ones stay applied and the failed ones
stay selected. More than 500 ids in one batch is refused.

## AI filters

People, organizations, deals and leads can be filtered from plain English through the AI layer. The
model receives only the target's allowed fields and operators, its reply is validated with the
target's filter schema, and a field outside that allow-list is rejected. With `AI_FAKE=true` the
answers are deterministic, one per target.

## Undo

- A stage move on the board shows "Moved to {stage}" with Undo for eight seconds. Undo moves the
  deal back through the same compare-and-swap action; if the deal changed in the meantime it shows
  "Couldn't undo: the deal changed since".
- Deleting a deal, person, organization or activity (one row or a selection) shows "{n} deleted"
  with Undo, which restores through the recycle bin.
- Toasts pause while hovered or focused, dismiss with Escape (when focused) or the X, and errors are
  announced assertively. At most three are visible.

## Command palette and shortcuts

Press Cmd/Ctrl+K for the palette. It lists Create, Go to and Actions commands filtered by your
permissions, above the normal record search:

- **Create:** deal, person, organization, activity, log a call, project, quote.
- **Go to:** every main page, API tokens, and (admins) backups and the audit log.
- **Actions:** find duplicates, keyboard shortcuts.

Sequences and single keys:

| Keys | Action |
| --- | --- |
| `g d` | Deals |
| `g p` | People |
| `g o` | Organizations |
| `g a` | Activities |
| `g l` | Leads |
| `g i` | Insights |
| `g j` | Projects |
| `g f` | Forecast |
| `g m` | Inbox |
| `n d` | New deal |
| `n p` | New person |
| `n o` | New organization |
| `n a` | New activity |
| `n c` | Log a call |
| `1` to `9` | Jump to a navigation item |
| `j` / `k`, Enter | Move the list row cursor, open the row |
| `?` | Shortcut help sheet |
| `Cmd/Ctrl+K` | Command palette |

Sequences have a 1.2 second window, and anything typed inside a text field or while a dialog is open
is ignored. The `?` sheet is generated from the same registry as the matcher.
