# Upstream tracking: Dealflow on warpdrive

## Remotes and branches

- `upstream` = `https://github.com/sneg55/warpdrive.git` (read-only source of future fixes)
- `origin` = none. This checkout is the Dealflow repository; nothing is pushed anywhere.
- Our branch: `main`
- Snapshot base: tag `v1.2.0` (commit `d15389f`, "Release 2026-10-02 (veodyn b130b752)"). The step 3
  probe in Task 0.1 compared `v1.2.0` with `upstream/main` and both produced the same diff, because
  `upstream/main` points at the same commit; the tag was chosen because it matches `package.json`
  version `1.2.0`.

## Bringing an upstream fix over

```bash
git fetch upstream --tags
git cherry-pick -x <sha>        # -x records the upstream sha in the commit message
```

If the cherry-pick conflicts, resolve in favour of our Dealflow contracts (PLAN-PART1.md section 6),
then run `pnpm typecheck && pnpm lint && pnpm test:unit`. Never rewrite `main`: our snapshot is the
root commit and every Dealflow task is its own commit on top.

## Migrations

Our migrations are named `00NN_dealflow_<topic>.sql` (`0075_dealflow_auth`, `0076_dealflow_ai` in
Part 1). Upstream numbers its own sequence. When an upstream migration arrives, regenerate it with
the next free number instead of reusing the upstream filename, so the journal stays monotonic.

## Upstream files we changed

Keep this list current: it is the conflict surface for every future cherry-pick.

- `deployWorkflow.test.ts` (deleted): it asserts `.github/workflows/deploy.yml`, which the OSS export
  does not contain and which we do not use (Task 0.3).
- `Dockerfile.test.ts` (changed): the workflow read and the "passed as a build arg by the deploy
  workflow" test were removed for the same reason; the three Dockerfile stage tests stay (Task 0.3).
- `scripts/auditConfig.ts` (new): the export left out this module that `scripts/seedSavedFilters.test.ts`
  imports; it is recreated from the plan's Task 0.3 snippet (Task 0.3).
- `tsconfig.json`, `biome.json`, `eslint.config.mjs`, `vitest.classify.ts` (changed): ignores for the
  kit folder, generated test output and a stray `DEALFLOW/` copy of the old app that sits in this
  workspace; and `scripts/dealflow/*.mjs` added to the ESLint default project (Task 0.1, Task 0.3).
- `.gitignore`, `package.json` (changed): generated paths and the Dealflow scripts from
  PLAN-PART1.md 6.1 (Task 0.1); the package name, description and contributors (Task 1.2); and
  `dev:up` without the explicit compose project name (Task 1.4, AMENDMENT A1).
- `src/constants/strings.ts`, `src/constants/settingsStrings.ts`,
  `src/constants/enrichmentStrings.ts`, `src/app/(app)/settings/email-sync/strings.ts`,
  `src/app/oauth/authorize/consent.tsx`, `src/features/notifications/email/render.ts`,
  `src/features/release/ui/VersionBanner.tsx`, `src/features/leads/inbox/SourceOriginInfo.tsx`,
  `src/features/deal-workspace/composer/VideoCallField.tsx`, `src/app/layout.tsx`,
  `src/features/email/composer/sendFailure.ts` (changed): user-visible copy now says Dealflow
  (Task 1.1).
- `src/components/ui/DatePicker.tsx` (changed): the calendar chunk cache is read instead of being
  write-only, which the linter required (Task 0.7).
- `src/features/mcp/server.ts`, `src/app/api/mcp/route.ts` (changed): MCP server name `dealflow`
  (Task 1.2).
- `README.md`, `LICENSE`, `docs/mcp-server.md` (changed): Dealflow docs, added copyright line,
  renamed MCP guide (Task 1.2).
- `src/config/env.ts`, `.env.example` (changed): telemetry and update check default on, then off
  (Task 1.3); Docker host-port keys, proxy example section and configurable MinIO images (Task 1.4).
- `docker-compose.yml` (changed): no proxy service, loopback publishes for app/ws/MinIO, configurable
  `MINIO_IMAGE`/`MC_IMAGE` and `DEALFLOW_ENV_FILE`, header rewritten (Task 1.4, AMENDMENT A1).
