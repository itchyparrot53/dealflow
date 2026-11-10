# Campaigns: reuse map and design note

Part 14 (`dealflow-wd-p14-v1`), Task 0.2. This note names the existing code each contract in
`PLAN-PART14.md` section 6 plugs into, before any of it is written. Every row gives the file and
the exact function or type. "Mismatch" marks a place where the code differs from the plan's
wording; each mismatch is also a Decision line in `PROGRESS.md`.

## How to read this

- **Existing API**: what already ships and is reused unchanged.
- **New**: created by Part 14, listed so the boundary between reuse and new code is explicit.
- Everything new lives in `src/features/campaigns/` and `src/features/marketing/`, plus the new
  schema files, routes and settings page named in the plan's section 5.

## 1. Permissions (6.1)

- `src/constants/permissionFlags.ts`
  - `GLOBAL_FLAGS` holds the unscoped flags (`documents.manage`, `forms.manage`, ...). The four
    campaign flags are appended here.
  - `ALL_PERMISSION_FLAG_KEYS` is derived, so adding to `GLOBAL_FLAGS` widens the stored flag map.
  - `REGULAR_DEFAULT_FLAGS` is built from the `REGULAR_TRUE` set, `ADMIN_DEFAULT_FLAGS` turns
    everything on. `campaigns.view` joins `REGULAR_TRUE`; the other three stay off by default.
- `src/features/permissions/actions-meta.ts`: `GlobalAction` is a hand-maintained union that
  duplicates `GLOBAL_FLAGS`, and `Action` is built from it. The same four names go into both files.
  Mismatch: one flag name can exist in one list and not the other, so the permission tests must
  assert both.
- `src/features/permissions/can.ts`: `can(user: PermSetUser, action: Action, record?)`. It already
  returns true for `user.type === "admin"`, so the "Admin true" column needs no code.
- `src/server/hydrateActor.ts`: `hydrateActor(db, userId, signal): Promise<HydratedActor | null>`
  rebuilds an actor (flags, groups, teams) from a user id with no cookies. This is what the send
  path uses to evaluate the segment as `send_as_user_id`.
- `src/features/auth/seed.ts` seeds the Regular and Admin permission sets from the defaults above,
  and `src/features/permissions/can.test.ts` covers the mapping. Both need the new flags.

## 2. Marketing status, consent and suppression (6.2)

- New: `src/db/schema/marketing.ts` (`person_marketing`, `consent_events`, `marketing_suppressions`,
  `marketing_tokens`), exported from `src/db/schema/index.ts`, plus the campaign tables in
  `src/db/schema/campaigns.ts`.
- Domain events: `emitDomainEvent(db, ev: DomainEventDraft, signal)` in `src/features/events/emit.ts`.
  It must run inside the same transaction as the mutation (it takes `DbOrTx`), which is exactly what
  6.2 requires. Add `person.marketing_status_changed` to `DOMAIN_EVENT_TYPES` in
  `src/features/events/types.ts`; `src/features/events/dispatcher.ts` only routes known triggers, so
  no dispatcher change is needed unless an automation trigger is added.
- Timeline: `recordChange(db, args, signal)` in `src/features/collaboration/changeLog.ts` is the
  append-only audit row, and it also maps field changes to domain events
  (`eventTypesForChange`). Campaign events write through it (see section 12).
- Errors: `src/constants/errorIds.ts`, new domains `E_MARKETING_*` and `E_CAMPAIGN_*`.

## 3. Double opt-in, unsubscribe, public pages (6.3)

- Registry: `src/features/email-design/registry.ts`
  - `EMAIL_TEMPLATE_KEYS` is a closed 10-key union; Part 14 adds `marketing_double_opt_in` and
    `campaign_sender_verification` here and their definitions in `EMAIL_TEMPLATES`.
  - `isTemplateKey` and `sampleVariables` are derived, so both keep working.
  - `src/features/branding/brand.test.ts` pins the visible copy of every key, so the new defaults
    need a line there.
- Sending: `sendSystemEmail(db, key, to, variables, signal, opts)` in
  `src/features/email-design/sendSystemEmail.ts`, which resolves the registry, renders, and calls
  `getSystemMailer()` from `src/features/mailer/systemMailer.ts`.
