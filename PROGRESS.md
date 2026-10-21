# PROGRESS: dealflow-wd-p6-v1

STATUS: IN PROGRESS
Current: 2.1 · Last updated: 2026-10-21 04:30

## Phase base commits
- Phase 0: 935685bd476eb7d5c75d51b3439a8ffe7711aa4c
- Phase 1: ceae046
- Phase 2: 8691903

## Tasks
- [x] 0.1 Start Part 6: progress files, kit and baseline
- [x] 0.2 Forms and booking schema and migrations
- [x] 0.3 Pure core: time zones, slots, fields, spam token, ICS (test-first)
- [x] 0.4 Phase 0 QA gate
- [x] 1.1 Forms service and the capability
- [x] 1.2 Public submit and events (test-first)
- [x] 1.3 Phase 1 QA gate
- [ ] 2.1 Booking pages service and busy time
- [ ] 2.2 Slots, booking and cancel (test-first)
- [ ] 2.3 Phase 2 QA gate
- [ ] 3.1 Forms admin screens
- [ ] 3.2 Public form page
- [ ] 3.3 Booking admin screens
- [ ] 3.4 Public booking and cancel pages
- [ ] 3.5 Triggers in the editors, demo seed and docs
- [ ] 3.6 Phase 3 QA gate
- [ ] 4.1 E2E forms and booking spec and screenshots
- [ ] 4.2 Integration suite and smoke
- [ ] 4.3 Independent review and hardening
- [ ] 4.4 Final checklist
- [ ] 4.5 Final report and completion

## QA log
- Baseline: install ok · typecheck ok · lint ok (14 warnings) · build ok (a first attempt hit the known `ENOTEMPTY` race on `.next`; cleared and retried) · unit 5124/5124
- Phase 0 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5191/5191 · pure core (zonedTime/slots/fields/spamToken/ics) 67/67
- Phase 1 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5197/5197 · forms/events/automations/leads integration SKIPPED (Docker daemon unresponsive; Testcontainers global setup hung for 15+ minutes and was killed, per section 10)

## Decisions
- 0.1: section 4 starting point matches exactly: PROGRESS.md said `dealflow-wd-p5-v1` with `STATUS: COMPLETE`, and HEAD was `935685bd476eb7d5c75d51b3439a8ffe7711aa4c`, so this run starts fresh at Task 0.1 as section 0 rule 1 expects.
- 0.1: the kit arrived untracked as `dealflow-wd-part6-kit/` at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part6-kit` (matching the Part 1 to 5 layout), added the root `PLAN-PART6.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical; `PLAN_FILE` is now `PLAN-PART6.md`). The untracked `dealflow-wd-part6-kit.zip` is added to `.git/info/exclude`, as `/dealflow-wd-part2-kit.zip` was.
- 0.1: the next free migration numbers are 0085 and 0086 (the last file is `0084_dealflow_automation_notifications.sql`), so the two Part 6 migrations keep the planned names `0085_dealflow_forms_booking` and `0086_dealflow_forms_booking_notifications`.
- 0.1: `src/db/schema/activities.ts` has `due_at`, `end_at`, `duration_minutes`, `done`, `assignee_id` and the all-day flag (`all_day`, commented next to `due_at`), so 6.6's busy rule maps directly: end = `end_at`, else `due_at + duration_minutes`, else 30 minutes, and `all_day` rows never block.
- 0.1: `leads.source_origin` is free text with no DB check (default `manually_created`); the closest web-form value is `web_form`, which already exists as a key in `src/constants/sourceChannels.ts`, so a lead created by a form sets `sourceOrigin = "web_form"` and `sourceChannel = "web_form"`.
- 0.1: there is no standalone person-by-email helper. The email-linking code (`src/features/email/linking.ts:63`, also `src/features/import/dedup.ts:33`) compares `${persons.primaryEmail} = ${email} and deleted_at is null`, and `primary_email` is `citext`, so that comparison is already case-insensitive; the submit and booking services reuse it and log it in their own tasks.
- 0.1: security headers are set by `next.config.ts` `headers()` (this project has no middleware by design), so 6.8's framing exception becomes a path-scoped entry for `/f/:path*` and `/book/:path*` carved out of the strict `frame-ancestors 'none'` entry, pinned by `next.config.test.ts`.
- 0.1: `SystemMail` (`src/features/mailer/types.ts`) is `{ to, subject, text, html }` with no attachments, so the booking confirmation carries the time, location and cancel link in the body only, and the `.ics` is offered solely as the confirmation page's "Add to calendar" data-URL download, per section 10.
- 0.1: pnpm 9.15.9 (from `/tmp/dealflow-tools`), Node 24.16.0 and Docker 24.0.5 are available, and the `subagent` tool is available, so the Task 4.3 review can use it.

