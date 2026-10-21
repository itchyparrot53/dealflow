# Booking pages

A booking page is a public `/book/{publicId}` link that offers a host's free times. Every signed-in
user manages their own page under Settings > Booking pages; an admin sees every page and its host.
Booking pages and the cancel link may be framed by any site, and every page carries a "Powered by
Dealflow" footer.

## Availability

Each page has seven weekday rows with up to three from/to ranges in 15-minute steps (for example
Monday 09:00 to 17:00 with a lunch break). A closed day has no ranges. The default is Monday to
Friday 09:00 to 17:00 with an empty weekend. Ranges must have `from < to` and must not overlap.

Page settings: duration 15 to 240 minutes (default 30), buffer 0 to 120 minutes (default 0),
minimum notice 0 to 168 hours (default 4), days ahead 1 to 90 (default 30), a location and the
activity type written on the host's calendar (the first type named "meeting" by default).

## Slot rules

For each date in the requested window (at most 14 days), each availability range yields starts every
`duration` while `start + duration` still fits, converted from the page zone to UTC. A start is
dropped when it is earlier than `now + minNoticeHours` or later than `now + daysAhead` days, and when
`[start - buffer, start + duration + buffer)` overlaps any busy interval. The result is sorted,
de-duplicated UTC ISO strings.

## Busy time

Busy time is the host's open, non-deleted, non-all-day activities that overlap the window. An
activity's span is `end_at` when set, else `due_at + duration_minutes`, else 30 minutes. All-day
activities never block a slot. The host is the activity's assignee (upstream `assignee_id` is NOT
NULL, so there is no owner fallback).

## Time zones and DST

Time zones use `Intl` only. The effective page zone is the host's profile time zone when set and
valid, else the page's own zone. Times that do not exist (spring forward) resolve forward by the
gap; times that happen twice (fall back) take the first occurrence. A 09:00 local slot stays 09:00
local across a DST change, which the unit tests pin for London and New York.

## Booking

The visitor picks a date and time and gives a name, an email and an optional note. The write takes
an advisory lock per host (`pg_advisory_xact_lock(hashtext('booking:' || host_id))`), recomputes the
day's slots and refuses a start that is no longer free with 409 `E_BOOKING_002`. Then, as the host,
it finds or creates the person, creates the activity (subject `{page title} with {name}`, the page's
type, `due_at` to `end_at`, the host as owner and assignee), inserts the booking and emits
`booking.created`.

After commit the host gets a `booking_created` notification and the visitor gets one email with the
time in the page zone, the location and a cancel link. A mail failure is logged and does not undo
the booking. The confirmation page shows the booked time in the visitor's own zone and offers the
same `.ics` bytes as an "Add to calendar" download; the system mailer does not take attachments, so
nothing is attached to the email.

Ten booking requests a minute per client IP are allowed; over that the route answers 429.

## Cancel

The emailed link is `/book/cancel/{token}`. Only the SHA-256 hash of a 24-byte random token is
stored, so a database read cannot cancel a booking. The page shows the booking and one button; the
post finds the booking by hash with status `booked`, marks it `cancelled`, soft-deletes the activity,
emits `booking.cancelled` and notifies the host. A second use of the link is refused with
`E_BOOKING_005` (404 on the route).

## `.ics`

`buildIcs` returns an RFC 5545 VCALENDAR with one VEVENT: UTC times, CRLF endings, 75-octet line
folding, and escaped commas, semicolons, backslashes and newlines. The unit test pins an exact
string.

## Events

- `booking.created`: entity is the activity; payload carries the booking, the page title, the host
  and the visitor.
- `booking.cancelled`: entity is the booking's person, else the activity; same payload shape.
- Conditions on either event evaluate against the visitor's person.

Automations can trigger on both with no filter, and webhooks receive both under "Forms and booking".