- Mail capture: `src/features/mailer/{systemMailer,captureMailer,smtpMailer,logMailer}.ts`. With
  `MAIL_FAKE=true`, `getSystemMailer()` returns the capture mailer, so the double opt-in and the
  sender verification are captured in tests for free.
- Public route layout: there is **no middleware and no public allow-list** in this codebase (a
  Decision from Part 13). Public pages are top-level app folders outside `(app)`: `/d`, `/f`,
  `/book`, `/email-assets/logo`. `/c`, `/u` and `/v` follow the same rule.
- Rate limiting: `checkRateLimit(name, headers)` in `src/server/rateLimitGuard.ts`, names in
  `src/constants/rateLimits.ts`. `emailTracking` (240 per minute) is the public, fail-open limiter
  the tracking pixel and the email logo already use; the campaign public routes reuse it.
- CSRF: `guardCsrf` in `src/features/identity/actions/shared.ts` is for authenticated server
  actions. The one-click unsubscribe POST is exempt by design (the token is the credential), so the
  new route must not import `guardCsrf` and the plan records that exemption in 6.3.
- Web forms: see section 6.

## 4. Content blocks and rendering (6.4)

- `src/features/email-design/tokens.ts`: `EMAIL_COLORS`, `EMAIL_FONT_STACK`, `EmailDesign`,
  `DEALFLOW_DESIGN`. Reused for colors and fonts.
- `src/features/email-design/variables.ts`: `escapeHtml`, `renderVariables(template, values, { mode })`,
  `stripHeaderBreaks`. The campaign personaliser wraps these and adds the `|fallback` form (new).
- `src/features/email-design/layout.ts`: `htmlToText(html)` is reused for the plain-text part.
  `renderEmail(RenderEmailInput)` is **not** reused: it is shaped for one-to-one wrapped email
  (family, layout, summary, CTA) while campaigns are full-width designed documents. The campaign
  renderer is new (`campaigns/blocks/render.ts`) and copies the MSO, VML and table patterns.
- `src/features/email-design/design.ts`: `getEmailDesign(db, signal): Promise<EmailDesignView>`
  supplies the logo URL path, accent color, display name, footer text and address flags.
- `src/features/email-design/imageSize.ts`: `imageSize(bytes): ImageInfo | null` is extended with
  GIF for campaign images (Task 2.2).
- New: `campaigns/blocks/{schema,render,plainText,starters,sanitizeMarketing,personalize}.ts`.

## 5. Campaign images (6.5)

- Storage: `src/features/files/storage.ts`
  - `makeStorageClient(): StorageClient` with `presignPost`, `headObject`, `presignGet`,
    `copyObject`, `deleteObject`, `getObjectBytes`, and optional `putObject`.
  - `src/features/files/storageFake.ts` is the in-memory fake used by integration tests.
  - `src/features/files/actions.ts` is the full presigned-POST handshake (init, confirm, copy to an
    immutable key). Campaign images are at most 1 MB, so 6.5 allows the simpler server action; the
    Decision in Task 2.2 records which one was chosen.
- Public route pattern: `src/app/email-assets/logo/[file]/route.ts` shows the shape to copy: exact
  regex on the file name, `checkRateLimit("emailTracking", ...)`, DB lookup, immutable cache header,
  404 without a row. Campaign assets add `/email-assets/c/{id}.{ext}` in the same folder style.
- Magic bytes: `imageSize.ts` and `src/features/identity/avatar/imageSniff.ts`.

## 6. Web forms (6.3, 6.12)

- `src/features/forms/fields.ts`: `FIXED_FIELD_KEYS` (`name`, `email`, `phone`, `organization`,
  `job_title`, `message`), `FormField`, `formFieldsSchema` (name and email are mandatory), and
  `ALLOWED_CUSTOM_FIELD_TYPES`. `marketing_consent` joins the fixed keys; its label is editable like
  the other fixed fields.