- `docker-compose.dev.yml` (changed): only the Postgres and MinIO console debug ports (Task 1.4).
- `docker-compose.local.yml` (changed): this machine's override updated for the new base file, no
  proxy stanza, no duplicate publishes (Task 1.4, AMENDMENT A1).
- `Caddyfile` (moved): now `docs/reverse-proxy/Caddyfile.example`, with `$APP_UPSTREAM`,
  `$WS_UPSTREAM` and `$S3_UPSTREAM` variables (Task 1.4).
- `Caddyfile.test.ts` (changed): reads the example path above (Task 1.4).
- `docs/deploy.md` (rewritten): proxy-less topology, host-port variables, first admin via the
  bootstrap link or an email link (Task 1.4).

## Deploy project names

Task 1.4 supersedes ROADMAP.md's "Compose project: dealflow" line. The dev stack uses the folder's
own compose project name (this machine: `warpdrive-main`), so it reuses the owner's existing
containers and volumes; the container smoke test keeps its dedicated `dealflow-smoke` project.

## Part 2 (mail provider) base

Part 2 builds on the Part 1 result at commit `64363ce` (PROGRESS-P1.md). From here, upstream fixes to
the email layer need reading before a cherry-pick: Phase 1 replaces `GmailClient` call sites with the
provider-neutral `MailProvider` in `src/features/mail/provider/`, and Task 1.1 renames the Gmail
columns to `provider_*` / `sync_cursor`. The Gmail adapter keeps the upstream sync engine
(`syncMailbox`) unchanged inside `src/features/mail/provider/gmailAdapter.ts`.

### Part 1 Phase 2 to 5 additions and edits

The audit found these absent from the list above; all were Part 1 work, so a future cherry-pick
that touches them needs a manual read first.

- `src/features/auth/*` (new): `authMethods`, `authTokens`, `bootstrapLocal`, `credentials`,
  `invites`, `magicLink`, `originCheck`, `password`, `passwordActions`, `passwordLogin`,
  `sessionCookies`, `sessionsAdmin`; `bootstrap.ts`, `devLogin.ts` and `loginReturn.ts` (changed).
- `src/app/auth/*` (changed routes): `password`, `magic-link`, `magic/verify`, `invite/accept`,
  `start`, `dev-login`.
- `src/app/(auth)/login/*` (changed): `page.tsx`, `LoginPanel.tsx`, `magic/page.tsx`,
  `invite/page.tsx`.
- `src/app/(app)/settings/*` (changed): `SettingsNav.tsx`, `profile/page.tsx`,
  `profile/PasswordCard.tsx`, `users/InviteUserForm.tsx`, `email-sync/strings.ts`.
- `src/features/mailer/*` (new): the system mailer and its templates.
- `src/features/mcp/tools/types.ts`, `src/server/trpc/root.ts`, `src/db/schema/index.ts`,
  `src/constants/errorIds.ts`, `src/constants/authStrings.ts` (changed): Part 1 registry and
  catalogue additions.
- `src/features/deal-workspace/DealSidebar.tsx`,
  `src/features/deal-workspace/history/NoteCard.tsx`,
  `src/features/deal-workspace/composer/VideoCallField.tsx`,
  `src/features/deals/CreateFilterModal.tsx`, `src/features/email/composer/Composer.tsx`,
  `src/features/identity/actions/invite.ts` (changed): AI entry points and Dealflow copy.

## Part 2 column rename (Task 1.1)

Migration `0078_dealflow_mail_rename` renames the Gmail-specific columns in place: `gmail_thread_id`
to `provider_thread_id`, `gmail_message_id` to `provider_message_id` (messages and send attempts),
`gmail_attachment_id` to `provider_attachment_id`, and `last_history_id` to `sync_cursor`. The
constraint names (`uq_thread_acct_gmail`, `uq_msg_acct_gmail`) are unchanged.

From this commit on, an upstream fix that touches the email layer must be ported by hand: the
upstream column names no longer exist here. Read the upstream diff, map the old names onto the new
ones, and prefer the `MailProvider` layer in `src/features/mail/` over adding new `GmailClient`
call sites. The Gmail adapter keeps the upstream sync engine (`syncMailbox`) unchanged.