- 0.2: `drizzle-kit generate --name dealflow_forms_booking` produced `0085_dealflow_forms_booking.sql` creating exactly the four tables of 6.4 (`web_forms`, `web_form_submissions`, `booking_pages`, `bookings`) with every named index and constraint; `drizzle-kit generate --custom --name dealflow_forms_booking_notifications` produced `0086`, filled with three `ALTER TYPE notification_type ADD VALUE` statements. `pnpm db:migrate:dev` applied both to the host dev database, and a query confirmed the four tables and the three new enum labels.
- 0.2: `fields`, `availability` and submission `values` are untyped `jsonb` columns (Part 5's `automations.definition` precedent), because the feature schemas own those shapes and importing feature types into `src/db/schema` would invert the dependency.
- 0.2: two constraints beyond the 6.4 column list are declarative guards for rules 6.8 already states: `web_forms_redirect_url_ck` requires an `https://` prefix, and `bookings_span_ck` requires `end_at > start_at`. Neither changes the planned shape; both keep a bad row out of the database even if a future caller skips the service.
- 0.2: adding the three notification kinds to `NOTIFICATION_TYPES` made the per-type exhaustive maps incomplete, so `deepLink.ts`, `NotificationItem.tsx`, `strings.ts` (feed and preference labels) and the notification email renderer gained entries now; otherwise a new-kind row would hit a missing key at runtime. Email defaults are off for `form_submission` and on for both booking kinds, per 6.8.

- 0.3: the five test files were written first (67 cases) and all five failed with "Cannot find module" before any implementation; the modules then made 67/67 pass.
- 0.3: `zonedToUtc` follows the plan's explicit test over its two-offset sketch, which returns the second occurrence of an ambiguous fall-back time. Both candidate offsets (sampled a day either side) are tried, only instants that render back to the requested wall clock count, the earliest valid one wins, and a spring-forward gap takes the later candidate, so it resolves forward by the gap. Pinned by London 2026-03-29 01:30 and 2026-10-25 01:30.
- 0.3: a slot window wider than 14 days is clamped to the first 14 days rather than refused (the public route rejects wider windows anyway, and clamping keeps a direct caller bounded).
- 0.3: the form spam token is signed with `env.WS_TICKET_SECRET`, the install's existing 32+ character HMAC secret, under a `dealflow-form-token:` purpose prefix so the two signature namespaces cannot be swapped. Comparison is constant time, future timestamps are rejected as forged, and the age bounds are `FORM_MIN_FILL_MS` and `FORM_TOKEN_MAX_AGE_MS`.
- 0.3: custom field mapping is `text` to text, `large_text` to long text, `numeric` to number, `date` to date and `single_option` to single option; those are the only types a form field may reference, checked both at definition time (`ALLOWED_CUSTOM_TYPES`) and at submit time, and a single-option value is normalised to the option id.
- 0.3: the eleven FORM and BOOKING error IDs from 6.2 landed here rather than in Task 1.1, because `zonedTime.ts` needs a registry ID for an impossible internal date; Task 1.1 consumes them for the services.
- 0.3: `buildIcs` takes an optional `now` for DTSTAMP so the exact-string test is deterministic; this is additive to 6.8's argument list, and an omitted `now` uses the current time.
- 0.3: `availabilitySchema` and `DEFAULT_AVAILABILITY` live in `slots.ts` (at most three ranges a day, `from < to`, no overlaps, HH:MM); `FORM_*`, `BOOKING_*` and `SLOT_RANGE_MAX_DAYS` live in `src/constants/formsBooking.ts`, and the section 6.2 copy in `src/constants/formsBookingStrings.ts`.

- 1.1: `forms.manage` joined `GLOBAL_FLAGS`, `HIGH_RISK_FLAGS` and the `GlobalAction` union; no migration is needed because the flag registry is code-defined, exactly as `automations.manage` was.
- 1.1: the service splits failures: a Zod failure of the whole input is `E_FORM_005` (inline issues), while definition semantics (ineligible custom field id, inactive owner, non-https redirect, stage outside the pipeline) are `E_FORM_002` with context issues.
- 1.1: `forms.update` merges the patch over the stored row before the cross-field checks, so a partial patch can never leave a deal form without a stage; `setFormActive` is an update of just that flag.
- 1.1: the forms router has an `options` query returning pipelines, stages, active users and the eligible custom fields in one read, so the editor does not fan out; every router procedure is admin-gated inside the procedure as well as at the page.
- 1.1: eligible custom fields are the active definitions on person, lead and deal limited to the five type names of 6.7; `ALLOWED_CUSTOM_FIELD_TYPES` is exported from `fields.ts` so the save-time check and the submit-time check share one set.
- 1.1: `public_id` is `randomBytes(12).toString("base64url")` (16 characters) generated in the service, and `redirect_url` is also guarded by the `web_forms_redirect_url_ck` check from 0.2.

- 1.2: the submit route was designed test-first: the integration file (`forms.integration.test.ts`, nine cases plus two route cases) was written before the service. Docker stopped responding while that file was being run (Testcontainers hung in global setup for over fifteen minutes and was killed), so the cases are written but not yet executed; the integration gate line is SKIPPED per section 10 and the rerun is an owner action.
- 1.2: a form submission runs in one transaction with the create services called on the transaction handle (a nested `.transaction()` is a savepoint), so person, organization, lead or deal, note, submission row, counter and the `form.submitted` event commit together or not at all. The notification is sent after commit and a suppressed or failed notification never fails the visitor's submission.
- 1.2: `job_title` is captured in the submission values and written into the note, not to the person: upstream `persons` has no job-title column, and Part 6's Definition of done 1 says the migrations add nothing beyond the four tables and three notification kinds.
- 1.2: a submission is created as the form owner via `hydrateActor` plus the existing services, with the owner's real flags in the create session; a lead gets `sourceOrigin = "web_form"` and `sourceChannel = "web_form"`, and a deal goes into the form's pipeline and stage.
- 1.2: the run row carries no event type, so the runner reads the retained event by `eventId` to decide whether a condition targets the visitor's person (`form.submitted`, `booking.created`, `booking.cancelled`) or the record itself; that keeps 6.8's condition target without a schema change.
- 1.2: a `form_submission` notification on a lead needed a lead visibility parent, so `VisibleRecord` gained a `lead` variant and `canActorAccessParent` a `lead` case; the lead rule reuses `canSee` (no pipeline gate) and the change is listed for UPSTREAM.md in 3.5.
- 1.2: framing is a path-scoped `next.config.ts` entry for `/(f|book)(/.*)?` carved out of the strict entry (a second CSP would be intersected, not loosened) and it drops `X-Frame-Options`; `next.config.test.ts` pins the public paths, the neighbours, and the scoped matcher.
- 1.2: the route rejects a body over `FORM_BODY_MAX_BYTES` with 413 and maps `E_FORM_001` to 404, `E_FORM_003` to 422 and `E_FORM_004` to 429 with `Retry-After`; the honeypot, a too-fast token and a forged token all answer 200 with the success copy and write nothing.

- TODO(owner): Docker stopped responding mid-run on 2026-10-21 (the owner's containers were no longer running when it came back). Restart Docker Desktop, then run `pnpm test:integration`, `pnpm e2e` and `DOCKER_BUILDKIT=0 pnpm smoke`, and restart the dev stack with `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on every command that loads `.env`.
- TODO(owner): rebuild the dev stack so it reads the Part 4 and Part 5 migrations and schema once `0083_dealflow_automations` is applied: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
- TODO(owner): add the currency rates your deals need in Settings > Currencies. The live database base is GBP and has no stored EUR or USD rate.

## Open issues
- Docker Desktop became unresponsive during Task 1.2: `docker ps` and `docker images` time out (30 s), the owner's containers stopped, and `pnpm exec vitest run --project integration src/features/forms` hung in Testcontainers global setup for over fifteen minutes before being killed. The Phase 1 named integration command is therefore SKIPPED, not green; the test files are committed and must be re-run once Docker recovers.

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
