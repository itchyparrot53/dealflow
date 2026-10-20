# PROGRESS: dealflow-wd-p4-v1

STATUS: IN PROGRESS
Current: 2.2 · Last updated: 2026-10-20 23:37

## Phase base commits
- Phase 0: e214c9a8e17342315ee36e23e0f65588843c1e58
- Phase 1: 9322d5e0677f1253b833249fff70ed9e3c9a6375
- Phase 2: 3d59f4b61b69eb62b0afd0703d478ecf0c6ba586

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
- [ ] 2.2 Owner notifications
- [ ] 2.3 Phase 2 QA gate
- [ ] 3.1 Settings → Documents
- [ ] 3.2 Deal section, document page, view and public actions
- [ ] 3.3 Documents list and navigation
- [ ] 3.4 Print stylesheet and preview
- [ ] 3.5 Demo seed and docs
- [ ] 3.6 Phase 3 QA gate
- [ ] 4.1 E2E documents spec and screenshots
- [ ] 4.2 Integration suite and smoke
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: typecheck ok · lint ok (14 warnings) · build ok (a first attempt hit the known `ENOTEMPTY` race on `.next`; cleared and retried) · unit 5004/5004
- Phase 0 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok (a first attempt hit the known `ENOTEMPTY` on `.next`; cleared and retried) · unit 5063/5063 · no named integration files at this gate
- Phase 1 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5063/5063 · documents/products/mail integration 68/68

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
