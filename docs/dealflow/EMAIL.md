# Outbound email inventory

Task 0.2 of Part 13. Every place Dealflow sends email, what it says today, and which registry key it
will use. Produced by reading the senders named in section 4 and grepping
`getSystemMailer|sendSystem|sendEmail(|sendDocument(` in `src`; no runtime was used.

## System and customer senders

| Key | Family | Sent by | Trigger (unchanged) | Recipients | Current subject | Current HTML source |
|---|---|---|---|---|---|---|
| `sign_in_link` | product | `src/app/auth/magic-link/route.ts` POST -> `requestMagicLink` (`features/auth/magicLink.ts`) | a sign-in link request | the address in the form, only when the account exists; the route answers the same either way | `Your Dealflow sign-in link` | `magicLinkMail` in `src/features/mailer/templates.ts`: brand header image, two paragraphs, the link as an anchor |
| `invite` | product | `src/features/identity/actions/invite.ts` `inviteUserAction` | an admin invites a user | the invited address | `{inviterName} invited you to Dealflow` | `inviteMail` in `mailer/templates.ts`: brand header, two paragraphs, the link |
| `notification` | product | `src/features/notifications/email/job.ts` `runEmailNotificationJob` | a notification row with email enabled | the notification's user; visibility and the email preference are rechecked at send time | per type from `renderNotificationEmail` (`Somebody mentioned you in Dealflow`, `Deal won!`, `Task assigned: {task}`, ...) | `notifications/email/render.ts` `wrap()`: brand header, one escaped line, a link labelled `Open in Dealflow` |
| `backup_failed` | product | `src/features/backups/backup.ts` `notifyFailure` | a scheduled backup fails | every active admin | `Dealflow backup failed` | brand header plus `<p>The scheduled backup failed:</p><pre>{detail}</pre>`; `detail` is interpolated raw |
| `webhook_disabled` | product | `src/features/webhooks/deliver.ts` `disableSubscription` | a webhook is auto-disabled after repeated failures | the subscription creator | `A Dealflow webhook was disabled` | brand header plus paragraphs with `user.name` and `reason` interpolated raw |
| `booking_confirmed` | customer | `src/features/scheduling/booking.ts` `bookSlot` -> `sendVisitorEmail` | a guest books a slot | the guest's address | `Booked: {page.title} with {host.name}` | brand header plus `<pre>{escaped text}</pre>`; the text carries the when, duration, location and cancel URL. No `.ics` attachment today |
| `booking_cancelled` | customer | **missing** (`src/features/scheduling/cancel.ts` notifies the host only) | a guest cancels | the guest, once implemented | will be `Cancelled: {booking.title} with {host.name}` | none today; the host gets the `notification` key |
| `quote_sent` | customer | `src/features/documents/send.ts` `sendDocument` -> `composeMail` | Send on a quote | the document's customer email | `Quote {number} from {companyName}` | plain text turned into paragraphs by `toBodyHtml`, with `View it here: {publicUrl}` and the owner's name |
| `invoice_sent` | customer | same | Send on an invoice | the document's customer email | `Invoice {number} from {companyName}` | same as the quote |
| `customer_message` | customer | `src/features/email/send.ts` `sendEmail` (composer, reply, scheduled, automation, documents) | a user or automation sends an email | the To/Cc/Bcc the user chose | the user's subject, after merge fields | sanitized author HTML, then tracking rewrites and the signature (`sendHelpers.ts`); no layout |

## Current HTML builders outside `src/features/email-design/`

These are the files Task 2.1 and 2.2 must drain. The final checklist greps for them.