- `src/features/forms/submit.ts`: `loadPublicForm(db, publicId, signal)` and
  `submitForm(db, publicId, input, now, signal)`. The honeypot and spam-token branches return the
  silent outcome before writing, so the consent field changes nothing on the spam path (6.3).
- `src/features/forms/actions.ts` holds the authenticated CRUD actions; the public page and route
  live under `src/app/f/`.
- Editor: `src/features/forms/ui/`.

## 7. Notifications and alerts (6.8)

- `src/constants/notificationTypes.ts`: `NOTIFICATION_TYPES` is a closed union; `campaign_click`
  is appended.
- `src/constants/notificationDefaults.ts`: `DEFAULT_EMAIL_BY_TYPE` (email off for the new type) and
  `DEFAULT_PUSH_BY_TYPE` must gain a row each, or the `Record<NotificationType, boolean>` types fail
  to compile (which is the intended guard).
- `src/features/notifications/preferences.ts`: `getPreferences`, `setPreference` read the defaults
  above. `src/features/notifications/produce.ts` is the writer used by the click route.
- Delivery: `src/features/notifications/email/job.ts` (`registerEmailNotificationWorker`) and
  `src/features/push/job.ts` are unchanged; they consume the row the producer writes.

## 8. People bulk actions (6.12)

- `src/features/contacts/bulk/actions.ts`: `bulkContactAction(raw, csrfToken)` with a
  `.strict()` input of `{ entity, kind, ids, ownerId? }`, CSRF guard, `createContext` actor and a
  `ids` cap; `ContactBulkActionResult`.
- `src/features/contacts/bulk/bulk.ts`: `bulkChangeContactOwner`, `bulkDeleteContacts`, and the
  `ContactBulkFailure` shape.
- UI: `src/features/contacts/PeopleList.tsx` renders `BulkActionBar` and already calls
  `bulkContactAction`; the marketing bulk action adds a `kind` (or its own action) there.
- The 5,000 cap is a new constant, not the existing delete cap; the Decision in Task 1.5 records it.

## 9. CSV import (6.12)

- `src/features/import/importFields.ts`: `ENTITY_FIELDS.person` is the mappable list and
  `STANDARD_IMPORT_FIELDS` derives from it. "Marketing status" is added to the person list, so the
  mapping UI picks it up without a second list.
- `src/features/import/commit.ts`: `commitRow` writes each row; `commitHelpers.ts` holds the actor
  and visibility glue.
- Undo: `src/features/import/undoJob.ts` (`undoBatch`, `handleUndoJob`, `enqueueUndoJob`,
  `registerImportUndoWorker`) and `undoDelete.ts` (`undoOneRow`). A status change needs a recorded
  previous value on the batch so undo can revert it, the same way ownership and labels are handled.

## 10. Uploads, jobs and charts

- pg-boss: `src/server/worker.ts` has `registerAllJobs(boss)` (all handlers registered there) and
  `startWorker()`; producers use `getBoss()` from `src/jobs/boss.ts`; queue names and cron strings
  live in `src/constants/jobNames.ts`. New jobs: `campaign-send`, `campaign-start`, the sequence
  tick and the bounce mailbox poll, registered by a `registerCampaignJobs(boss)` call added to
  `registerAllJobs`.
- Worker entrypoint: `src/entrypoints/worker.ts` calls `startWorker()`; the e2e harness
  (`scripts/e2e/e2e-server.mjs`) spawns the same worker, so campaign jobs run in e2e without a
  fallback flag.
- Charts: `src/components/ui/chart.tsx`: `ChartContainer`, `ChartConfig`, `ChartSeries`,
  `ChartTooltip`, `ChartTooltipContent` (Recharts). Reports reuse it; no new chart library.

## 11. People list, filter field and detail (6.12)

- `src/features/contacts/contactFilterConfig.ts`: `PERSON_FILTER_CONFIG` (name, primaryEmail,
  ownerId, labels) and `ContactFilterConfig`. `marketing_status` is added as a person field in both
  the config (client metadata) and `PERSON_COLUMN_SQL` (server column map), with its operator set.
- `src/features/contacts/contactFilter.ts`: `compileContactFilter(def, PERSON_FILTER_CONFIG,
  PERSON_COLUMN_SQL)` compiles the AST, `personFilterSchema` validates it.
