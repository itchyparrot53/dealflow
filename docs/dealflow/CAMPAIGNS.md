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
