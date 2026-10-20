# PROGRESS: dealflow-wd-p2-v1

STATUS: IN PROGRESS
Current: 5.5 · Last updated: 2026-10-20 18:15

## Phase base commits
- Phase 0: 64363ce446a92308919921e7bcaa77ddf6ba2844
- Phase 1: 508cafc269715bd4cf1e68f676499bd0b01aed5b
- Phase 2: 21e78ca3fdbf88845c08ff6014ff662b75435905
- Phase 3: b016fdcb2b3b98e19c242553ebe00ecc7a8e6d5f
- Phase 4: 09b1c6ddad022b60b851575d8505c96b18ab4c04
- Phase 5: 7b0e3ff81e4e6d178850339828aa8afab8901196

## Tasks
- [x] 0.1 Start Part 2: progress files, kit and baseline
- [x] 0.2 Independent audit of Part 1
- [x] 0.3 Assistant confirm race and AI timeouts
- [x] 0.4 Password reset after email-link sign-in and atomic lockout
- [x] 0.5 Scripts, release tests and audit leftovers
- [x] 0.6 Phase 0 QA gate
- [x] 1.1 Rename the Gmail columns
- [x] 1.2 Mail tables
- [x] 1.3 MailProvider interface and Gmail adapter
- [x] 1.4 Send path on MailProvider
- [x] 1.5 Sync, attachments and trash on MailProvider; neutral inbound store
- [x] 1.6 Message-ID domain and notification emails via the system mailer
- [x] 1.7 Phase 1 QA gate
- [x] 2.1 Parser, Message-IDs, subjects and Bcc stripping
- [x] 2.2 Transport interfaces and real transports
- [x] 2.3 Filesystem fake transport
- [x] 2.4 Credentials and the connect service
- [x] 2.5 Email sync settings: connect form and Gmail option
- [x] 2.6 Phase 2 QA gate
- [x] 3.1 Folders, cursors and locations
- [x] 3.2 Inbound apply and threading
- [x] 3.3 Incremental sync and UIDVALIDITY reset
- [x] 3.4 Initial window and background backfill
- [x] 3.5 IDLE manager and sync cadence
- [x] 3.6 Sync integration tests
- [x] 3.7 Phase 3 QA gate
- [x] 4.1 SMTP send and the Sent APPEND
- [x] 4.2 Reply headers, thread ids and reconcile for IMAP
- [x] 4.3 Send throttle
- [x] 4.4 Attachments on demand and trash MOVE
- [x] 4.5 Send integration tests
- [x] 4.6 Phase 4 QA gate
- [x] 5.1 E2E mail spec and screenshots
- [x] 5.2 Live Purelymail check
- [x] 5.3 Integration suite, smoke and docs
- [x] 5.4 Independent review and hardening
- [ ] 5.5 Final checklist
- [ ] 5.6 Final report and completion

## QA log
- Independent review: QA RESULT FAIL (round 3) via fresh-context subagent · 3 rounds · round 1 FAIL (1 major, 5 minor) · round 2 FAIL (1 major, 5 minor) · round 3 FAIL (1 major, 2 minor) · all fixed · typecheck ok · lint ok · build ok · unit 4979/4979 · mail integration 24/24
- Phase 4 gate: commands green · typecheck ok · lint ok · build ok · unit 4975/4975 · mail/email/notifications integration 410/410
- Phase 3 gate: commands green · typecheck ok · lint ok · build ok · unit 4975/4975 · mail/email integration 351/351
- Phase 2 gate: commands green · typecheck ok · lint ok · build ok · unit 4975/4975 · mail integration 5/5
- Phase 1 gate: commands green · typecheck ok · lint ok · build ok · unit 4950/4950 · email/notifications/leads integration 480/480
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 4945/4945 · ai/auth/release integration 83/83
- Audit P1: subagent (fresh context) · QA RESULT PASS · 0/0/0
- Baseline: typecheck ok · lint ok · build ok (a first attempt hit an `ENOTEMPTY` race on `.next`; the retry after the tree settled passed) · unit 4945/4945 · integration 1788/1790 (the 2 `src/features/release/router.test.ts` failures are R4, fixed in Task 0.5)

