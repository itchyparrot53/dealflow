# PROGRESS: dealflow-wd-p5-v1

STATUS: IN PROGRESS
Current: 5.1 · Last updated: 2026-10-21 02:33

## Phase base commits
- Phase 0: ebbf7d2e3a2c5f3e42373785db224dc8f5d1bfbf
- Phase 1: 1673688
- Phase 2: 682fb2d
- Phase 3: 1b46554
- Phase 4: 4fc94b8
- Phase 5: 7d9cd58

## Tasks
- [x] 0.1 Start Part 5: progress files, kit and baseline
- [x] 0.2 Trusted client IP (test-first)
- [x] 0.3 Automations schema and migration
- [x] 0.4 Pure core: definition, trigger matching, IP ranges, signatures (test-first)
- [x] 0.5 Phase 0 QA gate
- [x] 1.1 Emit from recordChange (test-first)
- [x] 1.2 Create and document events
- [x] 1.3 Dispatcher, snapshot and retention (test-first)
- [x] 1.4 Phase 1 QA gate
- [x] 2.1 Runner, conditions and the capability (test-first)
- [x] 2.2 Core actions
- [x] 2.3 Email and AI actions
- [x] 2.4 Phase 2 QA gate
- [x] 3.1 Safe delivery (test-first)
- [x] 3.2 Subscriptions service, test send and redeliver
- [x] 3.3 Phase 3 QA gate
- [x] 4.1 Automations list and editor
- [x] 4.2 Run log
- [x] 4.3 Describe it and the template gallery
- [x] 4.4 Webhooks settings and delivery log
- [x] 4.5 Demo seed and docs
- [x] 4.6 Phase 4 QA gate
- [ ] 5.1 E2E automations spec and screenshots
- [ ] 5.2 Integration suite and smoke
- [ ] 5.3 Independent review and hardening
- [ ] 5.4 Final checklist
- [ ] 5.5 Final report and completion

## QA log
- Baseline: install ok · typecheck ok · lint ok (14 warnings) · build ok (a first attempt hit the known `ENOTEMPTY` race on `.next`; cleared and retried) · unit 5063/5063
- Phase 4 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5124/5124 · automations/webhooks 35/35
- Phase 3 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5124/5124 · webhooks/events 30/30
- Phase 2 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5124/5124 · automations/events/ai/notifications 106/106
- Phase 1 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5124/5124 · events/documents/deals/collaboration 219/219
- Phase 0 gate: commands green · typecheck ok · lint ok (14 warnings) · build ok · unit 5124/5124 · documents 45/45