## Part 3 (products, currencies, forecast) base

Part 3 builds on the Part 2 result at commit `15ff072` (PROGRESS-P2.md). The new work lives in
`src/features/currency/`, `src/features/products/` and `src/features/forecast/`, plus the new
`src/db/schema/sales.ts` and migration `0080_dealflow_sales`. Upstream files edited for the part
(port future upstream fixes here by hand):

- `src/db/schema/deals.ts` (comment only): `deals.value` now documents "value in the deal's
  currency".
- `src/db/schema/index.ts`, `src/constants/errorIds.ts`, `src/constants/permissionFlags.ts`,
  `src/constants/changeLogFields.ts`, `src/features/permissions/actions-meta.ts`,
  `src/server/trpc/root.ts`: the sales schema export, the PRODUCT/CURRENCY IDs, the
  `products.manage` capability, currency/probability change fields and the currency/products/
  forecast routers.
- `src/features/deals/dealUpdate.ts`: the manual-value guard (`E_PRODUCT_004`) and
  `recordDealValueChange`, the line-sync writer that shares the manual edit's change log and
  `dealUpdated` event.
- `src/features/deals/dealRepo.ts`, `useBoardDerived.ts`, `Board.tsx`, `BoardStages.tsx`,
  `BoardColumn.tsx`, `BoardHeader.tsx`, `BoardToolbar.tsx`, `BoardSummary.tsx`, `DealCard.tsx`,
  `boardTypes.ts`: the board/list reads now select the deal currency and effective probability, and
  the cards, column totals, weighted total and toolbar total convert and weight through `summarize`.
- `src/features/deals/DealList.tsx`, `DealListClient.tsx`, `DealListTableBody.tsx`,
  `fetchDealListRows.ts`, `dealListPageData.ts`: the excluded-deals footer, the deal-currency value
  cell and the base-converted list totals.
- `src/features/deal-workspace/summaryRepo.ts`, `DealSidebar.tsx`, `DealSummaryActionList.tsx`,
  `src/constants/dealSidebarSections.ts`, `src/constants/dealSidebarStrings.ts`,
  `src/app/(app)/deals/[dealId]/DealDetailView.tsx`,
  `src/app/(app)/deals/[dealId]/DealWorkspaceClient.tsx`: the optional `productSummary`, the
  Products sidebar section, "Calculated from products" and the "≈ base" value, and the edit-rights
  flag threaded to the section.
- `src/features/inline-edit/saveError.ts`, `src/types/actionResult.ts`: the `E_PRODUCT_004` copy and
  the optional error code carried to the client for the missing-rate copy.
- `src/features/pipelines/StageEditCard.tsx`, `SortableStageCard.tsx`, `EditPipelineClient.tsx`,
  `useStageDeletion.ts`: the per-stage probability input and its immediate save.
- `src/components/shell/LeftNav.tsx`, `NavIcons.tsx`, `src/constants/nav.ts`,
  `src/constants/strings.ts`: the Forecast navigation item.
- `src/app/(app)/pipeline/[id]/page.tsx`, `[id]/list/page.tsx`, `[id]/archived/page.tsx`,
  `pipeline/[id]/edit/page.tsx`, `settings/SettingsNav.tsx`: rate-map and probability wiring, plus
  the Currencies and Products settings links.
- `scripts/seed-demo.ts` (and new `scripts/seed-demo-sales.ts`): demo products, rates, lines and
  close-date spread.
- `src/constants/errorIds.test.ts`, `src/features/deals/DealListClient.test.tsx`: the new domain
  and footer field in existing assertions.
- `e2e/helpers.ts`, `scripts/e2e/seed-session.ts`: the sales fixture ids the new spec reads.
- `README.md`: the "Products, currencies and forecast" section.

## Part 4 (quotes and invoices) base