## Decisions
- 0.1: moved the kit from the root folder to `PLAN AND EXECUTE/dealflow-wd-part2-kit` and committed it there, matching Part 1's layout, because section 4 allows a subfolder and the root already carries the Part 1 symlink; added the root `PLAN-PART2.md` symlink and copied the kit's `scripts/check-progress.mjs` (byte-identical) over the Part 1 copy at the path contract 6.2 names.
- 0.1: added the arriving `dealflow-wd-part2-kit.zip` to `.git/info/exclude` (local only) instead of committing or deleting it, because it is the transport container, not source.
- 0.1: ran the unit and integration baselines WITHOUT the `GOOGLE_*=` overrides, because `vitest.setup.ts` supplies its own Google test values and shell overrides shadow them (4 tests failed that way); only commands that load `.env` itself (`pnpm build`, `db:migrate:dev`) take the overrides.
- 5.3: the full integration suite passed 1819/1819 in 389 files (161.7 s), so the two release failures are gone; `DOCKER_BUILDKIT=0 pnpm smoke` printed SMOKE PASS and left no container or volume; `pnpm db:seed:demo` ran on a throwaway `dealflow_seed_p2` database (7 users, 54 deals, 125 messages) which was dropped afterwards.
- 5.3: `docs/dealflow/MAIL.md` documents the provider layer, connecting Purelymail, the limits and env vars, the Purelymail facts (no Sent auto-save, SEARCH lag, IDLE latency, HIGHMODSEQ 0, no SPECIAL-USE), the fake transport and the live check; the README has a short Email section; HEALTH-CHECK.md gained a Part 2 end table.
- 5.2: `pnpm mail:live-check` returned `status: ok` (send, APPEND uid 10, inbound in 5.8 s, Bcc stripped, reply references the first id, Sent search found it, Trash move done, 26.7 s total), written to `docs/dealflow/mail-live-check.json` and summarised in HEALTH-CHECK.md.
- 5.2: the check exposed two real issues and both are fixed: the waiter snapshotted INBOX after the send (so a fast arrival looked "known") and parsed Message-IDs are lowercased while the derived id kept the ISO string's case, so the comparison never matched; the script now normalises both sides.
- 5.2: Purelymail reports `specialUse: null` for every folder, which the live check recorded. `discoverFolders` now falls back to the folder name (including the last path segment), otherwise only INBOX would sync on this host.
- 5.4: review round 1 (subagent, fresh context) returned FAIL with 1 major and 5 minors. Fixed: the deal-timeline locator now waits on the deal page (the contact fallback is only for a contact with no deal), the profile-reset and thread-reply screenshots scroll their target into view (the reply shot waits for two reader cards and closes the composer), HEALTH-CHECK records the real 4975 unit tests, the E_MAIL_010 copy quotes the documented 250 default, and every APPEND failure branch increments `tries` up to `gave_up`.
- 5.4: review round 2 returned FAIL with 1 major and 5 minors. Fixed: the send action no longer passes its 8 s signal into `sendEmail` (IMAP now gets the 30 s budget) and the outbox no longer aborts after a provider send succeeded; the reply screenshot waits for two message cards and closes the composer; the inline APPEND session failure counts a try; two comments/messages no longer contain the checklist's literal `GOOGLE_WORKSPACE_DOMAIN` or `password`; the 5.1 decision text now matches the spec's behaviour.
- 5.4: review round 3 (the last of the three allowed) returned FAIL with 1 major and 2 minors. Fixed: `specialUseOf` strips IMAP's leading backslash (the earlier live-check "no flags" claim was this bug, not the host), with unit tests for `\Inbox`, `\Sent`, `\Junk`, `\Trash`, `\Archive` and `\All`; the IMAP provider uses `limits.maxRecipients` when given, with a direct test; the fake's CONDSTORE behaviour is now documented as modelling the real thing and pinned by a test, and the Purelymail fact in HEALTH-CHECK/MAIL is corrected.
- 5.4: after the round 3 fixes `pnpm mail:live-check` ran again and returned ok with real flags: INBOX inbox, Sent sent, Drafts drafts, Archive archive, Junk junk, Trash trash (inbound 5.7 s, reply 6.0 s, total 30.2 s). Unit 4979/4979, mail integration 24/24.
- 5.1: the e2e stack gets `MAIL_PROVIDER_FAKE_DIR=.e2e/fakemail`, a 5 s sync cadence, no IDLE and no backfill; `helpers.ts` gained `deliverFakeMail`, `fakeFolder`, `readFakeMail` and `waitForText`.
- 5.1: 01-auth now saves a PASSWORD session at the end (it used a magic-link session, which by R3 may change the password without the current one, so 02's current-password step could not find the field).
- 5.1: 06-mail disconnects the demo data's Gmail mailbox before connecting IMAP (demo1 already had a connected Gmail row), and `seed-session` now picks an open deal whose contact has exactly one open deal so `resolveLink` can auto-link it; when a deal is seeded the spec waits for the thread on the deal page and only uses the contact page when the contact has no deal; both paths assert the subject is visible.
- 5.1: `pnpm e2e` passes 16/16 across specs 00 to 06; the 8 `p2-*` screenshots exist and all 23 Part 1 screenshots are untouched. The spec retries the whole open-and-count step so a five-second sync cannot race it.
- 4.5: the nine required cases pass against the fake transport and real Postgres; the APPEND failure test builds a wrapper factory whose session fails only `append`, and the retry job takes an injectable `transports` so it can run on the working fake.
- 4.5: the daily-limit case seeds two sent attempts with one recipient each and passes `limits: { dailyRecipients: 2 }` to the provider, so the third send defers with a `scheduled_at` more than 20 hours out and no SMTP delivery.
- 4.4: `fetchAttachment` ranks the message's locations inbox, sent, archive, junk, trash, re-fetches that UID (null source means over the byte cap → `E_MAIL_011`), re-parses with `simpleParser` and returns the `idx:{n}` attachment; no location or no index gives `E_MAIL_013`.
- 4.4: `trashThread` groups the thread's locations by folder, MOVEs each group to the special-use Trash folder, replaces the rows from the returned UID map (reading the Trash folder's UIDVALIDITY once) and deletes the old rows; with no map the rows are deleted and the next sync re-adds them. The local `trashed_at` stamp stays with the caller, as for Gmail.
- 4.2: `replyHeaders` reads `email_message_headers` for the parent; `findSent` searches the Sent folder by Message-ID (SEARCH lag is irrelevant by the time reconcile runs); `describeSent` finds the attempt by its stored header, falls back to `imap:<header>` for the thread id and to the stored header for the RFC 822 values when no headers row exists yet.
- 4.3: `checkDailyQuota` sums the to+cc+bcc lengths of attempts marked sent in the last 24 h; over the cap the error is `E_MAIL_009` with `retryAt` = oldest counted send + 24 h + 1 min, `processSendAttempt` resets the row to pending with that `scheduled_at`, releases the claim and enqueues the scheduled send, returning `status: "deferred"`.
- 4.3: `sendEmail` rejects more than `MAIL_SEND_MAX_RECIPIENTS` before any row exists; the composer copy says "too many recipients" rather than quoting the number, because the limit is server-configurable and the message helper stays client-safe (no server env import).
- 4.1: the wire copy is `stripBccHeader(raw)` while the Sent APPEND carries the full message; the send returns as soon as SMTP accepts, and the APPEND runs in its own session with a 15 s budget so it can never abort an accepted send.
- 4.1: `mail_sent_appends` is written before the APPEND; a failure increments `tries` and `last_error_id`, and the five-minute retry job rebuilds the MIME from the stored payload, the fixed Message-ID and the thread's newest other message for In-Reply-To/References, marking `gave_up` at 12 tries.
- 4.1: the CRM copy's snippet comes from the attempt payload's text part (HTML stripped as a fallback), because the provider only receives the raw message; `sendEmail` picks a 30 s budget for IMAP and keeps 8 s for Gmail.
- 3.6: a message that already exists and reappears in another folder now reports its thread id, so the whole-thread trash state is re-evaluated when a location is added; a folder whose listing is empty but which reports zero messages has all its locations treated as vanished, while the "empty listing on a non-empty folder" guard stays.
- 3.6: the fake transport bumps the SOURCE folder's MODSEQ on `move`, mirroring a real server's expunge, so the sync notices vanished UIDs; without it the unchanged shortcut skipped the emptied folder.
- 3.6: the nine required cases run against the fake transport and real Postgres, including initial window plus backfill enqueue, header threading with a child before its parent, subject fallback, cross-folder dedupe, trash state both ways, UIDVALIDITY reset, person/deal linking, the no-change skip and the backfill walk to the clamp.
- 3.5: the IDLE manager scans every 60 s, caps at `MAIL_IDLE_MAX`, skips fake transports (and remembers them for the process), closes sessions for disconnected accounts, and backs off 1, 2, 4 minutes up to 30 per account after a session ends; a live session's `exists` event enqueues the regular sync job through the same queue, only when no tick is already pending.
- 3.5: `startWorker` owns the shutdown path: SIGTERM/SIGINT clear the idle timer, abort and close every IDLE session, then stop pg-boss gracefully.
- 3.5: the poll cadence comes from `env.MAIL_SYNC_CADENCE_SECONDS` and `jitterFor` uses `min(SYNC_JITTER_MODULO_SECONDS, cadence)`, so the default 90 s keeps the existing test numbers.
- 3.4: a window with more messages than MAIL_BACKFILL_MAX_PER_RUN applies the oldest 300 and moves the cursor ceiling to the earliest processed internal date (new `oldestMessageDate` on the apply result), so the next run continues below it; a complete window moves the ceiling to the window start, and the clamp sets `backfillDone` and clears `backfillBefore`.
- 3.4: the backfill job is registered from `registerAllJobs` after the email jobs, times out at 120 s, and re-enqueues itself with `startAfter: 30` while any folder remains; the initial enqueue stays singleton per account.
- 3.3: the initial pass sets `lastUid` to `max(uidNext - 1, newest applied uid)` and keeps `backfillBefore` for inbox/sent/archive only, so older mail is fetched by the backfill job instead of the incremental pass; junk and trash are listed whole and marked backfill-done.
- 3.3: the unchanged shortcut needs both a non-null HIGHESTMODSEQ match and a listing within 15 minutes, so a folder whose modseq is unknown (a server reporting 0) still lists every tick; vanished locations are ignored when the listing is empty but the folder reports messages.
- 3.3: the IMAP provider's `sync` hydrates the owner, opens a session, runs the engine and closes the session in `finally`; an auth failure marks the account `status = 'error'` with `last_error_id` so Settings offers Update password.
- 3.2: `resolveThreadKey` looks up stored headers first (In-Reply-To, then References newest to oldest), then falls back to a same-subject thread within 30 days that shares a non-self participant; the participant list is aggregated in one SQL query so the fallback never runs a query per thread.
- 3.2: `applyFolderMessages` checks existence per message, and only writes a location when the message is already known; a new message resolves its thread key, stores message and location in one transaction, so a failure never advances a cursor past an unstored message. A too-large message is parsed from its headers plus the fixed preview.
- 3.2: `reconcileTrash` leaves a thread with no locations untouched, marks a thread trashed only when every location is junk or trash, and clears `trashed_at` as soon as one message is visible again.
- 3.1: `discoverFolders` treats an unflagged INBOX as the inbox by path and drops drafts and unknown folders; the cursor and location helpers are typed on the schema, and `deleteFolderState` removes the folder's locations before the cursor so a UIDVALIDITY reset cannot leave orphan UIDs.
- 2.5: `ActorMailboxStatus` carries `provider` ("imap" when a credentials row exists) and `imapHost` from a LEFT JOIN; the settings page passes `googleEnabled = authMethods().google` and the provider, and the client shows the connect form for a missing, disconnected or failing mailbox plus "Update password" for a connected IMAP one.
- 2.5: the form pre-selects "Other IMAP/SMTP server" when the stored host is not the Purelymail preset, prefills the address and host for an update, and maps `E_MAIL_003/004/005/006` to the copy in 6.11; the Gmail alternative lives inside the form so it only appears when Google is configured.
- 2.5: the old tests targeted `data-status` on the status dot; the hook now lives on `mailbox-status` as 6.13 requires, so the dot assertion targets `data-health` and keeps its colour intent.
- 2.4: the Purelymail preset stays defined in `src/constants/mail.ts` (as Task 1.2 placed it) and `connect/presets.ts` is the typed lookup, so the UI and the service cannot drift.
- 2.4: `connectImapMailbox` tests IMAP and SMTP before any write, resets cursors/locations inside the transaction, and enqueues the first sync after commit; an enqueue failure is logged rather than undoing a stored connection, because the worker boot pass picks the mailbox up anyway.
- 2.4: a unique violation on `email_address` maps to `E_MAIL_006` (another user owns that address); `exchangeAndBind` and `softDisconnectMailbox` now delete the credentials row, which is what switches an account back to the Gmail provider.
- 2.4: `createImapProvider` ships as a skeleton (every method `E_MAIL_015`, empty headers, no-op close) so `resolveMailProvider` can already return kind "imap"; the connect integration test proves the five required cases against the fake transport and real Postgres.
- 2.3: the fake's `internalDate` is the .eml file's mtime (tests set it with `utimesSync`, and `fakeDeliver` accepts a `date`), so the initial-window and backfill tests can place mail in the past; the fake models CONDSTORE with a positive `highestModseq` that grows on append and move (a test pins it), and its `status` reads `meta.json` so `fakeResetUidValidity` is visible.
- 2.3: the fake SMTP delivers to the envelope recipients, not the parsed To header, because Bcc recipients are exactly the ones missing from the wire copy; every send is logged to `_smtp` and the sender's mailbox is created on the way.
- 2.2: `fetchSources` fetches metadata first and then the source only for messages within `maxBytes`, one `fetchOne` at a time inside a 25-UID batch (the server rejects overlapping fetches on one selected mailbox); `idle` opens its own connection so the polling session stays usable, and `highestModseq` 0n is mapped to null as the contract requires.
- 2.2: IMAP failures go through one mapper: `authenticationFailed` or an auth-looking message means `E_MAIL_004`, connection/TLS/timeout text means `E_MAIL_003`, everything else `E_MAIL_008` with the command name; contexts never carry the password. SMTP maps `EAUTH`/535 to `E_MAIL_004`, transport codes to `E_MAIL_003`, and other failures to `E_MAIL_001` (send) or `E_MAIL_003` (verify).
- 2.1: `providerAttachmentId` indexes mailparser's `attachments` array, not the MIME tree (the first attachment is `idx:0`), which is exactly what the re-parse on download will index into; the test pins that.
- 2.1: `parseRawMessage` falls back to stripping tags from the HTML part for the snippet when a message has no text part, and `maxBodyChars` caps both bodies; `parseTooLarge` reuses the same mapping from header bytes and replaces the body and attachments.
- 1.6: `enqueueSend` reads the account's `email_address` and uses the part after `@` (lowercased) as the Message-ID domain, falling back to `dealflow.invalid` only when the address is empty; the environment import left the outbox. The R6 unit test asserts the `umev.co.uk` tail.
- 1.6: `SendFn` is now `(to, SystemMail, signal) => Result<{ messageId }>` and the default sends through `getSystemMailer()`; the job's `email_accounts` lookup and connected-status check are gone, so a notification reaches a user with no mailbox. The old "suppresses when the recipient has no connected mailbox" test became "sends even when the recipient has no connected mailbox" (assertions strengthened to a real send to the user's address), and the unused mailbox fixture was removed from the visibility test; this is the plan's contract change, not a weakened assertion.
- 1.5: `storeInboundMessage` also returns `arrival` (deal id, thread, message, subject, sender) beside the contract's three fields, because the deal notification must run after the transaction commits while the decision (linked deal, not self-sent) belongs with the write; applyMessages only collects and sends it.
- 1.5: the shared store writes `email_message_headers` for inbound messages with a Message-ID, so threading works for both providers; the Gmail parser now extracts Message-ID, In-Reply-To and References with its existing header helper.
- 1.5: `resolveAttachmentDownload`, `trashThread` and the attachment route take a provider (and close it); `sweepAllMailboxes` skips accounts with a credentials row, so the Gmail-only spam sweep never runs against IMAP mailboxes.
- 1.4: `SendOutcome` carries the optional `SentMessage`; `storeOutboundCopy` uses it when present and otherwise calls `provider.describeSent` once, which is what the replay-repair path needs.
- 1.4: the Gmail adapter flags a post-accept metadata failure with `sent: true` and the provider id in the error context, and the outbox records the attempt as sent in that case; only the CRM-copy step fails, preserving the replay-repair behaviour the existing test asserts.
- 1.4: `storeOutboundCopy` now writes the outbound `email_message_headers` row; the `references` column is a reserved word in raw SQL, so it is quoted and its text[] value is built with `jsonb_array_elements_text` (a plain array parameter was expanded by drizzle).
- 1.4: `runSyncJob`/`runSendJob` take `resolveProvider` and close the provider in a `finally`; the send action resolves through `resolveMailProvider`, and the future-scheduled path uses a throwing stub provider.
- 1.4: the 17 affected test files now pass `gmailProviderForTest(db, accountId, fake)`; no assertion changed. Email integration 337/337, email unit 647/647.
- 1.3: `ResolveDeps` only carries `gmailClient` for now; the contract's optional `transports` field needs `MailTransportFactory`, which Task 2.2 creates, so it is added in Task 2.4 together with `createImapProvider`; the IMAP branch returns `E_MAIL_015` as the plan specifies.
- 1.3: the Gmail adapter's `send` does the second metadata read (thread id and snippet) and returns its error if that read fails, matching today's `storeOutboundCopy`, which also treats a failed fetch as a failed store; the caller reconciles by Message-ID.
- 1.3: `SentMessage.headers` for a reply come from the parent's `Reply-Thread` headers (inReplyTo plus the references chain), while `describeSent` reads the message's own Message-ID/In-Reply-To/References, because replay repair has no parent argument.
- 1.3: the rename shortened some lines enough that biome now formats `db/schema/mail.ts`, `email/outboxReconcile.ts` and `email/spamSweep.test.ts` differently; formatted only, no behaviour change.
- 1.2: `drizzle-kit generate --custom` kept the previous snapshot (the five renamed columns still read `gmail_*` in `drizzle/meta/0078_snapshot.json`), so I renamed those keys in the snapshot by hand before generating 0079; that keeps 0079 a pure add and every later diff clean.
- 1.2: this drizzle-orm version has no `bytea` in `pg-core`, so `mail.ts` defines the same `customType` the email schema uses for encrypted tokens; the encrypted password column is `bytea`.
- 1.2: env:sync appended the eight `MAIL_*` keys to `.env` (values are the defaults); `.env.example` documents them in a new `# Mail (IMAP/SMTP)` section.
- 1.1: renamed 89 source files plus 3 scripts (95 paths including the schema, the migration and its snapshot); the only Gmail names left are the allowed `parentGmailMessageId` / `parent_gmail_message_id` aliases, and `docs/dealflow/UPSTREAM.md` now records that upstream email fixes must be ported by hand.
- 1.1: `drizzle-kit generate --custom` needed the unique constraints updated to the new property names before it could serialize the snapshot; the empty migration was then filled with the five `ALTER TABLE ... RENAME COLUMN` statements from 6.5 and applied to the dev database (columns verified through `information_schema`).
- 0.6: gate fix round 1 fixed a typecheck error introduced in 0.5 (`readPackageVersion()` may be undefined; the enabled-path test now uses `getCurrentVersion()` and dropped an unused seeded user) and formatted the two test files; the phase gate then passed with the same assertions.
- CONTRACT CHANGE: 0.5 keeps Part 1's AMENDMENT A1 on `docker-compose.yml` (no `name: dealflow`): adding it now would rename the compose project and orphan the owner's running `warpdrive-main` volumes, so the dev stack keeps the folder-derived project name while the smoke test keeps its dedicated `dealflow-smoke` project. Audit finding A1.
- 0.5: scripts follow 6.2 (`test:unit` and `test:integration` bake the UTC/en-US environment, `build` sets `ALLOW_FIRST_LOGIN_ADMIN=false`, `mail:live-check` is added now and its script file arrives in Task 5.2).
- 0.5: R4 updated `release/router.test.ts` to the new default (`disabled: true`) and moved the cached-release assertions onto `computeStatus(..., false)` so the enabled path is still covered with every original assertion.
- 0.5: A2 extended `docs/dealflow/UPSTREAM.md`; A3 (226-line AssistantSheet) and A4 (paid-check process note) are ACCEPTED with reasons; R6 stays DEFERRED to Task 1.6; AUDIT-P1.md has no finding left without a status.
- 0.4: extracted the password change into `src/features/auth/passwordChange.ts`, not `passwordActions.ts`, because a `"use server"` module may export only server actions and the integration test must call the logic directly; the action keeps CSRF, the session and the Zod parse.
- 0.4: `PasswordCard` takes both `hasPassword` and `requiresCurrent` instead of the single `requiresCurrent` the plan names, so the "you signed in with an email link" note cannot appear for an account that has no password yet; the field is hidden whenever `requiresCurrent` is false, as specified.
- 0.4: the 15-minute link window is a SQL `now() - interval '15 minutes'` comparison on `session_auth_events.authenticated_at`; migration `0077_dealflow_session_auth` creates the table (next free number after 0076) and is applied to the dev database.
- 0.4: verified both new tests fail against the old code before committing: the lockout test leaves `locked_until` null, and the magic-link reset returns `E_AUTH_013`.
- 0.3: the R1 test warms two pool connections before the concurrent confirms, because with a cold pool the first confirm finishes before the second one's connection is established and the race never happens; with warm connections the old code produced two ok results and two notes, and the claim-first code leaves exactly one of each.
- 0.3: `confirmAiAction` claims with one `UPDATE ... WHERE status='pending' RETURNING *` and writes the result in a second update; a failed write downgrades the claimed row to `failed` (E_AI_010 stays in the tool result), and `rejectAiAction` uses the same claim.
- 0.3: the assistant actions already had a 90 s budget, so R2 only touched the five `chatJson` actions plus the OpenRouter client (`timeout: 55_000, maxRetries: 1`); the tRPC reads keep `SIG()` because they are database-only.
- 0.2: the fresh-context audit passed with 0 blockers, 0 majors and 0 minors; its four non-blocking observations are A1 to A4 in AUDIT-P1.md. A1 (compose `name`) stays as Part 1's AMENDMENT A1 and becomes a `CONTRACT CHANGE:` decision in 0.5; A2 (UPSTREAM list) is fixed in 0.5; A3 (226-line sheet) is a style deviation, accepted unless 0.5 touches the file; A4 is a process note with no code change.
- 0.2: R7 is the finding that Part 1's review fell back to a self-review; this audit satisfies it, and the row is closed in 0.5 with the other findings.
- 0.1: added `mailparser@3.10.0` and `@types/mailparser@3.9.0` with pnpm 9.15.9 from `/tmp/dealflow-tools`; the peer-dependency warning about `eslint-plugin-import` needing eslint <= 9 predates this task and changes nothing.