## Decisions
- 0.1: section 4 starting point matches exactly: PROGRESS.md said `dealflow-wd-p4-v1` with `STATUS: COMPLETE`, and HEAD was `ebbf7d2e3a2c5f3e42373785db224dc8f5d1bfbf`, so this run starts fresh at Task 0.1 as section 0 rule 1 expects.
- 0.1: the kit arrived untracked as `dealflow-wd-part5-kit/` at the repo root, so I moved it to `PLAN AND EXECUTE/dealflow-wd-part5-kit` (matching the Part 1 to 4 layout), added the root `PLAN-PART5.md` symlink and copied the kit's `scripts/check-progress.mjs` over the root copy (byte-identical; `PLAN_FILE` is now `PLAN-PART5.md`), per section 4's kit row.
- 0.1: no `dealflow-wd-part5-kit.zip` exists in the tree (the kit arrived as a folder), so `.git/info/exclude` needed no new entry; `/dealflow-wd-part2-kit.zip` remains the only zip entry there.
- 0.1: the next free migration number is 0083 (the last file is `0082_dealflow_document_notifications.sql`), so the automations migration keeps the planned name `0083_dealflow_automations`.
- 0.1: `grep -rl "recordChange(" src/features` lists 21 files, of which 2 are tests and 1 is `changeLog.ts` itself, so 18 real callers match section 4: the deal workspace edit paths (stage, owner, won/lost, participants, followers, merge, duplicate, delete, convert), `deals/{dealUpdate,dealUpdateChangeLog,dealMove,archiveDeal,deleteDeal}`, `contacts/merge`, `leads/leadConvert` and `products/dealTerms`.
- 0.1: creates do NOT call `recordChange`: `createDeal` (`dealActions.ts`), `createPerson` (`personsRepo.ts`), `createOrg` (`orgsRepo.ts`) and `createActivity` (`activities/repo.ts`) insert directly, so Task 1.2 will add `emitDomainEvent` to each create service and list those upstream edits in UPSTREAM.md.
- 0.1: saved-filter targets are `["deal", "person", "organization", "lead"]` (`SAVED_FILTER_TARGET_ENTITIES` in `src/features/saved-filters/schemas.ts`), so automation conditions are offered for deal, person and organization exactly as 6.7 says, never for lead.
- 0.1: the encryption helper to reuse for webhook secrets is `src/features/email/crypto.ts` (`encryptToken`/`decryptToken`, AES-256-GCM with `TOKEN_ENCRYPTION_KEY`, bytea output), the same one Part 2 uses for mail passwords.
- 0.1: pg-boss schedules live in `src/server/worker.ts` and queue names in `src/constants/jobNames.ts` (as Part 4 did for `documents.overdue`), so the dispatcher, rotting, retention and webhook jobs register from that worker.
- 0.1: pnpm 9.15.9 (from `/tmp/dealflow-tools`), Node 24.16.0 and Docker 24.0.5 are available, and the `subagent` tool is available, so the Task 5.3 review can use it.
- 0.1: baseline green: install `--frozen-lockfile` up to date, typecheck ok, lint ok (14 warnings, 0 errors), build ok (a first attempt hit the known `ENOTEMPTY` race on `.next`; cleared and retried), unit suite recorded in the QA log.

- 0.2: the nine `clientIp` cases were written first and run red (missing `./clientIp`) before the implementation; all nine passed after.
- 0.2: `clientIp` lives in `src/features/net/clientIp.ts` and replaces Part 4's first-entry helper (removed from `publicDocuments.ts`, which now imports it), so the documents page and both public POST routes share one rule: hops are counted from the right, `hops=0` trusts only `x-real-ip`, and a chain shorter than the hop count falls back to the leftmost entry.
- 0.2: `TRUSTED_PROXY_HOPS` (integer 0..5, default 1) and `WEBHOOK_ALLOW_PRIVATE` (boolean, default false) are appended to the env schema and `.env.example`; `src/constants/automations.ts` now holds every 6.1 constant plus `DOMAIN_EVENTS_CHANNEL`, the LISTEN channel name 6.5's emit needs.
- 0.2: `src/server/rateLimit.ts` still reads `x-forwarded-for` directly for the signed-in limiter; it already takes the last entry (equivalent to the new default of one hop), sits outside 6.2's named paths, and changing its missing-header `SHARED_BUCKET` fallback would alter behaviour, so it is logged for the checklist instead of rewritten.

- 0.3: `drizzle-kit generate --name dealflow_automations` produced `0083_dealflow_automations.sql` creating exactly the five tables of 6.4 (`domain_events`, `automations`, `automation_runs`, `webhook_subscriptions`, `webhook_deliveries`), and `pnpm db:migrate:dev` applied it to the host dev database; all five tables and every named index were confirmed by query.
- 0.3: `txid` is a Drizzle `bigint` in `number` mode defaulting to SQL `txid_current()`, and `event_id` in runs and deliveries is nullable with no FK so event retention can delete events while the run and delivery logs outlive them, as 6.4 notes.
- 0.3: `secret_enc` reuses the same local `bytea` customType `src/db/schema/email.ts` uses, so encrypted webhook secrets are bytea exactly like mail passwords and OAuth tokens, and `steps` defaults to `'[]'::jsonb`.