| File | Builds | Registry key |
|---|---|---|
| `src/features/mailer/templates.ts` | magic link and invite fragments, and `linkParagraph` | `sign_in_link`, `invite` |
| `src/features/mailer/branding.ts` | `emailBrandHeaderHtml` / `emailBrandHeaderText` | product families |
| `src/features/notifications/email/render.ts` | notification HTML and its `Open in Dealflow` link | `notification` |
| `src/features/scheduling/booking.ts` `sendVisitorEmail` | booking confirmation `<pre>` block | `booking_confirmed` |
| `src/features/backups/backup.ts` `notifyFailure` | backup failure paragraphs | `backup_failed` |
| `src/features/webhooks/deliver.ts` `disableSubscription` | webhook disabled paragraphs | `webhook_disabled` |
| `src/features/documents/send.ts` `toBodyHtml` | quote and invoice body paragraphs | `quote_sent`, `invoice_sent` |

## The customer send path and where the wrap goes

`sendEmail` (`src/features/email/send.ts`) does, in order: merge fields, `sanitizeAuthorHtml`,
`enqueueSend` (the payload row holds the sanitized HTML), `applyTrackingAndSignature` (rewrites links,
mints the open token, appends the signature, and persists the result back into the payload row), an
early return for a future scheduled send after that preparation, then `processSendAttempt` and
`storeOutboundCopy` with the prepared body. The MIME builder already accepts an optional text part
(`SendPayload.text`, passed through in `outbox.ts`), so the layout's text output belongs in the
payload next to the HTML.

The wrap point is therefore inside/after `applyTrackingAndSignature`, before the scheduled early
return: the stored payload and the Sent/CRM copy then hold exactly what went on the wire, a scheduled
send is wrapped once, and the `data-df-layout` marker makes a second pass a no-op. Documents wrap
before calling `sendEmail` (they add the summary and button themselves, as 6.6 requires), and
automations wrap in their action; the marker guard keeps the generic path from wrapping either again.

## What differs from the plan's assumptions

- **`booking_cancelled` has no sender.** The cancel flow (`scheduling/cancel.ts`) soft-deletes the
  activity, emits `booking.cancelled` and notifies the host, but emails the guest nothing. Part 13
  adds the guest email in Task 2.2 through the registry, on the same trigger and to the same
  recipient the flow already has; it is the listed template, not a new email type.
- **The booking confirmation has no calendar attachment.** The `.ics` is built and returned to the
  HTTP caller, never attached. Task 2.2 adds it through the `SystemMail.attachments` support 6.4
  requires, so the template's "A calendar invite is attached." is true.
- **There is no HTML-to-text helper.** No `plainTextBody`, `htmlToText` or equivalent exists. Per
  section 10 the builder writes a small converter in `layout.ts` with tests and reuses it for the
  text part; the inventory records that rather than inventing a path.
- **Notification CTAs are all `Open in Dealflow`.** The per-type labels in 6.4 (`Open deal`,
  `Open activity`, `Open quote`, `Open conversation`, `Open form`, `Open booking`, or
  `Open Dealflow`) do not exist yet; Task 2.1 derives the label from the same `NotificationRow`
  switch in `render.ts` and passes it as `notification.cta`.
- **Two current senders interpolate unescaped values into HTML.** `backup_failed` puts the failure
  detail into `<pre>` and `webhook_disabled` puts `user.name` and the reason into paragraphs without
  escaping. The new renderer escapes every variable, so Task 2.1 closes this while it moves the copy.
- **Document subjects and messages are code defaults,** not editable templates. Task 2.3 resolves
  `quote_sent` and `invoice_sent` from the registry and pre-fills the dialog, keeping spec 08's labels.
- **There is no notification digest.** The email job sends exactly one message per notification row
  and the enqueue path creates one job per row, so no `notification_digest` key is needed.

## Not wrapped (6.3)

Inbound mail, mail that already carries a `data-df-layout` marker, a send whose layout resolves to
`plain`, and the `.ics` attachment payload.

## Reused building blocks

`sanitizeAuthorHtml` for every authored or variable-rendered body, `RichTextBody` (TipTap 3.27.1) for
the composer and the document send dialog, `formatMoney(..., 2)` for document totals, `formatCalendarDate`
for document dates, `SystemMailer` and its three modes, and `SendPayload.text` for the plain-text
alternative.
