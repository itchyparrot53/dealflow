# PROGRESS: dealflow-wd-p14-v1

STATUS: IN PROGRESS
Current: 3.3 · Last updated: 2026-11-10 03:01

## Phase base commits
- Phase 0: 427c4673a950cb0964601a44b257d43c686ff594
- Phase 1: fee0b914419c1c4537efa16e37ea141e6009848b
- Phase 2: 435862f58a04d9becb8ea9d9237cdc4e7ed1c8ba
- Phase 3: 47235f9eed5ea56c0523f5a358b46d506fb7f318

## Tasks
- [x] 0.1 Start Part 14: progress files, kit, baseline and environment
- [x] 0.2 Reuse map and design note
- [x] 0.3 Phase 0 QA gate
- [x] 1.1 Schema, migration and permission flags
- [x] 1.2 Marketing status service and suppression
- [x] 1.3 Double opt-in, unsubscribe pages and one-click
- [x] 1.4 Form consent field and CSV import mapping
- [x] 1.5 Contacts UI: marketing section, list column, filter field, bulk change
- [x] 1.6 Phase 1 QA gate
- [x] 2.1 Block schema, renderer, plain text and marketing sanitiser
- [x] 2.2 Campaign images and the public asset route
- [x] 2.3 Builder UI
- [x] 2.4 Templates: starters, saved templates, test send
- [x] 2.5 Phase 2 QA gate
- [x] 3.1 Campaign list and the four-step editor
- [x] 3.2 Settings › Campaigns: senders, address, consent, sending, domain check
- [ ] 3.3 Sending engine
- [ ] 3.4 Tracking routes, web version, timeline and click alerts
- [ ] 3.5 Bounce mailbox and the DSN parser
- [ ] 3.6 Phase 3 QA gate
- [ ] 4.1 Sequences: model, editor, scheduler, entries and exits
- [ ] 4.2 Campaign report and recipients export
- [ ] 4.3 Campaign insights with comparison and type filter
- [ ] 4.4 Phase 4 QA gate
- [ ] 5.1 Campaigns e2e spec, demo seed and gallery
- [ ] 5.2 Docs
- [ ] 5.3 End-to-end, integration suite and smoke
- [ ] 5.4 Independent review
- [ ] 5.5 Final checklist
- [ ] 5.6 Final report and completion

## QA log
- Phase 2 gate: commands green · typecheck ok · lint ok (16 warnings, 1 info) · build ok · unit 5522/5522 in 864 files · check:design 0 violations, 18 opt-outs · campaigns files 36/36 (2 unit, 2 integration)
- Phase 1 gate: commands green · typecheck ok · lint ok (16 warnings, 1 info) · build ok · unit 5494/5494 in 862 files · check:design 0 violations, 18 opt-outs · marketing, forms and import integration 251/251 in 44 files
- Phase 0 gate: commands green · typecheck ok · lint ok (16 warnings, 1 info) · build ok · unit 5486/5486 in 861 files
- Baseline: install ok (frozen lockfile) · typecheck ok · lint ok (16 warnings, 1 info) · build ok · unit 5486/5486 in 861 files · check:design 0 violations, 17 opt-outs