Part 4 builds on the Part 3 result at commit `e214c9a` (PROGRESS-P3.md). The new work lives in
`src/features/documents/` (services, public surface and UI), `src/db/schema/documents.ts`,
migrations `0081_dealflow_documents` and `0082_dealflow_document_notifications`, the public routes
`src/app/d/` and `src/app/api/public/`, and the internal routes `src/app/(app)/documents/` and
`src/app/(app)/settings/documents/`. Upstream files edited for the part (port future upstream fixes
here by hand):

- `src/db/schema/index.ts`: exports the documents schema.
- `src/constants/errorIds.ts`, `src/constants/errorIds.test.ts`: the twelve DOC IDs and the
  `DOC` domain.
- `src/constants/permissionFlags.ts`, `src/features/permissions/actions-meta.ts`: the
  `documents.manage` capability (global, high risk).
- `src/server/trpc/root.ts`: the `documents` router.
- `src/constants/notificationTypes.ts`, `notificationDefaults.ts`, `strings.ts`,
  `src/features/notifications/entityHref.ts`, `ui/NotificationItem.tsx`, `ui/deepLink.ts`,
  `email/render.ts`: the three document kinds, their labels, payload links and email copy.
- `src/features/notifications/preferences.test.ts`, `schema.test.ts`: the new email defaults and
  the 13-value enum.
- `src/server/worker.ts`, `src/constants/jobNames.ts`: the `documents.overdue` cron job.
- `src/features/deal-workspace/summaryRepo.ts`, `DealSidebar.tsx`,
  `src/constants/dealSidebarSections.ts`, `src/constants/dealSidebarStrings.ts`: the optional
  `documentSummary` and the Documents sidebar section.
- `src/components/shell/LeftNav.tsx`, `NavIcons.tsx`, `TopBar.tsx`, `ReconnectBanner.tsx`,
  `src/constants/nav.ts`, `src/constants/strings.ts`: the Documents navigation item and the
  `data-print-hide` marking on the app chrome.
- `src/features/release/ui/VersionBanner.tsx`: the `data-print-hide` marking.
- `src/components/ui/Checkbox.tsx`: the optional `testId` prop (Radix owns the root element, so the
  public accept checkbox needs one to be addressable).
- `src/app/(app)/settings/SettingsNav.tsx`: the Documents settings link.
- `src/app/globals.css`: the A4 print rules.
- `scripts/seed-demo.ts`: calls the new documents seed and reports its counts. `scripts/seed-demo-records.ts`
  unlinks activities owned by non-demo users from demo deals, people and organizations before deleting
  them, so a re-seed is not blocked by foreign keys. New `scripts/seed-demo-documents.ts`.
- `README.md`: the "Quotes and invoices" section.

## Part 5 (automations and webhooks) base

Part 5 builds on the Part 4 result at commit `ebbf7d2` (PROGRESS-P4.md). New work lives in
`src/features/events/`, `src/features/automations/`, `src/features/webhooks/`,
`src/features/net/`, `src/db/schema/automations.ts`, migration `0083_dealflow_automations` and
the settings routes. Upstream files edited for the part (port future upstream fixes here by hand):

- `src/db/schema/index.ts`: exports the automations schema.
- `src/config/env.ts`, `.env.example`: `TRUSTED_PROXY_HOPS` and `WEBHOOK_ALLOW_PRIVATE`.
- `src/constants/errorIds.ts`, `src/constants/errorIds.test.ts`: the AUTOMATION and WEBHOOK IDs
  and their domains.
- `src/constants/permissionFlags.ts`, `src/features/permissions/actions-meta.ts`: the
  `automations.manage` capability (global, high risk).
- `src/constants/notificationTypes.ts`, `notificationDefaults.ts`, `strings.ts`,
  `src/features/notifications/ui/deepLink.ts`, `ui/NotificationItem.tsx`: the `automation` kind.
- `src/features/notifications/preferences.test.ts`, `schema.test.ts`: the new default and the
  14-value enum.
- `src/components/ui/Select.tsx`, `Switch.tsx`: optional `testId` hooks (Radix owns the nodes).
- `src/app/(app)/settings/SettingsNav.tsx`, `src/server/trpc/root.ts`: the Automations settings
  link and the automations, webhooks routers.
- `src/features/collaboration/changeLog.ts`: `recordChange` writes domain events in the same
  transaction.