## Owner actions
- TODO(owner): `.env` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` set with `GOOGLE_WORKSPACE_DOMAIN` empty, which the all-or-nothing rule rejects. Set the domain or blank all three; this run passes `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` on every command that loads `.env`.
- TODO(owner): migration `0078_dealflow_mail_rename` is already applied to the dev database, so the running `warpdrive-main` app (still the Part 1 build) reads the old column names and will error on email screens until it is rebuilt: `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (no `-v`). Rebuild once Phase 1 lands.

## Open issues
- None

## Environment
- `export PATH=/tmp/dealflow-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/dealflow-pnpm-store` (pnpm 9.15.9 lives in `/tmp/dealflow-tools`; the global pnpm here is 8.9.2).
- `export TZ=UTC LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before tests (13 upstream tests assume UTC and en-US).
- Commands that load `.env` need `GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= GOOGLE_WORKSPACE_DOMAIN=` in front until the owner fixes the partial Google config.
- Build: `ALLOW_FIRST_LOGIN_ADMIN=false pnpm build`; if `next build` fails with `ENOTEMPTY`, remove `.next` and retry once.
- Host database commands: `DATABASE_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` (`.env` targets the container network).
- E2E: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/dealflow-pw-browsers`; ports 3210/3211.
- Smoke: `DOCKER_BUILDKIT=0 pnpm smoke` (the sandbox blocks buildx refs under `~/.docker/buildx`); ports 3310/3311/3312.
- Docker 24.0.5 is up; the owner's `warpdrive-main` stack holds 5433/9000/9001.

## Final report
(written in Task 5.6)