## Decisions
- 0.1: starting point matches section 4. `PROGRESS.md` said `dealflow-wd-p13-v1` with `STATUS: COMPLETE`, so it is renamed to `PROGRESS-P13.md` and Part 14 starts at Task 0.1 from base `427c467`.
- 0.1: the owner's live stack `dealflow-prod` is running on 127.0.0.1:3001, 8080 and 9000 (its Postgres publishes 5433). It was inspected read-only with `docker ps` and never stopped, recreated or called.
- 0.1: port 5433 is held by the owner's live stack, so the dev stack runs with `DEV_PG_PORT=5434 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up` (Postgres 5434, MinIO S3 9100, console 9101). Every host database command and every e2e or integration run uses `DEV_PG_PORT=5434`; this is Part 13's documented fallback when a port is held.
- 0.1: the saved-filter schema already lists `person` (`SAVED_FILTER_TARGET_ENTITIES` in `saved-filters/schemas.ts`), but `filterAst.ts` and `filterAstSql.ts` compile deals only (`d.` alias and the deal field allow-list), so the person segment adapter that section 4 allows for is added with the campaign segment work.
- 0.1: the Part 13 renderer is present as section 4 expects (`email-design/{tokens,variables,layout,design,registry,sendSystemEmail}.ts`, `getEmailDesign` in `design.ts`, `sendSystemEmail` in `sendSystemEmail.ts`), so campaigns reuse it without an API change.
- 0.1: one-to-one tracking lives at `src/app/t/open/[token]` and `src/app/t/click/[token]`; Part 14 adds campaign routes under `src/app/t/c/*` and never changes these.
- 0.1: automations register handlers with `registerActionHandler` (`src/features/automations/actions/registry.ts`), so `enroll_in_sequence` plugs in there.
- 0.1: the latest migration is `drizzle/0093_dealflow_email_design.sql`, so the campaigns migration takes `0094_dealflow_campaigns.sql`.
- 0.1: the e2e harness already runs the pg-boss worker (`scripts/e2e/e2e-server.mjs` spawns `src/entrypoints/worker.ts`), so campaign jobs need no in-process e2e fallback.
- 0.1: pnpm 9.15.9 in `/tmp/dealflow-tools` had been partly garbage collected (the `pnpm` symlink pointed at a missing package), so it was reinstalled with the documented `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` command. The global pnpm is 8.9.2 and is never used.
- 0.1: Docker is up (24.0.5) but the VM has 8.2 GB free of 95.0 GB (91% used). That is below the 10 GB comfort threshold Part 13 recorded, so builds and the smoke run are watched for "no space left" and never pruned (section 0 rule 14).
- 0.1: `.env` had its three `GOOGLE_*` values blanked in the previous session (they were two placeholders plus an empty domain, which the all-or-nothing rule rejects), so env validation now passes. The Environment `GOOGLE_*=` command prefixes are kept but are redundant; `.env` is not edited again by this run (rule 17).
- 0.2: person segments compile with the contacts engine (`contacts/contactFilter.ts compileContactFilter` plus `PERSON_FILTER_CONFIG` and `PERSON_COLUMN_SQL`); `filterAst.ts`/`filterAstSql.ts` are the deal-only compiler, so no entity adapter is added there (section 4 allows this fallback).
- 0.2: people visibility has no SQL clause; `listPeople` filters candidate rows with `canSee` in process, so the segment preview and the send-time snapshot do the same, hydrating the campaign creator with `hydrateActor` instead of inventing a person visibility clause.
- 0.2: `GLOBAL_FLAGS` and the `GlobalAction` union are two hand-maintained lists in different files, so each of the four campaign flags is added to both and the permission tests cover both.
- 0.2: the outbound email registry is a closed union, so `marketing_double_opt_in` and `campaign_sender_verification` are appended to `EMAIL_TEMPLATE_KEYS` and `EMAIL_TEMPLATES`, and the brand test gains their pinned copy.
- 0.2: campaign timeline entries use the existing change log (`recordChange`) rendered as `HistoryItem.event` by `contactTimeline`, not a new feed table.
- 0.2: campaign mail gets its own transport module reading `MARKETING_SMTP_*` then `SMTP_*`, and reuses the `MAIL_FAKE` capture store so tests read the wire copy; one-to-one `renderEmail` is not reused for campaign layout, only its tokens, variables and `htmlToText`.
- 0.2: public routes are top-level app folders with no middleware allow-list to edit, so `/c`, `/u`, `/v` and `/t/c/...` need none; all reuse the public fail-open `emailTracking` limiter.
- 3.2: sender verification is a GET `/campaign-verify/{token}` link (the token is the credential; a scanner prefetch only completes a verification the team requested), single-use with the 48 hour expiry; a failed verification email deletes its token so the sender can be re-verified.
- 3.2: `getCampaignSettings` falls back to the 6.9 defaults when the singleton row is missing, and `saveCampaignSettings` rejects a rate above the env ceiling; `MARKETING_SMTP_*`, `CAMPAIGN_SEND_RATE_PER_MINUTE` and `CAMPAIGN_BATCH_SIZE` were added to env now because the settings page displays them and Task 3.3 consumes them.
- 3.2: the domain check injects the DNS resolver, caps each lookup at 5 seconds with a per-record error and caches results for an hour; tests cover pass, missing, resolver error and timeout with fake timers.
- 3.2: the transport label reports marketing SMTP when configured, otherwise the system SMTP, otherwise log-only, and never returns credentials.
- 3.1: the editor autosaves through `updateCampaignAction` 800 ms after the last edit, and the service refuses edits once a campaign is sent.
- 3.1: the recipient preview compiles the same people filter as the list (`compileContactFilter`), then applies `canSee` and the consent rules in `classifyPeople`; the send snapshot in 3.3 reuses this preview.
- 3.1: the Review checklist is pure (`campaignChecklist`) fed by `auditDocument`; the Send and Schedule buttons arrive with the sending engine (3.3), so no dead control ships in 3.1.
- 3.1: only the Campaigns and Templates tabs render; Automated and Insights are added in Phase 4 rather than shipping tabs that do nothing.
- 3.1: the editor is a keyed form component seeded from props (no setState in an effect), which the React lint rule requires and which also keeps the four steps in separate components.
- 2.5: the gate's lint pass forced three splits for the cognitive-complexity budget: the builder's properties panel and import dialog became their own components, `patchBlock` lost a mutable flag, and `styleAuthorHtml` got explicit parameter types. Behaviour is unchanged and the pure tests still pass.
- 2.4: the four starters are static documents with stable block ids and no images, so they can be used before any asset exists; a schema test parses each one.
- 2.4: saved templates are `campaign_templates` rows validated on save; duplicates are named "<name> copy".
- 2.4: the test send uses the system mailer (captured under `MAIL_FAKE`) until Task 3.3 lands the marketing transport; recipients must be active users of the install, at most five, and the subject is prefixed `[Test] `.
- 2.4: `TemplatesView` delegates "Use" to its parent because creating a campaign row belongs to Task 3.1's editor flow; 3.1 mounts this view behind `?view=templates`.
- 2.3: the builder preview is server-rendered by the same `renderCampaign` via `campaigns.preview`, and the iframe is sandboxed with `allow-scripts` only; a selection message is accepted only from the opaque `"null"` origin and after shape validation (`blockIdFromMessage`).
- 2.3: reordering uses dnd-kit on a compact block list plus Alt+Arrow on the selection, because dragging inside the sandboxed preview would need same-origin control of the iframe; both paths dispatch the same reducer action.
- 2.3: text blocks reuse the composer's TipTap `RichTextBody` with the merge-field insert, so one editor owns campaign body text and merge tokens.
- 2.3: image upload is a native file input (the design system has no file picker) whose bytes are validated server-side for type, size and 1 MB cap; upload errors surface next to the palette and the properties panel.
- 2.2: uploads take the server-action path (the 1 MB limit makes the presigned handshake unnecessary) and write through `StorageClient.putObject`, which the real client already implements; tests inject `FakeStorageClient`.
- 2.2: assets deduplicate by sha256, so the same image uploaded twice reuses one row and one object.
- 2.2: `imageSize` now reads GIF logical-screen dimensions and its mime union includes `image/gif`; PNG and JPEG parsing are unchanged.
- 2.2: the public asset route answers 404 for an unknown id, a mismatched extension and a vanished object alike, and is fail-open on the public `emailTracking` limiter.
- 2.1: the campaign renderer is its own module (`campaigns/blocks/render.ts`) because `renderEmail` is one-to-one shaped; it reuses `EMAIL_COLORS`, `EMAIL_FONT_STACK`, `escapeHtml`, `htmlToText` and the MSO/VML patterns. Merge fallbacks (`{{person.first_name|there}}`) live in `personalize.ts` because Part 13's engine has none.
- 2.1: the marketing sanitiser uses `sanitize-html` (the plan's choice) with a CSS property allow-list, a 32 KB cap on `data:` images and no `<style>`; it also returns the removed tag names so the import dialog can show what was stripped.
- 2.1: the six social icons are 24 px monochrome PNGs generated once with the installed Chrome (Playwright screenshot of a letter mark) and committed under `public/email/social`; nothing hotlinks a third-party icon.
- 2.1: the two-column block stacks via a `.df-col` media query at 620 px, and nested columns are rejected by the schema rather than flattened at render time.
- 1.6: `CONTRACT CHANGE:` Next.js refuses a `route.ts` and a `page.tsx` at the same segment, so the one-click endpoint moved to `POST /u/{token}/one-click` (still under `/u/*`, same token-only CSRF exemption) while the preference page keeps `/u/{token}`. Task 3.3's `List-Unsubscribe` header must use the `/one-click` URL.
- 1.6: the gate caught two regressions from the new UI: the public confirm and unsubscribe `h1`s used raw `text-2xl` (fixed to the named `text-title` step), and the person detail unit mock needed the `marketing.getPerson` query and invalidation (test wiring only, no assertion weakened).
- 1.5: the person marketing read is a tRPC query (`marketing.getPerson`) rather than props from the server page, so the section can invalidate after a change and the IP and user agent are nulled server-side unless the actor holds `marketing.manage`.
- 1.5: the `marketingStatus` filter compiles through a correlated `coalesce` subquery (a missing row reads as `not_subscribed`), so people queries need no join and the saved-filter engine treats it as an is / is not text field.
- 1.5: the Marketing column is optional (`defaultVisible: false`) so the existing table width is unchanged; it is available from Customize columns.
- 1.5: the bulk change is its own server action with a 5,000 cap and one transaction; it pre-filters the selection to transitions the table allows, so a single disallowed person cannot abort the batch.
- 1.5: changed tests: the contact filter config test expects the new `marketingStatus` field and its eq/neq ops; new tests cover the SQL compile, the list filter with row status, and the bulk service (permission, cap, events).
- 1.4: `CONTRACT CHANGE:` the 6.2 transition table gained the import edges (`subscribed` or `pending` to `unsubscribed` with source `import`, `pending` or `subscribed` to `not_subscribed` with source `import`), because 6.12 requires the CSV import to set those three values and the original table had no path for them. The matrix test in `status.test.ts` was extended with exactly those edges.
- 1.4: the imported marketing status lives on `MappedRow` beside `primary`, not inside it, because `personCreateInput` would strip the field; validation normalises subscribed / unsubscribed / not subscribed and reports any other cell as a row error.
- 1.4: the import-wide confirmation is `import_batches.marketing_consent` (migration `0095_dealflow_campaign_import.sql`), set from the Preview step checkbox, and `commitRow` refuses a row mapped to subscribed before it creates or updates anything.
- 1.4: undo restores the previous status through `restoreMarketingStatus` (source `system`, outside the table) using `import_rows.marketing_status_before` and `marketing_person_id`; a person the import itself created is skipped because undo removes that contact.
- 1.4: the public form's consent checkbox is a native input on purpose (the form must work without JavaScript); an unticked box changes nothing, and a refused consent write is logged instead of failing the visitor's submission.
- 1.4: changed tests: the Preview step tests gained `needsMarketingConsent`, the status matrix gained the import edges, and the forms integration suite gained the two consent cases (pending plus one captured email, and untouched when unticked).
- 1.3: the double opt-in and sender verification links are registry templates whose URL arrives as a variable (`confirm_url`, `verify_url`), so the button label is editable while the path is built by code; this satisfies "structural URL" without adding a new registry field.
- 1.3: `CAMPAIGN_DOI_DAILY_LIMIT` (default 500) was added to `src/config/env.ts` in this task because 6.3 needs the install-wide cap, and to `.env.example` directly (only `scripts/dealflow/env-sync.mjs` may touch `.env`).
- 1.3: double opt-in tokens are single-use through one guarded `UPDATE ... RETURNING` (`consumeMarketingToken`); unsubscribe tokens are reusable and never expire, because the same link can appear in many sends and the token is the credential.
- 1.3: this codebase has no CSRF middleware or public path allow-list (Part 13 Decision), so the "exemption" is simply that the `/u/{token}` POST route never calls `guardCsrf`; the page buttons are server actions and the one-click path is the route.
- 1.3: the one-click route answers 200 for an unknown token as well, so the endpoint cannot be probed, and it uses the public `emailTracking` limiter fail-open, because a real recipient must be able to unsubscribe during a flood.
- 1.2: the marketing and campaign vocabularies moved to `src/constants/{marketing,campaigns}.ts` so the status chip and the change dialog can import them without the drizzle schema; the schema files re-export the same arrays and `db:generate` reports no schema change.
- 1.2: a repeat of the current status is a no-op (no consent event), because the event log must not claim a transition that did not happen.
- 1.2: the suppression sync (new person, changed primary email) writes the suppression status with source `system` outside the 6.2 table, because the table has no `not_subscribed` to `unsubscribed` edge while 6.2 requires the suppressed address to land on the suppression status.
- 1.2: `person.marketing_status_changed` joined `DOMAIN_EVENT_TYPES`; `conditionTarget` in `automations/definition.ts` maps it to person, and it is not a trigger type, so automations are unaffected.
- 1.1: `db:generate` produced `0094_dashing_switch.sql`; it was renamed to `0094_dealflow_campaigns.sql` with the journal tag updated, and the `campaign_settings` singleton was appended with `ON CONFLICT DO NOTHING`, so a fresh database always has the row (the Part 13 convention).
- 1.1: `marketing_tokens` carries purpose `sender` and a nullable `sender_id` in addition to 6.3's `doi` and `unsub`, because 6.9's sender verification uses the same single-use token table; the check constraint lists all three.
- 1.1: the hidden nurture campaign link sits on `sequence_steps.campaign_id` (`ON DELETE SET NULL`), so deleting a step does not delete its history and there is no second mapping table.
- 1.1: `campaigns.send` and `marketing.manage` joined `HIGH_RISK_FLAGS`, because they let a permission-set editor grant bulk mail and the consent export without admin authority, matching how `documents.manage` and `forms.manage` are treated.
- 1.1: the error-id registry test's domain allow-list gained `MARKETING` and `CAMPAIGN`; the registry test fails closed on an unknown domain, so this is the required test update for the new ids.
- 0.2: new jobs register in `registerAllJobs` (`src/server/worker.ts`) with queue names in `src/constants/jobNames.ts` and producers through `getBoss()`; the e2e harness already runs that worker.

## Owner actions
- TODO(owner): set all three `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and `GOOGLE_WORKSPACE_DOMAIN` values in `.env` if you want Google sign-in; they are blank now so the app runs without Google SSO.
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.
- TODO(owner): push is still off because `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are empty. Run `pnpm push:vapid`, add all three to `.env`, then restart the app and worker.

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2). Recreate it with `npm install --prefix /tmp/dealflow-tools --cache /tmp/npm-cache pnpm@9.15.9` if `/tmp` was cleared.
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before manual test runs; `pnpm test:unit` and `pnpm test:integration` already bake these in. Run unit and integration tests WITHOUT `GOOGLE_*=` overrides (`vitest.setup.ts` supplies its own).
- Commands that load `.env` (`pnpm build`, `db:migrate:dev`, `db:generate`, `db:seed:demo`) carry `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` as a habit; `.env` has all three blank now, so they are redundant but harmless. Check emptiness only, never print values.
- `npm view` in this sandbox needs `--cache /tmp/npm-cache --logs-dir=/tmp/npm-logs` (writing `~/.npm/_logs` is blocked).
- Build: `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN= ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host database commands: `export DEV_DB_URL=postgres://warpdrive:warpdrive@localhost:5434/warpdrive` and prefix `DATABASE_URL=$DEV_DB_URL` (`.env` targets the container network).
- Dev stack: `DEV_PG_PORT=5434 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up` (Postgres 5434, MinIO S3 9100, MinIO console 9101). Never bind 3001, 8080, 9000 or 5433 (the owner's `dealflow-prod`) and never touch port 3333 or 3000.
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers` (reinstall browsers with `pnpm exec playwright install chromium` if `/tmp` was cleared); ports 3210/3211; every run is `MINIO_PORT=9100 DEV_PG_PORT=5434 pnpm e2e` (and `... pnpm exec playwright test ...`). Smoke: `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke` (ports 3310/3311/3312).
- Docker 24.0.5 is up with 8.2 GB free in the VM (95.0 GB total) as of 2026-11-10 00:57; the dev stack provides Postgres on 5434 and MinIO on 9100/9101 (`pnpm dev:up` brings it back after a reboot or a Docker restart). Never prune; if a build fails with "no space left" after Task 0.1, record the step SKIPPED and end `COMPLETE WITH OPEN ISSUES` (section 10).
- Progress check: `pnpm check:progress` (final: `pnpm check:progress --final`).
- Document PDFs: `DOCS_CHROME=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome pnpm docs:pdf` if the default browser path is not found.

## Final report
(written in Tasks 5.5 and 5.6)
