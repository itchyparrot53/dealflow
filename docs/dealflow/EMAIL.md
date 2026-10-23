# Email system: one renderer, editable copy

Part 13 routes every outbound email through `src/features/email-design/`. Product email keeps the
Dealflow identity; customer email uses the company design from Settings › Email design. No sender
builds HTML and no template is edited in code.

## The renderer

| File | Responsibility |
|---|---|
| `layout.ts` | Table-based, inline-styled, 600 px HTML with an Outlook (MSO/VML) wrapper, a plain-text alternative, a hidden preheader, a summary card, a button with a fallback link, and the 90 KB guard (product throws `E_EMAIL_DESIGN_001`, customer warns and sends). |
| `tokens.ts` | Colour and type tokens, the Dealflow design (`#2D8548`, logo `/brand/email-logo@2x.png` at 160x33), and the `EmailDesign` view shape. |
| `variables.ts` | `{{name}}` substitution: escaped in HTML mode, raw in text mode, unknown tokens empty; `stripHeaderBreaks` for subjects. |
| `registry.ts` | The 10 keys, their default copy, variables with samples, CTA URL variables, summary rows and audience. |
| `templates.ts` | Resolves an override or the default, saves (sanitises the body), resets, lists. An override replaces every field. |
| `sendSystemEmail.ts` | The one send entry point: resolve, render variables, render the layout, send through the system mailer, add `List-Unsubscribe` for notifications, pass attachments. |
| `design.ts` | The company design singleton, the logo upload/remove (magic-byte sniff, 256 KB and 2000 px limits) and `getEmailLogo` for the public route. |
| `wrapCustomerEmail.ts` | Wraps a customer body once, using the design's new/reply layout or the per-message choice; the `data-df-layout` marker makes a second pass a no-op. |

## The registry

| Key | Family | Audience | Sender (trigger unchanged) | Current subject |
|---|---|---|---|---|
| `sign_in_link` | product | Your team | magic-link route | `Your Dealflow sign-in link` |
| `invite` | product | Your team | invite action | `{inviter} invited you to Dealflow` |
| `notification` | product | Your team | notification email job | per type (`Deal won!`, `Reminder: ...`) |
| `backup_failed` | product | Your team | backup job, to active admins | `Dealflow backup failed` |
| `webhook_disabled` | product | Your team | webhook auto-disable | `A Dealflow webhook was disabled` |
| `booking_confirmed` | customer | Customers | `bookSlot` | `Booked: {title} with {host}` |
| `booking_cancelled` | customer | Customers | cancel flow (guest) | `Cancelled: {title} with {host}` |
| `quote_sent` | customer | Customers | document send | `Quote {number} from {company}` |
| `invoice_sent` | customer | Customers | document send | `Invoice {number} from {company}` |
| `customer_message` | customer | Customers | composer, reply, automation, documents | the author's subject |

The composer and reply path uses `customer_message`, which is not editable in the Templates tab. A
new email resolves `design.newEmailLayout`; a reply resolves `design.replyLayout`; documents and
automations wrap before the mailbox path; `plain` sends the author HTML unchanged.

## Variables and overrides

- Common variables: `company.name`, `app.url`, `recipient.name`, `recipient.email`. Each key adds the
  values it needs (`link.url`, `notification.line`, `document.total`, `booking.when`, and so on).
- HTML mode escapes every value, so a contact name cannot inject markup. Subjects and preheaders run
  through `stripHeaderBreaks` (CR, LF and other control characters removed, then cut to 200/140).
- An override is a full replacement: clearing the preheader clears it. Reset deletes the row and
  restores the default. Button URLs never come from the edit form; they are structural.

## Security

- Template bodies and composer HTML go through `sanitizeAuthorHtml` before rendering; layout
  variables are escaped, never interpolated raw.
- The logo route (`/email-assets/logo/{hash}.{png|jpg}`) matches the stored hash and serves the
  stored bytes and type for that hash only. It never reads a path from the request, and it still
  serves the logo when the public rate limit is hit.
- Preview iframes use `sandbox=""` and `srcdoc`, so no script can run.
- Saves are admin only, CSRF-checked, Zod-validated and audited (`email_design.updated`,
  `email_template.updated`, target type `settings`). Test sends go only to the signed-in admin.
- No email content or variable values are logged. The notification email carries a
  `List-Unsubscribe` header.

## Testing and gallery

- Unit: variable escaping and header stripping, layout contracts, contrast, image sniffing, the
  registry defaults rendering under 90 KB with no tokens left, wrap resolution, the editor.
- Integration: design save/upload/logo route/fetch, non-admin refusals, accent contrast, template
  override/reset and length limits, `sendSystemEmail` with capture mail, and the send path wrap with
  the signature and tracking inside the layout.
- E2E `e2e/17-email.spec.ts`: sign-in link, invite template edit/reset, branding with a logo and
  accent, reply minimal, quote summary and button, preview parity, contrast guard.
- Gallery: `pnpm email:gallery` renders 13 emails at 600 and 375 px (26 PNGs) into
  `e2e/screenshots/email/`, each under 90 KB. It serves `public/` on a temporary port so the logo
  loads without a running app.

## Adding a template

1. Add the key and default copy to `registry.ts` (subject, preheader, body, CTA label, variables
   with samples). Keep button URLs in code as a `cta.urlVariable`.
2. Call `sendSystemEmail` (product) or `wrapCustomerEmail` (customer) from the existing sender; do
   not build HTML.
3. Add the key to the tests' loops: the registry test and the gallery render every key, so a missing
   variable or an oversized email fails fast.

## Not wrapped

Inbound mail, a body that already carries `data-df-layout`, a `plain` send, and the `.ics`
attachment payload.

## Reused building blocks

`sanitizeAuthorHtml`, `RichTextBody` (TipTap 3.27.1) for the composer and both email editors,
`formatMoney(..., 2)` for document totals, `formatCalendarDate` for document dates, the system
mailer's three modes, and `SendPayload.text` for the plain-text alternative.
