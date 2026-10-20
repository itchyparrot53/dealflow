# PROGRESS: dealflow-wd-p4-v1

STATUS: IN PROGRESS
Current: 4.2 · Last updated: 2026-10-21 00:37

## Phase base commits
- Phase 0: e214c9a8e17342315ee36e23e0f65588843c1e58
- Phase 1: 9322d5e0677f1253b833249fff70ed9e3c9a6375
- Phase 2: 3d59f4b61b69eb62b0afd0703d478ecf0c6ba586
- Phase 3: 4770be57f7c881e33848e45727425d263da27266
- Phase 4: de9400d96a9e8d9df6f26068755af2566283d0e5

## Tasks
- [x] 0.1 Start Part 4: progress files, kit and baseline
- [x] 0.2 Documents schema and migration
- [x] 0.3 Markdown-lite, variables, transitions, numbering (test-first)
- [x] 0.4 Phase 0 QA gate
- [x] 1.1 Settings, templates and the capability
- [x] 1.2 Create, edit, refresh, duplicate, delete (test-first)
- [x] 1.3 Issue, numbering and void
- [x] 1.4 Payments and the overdue job
- [x] 1.5 Sending through the mailbox
- [x] 1.6 Phase 1 QA gate
- [x] 2.1 Public reads, accept and decline (test-first)
- [x] 2.2 Owner notifications
- [x] 2.3 Phase 2 QA gate
- [x] 3.1 Settings → Documents
- [x] 3.2 Deal section, document page, view and public actions
- [x] 3.3 Documents list and navigation
- [x] 3.4 Print stylesheet and preview
- [x] 3.5 Demo seed and docs
- [x] 3.6 Phase 3 QA gate
- [x] 4.1 E2E documents spec and screenshots
- [ ] 4.2 Integration suite and smoke
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: typecheck ok · lint ok (14 warnings) · build ok (a first attempt hit the known `ENOTEMPTY` race on `.next`; cleared and retried) · unit 5004/5004
- Phase 0 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok (a first attempt hit the known `ENOTEMPTY` on `.next`; cleared and retried) · unit 5063/5063 · no named integration files at this gate
- Phase 1 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5063/5063 · documents/products/mail integration 68/68
- Phase 2 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok (a first attempt hit the known `ENOTEMPTY` on `.next`; cleared and retried) · unit 5063/5063 · documents/notifications/auth integration 142/142
- Phase 3 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5063/5063 · documents integration 45/45