- `src/features/contacts/listPeople.ts`: `listPeople(db, actor, opts, signal)` is the list read and
  the pattern for "compile, then apply `canSee`".
- Detail page: `src/app/(app)/contacts/people/[personId]/PersonDetailView.tsx` (server load) and
  `PersonDetailClient.tsx` (client tabs), with `PersonSidebar` for the left column. The Marketing
  section goes into the sidebar/tab content, using the Part 12 primitives.
- Timeline read: see section 12.

## 12. Person timeline (6.8)

- `src/features/contacts/contactTimeline.ts`: `contactTimeline(db, actor, entityType, entityId,
  signal)` merges three reads: `listActivitiesForEntity` (`features/activities/forEntity.ts`),
  `listNotes` (`features/collaboration/notesRepo.ts`) and `listChangeLog`
  (`features/collaboration/changeLog.ts`) through `buildHistoryTimeline`
  (`features/deal-workspace/historyTimeline.ts`).
- `HistoryItem` (same file) has an `event` variant: `{ kind: "event", id, at, label, actorName }`,
  produced by `toChangeItem` from a `ChangeLogEntry`. So the campaign events that must appear on the
  contact History are written with `recordChange` on the person (field `campaign`), and `toChangeItem`
  gains the label cases ("Campaign sent: ...", "Opened ...", "Clicked ...", "Unsubscribed ...",
  "Bounced ..."). This is the "existing changelog or history mechanism" the plan leaves open, and
  the Decision in Task 3.4 records the choice.
- The tRPC read is `trpc.contacts.contactTimeline` in `src/features/contacts/router.ts`, consumed by
  `ContactTimelinePanel` in `src/app/(app)/contacts/contactDetail.shared.tsx`.

## 13. Filtering, segments and the visibility mismatch (6.1, 6.6)

This is the one place where the plan's wording and the code diverge, so it gets its own section.

- The plan says the segment is "evaluated by `filterAstSql`". In this codebase `filterAst.ts` and
  `filterAstSql.ts` are the **deal** filter compiler: the column map uses the `d.` alias and the
  field allow-list is deal-only. People filters are a separate engine:
  `contacts/contactFilter.ts:compileContactFilter` with `PERSON_FILTER_CONFIG` and
  `PERSON_COLUMN_SQL`, and their schemas already exist in `saved-filters/schemas.ts`
  (`SAVED_FILTER_TARGET_ENTITIES` includes `person`). Campaigns therefore use the contacts engine;
  no entity adapter is added to `filterAst`. Decision: 0.2.
- People visibility has no SQL clause. `listPeople` loads the non-deleted rows and filters in process
  with `canSee(actor, toVisibleRecord(row))` from `features/permissions/canSee.ts`. The campaign
  segment follows the same rule: the candidate query selects the visibility columns and the email,
  then `canSee` filters them, so preview and snapshot agree with the people list. At send time the
  snapshot hydrates the creator with `hydrateActor(db, campaign.sendAsUserId, signal)` and runs the
  same `canSee`. Decision: 0.2.
- Saved filter kinds: a campaign segment is `{ kind: "saved_filter", savedFilterId }` or
  `{ kind: "definition", definition }`. The saved row must have `targetEntity === "person"`; the
  list comes from `trpc.savedFilters.listByTarget`, and the stored definition is re-validated with
  `savedFilterDefinitionSchema("person")` before compiling, exactly like the people list.

## 14. Mail transport (6.7)

- `src/features/mailer/types.ts`: `SystemMailer` (`mode`, `send`), `src/features/mailer/systemMailer.ts`:
  `getSystemMailer()`, `src/features/mailer/smtpMailer.ts`: the SMTP implementation,
  `src/features/mailer/captureMailer.ts`: the `MAIL_FAKE` capture, `logMailer.ts`: the fallback.