- 0.4: the three test files were written first and run red (all three failed with "Cannot find module") before any implementation; the pure modules then made all 57 cases pass.
- 0.4: 6.3's literal `E_AUTOMATION_INPUT_INVALID` and `E_WEBHOOK_INPUT_INVALID` cannot satisfy the registry's enforced `E_<DOMAIN>_<NNN>` format (`errorIds.test.ts`), so they are `AUTOMATION_INPUT_INVALID: "E_AUTOMATION_006"` and `WEBHOOK_INPUT_INVALID: "E_WEBHOOK_005"`, following Part 4's `E_DOC_011` precedent; the other nine 6.3 IDs use their numbers unchanged, and AUTOMATION plus WEBHOOK joined the registry's domain allow-list in the test.
- 0.4: the trigger helpers are generic over the literal type; a plain `(type: TriggerType)` helper widened every variant's `type` to the whole union, which collapsed Zod's discriminated union and broke narrowing (the first typecheck failure), so the fix was generics, not a cast.
- 0.4: `deal.updated` with `fields: []` matches any change, because the editor leaves the field list unset by default and an empty list means the same thing; `matchesTrigger` still requires one of the listed fields when the list has entries.
- 0.4: the signature test pins the HMAC vector `38877139021993b830af32feea6e18a8da83eb2f6e49ee50bd9e4cf4ca4d3789` computed once with `node:crypto` for secret `whsec_test`, timestamp `1700000000`, body `{"a":1}`, so a change to the signing input fails instead of agreeing with itself.
- 0.4: 6.7 types the condition as the deal `FilterDefinition`, so the schema validates deal fields only; Task 2.1 will decide how a person/organization condition target evaluates a stored condition and log it then.

- 0.5: the first gate `pnpm lint` run failed on formatter output and two type-aware rules (`no-unnecessary-condition` on an `Object.values` check, `switch-exhaustiveness-check` on `conditionTarget`); fixed in `0.5: fixes round 1` by running the repository formatter over the new files, checking each `update_deal` field explicitly, and listing every event type in the switch, then the gate passed with the baseline's 14 warnings.
- 0.5: no `qa` review at this gate (fast profile, rule 9.4). Phase 1 base is the commit before the gate, matching Part 4's recorded base.

- 1.1: the four integration cases were written first and run red (the stage case needed the CAS `expectedUpdatedAt` the existing input schema requires), then all four passed; the deal field names `recordChange` receives are `stageId`, `status`, `deleted`/`deletedAt` and the activity completion field is emitted by the activity service in Task 1.2.
- 1.1: `emitDomainEvent` inserts in the caller's `DbOrTx` and then `NOTIFY dealflow_domain_events`, which Postgres delivers on commit; a failed NOTIFY only logs, because the dispatcher also polls, and a rolled-back transaction leaves no event and no notification.
- 1.1: the chain travels in an `AsyncLocalStorage` context (`chainContext.ts`) so the runner can open a chain without changing any service signature; `eventTypesForChange` treats `deletedAt` like `deleted` because the deal workspace path uses the former and the deals path the latter.

- 1.2: the create services now emit `deal.created`, `person.created`, `organization.created` and `activity.created` inside their own transaction; `createOrg` was not transactional before, so its insert and event were wrapped in one, and `completeActivity` emits `activity.completed` only on a false-to-true turn.
- 1.2: document events are `document.sent` (both issue and markSent path through `issueDocument`), `document.viewed` (first view only, quote and invoice), `document.accepted`/`declined`, `invoice.overdue` (one per `RETURNING id` row), `invoice.paid` (when the summed payments reach the total) and `invoice.voided`; the public view/accept/decline writes were moved into transactions so update and event commit together.
- 1.2: the one audited path that bypassed `recordChange` is `enrichment/prospectApplyItem.ts`'s `writeChangeLogs`; it now emits `person.updated` per field in the caller's transaction and takes the caller's `AbortSignal`, and `UPSTREAM.md` gained a Part 5 section.
- 1.2: the three new cases pass (7/7 in the events file) and the documents plus activities integration files still pass (151/151).