## Decisions
- 0.1: section 4 starting point matches exactly: PROGRESS-P3.md (formerly PROGRESS.md) said `dealflow-wd-p3-v1` with `STATUS: COMPLETE`, and HEAD is `e214c9a8e17342315ee36e23e0f65588843c1e58`, so this run starts fresh at Task 0.1 as section 0 rule 1 expects.
- 0.1: the kit arrived untracked as `dealflow-wd-part4-kit/` at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part4-kit` (matching the Part 1 to 3 layout), added the root `PLAN-PART4.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical; `PLAN_FILE` is now `PLAN-PART4.md`), per section 4's kit row.
- 0.1: no `dealflow-wd-part4-kit.zip` exists in the tree (the kit arrived as a folder), so `.git/info/exclude` needed no new entry; `/dealflow-wd-part2-kit.zip` remains the only zip entry there.
- 0.1: the next free migration number is 0081 (the last file is `0080_dealflow_sales.sql`), so the documents migration keeps the planned name `0081_dealflow_documents`.
- 0.1: there is no auth proxy or middleware allowlist in this codebase. `src/app/(app)/layout.tsx` is the session gate (`createContext` then `redirect("/login")`), and a route is public by living OUTSIDE that route group: `/t/click` sits at `src/app/t/click/[token]/route.ts` with no middleware. Part 4's `/d/[publicId]` and `/api/public/...` are public the same way, so there is no allowlist file to edit.
- 0.1: pg-boss schedules are registered in `src/server/worker.ts` (`registerReleaseCheckJob` from `src/features/release/job.ts`, queue name in `src/constants/jobNames.ts`), so `documents.overdue` will be registered from that worker.
- 0.1: the notifications kind list is the typed `NOTIFICATION_TYPES` tuple in `src/constants/notificationTypes.ts`, so the three document kinds are appended there.
- 0.1: pnpm 9.15.9 (from `/tmp/dealflow-tools`), Node 24.16.0 and Docker 24.0.5 are available; the `subagent` tool is available, so the Task 4.3 review can use it.
- 0.2: the self-referencing `documents.source_quote_id` needs the `AnyPgColumn` return annotation on its `references` thunk; a bare `() => documents.id` makes the table type circular (TS7022/TS2577), so the documented escape is used.
- 0.2: `document_lines` and `document_counters` carry the same positive/bounded checks Part 3's line table has (`quantity > 0`, `item_price >= 0`, percents 0 to 100, `last_number >= 1`) even though 6.4 names checks only for the other tables; a negative quantity or counter is a programmer error that the database now refuses.
- 0.2: `drizzle-kit generate` produced `0081_dealflow_documents.sql` creating exactly the six tables of 6.4 (document_settings, document_templates, document_counters, documents, document_lines, document_payments), and `pnpm db:migrate:dev` applied it to the host dev database; all six tables were confirmed present.
- 0.3: the three test files were written first and run red (all three failed with "Cannot find module") before any implementation; the pure modules then made all 59 cases pass.
- 0.3: `inlineSegments` slices the bold text from the source between the markers instead of reading the `match[1]` capture group, because `noUncheckedIndexedAccess` types that group as `string | undefined` while the type-aware ESLint rule treats an `??` guard for it as unnecessary; slicing satisfies both checks without an assertion.
- 0.3: `renderVariables` identifies the products marker by trimmed key, so `{{ products }}` also survives the creation pass, not just the exact `{{products}}` spelling. Kept markers keep their original spacing so a display-time pass can fill them later.
- 0.3: a markdown-lite line is trimmed before classification, so template authors can indent a marker without breaking it; `###` stays a paragraph because the h2 prefix requires a space after two hashes.
- 1.1: added `E_DOC_011` (input failed Zod) and `E_DOC_012` (delete refused on a kind's last template) beside the ten IDs of 6.2, following the `_INPUT_INVALID` convention every other feature uses and because 6.7 requires refusing the last template of a kind while 6.2 names no ID for that cause; the ten named IDs are added unchanged.
- 1.1: `documents.manage` is a new global flag, also listed in `HIGH_RISK_FLAGS` and the `GlobalAction` union, granted to admins by default; it needed no migration because the registry is code-defined, exactly like `products.manage` in Part 3.
- 1.1: settings and template reads stay open to any signed-in user (document creation and the public page need the company block and the template list), while every mutation checks `documents.manage` inside the service so an integration test can prove refusal.
- 1.1: `getDocumentSettings` inserts the column-default row on first read, and `listTemplates` inserts the shipped default template for a kind on first list (`onConflictDoNothing` guards two concurrent first callers); the partial unique index keeps one default per kind.
- 1.1: changed test: `src/constants/errorIds.test.ts` gained `DOC` in its domain allow-list because the registry now carries that domain; the per-ID format and uniqueness assertions are unchanged.
- 1.2: the integration file was written first and run red (missing module), then the services made all 15 cases pass; the totals case compares the document against Part 3's `dealTotals` over the deal's own lines, not just hard-coded strings.
- 1.2: document operations map a missing or invisible deal (`E_DEAL_001` from `loadEditableDeal`/`assertDealVisible`) to `E_DOC_001`, so a document call never reveals whether a deal id exists; a visible deal the actor may not edit keeps `PERM_DENIED`.
- 1.2: `include_products = false` makes the snapshot carry no lines and zero totals; with `true` the deal's product lines are copied and a deal without lines gets one line from the deal value. The flag owns the products block, which is the plan's intent for a template-level switch.
- 1.2: the body snapshot keeps every `document.*` variable (rendered at display time) and appends `\n\n## Terms\n{terms}` when the template has terms, exactly as 6.5 describes.
- 1.2: internal document reads keep deal visibility (`assertDealVisible`), so the deal section and the future `/documents` list only show documents of visible deals; the public exception for an issued invoice of a soft-deleted deal belongs to `publicDocuments.ts` (Task 2.1).
- 1.2: duplicate keeps the body, customer fields, currency and totals, gives a new `public_id`, clears the number and every status date, and recomputes a quote's `valid_until` from the current settings so a copy is a fresh draft.
- 1.2: added `listDocumentsForActor` and a `documents.list` read ahead of Task 3.3 because the list page and the deal section both need one bounded read; the visibility check runs per row against the shared deal predicate.
- 1.3: the issue cases were added first and run red (missing `./issue`), then all five passed; the concurrency case warms the pool and proves ten simultaneous issues produce the ten consecutive numbers `Q-YYYY-0001` to `0010`.
- 1.3: issuing locks the document row `FOR UPDATE` and takes the number with one `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, so the counter row is the single serialization point and no draft consumes a number.
- 1.3: `markSent` follows the same path as `issue` (draft to sent, number assigned if missing), and both refuse a document that is already issued with `E_DOC_003`.
- 1.3: an invoice's `due_date` is recomputed at issue from the current `invoice_due_days`, so a draft created before a settings change gets the window in force when it is issued.
- 1.3: `voidInvoice` refuses quotes and drafts with `E_DOC_003` and keeps the number on the row; `deleteDraft` refuses an issued invoice with `E_DOC_008` and an issued quote with `E_DOC_003`.
- 1.4: the payment and overdue cases were added first and run red (missing modules), then all 25 cases passed; the job case seeds a past-due sent invoice, a past-due paid invoice, a future sent invoice and a past-expiry quote, and only the first changes.
- 1.4: `recordPayment` locks the invoice row `FOR UPDATE` before summing the existing payments, so two concurrent payments cannot both pass the overpayment check; `E_DOC_007` carries the outstanding amount in its context.
- 1.4: an invoice becomes `paid` when the summed payments reach or pass the stored total (they can only equal it under the lock); `deletePayment` on a paid invoice applies `unpay` and then swaps in `overdue` when `due_date` is before today, without waiting for the job.
- 1.4: the overdue job is one `UPDATE ... WHERE due_date < (now() at time zone 'utc')::date`, registered on the worker at `0 6 * * *` and exported as `runOverdueInvoices` so the test calls the exact SQL; the queue name is `documents.overdue` in `jobNames.ts`.
- 1.4: fixed a real concurrency defect found by a pg deprecation warning: `getDocument` ran its three reads in `Promise.all`, and inside a transaction those run on one client, which cannot execute two queries at once. They are sequential now, and the warning is gone.
- 1.5: the compose send path is `src/features/email/actions.ts` calling `sendEmail` in `src/features/email/send.ts` with `resolveMailProvider` and `makeStorageClient`, passing `linkDealId`/`linkPersonId` so the thread links to the deal. `send.ts` reuses that same `sendEmail` call and `getActorMailbox` for the connected check.
- 1.5: the send tests use the Part 2 fake transport (`connectImapMailbox` plus `createFakeTransportFactory`, as the mail integration tests do) and `FakeStorageClient`, injected through `SendDocumentDeps.resolveDeps`/`storage`; the outgoing HTML part is base64 on the wire, so the test decodes the Sent copy before asserting the public URL.
- 1.5: the send implementation was drafted before its cases were run, so this task is not claimed as test-first; the first run still caught the base64 body detail, which the assertion now handles.
- 1.5: recipient and connected-mailbox checks run before the draft is issued, so `E_DOC_005`/`E_DOC_006` leave the document as a draft; the issue is committed before the mail call, so a send failure after issuing returns the mail error and leaves the document issued.
- 1.5: the action's short signal is deliberately not forwarded to `sendEmail`, matching the composer, so an SMTP send plus its Sent append gets `MAIL_SEND_TIMEOUT_MS` instead of the action budget.
- 2.1: `public.integration.test.ts` was written first and run red (missing modules); after the services it passed 16/16, with one assertion corrected: `{{products}}` is a block marker and is deliberately left in the rendered body, so the test now forbids only `{{document.` and asserts the products marker survives.
- 2.1: the public page and both route handlers live outside the `(app)` group (`src/app/d/[publicId]` and `src/app/api/public/...`), so they are public by construction; the build lists all three routes, and no allowlist file exists to edit (as logged in 0.1).
- 2.1: `publicRateLimit.ts` reuses the existing `createRateLimiter` fixed-window primitive with 30 requests a minute per IP and per publicId; `getPublicDocument` enforces it for the page (with the request IP) and each POST handler checks it before parsing.
- 2.1: the first view is recorded once: a sent quote moves to `viewed` with `viewed_at`, an invoice only gains `viewed_at`, and `recordView` already returns `firstView` so Task 2.2 can notify on exactly that event.
- 2.1: public visibility hides drafts, void documents and quotes of soft-deleted deals as `E_DOC_001`, while an issued invoice of a soft-deleted deal stays visible, exactly as 6.7 contrasts them.
- 2.1: the public view exposes `publicId` only, never the internal id, `dealId`, `createdBy`, customer email or `accepted_ip`; the test asserts the serialized view has no customer email.
- 2.1: the client IP is the first `x-forwarded-for` entry, then `x-real-ip`, then "unknown", because the Next runtime exposes no socket address; POST responses map 404/409/410/429, a failed origin check is 403 `E_AUTH_ORIGIN_REJECTED`, and an oversized (16 KB) or malformed body is 400 `E_DOC_INPUT_INVALID`.
- 2.2: `notifications.type` is a Postgres enum, so the three kinds needed migration `0082_dealflow_document_notifications` (`ALTER TYPE ... ADD VALUE` three times); it applied to the dev database and the integration template picks it up.
- 2.2: document notifications use `entityType: "deal"` because `createNotification`'s visibility gate only knows deal/person/organization/activity/email_message, and the deal is the correct visibility parent; the document id rides in the payload and new `payloadHref` in `entityHref.ts` resolves `/documents/{id}` for the feed item and the notification email.
- 2.2: the recipient is `documents.created_by`, falling back to the deal owner; `actor_id` is null because a customer viewing or accepting has no session.
- 2.2: notification delivery is best-effort: a failed Result or a thrown DB error is logged and never fails the public view/accept/decline (an AbortError still propagates as a cancellation).
- 2.2: email defaults are off for `document_viewed` (per-event noise) and on for `document_accepted`/`document_declined` (outcomes), matching the default policy comment in `notificationDefaults.ts`.
- 2.2: changed tests: `src/features/notifications/preferences.test.ts` gained the three expected defaults, and `src/features/notifications/schema.test.ts` now expects 13 enum values including the document kinds; no assertion was weakened.
- 2.2: the notification email renderer gained a grouped document case backed by one `documentEmailCopy` helper, because adding three inline cases pushed the existing switch over the cognitive-complexity cap.
- 2.3: the first full unit run after 2.2 failed the two static policy tests (`paletteTokens`, `typeScale`): the minimal public page used raw `slate` utilities and a `text-2xl` h1. Fixed to semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`) and `text-display` in `2.3: fixes round 1`; both tests then passed.
- 2.3: the host was under extreme external load (load average 190), so the first unit run took 733s and surfaced spurious worker-start timeouts; the re-run with `--maxWorkers=4` passed 5063/5063 in 139s. No test was changed for that.
- 3.1: the settings page is a server component that loads settings and both template lists from the services (as the products page does), and gates on `actor.type === "admin"` plus `can("documents.manage")`; the nav hides the link for everyone else, but the page gate is the boundary.
- 3.1: all documents copy lives in `src/constants/documentsStrings.ts`, including the exact 6.2 error strings, so the settings screens, the document page and the public page cannot drift from the contract wording.
- 3.1: the template dialog previews with sample values for both creation-time variables and `document.*`, so an author sees a document instead of braces; `MarkdownLite` renders React elements only and draws the lines table when lines are supplied, never HTML.
- 3.1: the settings navigation gained a Documents item (FileText) after Products; the route builds as `/settings/documents` and the 370 unit tests touching settings, documents and the palette/type-scale policies pass.
- 3.1: the first MarkdownLite draft used array indexes as React keys, which `noArrayIndexKey` rejects; the keys now come from small helpers over the statically rebuilt block list.
- 3.2: the deal workspace gained `documentSummary` (a count) and the sidebar registry gained a `documents` section appended last; the section mounts only when the workspace carries the summary, exactly like Part 3's `productSummary`, so older fixtures render without a tRPC provider and stored section preferences stay valid.
- 3.2: one `DocumentView` renders the internal page and the public page (and will render the print page), with `document.*` resolved by `renderDocumentBody` before it reaches the component, so both surfaces always agree.
- 3.2: the editor shows an action only when `nextStatus` allows it (issue, mark sent, void, pay), so a button can never offer a move the state machine refuses; the draft editor, payments table and dialogs sit behind the same service actions as the API.
- 3.2: `PublicActions` posts to the public API route handlers with a 15 second signal (the repo bans `fetch` without one) and refreshes the server component on success; `PrintButton` calls `window.print()` for the browser PDF path.
- 3.2: the shared `Checkbox` gained a `testId` prop because Radix owns the root element and the public accept hook needs `public-accept-checkbox`; the rest of the test hooks are on the elements the plan names.
- 3.2: the public page now renders the full `DocumentView` (company block, dates, customer, lines, totals, payment instructions, footer) instead of the minimal markup from Task 2.1.
- 3.3: `loadDocumentsList` is raw SQL because `dealVisibilityClause` fixes the table aliases to `d`/`p`, the same reason the forecast is raw SQL; it filters soft-deleted and archived deals, caps at 200, batch-loads the invoices' payments and calls `summarize` over the outstanding amounts, listing currencies without a rate as excluded instead of adding them unconverted.
- 3.3: the page loads the read on the server and `DocumentsList` only switches tabs and the status filter in component state, so changing either never reloads the RSC tree; the outstanding strip appears on the Invoices tab with `documents-outstanding-total`.
- 3.3: the main navigation gained Documents after Forecast (FileText glyph), so the number-key shortcuts shift by one because they index the same list by design, exactly as Part 3 logged for Forecast; the shortcut tests index `NAV_ITEMS` dynamically and stay valid.
- 3.3: the new integration case proves the visibility filter and the base-currency total (admin 1100.00, regular 600.00, JPY excluded, quotes never counted) and clears the documents table first because the total is global to the test database.
- 3.3: `/documents` builds alongside `/documents/[id]`; a quote's date column shows valid-until and an invoice's shows due date.
- 3.4: the print rules live in `globals.css` under `@media print`: `@page { size: A4; margin: 18mm }`, `[data-print-hide]` hidden, black on white, table borders from the `--border` token, and `main`/`article` unclamped so a multi-page document is not clipped by the shell's scroll container.
- 3.4: the app chrome is hidden by marking it, not by guessing selectors: `TopBar`, `LeftNav`, `ReconnectBanner` and `VersionBanner` carry `data-print-hide`. `DocumentView`'s own `<header>` is untouched, so a blanket `header` rule is avoided.
- 3.4: `/documents/[id]/print` reuses `DocumentView` with `renderDocumentBody`, renders a print button that carries `data-print-hide`, and builds as a dynamic route alongside `/documents` and `/documents/[id]`.
- 3.5: the documents seed lives in `scripts/seed-demo-documents.ts` and is re-runnable by replacing only documents whose title starts with "Demo: ", so a user's real documents are untouched; settings are upserted to Northwind Advisory with the example payment instructions, and each template is inserted only when its kind has none.
- 3.5: the seed computes line snapshots and totals with the app's own `lineNet`/`lineTax`/`dealTotals`, and takes numbers through the same counter upsert plus `formatDocNumber`, so the demo counters and the printed numbers agree.
- 3.5: the seed creates seven documents on deals with lines (draft quote, sent quote, accepted quote, invoice from the accepted quote, sent invoice due soon, overdue invoice, paid invoice with two payments), and running it on the dev database produced exactly those seven with linked source quote and two payments summing to the total.
- 3.5: the demo seed's re-run was blocked by a pre-existing bug: activities owned by non-demo users referenced demo deals, persons and organizations, so `wipeDemo` failed on their foreign keys. It now unlinks those references (`deal_id`, `person_id`, `org_id`) instead of deleting another user's activity; this was required to run the seed at all and is logged as a pre-existing fix in the upstream seed file.
- 3.5: `docs/dealflow/DOCUMENTS.md` covers the model, numbering, transitions, templates and variables, permissions, public page and rate limit, payments, the overdue job, sending and printing; `UPSTREAM.md` has a Part 4 section listing every upstream file, and the README gained a "Quotes and invoices" section.
- 4.1: the spec reads a new `documentsDealId` fixture: a line-bearing open deal whose contact has an email. The line-free "Demo sales playground" is reserved for the sales spec, and the line-bearing deals belong to other demo users, which is fine because an admin may edit any deal.
- 4.1: the spec connects the fake IMAP mailbox itself (disconnecting the seeded Gmail account or a previous connection first), so it also passes standalone; the full suite runs it after the mail spec.
- 4.1: the public URL is read from a new `data-public-url` attribute on the copy-link button instead of the clipboard, which keeps the spec deterministic while the button keeps copying for the user.
- 4.1: found and fixed a real gap while running the spec: `sendDocument` treated a disconnected mailbox as connected because `getActorMailbox` ignores the account status. It now uses `getActorMailboxStatus` and returns `E_DOC_006` for a disconnected account.
- 4.1: restored the `public-status` test hook that the 3.2 public-page rewrite dropped (an sr-only element carrying the status), and trimmed the stored scale off quantity and percentage cells for display ("2.000" reads "2").
- 4.1: `pnpm e2e` passed 18/18 across specs `00` to `08` (1.1 min); the seven `p4-*` screenshots exist and the Part 1 to 3 screenshots are present (23/8/6).

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on every command that loads `.env`.
- TODO(owner): rebuild the dev stack so it reads the Part 3 and Part 4 migrations and schema once `0081_dealflow_documents` is applied: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2).
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config. Check emptiness only, never print values.
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers`; ports 3210/3211. Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312).
- Docker 24.0.5 is up; the owner's `warpdrive-main` stack holds 5433/9000/9001. Never prune; if a build fails with "no space left", log `TODO(owner): free Docker disk space` and mark the step SKIPPED.
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).

## Final report
(written in Task 4.5)