- The campaign transport is new (`campaigns/send/transport.ts`) because it reads `MARKETING_SMTP_*`
  first and falls back to `SMTP_*`, and needs message headers plus optional DKIM. Under
  `MAIL_FAKE=true` it must capture through the same capture store (tagged `campaign`) so tests can
  read the wire copy. Env names go through `src/config/env.ts` (Zod) and `scripts/dealflow/env-sync.mjs`.
- Tracking pattern: `src/features/email/tracking.ts` (`mintTokensForSend`, `rewriteBody`,
  `recordOpen`, `recordClick`, `resolveClickTarget`, `disableTokens`) and its two routes show the
  "store the target, never trust the request" and "record best-effort" rules; campaigns get their
  own tables and routes (`/t/c/...`) and never change these.

## 15. Fakes and test hooks

- Mail: `MAIL_FAKE=true` plus `MAIL_CAPTURE_DIR` (`src/features/mailer/captureMailer.ts`),
  `setSystemMailerForTest` where a test needs a scripted sender.
- AI: `AI_FAKE=true` and `ScriptedAiProvider` (Part 12's JSON reliability work), so the subject
  suggestions in the Details step are deterministic in tests.
- Storage: `src/features/files/storageFake.ts`.
- DNS: an injected resolver for the domain check, never real network.
- Clock: inject `now` (the sequence scheduler and the send-window maths take it, like
  `submitForm(..., now, signal)` and the import job do).
- Jobs: the e2e harness runs the real worker; integration tests call the job handler directly.

## 16. Open questions resolved here

1. Person segment evaluation: contacts filter engine, not `filterAst` (Decision 0.2).
2. Person visibility: `canSee` in process, both at preview and at send (Decision 0.2).
3. Timeline mechanism: change log plus `HistoryItem.event`, not a new feed table (Decision 0.2).
4. Campaign transport: new module, reusing the capture and SMTP factories (Decision 0.2).
5. Public routes: top-level app folders, no allow-list to edit (Decision 0.2).

## 17. Architecture

The feature is split into two folders so the consent record stays independent of any one campaign:

- `src/features/marketing/` owns the person's marketing status, consent evidence, suppression,
  double opt-in, unsubscribe, marketing tokens and the person-facing Marketing panel.
- `src/features/campaigns/` owns senders, settings, assets, campaigns, blocks, the send engine,
  tracking, reports, insights, sequences and the campaign UI.

### Tables

| Table | Purpose |
|---|---|
| `campaign_senders` | Verified From name/address, default flag, verification token hash. |
| `campaign_settings` | Postal address, consent defaults, effective send rate, bounce run state. One row. |
| `campaign_assets` | Uploaded images, immutable object key, width/height, uploaded by. |
| `campaign_templates` | Saved builder documents that appear in the Templates view. |
| `campaigns` | Name, type, status, subject, preheader, sender, reply-to, segment, content JSON, schedule and totals cache. |
| `campaign_links` | Stable link index to destination URL, frozen before the first send. |
| `campaign_recipients` | One row per person/email per campaign, unique email hash, status, raw token and token hash. |
| `campaign_events` | Delivered, open, click, unsubscribe, bounce, complaint; carries recipient/person and link index. |
| `person_marketing` | Current status, consent basis, status-changed timestamp. |
| `consent_events` | Append-only transition history with source, basis, actor, IP/user agent when allowed. |
| `marketing_suppressions` | Email-hash suppression by reason (unsubscribed, hard bounce, complaint). |
| `marketing_tokens` | Hashed token to purpose/person/recipient; the raw token is never stored here. |
| `sequences` / `sequence_steps` | Automated campaign definition, entry/exit rules, send window, email or wait steps. |
| `sequence_enrollments` | Per-person position, status, lease, next run time. |
| `sequence_segment_members` | Membership memory for segment entry, so leaving and re-entering is explicit. |

Migrations are `0094_dealflow_campaigns.sql`, `0095_dealflow_campaign_import.sql`,
`0096_dealflow_campaign_send.sql`, `0097_dealflow_campaign_click.sql` and
`0098_dealflow_campaign_bounce_state.sql`.

### Send pipeline

1. `sendCampaignNowAction` / the schedule job calls `snapshotCampaign`. It evaluates the saved
   filter or inline definition with the contacts engine, applies `canSee` as the campaign creator,
   drops ineligible people, freezes the link templates, inserts `campaign_recipients` and sets the
   status to `sending`. The document and sender are read from the campaign at batch time.
2. `campaign.start` enqueues the first `campaign-send` tick. `runCampaignTick` claims a batch with
   `FOR UPDATE SKIP LOCKED`, sends through `send/batch.ts`, records `delivered` and enqueues the
   next tick when rows remain.
3. `send/batch.ts` renders the document with merge values, rewrites links to `/t/c/l/...`, appends
   the open pixel, adds the one-click `List-Unsubscribe` headers and the postal footer, attaches the
   inline logo, and sends through the campaign transport. Totals are refreshed after the batch.
4. The rate ceiling is `CAMPAIGN_SEND_RATE_PER_MINUTE`; the batch size is `CAMPAIGN_BATCH_SIZE`.
   A pause stops the next tick, a resume enqueues one, and a cancel stops the remaining rows.

The campaign transport (`send/transport.ts`) reads `MARKETING_SMTP_*` and falls back to `SMTP_*`.
It is separate from the system mailer because campaign mail needs per-message headers and optional
DKIM. Under `MAIL_FAKE=true` it writes the wire copy to the capture store, tagged with the campaign
id in `X-Dealflow-Campaign`, so tests and the e2e spec read the exact MIME parts.

### Tracking and public routes

| Route | Behaviour |
|---|---|
| `GET /t/c/o/{token}.gif` | Records an open (human or proxy by user agent), returns a 1x1 GIF. |
| `GET /t/c/l/{token}/{n}` | Records a click and returns a 302 to the stored destination; the destination is never read from the request. |
| `GET /u/{token}` | Preference page: confirm unsubscribe, choose categories. |
| `POST /u/{token}/one-click` | RFC 8058 one-click unsubscribe; the token is the credential, so CSRF is intentionally not required. |
| `GET /c/{token}` | Double opt-in confirmation page; the POST confirms. |
| `GET /v/{token}` | Web version of a sent campaign. |

`marketing_tokens` stores only the SHA-256 hash. `campaign_recipients.token` keeps the raw token
because the send path needs it to build the URLs (Decision in Task 0.2/3.3). Opens and clicks write
`campaign_events`, `change_logs` (field `campaign_event`) for the person timeline and refresh the
`campaigns.totals` cache.

### Sequences

Each email step owns a hidden campaign, so step sends reuse the same sender, footer, tracking,
unsubscribe and suppression rules. `registerSequenceJobs` schedules a one-minute tick and a
fifteen-minute segment scan. `processEnrollment` claims due rows with a lease
(`FOR UPDATE SKIP LOCKED`), evaluates the send window in the sequence's time zone with
`Intl.DateTimeFormat`, sends the step and advances the position. Exits (deal won, replied, optional
filter) and optional segment entry are evaluated in the same tick. Hidden campaigns are excluded
from the campaign list and from the campaign comparison; the Automated insights read them per step.

### Reports and insights

`reports.ts` computes the report from SQL aggregates over `campaign_events` and
`campaign_recipients`: summary, hourly/daily series, links and recipients. Human opens are the
default; the machine-open toggle includes proxy/scanner opens. The recipients table is capped at
2,000 rows in the view and the CSV exports the full list, both gated by `campaigns.view` and
`data.export`. `insights.ts` compares campaigns (type, sender, date range) and sequence steps; the
average is the unweighted mean of each campaign's own rate and the arrows appear only beyond 10%
relative difference.

### Permissions and visibility

`campaigns.view`, `campaigns.edit`, `campaigns.send` and `marketing.manage` are global flags.
`campaigns.view` is on for Regular users; the other three are off by default and can be granted
through a permission set. `marketing.manage` also governs the person's consent changes and the
sending settings. The send path
hydrates `send_as_user_id` with `hydrateActor` and applies the same `canSee` as the people list, so
the preview and the snapshot never disagree about who can be mailed.

## 18. Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `MARKETING_SMTP_HOST` | empty | Campaign SMTP host. Empty falls back to `SMTP_*`. |
| `MARKETING_SMTP_PORT` | `465` | Campaign SMTP port. |
| `MARKETING_SMTP_SECURE` | `true` | TLS for the campaign SMTP connection. |
| `MARKETING_SMTP_USER` / `MARKETING_SMTP_PASS` | empty | Campaign SMTP credentials. |
| `CAMPAIGN_SEND_RATE_PER_MINUTE` | `60` | Hard ceiling. Settings can lower it, never raise it. |
| `CAMPAIGN_BATCH_SIZE` | `50` | Recipients per send tick. |
| `CAMPAIGN_DOI_DAILY_LIMIT` | `500` | Confirmation emails per UTC day across the install. |
| `CAMPAIGN_DKIM_DOMAIN` | empty | DKIM signing domain. |
| `CAMPAIGN_DKIM_SELECTOR` | empty | DKIM selector. |
| `CAMPAIGN_DKIM_PRIVATE_KEY` | empty | Inline private key. |
| `CAMPAIGN_DKIM_PRIVATE_KEY_FILE` | empty | Path to the private key, used when the inline value is empty. |
| `CAMPAIGN_BOUNCE_IMAP_HOST` | empty | Bounce mailbox host. All four bounce values are required to enable the job. |
| `CAMPAIGN_BOUNCE_IMAP_PORT` | `993` | Bounce mailbox port; secure for 993. |
| `CAMPAIGN_BOUNCE_IMAP_USER` / `CAMPAIGN_BOUNCE_IMAP_PASS` | empty | Bounce mailbox credentials. |

DKIM signing switches on only when the domain, selector and one key field are all set. The postal
address, senders and consent defaults are settings in the database, not env vars. Env changes need a
restart of `app` and `worker`.

## 19. Deliverability

- **SPF**: publish the sending provider's include or IP ranges for the campaign sending domain.
- **DKIM**: publish the provider's selector, or Dealflow's `CAMPAIGN_DKIM_SELECTOR` when signing in
  the app. Set the domain, selector and key together.
- **DMARC**: start with `p=none` and a reporting address, read the aggregate reports, then move to
  `p=quarantine` and `p=reject` when every legitimate source aligns.
- **Bulk SMTP provider**: set `MARKETING_SMTP_*` to a provider that supports the volume and has a
  feedback loop. Do not send campaigns from a personal mailbox.
- **Bounce mailbox**: set all four `CAMPAIGN_BOUNCE_IMAP_*` values. The ten-minute job reads DSNs
  and ARF reports, marks hard bounces as `bounced`, and records complaints. A partly set mailbox
  disables the job rather than failing worker boot.
- **Warm-up**: start with engaged contacts and a low rate, then increase over several days.
- **List hygiene**: keep consent evidence, honour one-click unsubscribes immediately, and never
  re-add an address that is suppressed without a new, recorded consent event.

The **Domain check** in Settings uses an injected DNS resolver in tests and never calls a real
resolver there. It reports SPF, DKIM and DMARC status separately.

## 20. Operations and verification

- Jobs are registered in `src/server/worker.ts` by `registerCampaignJobs(boss)` and
  `registerSequenceJobs(boss)`; the worker entrypoint is the same one the compose stack runs.
- Backups include the campaign and marketing tables, so a restore keeps consent history and
  suppressions. The smoke backup round trip covers them.
- Unit tests cover the pure pieces: blocks, checklist, domain parsing, DKIM, headers, links, rates,
  segment compilation and sequence time maths.
- Integration tests cover the real Postgres paths: send, tracking routes, bounce mailbox, reports,
  CSV, insights, sequences, assets, senders, settings and the marketing transitions.
- `e2e/18-campaigns.spec.ts` covers settings and sender verification, consent and double opt-in,
  a full campaign send with test send and scheduling of the capture, tracking and report, one-click
  unsubscribe and duplication, a sequence send, and the 16-screen gallery.
- `scripts/seed-demo-campaigns.ts` seeds the demo dataset: 60% consent, two senders, two sent
  campaigns with events, a scheduled campaign, a draft, an active three-step sequence with twelve
  enrollments, and the five `Campaign E2E` people used by the spec.