- 1.3: the seven new cases were written first and run red (missing dispatcher, rotting and retention modules); after implementation the file passes 14/14.
- 1.3: the dispatcher claims its batch with `FOR UPDATE SKIP LOCKED`, groups `.updated` rows by `txid`/entity/type (changes concatenated, lowest id kept), writes run rows with `ON CONFLICT DO NOTHING` as the loop guard, marks the claimed rows processed and enqueues `automations.run` and `webhooks.deliver` only after the commit.
- 1.3: the worker runs the dispatcher on a `DISPATCH_POLL_SECONDS` interval plus a `LISTEN dealflow_domain_events` client borrowed from the shared pool, with one in-flight pass; the interval is unref'd so it never holds the process open, and dispatcher failures are logged, never thrown at the worker.
- 1.3: snapshots are built at dispatch time; a deal's currency comes from `deal_terms` or `env.BASE_CURRENCY`, a soft-deleted record yields `{ id }`, and documents expose `publicUrl` built from `BASE_URL` plus the public id.
- 1.3: the rotting rule is `filterAst`'s exact condition (`status = 'open'` and `stage_entered_at <= now() - (rotting_days + 1) days`) with a `NOT EXISTS` guard for any `deal.rotting` event created since the stage was entered; retention deletes only processed events older than 30 days and finished runs and deliveries older than 90 days.

- 1.4: the first gate fixes were formatter output, a cognitive-complexity cap on `eventTypesForChange` (the deal mapping became `dealEventTypes`) and a nullable predicate in the snapshot's phone lookup; after `1.4: fixes round 1` the gate passed with the baseline's 14 warnings.
- 1.4: no `qa` review at this gate (fast profile, rule 9.4). Phase 2 base is the commit before the gate.

- 2.1: the eight cases (five runner, three service) were written first and run red, then passed; the runner claims the run row `FOR UPDATE` and treats a finished row as a no-op, so a duplicate queue delivery cannot run twice.
- 2.1: conditions reuse the list compilers: a deal target runs `filterToSql` with the `d`/`p`/`s`/`o` joins its allow-list expects, while a person or organization target validates and compiles with the contact filter (a deal-shaped condition that does not fit is treated as `condition_false`, never as an error).
- 2.1: actions go through a handler registry (`actions/registry.ts`); an unregistered action fails its step with `E_AUTOMATION_003`, so the runner is testable with an injected executor before the real actions land in 2.2.
- 2.1: `automations.manage` is a new global flag, also listed in `HIGH_RISK_FLAGS` and the `GlobalAction` union, admin-only by default; no migration was needed because the flag registry is code-defined, exactly like `documents.manage`.
- 2.1: the `automation` notification kind needed migration `0084_dealflow_automation_notifications` (`ALTER TYPE`), and the enum and preferences assertions were updated to 14 values and the new `automation: false` email default, without weakening either assertion.

- 2.2: the four new cases were written first and run red (missing action modules and a failing assertion trio), then the file passed 12/12; the case isolation added a `beforeEach` that clears automations and marks pending events processed, because one case's enabled automations otherwise ran against the next case's records.
- 2.2: `update_deal` calls the deal page's own services (`updateDeal` for the close date, `changeStage`, `changeOwner`, `markWon`, `markLost`) and re-reads the deal before each CAS-based step, so the optimistic timestamp is never stale.
- 2.2: `create_activity` uses `createActivity`, `add_note` uses `createNote`, and `notify_user` uses `createNotification` with the new `automation` kind and the deal as visibility parent; a notification suppressed by the recipient's visibility is treated as a successful step (nothing to deliver, nothing to fail).
- 2.2: subject, note body and message render through Part 4's `renderVariables` with a deal context built by `actions/context.ts` (`deal.*`, `person.*`, `organization.name`, `owner.*`).