- Creates that emit their own event: `src/features/deals/dealActions.ts`,
  `src/features/contacts/personsRepo.ts`, `src/features/contacts/orgsRepo.ts` (now transactional),
  `src/features/activities/repo.ts` (create and completion).
- Document status events: `src/features/documents/issue.ts`, `payments.ts`, `publicDocuments.ts`,
  `overdueJob.ts`.
- `src/features/enrichment/prospectApplyItem.ts`, `prospectApply.ts`: the enrichment path writes
  its change log directly, so it emits and now takes an `AbortSignal`.
- `src/server/worker.ts`, `src/constants/jobNames.ts`: the rotting and retention crons, the
  dispatcher poll and the automations and webhooks queues.
- `src/app/d/[publicId]/page.tsx`, `src/app/api/public/documents/[publicId]/{accept,decline}/route.ts`:
  use the shared `clientIp`.

### Part 5 demo and docs

- `scripts/seed-demo.ts`, new `scripts/seed-demo-automations.ts`: two disabled demo automations and
  one disabled example webhook.
- `scripts/e2e/e2e-env.mjs`: `WEBHOOK_ALLOW_PRIVATE=true` for the local receiver.
- `README.md`: the "Automations and webhooks" section.

## Part 6 (web forms and scheduler) base

Part 6 builds on the Part 5 result at commit `935685b` (PROGRESS-P5.md). New work lives in
`src/features/forms/`, `src/features/scheduling/`, `src/features/public/PoweredBy.tsx`,
`src/db/schema/forms.ts`, migrations `0085_dealflow_forms_booking` and
`0086_dealflow_forms_booking_notifications`, the `src/app/f/` and `src/app/book/` routes and their
public API routes, and the settings screens. Upstream files edited for the part (port future
upstream fixes here by hand):

- `src/db/schema/index.ts`: exports the forms schema.
- `next.config.ts`, `next.config.test.ts`: the `/f/*` and `/book/*` framing carve-out
  (`frame-ancestors *`, no `X-Frame-Options`).
- `src/constants/errorIds.ts`, `src/constants/errorIds.test.ts`: the FORM and BOOKING IDs and their
  domains.
- `src/constants/permissionFlags.ts`, `src/features/permissions/actions-meta.ts`: `forms.manage`
  (global, high risk).
- `src/constants/notificationTypes.ts`, `notificationDefaults.ts`, `strings.ts`,
  `src/features/notifications/ui/deepLink.ts`, `ui/NotificationItem.tsx`,
  `src/features/notifications/email/render.ts`: the `form_submission`, `booking_created` and
  `booking_cancelled` kinds and their copy.
- `src/features/notifications/preferences.test.ts`, `schema.test.ts`: the three new defaults and
  the 17-value enum.
- `src/features/permissions/types.ts`: a `lead` variant of `VisibleRecord`.
- `src/features/files/fileAuthz.ts`: a lead visibility parent, so a submission notification on a
  lead is delivered instead of suppressed.
- `src/features/events/types.ts`, `snapshot.ts`: the three event types and their payloads.
- `src/features/automations/definition.ts` and its test, `runner.ts`, `ui/types.ts`,
  `ui/TriggerPicker.tsx`: the three triggers, the form filter and the person condition target.
- `src/constants/automationsStrings.ts`: trigger summaries for the new events.
- `src/features/webhooks/ui/WebhookDialog.tsx`: the "Forms and booking" event group.
- `src/app/(app)/settings/SettingsNav.tsx`: Forms (admin) and Booking pages (every user).
- `src/server/trpc/root.ts`: the forms and scheduling routers.
- `src/app/(app)/settings/automations/[id]/page.tsx`: passes the form list to the trigger picker.
- `scripts/seed-demo.ts`: calls the new demo seed.

### Part 6 demo and docs

- `scripts/seed-demo-forms.ts`: one active form with two submissions, and one active booking page
  with a future booking and its activity.
- `docs/dealflow/FORMS.md`, `docs/dealflow/SCHEDULING.md`: new; `AUTOMATIONS.md` and
  `WEBHOOKS.md` gained the new events.
- `README.md`: the "Forms and booking pages" section.
