# Quotes and invoices

Part 4 turns a deal's product lines into quotes and invoices, sends them through the
user's own mailbox, and records payments by hand. This document covers the model,
numbering, status rules, templates, the public page and printing.

## Model

One `documents` row is a quote or an invoice (`kind`). Shared child tables hold the
snapshot lines and the recorded payments:

- `documents`: kind, deal, template, optional source quote, `public_id`, number,
  title, rendered body, currency, subtotal/tax/total, status, customer fields and
  the status timestamps.
- `document_lines`: a snapshot of the deal's product lines at creation (or on
  "Refresh from deal" while the document is a draft). Later deal edits never change
  an issued document.
- `document_payments`: hand-recorded payments against an invoice.
- `document_templates`: body and terms per kind, with one default per kind.
- `document_settings`: a single row (`id = true`) with the number prefixes, the
  quote validity and invoice due windows, the company block, payment instructions
  and the footer.
- `document_counters`: `(kind, year)` to `last_number`, the only number source.

Money uses `src/features/currency/money.ts` on integer minor units with per-line
rounding; stored totals are `numeric(14,2)` strings. `public_id` is 18 random
bytes as base64url (24 characters), never the sequential number.

## Numbering

Numbers are assigned when a document is issued, not when it is created:

```
{prefix}-{YYYY}-{NNNN}      Q-2026-0007, INV-2026-12345
```

The year is the issue date's UTC year and the prefix comes from
`document_settings` (`Q` and `INV` by default). Issue locks the row and takes the
next value with a single

```sql
INSERT INTO document_counters (kind, year, last_number) VALUES ($1, $2, 1)
ON CONFLICT (kind, year) DO UPDATE SET last_number = document_counters.last_number + 1
RETURNING last_number
```

inside the same transaction, so concurrent issues cannot duplicate a number, and a
draft never consumes one.

## Statuses and transitions

```
draft -> sent (issue or mark sent)
sent -> viewed (quote) | viewed (invoice keeps sent)
sent|viewed -> accepted | declined (quote)
sent -> overdue (daily job) ; paid <-> sent (payment add/delete)
sent|overdue -> void (invoice only)
```

Rules (`src/features/documents/transitions.ts`, pure and unit-tested):

- `issue` and `markSent` only move a draft and both assign the number if missing.
- A quote can be accepted or declined once, from sent or viewed.
- An invoice's view records `viewed_at` without changing the status.
- `paid` is reached when payments reach the total; deleting a payment returns the
  invoice to `sent`, or `overdue` when the due date has passed.
- Drafts are deleted, not voided. Issued invoices are never deleted (`E_DOC_008`);
  an issued quote is refused with `E_DOC_003`.
- Expiry is derived, not a status: a sent or viewed quote whose `valid_until` is
  before today (UTC) is expired and cannot be accepted or declined (`E_DOC_004`).

## Templates and variables

Templates are markdown-lite (headings `#`/`##`, `-` lists, `---`, paragraphs, and
`{{products}}` on its own line for the lines table). `**bold**` is the only inline
format. Rendering is React elements only; a template never injects HTML.

Variables are `{{ key }}` with spaces allowed. They render in two passes: creation
fills everything except `document.*`, and the display pass fills `document.*`
(number, totals and dates can still change until issue). Unknown keys render as
empty text, and `{{products}}` is left for the block renderer.

| Variable | Value |
|---|---|
| `deal.title`, `deal.value` | the deal |
| `person.name`, `person.first_name` | the linked person |
| `organization.name` | the linked organization |
| `owner.name`, `owner.email` | the deal owner |
| `company.name` | `document_settings.company_name`, falling back to the owner |
| `document.title`, `document.number`, `document.total` | display time |
| `document.valid_until`, `document.due_date`, `document.issue_date` | display time, long en-GB |

A kind with no template gets the shipped default on first list, so a new install
can create a document immediately. Deleting the last template of a kind is refused
(`E_DOC_012`).

## Permissions

- `documents.manage` (admin by default, high risk) is required to change the
  settings, templates and defaults.
- Creating, editing, issuing, sending, duplicating, voiding and recording payments
  require edit rights on the deal.
- Reading follows deal visibility, so a document of a deal the user cannot see is a
  missing document (`E_DOC_001`).

## Public page and rate limit

`/d/{publicId}` needs no session. It shows the company block, dates, customer,
body and lines, totals, and for invoices the payment instructions and footer. A
draft or void document, or a quote of a soft-deleted deal, is a 404; an issued
invoice of a soft-deleted deal stays visible (the customer may still owe it).

The first view is recorded once: a sent quote becomes `viewed`, an invoice gains
`viewed_at`. Accept and decline are `POST /api/public/documents/{publicId}/accept`
and `/decline`; both check the request origin, cap the body at 16 KB, validate
with Zod and record the client IP (first `x-forwarded-for` entry). The limiter is
a fixed 30 requests a minute per IP and per `publicId` (`E_DOC_010`).

The owner is notified (`document_viewed`, `document_accepted`,
`document_declined`) after the action commits; delivery is best-effort and never
fails the public request.

## Payments and the overdue job

Payments are recorded by hand with an amount, a paid date, a method
(bank transfer, card, cash, other) and an optional reference. An overpayment is
refused (`E_DOC_007`) and the row is locked while the outstanding amount is
computed.

The `documents.overdue` job runs at 06:00 UTC and marks only `sent` invoices whose
`due_date` is before the UTC date:

```sql
UPDATE documents SET status = 'overdue', updated_at = now()
WHERE kind = 'invoice' AND status = 'sent'
  AND due_date < (now() at time zone 'utc')::date
```

## Sending

Sending reuses the inbox composer's path (`sendEmail`), so the message passes the
mailbox ownership check, goes through the outbox and lands on the deal timeline.
The email carries the public link, not a PDF attachment. A draft is issued before
the send; a mail failure leaves the document issued and returns the mail error. A
missing customer email is `E_DOC_005`, a missing connected mailbox `E_DOC_006`.

## Printing

The public page and `/documents/{id}/print` render the same `DocumentView`, so the
customer's PDF and the preview cannot differ. "Download PDF" calls
`window.print()`; `globals.css` sets `@page { size: A4; margin: 18mm }`, hides
`[data-print-hide]` (the app chrome, action bars and buttons), prints black on
white and draws table borders with the `--border` token.

## Tests

- Unit: markdown-lite parsing, inline bold, variable rendering, the transition
  table (allowed and refused) and number formatting.
- Integration (`pnpm exec vitest run --project integration src/features/documents`):
  creation snapshots and totals, EUR deals, issue concurrency and numbering,
  payments and the overdue job, sending through the fake IMAP transport, the public
  view/accept/decline rules, the rate limit and the owner notifications.

The demo seed (`pnpm db:seed:demo`) creates the document settings, both default
templates and seven documents on deals with lines: a draft quote, a sent quote, an
accepted quote with an invoice built from it, a sent invoice due soon, an overdue
invoice and a paid invoice with two payments.