- 2.3: the four cases were written first and run red (missing modules, then three fixture mistakes), then passed 16/16 with the rest of the file; the cooldown case needed the second deal to reuse the first deal's person, because the cooldown is per automation and person.
- 2.3: the email action reuses the documents send shape (`getActorMailboxStatus`, `resolveMailProvider`, `sendEmail`, `linkDealId`/`linkPersonId`) and renders the saved `email_templates` row; `send_email` skips with `E_AUTOMATION_005` when there is no person, no address, no mailbox, an unowned template, or an `email:<personId>` step in this automation's last 24 hours.
- 2.3: the AI actions call `summarizeDeal`, `scoreDeal` and `draftEmail` as the hydrated creator, so provider selection, company and user caps, the rate limit and usage rows are Part 1's own; the summary is written as a note (summary, risks, next steps) and the draft is saved with `saveDraft`, never sent.
- 2.3: tests install the fake IMAP transport through `setSendEmailActionDepsForTest` (the same injection pattern as Part 4's send) and the deterministic provider through `setAiProviderForTest(fakeProvider())`; the cap case sets the company limit to zero and expects `E_AI_COMPANY_LIMIT` on the step.

- 2.4: the gate fixes were formatter output, a complexity split in `update_deal` (per-field step helpers) and in the runner (condition check and step execution extracted), the two test executors that were `async` without an `await`, and the missing `automation` case in the notification email renderer; after `2.4: fixes round 1` the gate passed with the baseline's 14 warnings.
- 2.4: no `qa` review at this gate (fast profile, rule 9.4). Phase 3 base is the commit before the gate.

- 3.1: the implementation was drafted before its cases were written, so this task is not claimed as test-first; all ten cases passed on their first run.
- 3.1: delivery uses `http(s).request` with a `lookup` that resolves every address and refuses the request inside the lookup when any address is blocked, so there is no check-then-connect gap; redirects are never followed, the response read is capped at `WEBHOOK_MAX_RESPONSE_BYTES`, and the timeout is `AbortSignal.timeout`.
- 3.1: a 2xx resets `consecutive_failures` and sets `last_delivery_at`; 410 disables with "Receiver returned 410 Gone"; other failures increment both counters, retry up to five attempts with the 6.10 backoff and then fail; ten consecutive failures disable the subscription and send one system email to the creator (with both text and HTML parts).
- 3.1: a disabled subscription marks the delivery failed with `E_WEBHOOK_004`, a missing delivery or subscription returns `E_WEBHOOK_001`, and an undecryptable secret fails the delivery without touching the receiver.

- 3.2: the six new cases pass first time after the service was written, 16/16 in the file; create returns the plaintext secret exactly once and every read selects only `SAFE_COLUMNS`, so no API can return the sealed value.
- 3.2: `rotateSecret` replaces the sealed value and returns the new plaintext once, `setEnabled(true)` resets `consecutive_failures` and `disabled_reason`, `redeliver` copies the payload and event type into a new pending row, and `sendTest` inserts a real synthetic `ping` delivery and runs it synchronously so the result appears in the delivery log.
- 3.2: reads live in a tRPC `webhooks` router (list, get, deliveries, all admin-gated inside the service), while mutations are server actions that own CSRF and the session exactly as the documents actions do.

- 3.3: the gate fixes were the formatter, one unnecessary type assertion in the DNS error path, and a complexity split of `deliverWebhook` into attempt, success, 410, and retryable-failure recorders; after `3.3: fixes round 1` the gate passed with the baseline's 14 warnings.
- 3.3: no `qa` review at this gate (fast profile, rule 9.4). Phase 4 base is the commit before the gate.

- 4.1: the list is a server page (admin-gated by `automations.manage`) feeding a client table with the enable switch, row menu and delete dialog, and "New automation" creates a draft then opens the editor; the editor holds the definition in local state and saves once through `updateAutomationAction`, with an inline error on `E_AUTOMATION_INPUT_INVALID`.
- 4.1: `ConditionEditor` is the section 10 fallback, a small field/operator/value builder over the deal fields `filterToSql` supports, rather than an embedded saved-filter builder; it reuses `FILTER_FIELDS`/`OPS_BY_FIELD` so every offered pairing compiles.
- 4.1: the template gallery and "Describe it" buttons are deferred to Task 4.3 with the dialogs they open, so this task ships the list and the editor only; both dialogs and their two list buttons land in 4.3.
- 4.1: `Select` and `Switch` gained an optional `testId` (the Part 4 `Checkbox` precedent) because Radix owns their root nodes; the settings nav gained the Automations item, shown to admins only, and the `automations` tRPC router joined the app router.

- 4.2: `RunLog` reads the router's last-100 runs and renders time, record link, status badge and skip reason, with collapsible per-action steps; the editor gained Definition and Run log tabs, and the run table carries `automation-run-row` with `data-status` for the e2e poll.

- 4.3: the three cases pass, 19/19 in the file; they also caught a real defect from 4.1: `import "./actions"` in the runner had started resolving to the new server-actions `actions.ts` instead of the `actions/` index, so no action had a handler. The import is now `./actions/index` with a comment explaining why.
- 4.3: 6.7's `notify_user.to` lists only `deal_owner`, but 6.9's template 6 notifies the automation owner; the union gained `automation_owner`, the handler resolves it to the creator, and a notification on a record without a deal now uses that record (organization or person) as the visibility parent instead of refusing.
- 4.3: `describe.ts` sends the install's real ids and relies on `chatJson`'s built-in one repair round (which sends the validation issues back); a second parse failure becomes `E_AUTOMATION_004`. The deterministic fake reads the first activity type from the prompt and returns "deal won, follow-up call in 1 day".
- 4.3: "Draft it" creates the drafted automation disabled and opens the editor with `?drafted=1` and the "Review before saving" note, so an AI draft can never run before an admin saves it; template cards create the template as a disabled automation in the editor.

- 4.4: `/settings/webhooks` renders the subscription table with status (enabled, or disabled with its reason), the row menu (edit, send test, rotate, delivery log, enable/disable, delete), the grouped event checkboxes and the one-time secret panel with the exact "Copy this secret now. You won't see it again." copy.
- 4.4: the delivery log is a dialog that queries the last 100 deliveries when opened, shows status/attempts/code/duration, expands the payload and can redeliver (then invalidates the query); the settings nav gained the Webhooks item for admins after Automations.
- 4.4: the webhook dialog is remounted with a key per open target instead of resetting its form from an effect (the React lint rule forbids synchronous setState in an effect), and `pnpm build` lists `/settings/automations`, `/settings/automations/[id]` and `/settings/webhooks`.

- 4.5: the seed adds `scripts/seed-demo-automations.ts` (template 1 and template 3 as disabled "Demo: " automations, and one disabled `https://example.invalid/hooks/dealflow` subscription with reason "Demo"), runs from `seed-demo.ts`, and a real `pnpm db:seed:demo` printed `demo_automations=2 demo_webhooks=1`.
- 4.5: the first re-seed failed on a pre-existing gap: `wipeDemo` deleted demo deals while Part 4 documents still referenced them with ON DELETE RESTRICT. It now deletes the demo deals' documents first; this was required to run the seed at all and is logged as a pre-existing upstream fix.
- 4.5: `docs/dealflow/AUTOMATIONS.md` and `docs/dealflow/WEBHOOKS.md` cover events, triggers, conditions, actions, the loop guard, AI actions, describe it, templates, run log, retention, the payload and signature example, retries, auto-disable and the blocked ranges; `UPSTREAM.md` has the Part 5 demo/docs section and the README gained "Automations and webhooks"; the e2e env sets `WEBHOOK_ALLOW_PRIVATE=true`.

- 4.6: the gate needed no fix round; it passed on the tree committed by 4.5 with the baseline's 14 warnings, 5124 unit tests and 35 automations/webhooks integration tests.
- 4.6: no `qa` review at this gate (fast profile, rule 9.4). Phase 5 base is the commit before the gate.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on every command that loads `.env`.
- TODO(owner): rebuild the dev stack so it reads the Part 4 and Part 5 migrations and schema once `0083_dealflow_automations` is applied: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`).
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
(written in Task 5.5)
