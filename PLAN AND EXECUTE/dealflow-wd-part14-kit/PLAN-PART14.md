# PLAN: Dealflow on warpdrive, Part 14: Campaigns (email marketing, Pipedrive Campaigns parity)

> Plan ID: dealflow-wd-p14-v1 · Written: 2026-11-10 (owner request; planner researched Pipedrive's Campaigns add-on) · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 5, fast verification profile, no human in the loop · Type: change to existing project

Parts 1 to 13 are finished (`PROGRESS-P1.md` to `PROGRESS-P12.md`, and `PROGRESS.md` until Task 0.1 renames it to `PROGRESS-P13.md`). Part 14 adds Campaigns: consent-managed marketing contacts, a block email builder with templates, live CRM segments, scheduled and throttled bulk sending, tracking with timeline and alerts, automated drip sequences, and campaign reports with comparative insights, all in one tier with no billing. Where it says "find", locate the existing code and change it; log a file as a Decision only when it is surprising.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 5** in fresh-context sessions, one phase per session. Parts 1 to 13 (`PLAN-PART1.md` to `PLAN-PART13.md`) are finished; their code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART14.md` in full and PROGRESS.md (open earlier `PLAN-PART{N}.md` files only where this plan points to them). If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p14-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 13's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 5.6, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 5.3.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.3, 1.6, 2.5, 3.6, 4.4):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). The one independent review is Task 5.4.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (the people filter allow-list gaining marketing status, new permission flags and their defaults, the rail and command palette gaining Campaigns, the import field list and the forms field types), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs only. This part needs no external service; e2e uses the fake mail transport and the fake AI provider.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove, recreate or call the owner's live Compose project `dealflow-prod` (127.0.0.1:3001, 8080 and 9000) and never read `.env.production`. Never stop, remove or recreate the owner's Compose project `warpdrive-main` (only `up -d` of its postgres, minio and createbuckets with the section 4 ports is allowed), never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack Postgres 5433 and MinIO 9100/9101 (section 4); 3001, 8080 and 9000 belong to `dealflow-prod`: never bind or call them. Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `PLAN-PART3.md`, `PLAN-PART4.md`, `PLAN-PART5.md`, `PLAN-PART6.md`, `PLAN-PART7.md`, `PLAN-PART8.md`, `PLAN-PART9.md`, `PLAN-PART10.md`, `PLAN-PART11.md`, `PLAN-PART12.md`, `PLAN-PART13.md`, `PLAN-PART14.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 13's file to `PROGRESS-P13.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p14-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 14: progress files, kit, baseline and environment
(every task through 5.6, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 5600/5600

## Decisions
- 0.3: chose … over … because …

## Owner actions
- TODO(owner): …

## Open issues
- None

## Environment
(copy the section 4 "Known environment" commands that this machine needs, and keep them current)

## Final report
(written in Tasks 5.5 and 5.6)
```

## 1. Goal

Build **Campaigns**, Dealflow's built-in email marketing, modelled on Pipedrive's paid "Campaigns by Pipedrive" add-on and included free in every install. Sales and marketing staff can:

- design branded emails in a block builder (or paste their own HTML);
- pick recipients live from CRM data;
- send now or on a schedule;
- run automated drip sequences;
- see opens, clicks, bounces and unsubscribes on every contact's timeline and in campaign reports.

Consent is first-class:

- every person has a marketing status;
- only subscribed people receive campaigns;
- double opt-in, one-click unsubscribe and a suppression list are built in;
- every email carries a non-removable unsubscribe footer and the company's postal address.

Pipedrive features carried over, all in one tier (there is no billing in a self-hosted install):

- the drag-and-drop and HTML builder;
- live CRM segmentation;
- automated campaigns;
- scheduling;
- double opt-in;
- sender verification and a domain check;
- engagement alerts;
- campaign reports;
- the "premium" comparative insights and the campaign-type filter.

## 2. Definition of done

1. **Contacts and consent (6.2, 6.3):**
   - every person has a marketing status with a consent history;
   - the suppression list is keyed by email hash;
   - double opt-in, a web-form consent field, the public confirm page, the unsubscribe page and one-click unsubscribe work;
   - the marketing status is filterable, bulk-editable (with a consent basis) and importable.
2. **Builder (6.4, 6.5):** a block builder with:
   - preview at 600 px and 375 px;
   - an HTML block and HTML import;
   - four starter templates, plus saved templates;
   - public campaign images;
   - every rendered email has the mandatory footer (unsubscribe, address, view in browser) and stays under 100 KB.
3. **Campaigns (6.6):**
   - a list;
   - a four-step editor (Details, Recipients, Content, Review) with a live recipient count and exclusion reasons;
   - a test send;
   - send now, schedule, pause, resume and cancel.
4. **Sending (6.7):**
   - sends go through pg-boss in throttled batches, with one email per recipient, idempotent;
   - suppression and status are re-checked at send time;
   - `List-Unsubscribe` and `List-Unsubscribe-Post` headers are set;
   - the marketing SMTP transport falls back to the system SMTP;
   - fake capture works in tests.
5. **Tracking (6.8):**
   - opens, clicks, unsubscribes and bounces are recorded per recipient;
   - click redirects come only from stored links;
   - engagement events appear on the person's timeline;
   - clicks notify the person's owner;
   - synchronous bounces are classified, and asynchronous bounces come from an optional bounce mailbox.
6. **Settings › Campaigns (6.9):**
   - verified senders;
   - the postal address (required to send);
   - double opt-in required (default on);
   - the send rate;
   - a domain check (SPF, DKIM, DMARC);
   - permission flags.
7. **Automated campaigns (6.10):**
   - sequences of email and wait steps;
   - entry is manual, by segment entry, or by the automation action `enroll_in_sequence`;
   - exits, the send window and per-step stats work.
8. **Reports and insights (6.11):**
   - campaign report;
   - recipients table with CSV;
   - comparison insights with averages, trends and the campaign-type filter.
9. **Proof:** `e2e/18-campaigns.spec.ts` passes, specs `00` to `17` still pass, the gallery has 16 screens, the user guide has a Campaigns chapter (PDFs rebuilt), and typecheck, lint, build, unit, full integration and smoke pass. One independent review ran.

## 3. Decisions already made

- **Name and place.**
  - "Campaigns" gets a new rail item (icon `Megaphone`) after Inbox, routes under `/campaigns`, and a feature folder `src/features/campaigns/`.
  - The schema goes in new files under `src/db/schema/`, and the migration is the next free number, named `00NN_dealflow_campaigns.sql`.
- **One tier, everything included.** There are no subscriber caps or billing. The Campaigns home shows the subscribed-contact count for information only.
- **Recipients are people.**
  - A campaign targets people. The segment is a people filter: an existing saved filter, or an ad-hoc definition built with the existing filter builder and evaluated by `filterAstSql`.
  - Deal-based targeting works through person filter conditions that reference deals where the filter engine supports them; otherwise the targeting is out of scope.
  - Organizations are not recipients.
- **Consent model:**
  - Status values: `not_subscribed` (default), `pending` (double opt-in sent), `subscribed`, `unsubscribed`, `bounced`.
  - Only `subscribed` people with a valid primary email, not suppressed, are sent campaigns.
  - The only way from `unsubscribed` or `bounced` to `subscribed` is a double opt-in confirmation, or the person resubscribing on the preference page. Manual bulk changes cannot do it.
- **Sending transport.** The campaign engine uses a dedicated nodemailer transport from `MARKETING_SMTP_*`, falling back to `SMTP_*`. It never uses a user's personal mailbox: bulk mail must not damage personal sending reputation.
  - The owner is told in the final report that a bulk-friendly provider (Amazon SES, Postmark Broadcast, Brevo or similar) is strongly recommended over a personal mailbox host.
  - `MAIL_FAKE=true` captures campaign mail exactly like system mail.
- **Rendering.** The campaign renderer is separate from Part 13's `renderEmail` because campaigns are full-width designed emails. It reuses `src/features/email-design/tokens.ts`, its MSO and button patterns, `variables.ts` escaping and the company design (logo, accent, address).
- **No new runtime dependencies.** Reuse:
  - nodemailer (the transport and DKIM option);
  - imapflow (the bounce mailbox);
  - `node:dns/promises` (the domain check);
  - `sanitize-html` (a marketing HTML profile);
  - TipTap (text blocks), dnd-kit (block ordering), pg-boss, MinIO, and the existing chart primitive.
- **Tracking privacy.** Store no raw IP addresses for opens or clicks; store a user-agent family only. Store the IP and user agent for consent evidence only (double opt-in confirmation and unsubscribe), visible to admins. There are no locations: no GeoIP database is shipped.
- **Spam complaints.** There is no feedback-loop integration. The report shows "Reported as spam" only if the bounce mailbox receives an ARF report (`multipart/report; report-type=feedback-report`), which is parsed like a bounce.

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | PROGRESS.md says `dealflow-wd-p13-v1` and `STATUS: COMPLETE` | log a Decision describing what you found; continue |
| The owner's live stack | `dealflow-prod` runs on 127.0.0.1:3001, 8080 and 9000 | nothing to do; never touch it |
| Dev stack ports | as Part 13: `DEV_PG_PORT=5433 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up`; e2e with `MINIO_PORT=9100 DEV_PG_PORT=5433` | as Part 13 section 4 |
| Filters | `src/features/saved-filters/filterAst.ts` and `filterAstSql.ts` compile a person filter definition into SQL with the visibility clause | if they need an entity adapter, add one for `person` and log it |
| Part 13 renderer | `src/features/email-design/{tokens,variables,layout,design}.ts` exist; `getEmailDesign()` returns the logo URL, accent, display name and address | reuse; log any API difference |
| Tracking | `src/app/t/open/[token]` and `src/app/t/click/[token]` exist for one-to-one email | campaigns get their own routes (6.8); never change these |
| Web forms | Part 6 forms support field types and create a lead or deal plus a person | add the `marketing_consent` field type there |
| Automations | actions register through `registerActionHandler` (Part 5) | add `enroll_in_sequence` the same way |
| Latest migration | `drizzle/0093_dealflow_email_design.sql` | take the next free number |
| Worker in e2e | the e2e harness runs the pg-boss worker (spec 09 needs it) | if it does not, run the campaign job in-process behind an e2e-only env flag and log it |
| Docker, kit location, pnpm 9, subagent, Playwright browsers | as Part 13 | as Part 13 |

**Known environment:** after Task 0.1 renames it, copy `PROGRESS-P13.md` → Environment into PROGRESS.md → Environment and follow it.

**Fatal (STOP with `STATUS: BLOCKED`):** pnpm cannot be installed; `pnpm install` fails for a registry reason; Docker is down at Task 0.1.

## 5. Target structure

```
src/db/schema/marketing.ts            # person_marketing, consent_events, marketing_suppressions
src/db/schema/campaigns.ts            # campaigns, campaign_templates, campaign_assets, campaign_links,
                                      # campaign_recipients, campaign_events, campaign_senders, campaign_settings,
                                      # sequences, sequence_steps, sequence_enrollments
drizzle/00NN_dealflow_campaigns.sql
src/features/marketing/               # consent: status.ts (state machine), suppression.ts, doubleOptIn.ts,
                                      # unsubscribe.ts, tokens.ts, ui/ (status chip, consent panel, bulk dialog)
src/features/campaigns/
  blocks/schema.ts, blocks/render.ts, blocks/plainText.ts, blocks/starters.ts, blocks/sanitizeMarketing.ts
  segment.ts                          # recipients query, counts and exclusion reasons
  send/{job.ts, transport.ts, batch.ts, headers.ts, personalize.ts}
  tracking/{links.ts, events.ts}
  bounces/{dsn.ts, mailbox.ts}
  senders.ts, settings.ts, domainCheck.ts, assets.ts
  sequences/{model.ts, scheduler.ts, enroll.ts}
  reports.ts, insights.ts, ai.ts
  router.ts, actions.ts, schemas.ts, constants.ts
  ui/ (CampaignList, CampaignEditor, steps/*, builder/*, ReportView, InsightsView, SequenceEditor, ...)
src/app/(app)/campaigns/..., src/app/(app)/settings/campaigns/page.tsx
src/app/c/[token]/ (double opt-in confirm), src/app/u/[token]/ (unsubscribe and preferences),
src/app/v/[token]/ (view in browser), src/app/t/c/o/[token]/ and src/app/t/c/l/[token]/[n]/ (tracking),
src/app/email-assets/c/[file]/ (campaign images)
e2e/18-campaigns.spec.ts, e2e/campaigns/*
docs/dealflow/CAMPAIGNS.md, docs/user-guide/campaigns.md
```

## 6. Contracts

### 6.1 Permissions

Add the flags to `src/constants/permissionFlags.ts`:

| Flag | Allows | Regular default | Admin |
|---|---|---|---|
| `campaigns.view` | the Campaigns list, reports and insights | true | true |
| `campaigns.edit` | create and edit drafts, templates and sequences | false | true |
| `campaigns.send` | send, schedule, pause, resume and cancel; activate sequences | false | true |
| `marketing.manage` | Settings › Campaigns, bulk marketing-status changes, the consent history export | false | true |

Every server action checks CSRF, the actor and the flag through `can()`. Recipient segments always apply the actor's people visibility clause at preview time. At send time the segment is evaluated as the campaign's creator, and that is recorded on the campaign.

### 6.2 Marketing status, consent and suppression

**Tables** (`src/db/schema/marketing.ts`):

```sql
CREATE TYPE marketing_status AS ENUM ('not_subscribed','pending','subscribed','unsubscribed','bounced');
CREATE TABLE person_marketing (
  person_id uuid PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,
  status marketing_status NOT NULL DEFAULT 'not_subscribed',
  consent_basis text CHECK (consent_basis IN ('double_opt_in','form_consent','explicit','legitimate_interest','imported')),
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  soft_bounce_count integer NOT NULL DEFAULT 0
);
CREATE TABLE consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
  email_hash text NOT NULL,                 -- sha256 hex of lower(trim(email))
  from_status marketing_status, to_status marketing_status NOT NULL,
  source text NOT NULL CHECK (source IN ('manual','bulk','import','form','double_opt_in','unsubscribe_link','one_click','preference_page','bounce','complaint','system')),
  basis text, actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ip text, user_agent text,                 -- only for double_opt_in, unsubscribe_link, one_click, preference_page
  campaign_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_events_person_idx ON consent_events (person_id, created_at DESC);
CREATE TABLE marketing_suppressions (
  email_hash text PRIMARY KEY, reason text NOT NULL CHECK (reason IN ('unsubscribed','hard_bounce','complaint')),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

A missing `person_marketing` row means `not_subscribed`. Rows are created lazily on the first change.

**State machine** (`src/features/marketing/status.ts`, pure, test-first):

| From | To | Allowed sources |
|---|---|---|
| `not_subscribed` | `pending` | `form`, `manual`, `bulk` (sends double opt-in) |
| `not_subscribed` | `subscribed` | `manual`, `bulk`, `import` (needs a basis: explicit, legitimate_interest or imported), `form` (when double opt-in is off), `double_opt_in` |
| `pending` | `subscribed` | `double_opt_in` |
| `pending` | `not_subscribed` | `manual`, `bulk`, `system` (double opt-in expired after 30 days) |
| `subscribed` | `unsubscribed` | any unsubscribe source, `manual`, `bulk` |
| `subscribed`, `pending` | `bounced` | `bounce` (hard, or the third soft bounce) |
| `subscribed`, `pending` | `unsubscribed` | `complaint` |
| `unsubscribed`, `bounced` | `pending` | `form`, `preference_page`, `manual` (only by sending double opt-in) |
| `unsubscribed`, `bounced` | `subscribed` | `double_opt_in` only |

Any other transition returns `err(E_MARKETING_001)`.

**Every transition, in one transaction:**
1. Write a `consent_events` row.
2. Upsert `person_marketing`.
3. Maintain `marketing_suppressions`: insert on `unsubscribed` (reason `unsubscribed`), on `bounced` (`hard_bounce`) and on a complaint; delete on `subscribed`.
4. Emit the domain event `person.marketing_status_changed` through the Part 5 event outbox.

Suppression is keyed by the email hash, so it survives person deletion and blocks any person who later gets the same email.

**Email changes:** when a person's primary email changes, re-check the new hash against suppressions. A suppressed address sets the status to the suppression reason's status, with source `system`.

### 6.3 Double opt-in, unsubscribe and forms

**Tokens** (`src/features/marketing/tokens.ts`): 24 random bytes in base64url. Store only the SHA-256 hex. Each token has a purpose (`doi` | `unsub`), a person id, a campaign recipient id (`unsub` only) and an expiry (`doi` 30 days; `unsub` none). Table `marketing_tokens`, in the same migration.

**Double opt-in:**
- Add Part 13 registry key `marketing_double_opt_in`, customer family, button "Confirm subscription" (structural URL `/c/{token}`). Default copy:
  - Subject: `Please confirm your subscription to {{company.name}}`
  - Body: `<p>Hi {{recipient.name}},</p><p>Please confirm that you want to receive emails from {{company.name}}. You can unsubscribe at any time.</p><p>If you didn't ask for this, ignore this email and you won't hear from us.</p>`
- Send it through Part 13 `sendSystemEmail`. Rate limit: at most 1 pending request per person per 24 hours, and at most `CAMPAIGN_DOI_DAILY_LIMIT` (default 500) per day for the install.
- `GET /c/{token}` shows a light public page with the company logo, "Confirm your subscription to {company}" and a "Confirm" button. The `POST` confirms (prefetch scanners must not confirm on GET), records the IP and user agent, and shows "You're subscribed". Expired or used tokens show "This link has expired".

**Unsubscribe:**
- Each campaign email's footer links `/u/{token}`. `GET` shows "Unsubscribe {masked email} from {company} emails?" with a primary button, Unsubscribe.
- `POST /u/{token}` unsubscribes and shows "You're unsubscribed", with a "Resubscribe" button that sends double opt-in.
- One-click: `POST /u/{token}` with the form body `List-Unsubscribe=One-Click` (RFC 8058) unsubscribes and returns 200 with no page. CSRF is exempt for this route only: the unguessable token is the credential. Rate-limit it with the public limiter.

**Web forms:**
- Add a field type `marketing_consent`: a checkbox with an editable label, default "I'd like to receive news and offers by email. I can unsubscribe at any time."
- When ticked on submit: double opt-in required sets `pending` and sends it; otherwise `subscribed` with basis `form_consent`.
- When unticked: no change.
- Spam-path submissions change nothing (Part 6 rule).

**Unit and integration tests:**
- tokens are hashed and single-use for double opt-in;
- GET never mutates;
- the one-click body is required for the 200 path;
- an expired double opt-in fails;
- the form consent creates `pending` and one captured email;
- the resubscribe flow.

### 6.4 Content blocks and rendering

**Block document** (`blocks/schema.ts`, Zod, versioned `{ version: 1, settings, blocks }`):

```ts
settings: { backgroundColor: hex; contentWidth: 600; fontFamily: "system" | "serif"; linkColor: hex }
type Block =
  | { id; type: "header"; logo: "company" | "none"; align: "left" | "center" }
  | { id; type: "heading"; text: string; level: 1 | 2; align }
  | { id; type: "text"; html: string }                       // TipTap HTML, sanitised with the author profile
  | { id; type: "image"; assetId: uuid; alt: string; width: number /*<=600*/; href?: url; align }
  | { id; type: "button"; label: string; href: url; color?: hex; align }
  | { id; type: "divider" } | { id; type: "spacer"; height: 8 | 16 | 24 | 32 | 48 }
  | { id; type: "columns"; columns: [Block[], Block[]] }     // two columns; nested columns are not allowed
  | { id; type: "social"; links: { network: "linkedin" | "x" | "facebook" | "instagram" | "youtube" | "website"; url }[] }
  | { id; type: "html"; html: string }                       // sanitised with the marketing profile (6.4)
// the footer is not a block: the renderer always appends it
```

URLs must be `https:` or `http:` (or `mailto:` for buttons and text links). Merge tokens are allowed in text, heading, button label and URL query strings.

**Renderer** (`blocks/render.ts`): `renderCampaign(doc, ctx) → { html, text, links: string[] }`.
- Table-based, inline styles, 600 px with a `.df-container` mobile rule.
- MSO wrapper, VML buttons and preheader, reusing `email-design` patterns and tokens.
- Two columns stack below 620 px.
- Images use explicit width and height and `alt`. Social icons are small PNGs served from `public/email/social/*.png`; create simple 24 px monochrome PNGs with the gallery script's Playwright and log it. Never hotlink third-party icons.
- **Footer**, always present and not removable:
  - the company display name and postal address (6.9, required);
  - "You received this email because you subscribed to {company} updates.";
  - links "Unsubscribe" (`{{unsubscribe_url}}`) and "View in browser" (`{{web_version_url}}`);
  - 12px `#65686F`, centred.
- **Personalisation:**
  - merge tokens use the Part 13 variables engine extended with a fallback `{{person.first_name|there}}`;
  - values are HTML-escaped in HTML and raw in text;
  - available variables: `person.first_name`, `person.last_name`, `person.name`, `person.email`, `organization.name`, `owner.name`, `owner.email`, `company.name`, plus the structural `unsubscribe_url` and `web_version_url`.
- **Links:** `links` returns the ordered unique `http(s)` hrefs found after merge (per campaign, not per recipient: links containing merge tokens are tracked by template position). The send path stores them as `campaign_links` (index to URL template).
- **Plain text** (`blocks/plainText.ts`): headings in caps lines, text converted, buttons as `Label: url`, images as `[alt]`, the footer included.
- **Size:** the reviewer warns when the HTML exceeds 90 KB (Gmail clips at about 102 KB) and blocks sending above 100 KB.

**Marketing HTML profile** (`blocks/sanitizeMarketing.ts`, for HTML blocks and imported templates):
- `sanitize-html` allowing table layout tags, `style` attributes (with a CSS property allow-list: colour, background, font, padding, margin, border, width, height, text-align, vertical-align, line-height, display, max-width), `img` with `src` `https:` only, `a` with `http(s)`/`mailto`;
- `class`, `id`, `bgcolor`, `align`, `width`, `height`, `role`, `cellpadding`, `cellspacing`, `border`;
- no `script`, `iframe`, `form`, `input`, `object`, `embed`, `on*` attributes, `javascript:` or `data:` URLs (except `data:image/png` and `data:image/jpeg` for images under 32 KB), and no `<style>` (stripped, with a warning in the UI that styles must be inline).

**Starter templates** (`blocks/starters.ts`), as complete block documents with neutral copy:
- "Newsletter": header, heading, text, image placeholder, two columns, button, social.
- "Announcement": header, heading, text, button.
- "Event invitation": header, heading, text with date, place and agenda, button "Save your seat".
- "Simple text": text only, personal style.

**Unit tests:**
- render snapshots by structure (footer present, unsubscribe link present, no script);
- escaping of merge values;
- columns stacking;
- `links` extraction;
- the marketing sanitiser blocks each dangerous construct;
- the size guard;
- plain text.

### 6.5 Campaign images

`campaign_assets` (id, sha256, mime `image/png|image/jpeg|image/gif`, size at most 1 MB, width, height, storage key in MinIO under `campaign-assets/`, created_by).
- Uploads go through the existing presigned MinIO pattern, or the server action pattern for files at most 1 MB; log which. Type comes from magic bytes; size from Part 13 `imageSize.ts` extended with GIF.
- Public route `GET /email-assets/c/{id}.{ext}`: streams the object only when the id exists and the extension matches, with `Cache-Control: public, max-age=31536000, immutable`. No auth; public limiter (never failing for the limit).
- The builder's image picker lists uploaded assets with thumbnails.

### 6.6 Campaigns: model, list and editor

**`campaigns` table:**

| Column | Type and rule |
|---|---|
| `id` | |
| `name` | max 120 |
| `type` | `newsletter` \| `announcement` \| `promotion` \| `event` \| `nurture` \| `other` |
| `status` | `draft` \| `scheduled` \| `sending` \| `paused` \| `sent` \| `cancelled` |
| `subject` | max 200, CR and LF stripped |
| `preheader` | max 140 |
| `sender_id` | FK `campaign_senders`, verified |
| `reply_to` | email or null |
| `segment` | jsonb: `{ kind: "saved_filter", savedFilterId }` or `{ kind: "definition", definition }` |
| `content` | jsonb block document |
| `template_id` | null allowed |
| `scheduled_at` | timestamptz null |
| `created_by` | |
| `send_as_user_id` | the user whose visibility evaluates the segment, set when sending starts |
| `started_at`, `finished_at` | |
| `totals` | jsonb cache, refreshed by the event writer |
| `created_at`, `updated_at` | |

**List page** (`/campaigns`, permission `campaigns.view`):
- `PageToolbar` with a view switcher: Campaigns, Automated, Templates, Insights.
- Primary "+ Campaign" (needs `campaigns.edit`).
- A table with columns: Name (with type chip), Status (StatusBadge: Draft, Scheduled {date}, Sending {n}%, Paused, Sent, Cancelled), Recipients, Open rate, Click rate, Sent or scheduled date, Owner, row menu (Duplicate, Delete draft).
- Empty state: "Create your first campaign" with the four starters.
- A header stat line: "{n} subscribed contacts".

**Editor** (`/campaigns/{id}`): a stepper with four steps, saved as you go (autosave debounce 800 ms, "Saved" indicator). Each step shows a green tick when it is valid.

1. **Details:**
   - Name, Type, Subject (with "Suggest with AI" giving 3 options via `chatJson`, fake in tests), Preview line, Sender (Combobox of verified senders, with a link to add one), Reply-to.
   - Live inbox preview: sender name, subject and preview line, as a mock inbox row.
2. **Recipients:**
   - "Use a saved filter" (Combobox of person saved filters visible to the actor) or "Build a filter" (the existing filter builder for people, inline).
   - Live count box: "{n} people will receive this campaign". Excluded, with counts: not subscribed, pending confirmation, unsubscribed, bounced, suppressed, no email, duplicate email (the first person wins).
   - A "Preview recipients" link opens a dialog listing the first 50 people.
3. **Content:**
   - The builder (6.4): a left panel of blocks to add (drag onto the canvas or click to append), the canvas centre (a 600 px live render in a sandboxed `srcdoc` iframe with selectable block outlines through `postMessage` hooks), and a right panel with the selected block's properties.
   - Top bar: Desktop or Mobile toggle, Undo and Redo (the history stack of the document), "Save as template", "Import HTML" (creates an HTML block document after the marketing sanitiser, showing what was removed), and "Send test" (to up to 5 addresses, which must be users of the install; merge values come from a chosen sample person).
   - Reorder with dnd-kit and the keyboard (Alt+ArrowUp/Down); Duplicate and Delete on each block.
   - The text block uses the TipTap editor with an "Insert merge field" control.
4. **Review:** a checklist, each item a pass or fail with a link to fix:
   - subject set;
   - sender verified;
   - postal address set in Settings › Campaigns;
   - recipients > 0;
   - every image has alt text;
   - every button and link has a URL;
   - HTML size < 90 KB (warning) and < 100 KB (blocking);
   - the domain check passes (warning only);
   - a test email sent (warning only).

   Then "Send now" (confirm dialog: "Send to {n} people now?") or "Schedule" (DatePicker and TimePicker in the user's time zone, at least 10 minutes ahead). Both need `campaigns.send`.

**State actions:** schedule, unschedule (back to draft), send now, pause (sending → paused; queued recipients stay queued), resume, cancel (paused or scheduled → cancelled; never-sent recipients become `skipped_cancelled`). A sent campaign is read-only, apart from Duplicate.

### 6.7 Sending engine

**Snapshot.** When a send starts (immediately, or when the scheduled job fires), one transaction:
1. Evaluates the segment as `send_as_user_id`.
2. Applies the eligibility rules (status `subscribed`, a valid email, not suppressed, deduplicated by email hash).
3. Inserts `campaign_recipients` (campaign_id, person_id, email, email_hash, status `queued`, token hash, unique on campaign_id + email_hash).
4. Sets the status to `sending`.
5. Freezes the rendered content and links into `campaign_links`, and the content snapshot on the campaign.

The send counts are fixed at that point.

**Jobs:**
- pg-boss queue `campaign-send`: one job per campaign tick. Each tick takes up to `CAMPAIGN_BATCH_SIZE` (default 50) queued recipients `FOR UPDATE SKIP LOCKED`.
- Throttle to `CAMPAIGN_SEND_RATE_PER_MINUTE` (env default 60; Settings can lower it, not raise it above the env). Pace with a token bucket persisted on the campaign (the last tick time and the sent-this-minute count), then reschedule the next tick.
- Ticks stop when the campaign is paused or cancelled, or when no queued recipients remain. Then the status becomes `sent`, with `finished_at` and final totals.
- A scheduled campaign registers a pg-boss job `campaign-start` at `scheduled_at`; unscheduling cancels it.

**Per recipient:**
1. Re-check the current status and suppression; skip with `skipped_status` or `skipped_suppressed`.
2. Personalise and render.
3. Rewrite links to `/t/c/l/{token}/{n}` (n = link index; the `{{unsubscribe_url}}` and `{{web_version_url}}` links are not rewritten).
4. Append the open pixel `/t/c/o/{token}.gif` before `</body>`.
5. Send.

**Headers:**
- `From: "{sender name}" <{sender email}>`, `Reply-To` when set.
- `List-Unsubscribe: <{BASE_URL}/u/{token}>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- `Precedence: bulk`, `X-Dealflow-Campaign: {campaign id}`.
- `Message-ID: <{campaign id}.{recipient id}@{sender domain}>`, deterministic so a retry reuses it.
- `Feedback-ID: {campaign id}:{type}:dealflow`.

**Transport** (`send/transport.ts`):
- nodemailer from `MARKETING_SMTP_HOST`, `_PORT`, `_SECURE`, `_USER`, `_PASS`, else `SMTP_*`.
- Optional DKIM signing when `CAMPAIGN_DKIM_DOMAIN`, `CAMPAIGN_DKIM_SELECTOR` and `CAMPAIGN_DKIM_PRIVATE_KEY` (or `_FILE`) are all set.
- With `MAIL_FAKE=true`, write to the capture folder, tagged `campaign`.
- All new env vars go in `src/config/env.ts` (Zod) and `.env.example` with placeholders, through `env-sync`.

**Results:**
- `250` (accepted) → `sent`, with `sent_at`.
- `5xx` → `bounced_hard`, plus the 6.2 transition with source `bounce`.
- `4xx` or network errors → retry up to 3 times with backoff (5, 30 and 120 minutes, via `retry_at`); after the last → `failed_soft`, increment `soft_bounce_count`, and the third soft bounce in a row across campaigns → `bounced`.

**Idempotency:** a recipient row is only sent when its status moves `queued` → `sending` in a guarded update (`WHERE status = 'queued'`), so two workers can never double-send. Unit and integration tests cover the double-tick race with two concurrent ticks.

### 6.8 Tracking, bounces and engagement

**`campaign_events`:** id, campaign_id, recipient_id, person_id, type `open | click | unsubscribe | bounce_hard | bounce_soft | complaint | delivered`, link_index null, user_agent_family text null, created_at. Index on (campaign_id, type) and (person_id, created_at).

**Routes** (public, no auth, public limiter that never fails a request for the limit, Part 2 tracking rule):
- `GET /t/c/o/{token}.gif` → a 1×1 transparent GIF with `no-store`. Record `open`; repeats are counted in the totals, and unique opens are distinct recipients.
- `GET /t/c/l/{token}/{n}` → look up the recipient by token hash and the link `n` of that campaign, render the URL template with the recipient's merge values, and 302 to it. Record `click`. An unknown token or n → 302 to `BASE_URL`. **Never redirect to a URL taken from the request.**
- `GET /v/{token}` → the email as that recipient got it (links untracked), with `noindex`.

**Machine opens:** flag an open as `machine` (`user_agent_family = 'proxy'`) when the user agent matches Apple Mail Privacy Protection or Google image proxies, or when it comes within 1 second of `sent_at`. Report "Opens" both with and without machine opens: the default excludes them, and a toggle shows all.

**Timeline:** person history shows "Campaign sent: {name}", "Opened {name}", "Clicked {url host} in {name}", "Unsubscribed via {name}" and "Bounced ({hard|soft})", with icons, through the existing changelog or history mechanism (log which). These appear in All and Email.

**Engagement alerts:** a new notification type `campaign_click` ("{person} clicked {link host} in {campaign}") goes to the person's owner, in-app by default (email off by default), and is configurable in Settings › Notifications.

**Async bounces** (`bounces/mailbox.ts`, optional, when `CAMPAIGN_BOUNCE_IMAP_HOST`, `_PORT`, `_USER` and `_PASS` are set):
- A pg-boss job every 10 minutes reads unseen messages with imapflow.
- `dsn.ts` parses `multipart/report; report-type=delivery-status` (Status `5.x.x` → hard, `4.x.x` → soft) and `report-type=feedback-report` (complaint). It finds the recipient by `X-Dealflow-Campaign` and `Message-ID` in the returned headers part.
- Apply the 6.2 transitions, mark the message seen and move it to a `Processed` folder (creating it if missing).
- Unit tests use fixture DSNs (Gmail, Outlook, Postfix and an ARF) under `src/features/campaigns/bounces/fixtures/`.

### 6.9 Settings › Campaigns

**Page** `/settings/campaigns`, permission `marketing.manage`, using Part 12 primitives. Sections:

1. **Senders:**
   - A table of From name, From email, Status (Verified or Pending) and Default.
   - "Add sender" sends a verification email (Part 13 registry key `campaign_sender_verification`, product family, button "Verify sender", token as in 6.3 with purpose `sender`, 48 hours).
   - Unverified senders cannot send.
2. **Postal address:** a required multi-line field (prefilled from Settings › Documents company details). Sending is blocked until it is set.
3. **Consent:**
   - "Require double opt-in for form sign-ups" (default on);
   - double opt-in expiry, read-only 30 days;
   - "Default consent label" for form fields.
4. **Sending:** the send rate per minute (1 to the env maximum), the batch size read-only, and the transport in use ("Marketing SMTP" or "System SMTP"), read-only with the host shown masked.
5. **Domain check:**
   - Enter the domain (default: the default sender's domain) and the DKIM selector (optional), then "Check".
   - Results:
     - SPF: a TXT record starting `v=spf1` exists;
     - DKIM: a TXT record at `{selector}._domainkey.{domain}` containing `p=`;
     - DMARC: a TXT record at `_dmarc.{domain}` starting `v=DMARC1`, showing its `p=` policy.
   - Each is Pass, Missing or Error, with a one-line fix.
   - `dns.promises` with an AbortSignal timeout of 5 seconds; results cached 1 hour in memory; unit tests with an injected resolver.
6. **Bounce mailbox:** read-only status (Configured or Not configured, the last run time, the last processed count) and the env names to set.

Saves are CSRF-checked, Zod-validated and audited (`campaign_settings.updated`).

### 6.10 Automated campaigns (sequences)

**Model:**
- `sequences`: id, name, status `draft | active | paused`, sender_id, reply_to, entry jsonb, exit jsonb, send_window jsonb `{ weekdaysOnly: boolean; startHour: 0-23; endHour: 1-24; timezone }`, created_by, timestamps.
- `sequence_steps`: id, sequence_id, position, kind `email | wait`, email: subject, preheader, content jsonb; wait: `wait_minutes`. Total wait at most 90 days; at most 20 steps.
- `sequence_enrollments`: id, sequence_id, person_id, status `active | completed | exited | failed`, current_position, next_run_at, entered_at, exit_reason. Unique on active (sequence_id, person_id).

**Entry** (`entry` jsonb, any combination):
- **Manual:** select people in the people list, then the bulk action "Enroll in sequence".
- **Segment entry:** a person saved filter. Every 15 minutes, people newly matching it are enrolled; the matched set is remembered in `sequence_segment_members` so leaving and re-entering does not re-enroll unless "Allow re-entry" is on.
- **Automation action** `enroll_in_sequence { sequenceId }`, available in the Part 5 automation editor for person-, deal- (primary person), lead- and form-based triggers.

**Exits** (always applied):
- the status is no longer `subscribed`;
- the person is deleted;
- the sequence is paused (enrollments wait) or deleted (they exit).

Optional exits: "When a deal for this person is won", "When the person replies to any email" (an inbound message from their email is linked to them), "When the person is in a filter".

**Scheduler:** a pg-boss job every minute takes due enrollments (`next_run_at <= now()`, status active, `FOR UPDATE SKIP LOCKED`, limit 200).
1. Check the exits.
2. An email step sends exactly like a campaign recipient. Each step gets a hidden internal campaign record of type `nurture` linked to the step, so tracking, reports and headers are identical. Then advance.
3. A wait step computes `next_run_at` and adjusts it into the send window.
4. The last step completes.

**Editor** (`/campaigns/automated/{id}`):
- A vertical timeline of steps with "+ Email" and "+ Wait".
- An email step opens the 6.4 builder in a sheet.
- A wait step takes a number plus hours or days.
- Entry and Exit panels; Activate (`campaigns.send`) and Pause.
- Per step: sent, open rate, click rate. Enrollment counts: active, completed, exited.

**Tests** (fake clock, integration):
- the delays and the send window (Friday 18:00 → Monday start hour with weekdays only);
- an exit on unsubscribe mid-sequence;
- segment entry without re-entry;
- the automation action enrols once;
- no double send under concurrent ticks.

### 6.11 Reports and insights

**Campaign report** (`/campaigns/{id}/report`, for sent or sending campaigns):

- **Stat tiles:** Recipients, Delivered (sent minus bounces), Unique opens and open rate (machine opens excluded by default, with a toggle), Unique clicks and click rate, Click-to-open rate, Unsubscribes and rate, Bounces (hard and soft), Reported as spam.
- **Charts** (existing chart primitive): opens and clicks per hour for the first 48 hours, then per day up to 30 days.
- **Links table:** URL, unique clicks, total clicks.
- **Recipients table:** person (link), email, status (Sent, Opened, Clicked, Unsubscribed, Bounced hard or soft, Skipped), last activity; filter by status; Export CSV (`data.export`, people visibility applied).

Rates divide by Delivered. Numbers use Part 12 `formatNumber`, and percentages show one decimal.

**Insights** (`/campaigns?view=insights`), the "premium" features:
- **Comparison table:** every sent campaign in a date range (default the last 90 days) with recipients, open rate, click rate, CTOR, unsubscribe rate and bounce rate; sortable.
- **"Your average" row,** and per-metric arrows showing each campaign against the average (above or below by more than 10% relative).
- **Filter by campaign type** and by sender.
- **Trend chart:** open and click rate per campaign over time.
- **Automated** (a tab): the same metrics per sequence and per step.

Queries aggregate in SQL over `campaign_events` and `campaign_recipients`. Indexes support them. A unit test with a seeded fixture checks every rate formula, including divide-by-zero, which renders as "-".

### 6.12 Contacts UI and import

- **Person detail** (left column) gets a "Marketing" section:
  - a status chip (Not subscribed, Pending, Subscribed, Unsubscribed, Bounced);
  - the consent basis and date;
  - "Change status" (dialog with the allowed transitions only, and a basis Select for `subscribed`; sending double opt-in is a choice);
  - "Consent history" (dialog with the events table; IP and user agent visible only to `marketing.manage`; Export CSV);
  - the last campaign activity.
- **People list:** an optional column "Marketing status", the filter field `marketing_status` (is or is not) in the filter engine for people, and a bulk action "Change marketing status" (needs `marketing.manage`; same rules as the dialog; at most 5,000 per action; one consent event each).
- **CSV import:** a mappable field "Marketing status" (values: subscribed, unsubscribed, not subscribed) with an import-wide confirmation: "I have consent to email the people marked subscribed". The basis is `imported`, and the import's undo reverts the statuses.

### 6.13 Seed and gallery

- `scripts/seed-demo-campaigns.ts` (wired into `db:seed:demo`):
  - 60% of the demo people subscribed, with basis `explicit`;
  - two verified senders;
  - two sent campaigns (Newsletter and Announcement), with recipients and realistic event mixes;
  - one scheduled campaign, one draft;
  - one active sequence with three steps and twelve enrollments.

  Deterministic (a seeded random).
- **The gallery:** `e2e/18-campaigns.spec.ts`'s `gallery` test saves `e2e/screenshots/campaigns/{name}-1440-light.png` for 16 screens:
  - list, details step, recipients step, builder, builder-mobile, review step;
  - report, insights, sequence editor, settings, person marketing section, consent dialog;
  - the double opt-in confirm page, the unsubscribe page, the newsletter email render, the announcement email render.

## 7. Conventions

Same as Parts 1 to 13 (CLAUDE.md is the authority). In addition:
- New code lives in `src/features/campaigns/` and `src/features/marketing/`. Changes to upstream files are the minimum needed to call them, listed in `docs/dealflow/UPSTREAM.md` under "Part 14".
- **Risky logic is test-first:** the 6.2 state machine, tokens and the routes in 6.3, the sanitiser and personalisation in 6.4, the eligibility and dedupe in 6.7, the idempotent send, tracking redirects, the DSN parser, the sequence scheduler, rate formulas and permissions.
- **Every public route:**
  - takes only a token and a validated body;
  - never renders user HTML outside a sanitised email body;
  - is rate-limited;
  - sends `X-Robots-Tag: noindex`.
- **UI** uses Part 12 primitives (dialog anatomy, FormField, Combobox, PageToolbar, EmptyState, number helpers) and passes `pnpm check:design`.
- **Logging:** never log email bodies, merge values or tokens; log campaign ids, counts and results.

## 8. Phases and tasks

`E2E` means `MINIO_PORT=9100 DEV_PG_PORT=5433` in front of the command (section 4).

### Phase 0: Start

#### Task 0.1 - Start Part 14: progress files, kit, baseline and environment

**Goal:** A Part 14 PROGRESS.md and a green baseline.

**Files:** create `PROGRESS.md`; rename `PROGRESS.md` → `PROGRESS-P13.md`; possibly root symlink `PLAN-PART14.md` and the checker copy `scripts/check-progress.mjs`

**Steps:**
1. Check section 4's table and log each result as a Decision.
2. `git mv PROGRESS.md PROGRESS-P13.md`, then create PROGRESS.md in the section 0 format with every task unchecked:
   - record the Phase 0 base commit;
   - copy `PROGRESS-P13.md` → Environment;
   - carry over still-open owner actions.
3. If the kit is in a subfolder, create the root symlink and the byte-identical checker copy.
4. Start the dev stack with the section 4 command.
5. Baseline: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (Environment prefixes), `pnpm test:unit`, `pnpm check:design`. Log `- Baseline: ...` with counts.
6. Commit `0.1: Start Part 14: progress files, kit, baseline and environment`, tick.

**Verify:** `pnpm check:progress` → OK

**Done when:** the baseline is green and logged.

#### Task 0.2 - Reuse map and design note

**Goal:** Know exactly which existing pieces Campaigns reuses before building.

**Files:** create `docs/dealflow/CAMPAIGNS.md`

**Steps:**
1. Read and record the exact APIs (file and function) of:
   - the people filter (`filterAst`, `filterAstSql`, saved filters for `person`);
   - Part 13 `email-design` (tokens, variables, layout patterns, `getEmailDesign`, `sendSystemEmail`, the registry);
   - Part 2 tracking routes;
   - Part 5 events and `registerActionHandler`;
   - Part 6 form field types and the submission flow;
   - notifications types and preferences;
   - the people bulk actions;
   - the CSV import field mapping and undo;
   - MinIO upload helpers;
   - pg-boss job registration;
   - the chart primitive;
   - the history and changelog mechanism for person timelines.
2. Write `CAMPAIGNS.md` with that map and one paragraph per section 6 contract saying where it plugs in. Note any mismatch as a Decision.
3. Commit `0.2: Reuse map and design note`, tick.

**Verify:** `test -s docs/dealflow/CAMPAIGNS.md` → exits 0

**Done when:** every reuse point names a file and function.

#### Task 0.3 - Phase 0 QA gate

**Goal:** Phase 0 is green.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). Record the Phase 1 base commit, commit `0.3: Phase 0 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes

**QA focus:** the reuse map is concrete.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: Consent and contacts

#### Task 1.1 - Schema, migration and permission flags

**Goal:** Every table in 6.2 to 6.10 exists, and the flags are in place.

**Files:**
- create `src/db/schema/marketing.ts` and `src/db/schema/campaigns.ts` (exported from the index);
- create `drizzle/00NN_dealflow_campaigns.sql` (via `db:generate` with the Environment prefixes, then checked against section 6);
- modify `src/constants/permissionFlags.ts` and its tests, and `src/constants/errorIds.ts` (`E_MARKETING_*`, `E_CAMPAIGN_*`).

**Steps:**
1. Write the schema exactly as section 6 (types, checks, uniques, indexes).
2. Generate and apply the migration to the dev database.
3. Add the 6.1 flags with defaults; update the permission tests (log it).
4. Commit `1.1: Schema, migration and permission flags`, tick.

**Verify:** `pnpm vitest run src/constants` → passes

**Done when:** the migration applies and the tests pass.

#### Task 1.2 - Marketing status service and suppression

**Goal:** The 6.2 state machine with evidence and suppression.

**Files:** create `src/features/marketing/status.ts`, `suppression.ts`, `service.ts` and their tests; an integration test `marketing.integration.test.ts`

**Steps:**
1. Write the transition-table tests first: every allowed and every refused transition.
2. Implement the pure machine and the transactional service: event, upsert, suppression, domain event, and the email-change re-check.
3. Integration tests:
   - suppression survives person deletion;
   - a new person with a suppressed email becomes unsubscribed or bounced;
   - the domain event is written in the transaction.
4. Commit `1.2: Marketing status service and suppression`, tick.

**Verify:** `pnpm vitest run src/features/marketing` → passes

**Done when:** unit and integration tests pass.

#### Task 1.3 - Double opt-in, unsubscribe pages and one-click

**Goal:** Consent flows that are safe against prefetch, injection and enumeration.

**Files:**
- create `src/features/marketing/tokens.ts`, `doubleOptIn.ts`, `unsubscribe.ts`;
- create `src/app/c/[token]/page.tsx` and its action, `src/app/u/[token]/page.tsx` and `route.ts` (the one-click POST);
- modify the Part 13 registry (`marketing_double_opt_in`, `campaign_sender_verification`), the public path allow-list and CSRF exemption for `/u/*` POST only;
- tests.

**Steps:**
1. Write the 6.3 tests first.
2. Implement the tokens, double opt-in send with its limits, the confirm page, the unsubscribe page, resubscribe and one-click.
3. Commit `1.3: Double opt-in, unsubscribe pages and one-click`, tick.

**Verify:** `pnpm vitest run src/features/marketing` → passes

**Done when:** the 6.3 tests pass and GET never changes data.

#### Task 1.4 - Form consent field and CSV import mapping

**Goal:** Consent enters through forms and imports.

**Files:** the Part 6 forms field types, submit handler and editor; the CSV import field mapping and undo; their tests

**Steps:**
1. Add the `marketing_consent` field type to the editor, the public form (works without JavaScript) and the submit handling per 6.3.
2. Add the import mapping with the confirmation and the undo per 6.12.
3. Integration tests: a ticked form sets `pending` and captures one double opt-in email; the import sets `subscribed` with basis `imported`; undo reverts.
4. Commit `1.4: Form consent field and CSV import mapping`, tick.

**Verify:** `pnpm vitest run src/features/forms src/features/import src/features/marketing` → passes

**Done when:** the tests pass.

#### Task 1.5 - Contacts UI: marketing section, list column, filter field, bulk change

**Goal:** People's consent is visible and manageable.

**Files:** create `src/features/marketing/ui/*`; modify the person detail left column, the people list columns and bulk actions, and the people filter field allow-list (`filterFields.ts`, `filterAstSql.ts`)

**Steps:**
1. Implement 6.12: the section, the dialogs (allowed transitions only) and the history with the IP gated.
2. Add the list column, the filter field and the bulk action (5,000 cap).
3. Unit tests: the dialog offers only allowed transitions; the filter field compiles to SQL.
4. Commit `1.5: Contacts UI: marketing section, list column, filter field, bulk change`, tick.

**Verify:** `pnpm vitest run src/features/marketing src/features/saved-filters src/features/contacts` → passes

**Done when:** the tests pass and `pnpm check:design` is 0.

#### Task 1.6 - Phase 1 QA gate

**Goal:** Prove consent.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). Record the Phase 2 base commit, commit `1.6: Phase 1 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm check:design` → `0 violation(s)`
- `src/features/marketing/*.integration.test.ts` and the forms and import integration files touched → pass

**QA focus:** 6.2 and 6.3 exactly; tokens hashed; GET safe; the IP visible only to `marketing.manage`.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: Builder and templates

#### Task 2.1 - Block schema, renderer, plain text and marketing sanitiser

**Goal:** Email-safe rendering of any campaign document.

**Files:** create `src/features/campaigns/blocks/schema.ts`, `render.ts`, `plainText.ts`, `sanitizeMarketing.ts`, `personalize.ts` (fallback tokens) and their tests

**Steps:**
1. Write the 6.4 tests first.
2. Implement the schema, the renderer (footer always present), plain text, personalisation with fallback and escaping, links extraction, the size guard and the sanitiser.
3. Commit `2.1: Block schema, renderer, plain text and marketing sanitiser`, tick.

**Verify:** `pnpm vitest run src/features/campaigns/blocks` → passes

**Done when:** the 6.4 tests pass.

#### Task 2.2 - Campaign images and the public asset route

**Goal:** Uploaded images are reachable from any inbox.

**Files:** create `src/features/campaigns/assets.ts` and its test, `src/app/email-assets/c/[file]/route.ts`; extend Part 13 `imageSize.ts` with GIF (+ test)

**Steps:**
1. Implement 6.5: the upload, type and size checks, MinIO storage, and the public route with its id and extension check.
2. Integration test: upload, then fetch 200 with bytes; a wrong extension gives 404; an unknown id gives 404.
3. Commit `2.2: Campaign images and the public asset route`, tick.

**Verify:** `pnpm vitest run src/features/campaigns src/features/email-design` → passes

**Done when:** the tests pass.

#### Task 2.3 - Builder UI

**Goal:** A block builder people can use without help.

**Files:** create `src/features/campaigns/ui/builder/*` (BlockPalette, Canvas, BlockFrame, PropertiesPanel, the per-block property forms, ImagePicker, ImportHtmlDialog, history) and tests

**Steps:**
1. Implement the 6.6 Content step builder: the palette, the iframe canvas with selection through `postMessage` (origin-checked), properties, dnd-kit and keyboard reorder, duplicate and delete, undo and redo, Desktop or Mobile, Import HTML (showing what was removed), and the TipTap text with merge fields.
2. Unit tests:
   - the history reducer;
   - reorder;
   - the properties update the document;
   - the import shows the stripped tags;
   - `postMessage` ignores foreign origins.
3. Commit `2.3: Builder UI`, tick.

**Verify:** `pnpm vitest run src/features/campaigns/ui` → passes

**Done when:** the tests pass and `pnpm check:design` is 0 for the new files.

#### Task 2.4 - Templates: starters, saved templates, test send

**Goal:** Nobody starts from a blank page.

**Files:** create `src/features/campaigns/blocks/starters.ts`, the Templates view (`/campaigns?view=templates`), template actions and router procedures, the test-send action; tests

**Steps:**
1. Add the four starters (6.4), "Save as template", the Templates list (name, updated, thumbnail rendered as a scaled iframe, Use, Duplicate, Delete), and "Use" to create a campaign from a template.
2. Test send: to at most 5 user addresses of the install, with a chosen sample person's merge values, the subject prefixed `[Test] `, through the marketing transport.
3. Unit and integration tests: the starters validate against the schema; the test-send recipients are restricted to users.
4. Commit `2.4: Templates: starters, saved templates, test send`, tick.

**Verify:** `pnpm vitest run src/features/campaigns` → passes

**Done when:** the tests pass.

#### Task 2.5 - Phase 2 QA gate

**Goal:** Prove the builder.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). Record the Phase 3 base commit, commit `2.5: Phase 2 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm check:design` → `0 violation(s)`
- the campaigns integration files so far → pass

**QA focus:** the sanitiser blocks every 6.4 construct; the footer cannot be removed; the iframe is sandboxed.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: Campaigns, sending and tracking

#### Task 3.1 - Campaign list and the four-step editor

**Goal:** Create, edit and review campaigns.

**Files:**
- create `src/app/(app)/campaigns/page.tsx` and `[id]/page.tsx`, `src/features/campaigns/ui/{CampaignList,CampaignEditor,steps/*}.tsx`, `segment.ts`, `router.ts`, `actions.ts`, `schemas.ts`, `ai.ts` (subject suggestions) and tests;
- modify the rail and the command palette (Go to Campaigns, Create campaign).

**Steps:**
1. Implement the 6.6 list, the stepper with autosave, Details (with AI suggestions, fake in tests), Recipients (live count and exclusions through `segment.ts`), and the Review checklist.
2. Unit and integration tests:
   - segment counts and every exclusion reason, with the visibility clause;
   - the dedupe by email hash;
   - the checklist blocks sending at more than 100 KB, with no address, and with an unverified sender.
3. Commit `3.1: Campaign list and the four-step editor`, tick.

**Verify:** `pnpm vitest run src/features/campaigns` → passes

**Done when:** the tests pass.

#### Task 3.2 - Settings › Campaigns: senders, address, consent, sending, domain check

**Goal:** Sending prerequisites in one place.

**Files:** create `src/app/(app)/settings/campaigns/page.tsx`, `src/features/campaigns/{senders,settings,domainCheck}.ts`, `ui/settings/*`, tests; modify the settings nav

**Steps:**
1. Implement 6.9 with sender verification (captured email in tests) and the domain check with an injected resolver.
2. Tests: verify-sender tokens; the domain check classification (pass, missing, error, timeout); permissions.
3. Commit `3.2: Settings › Campaigns: senders, address, consent, sending, domain check`, tick.

**Verify:** `pnpm vitest run src/features/campaigns` → passes

**Done when:** the tests pass.

#### Task 3.3 - Sending engine

**Goal:** Throttled, idempotent, consent-checked bulk sending.

**Files:** create `src/features/campaigns/send/{job,transport,batch,headers}.ts` and tests; modify `src/config/env.ts`, `.env.example` (via env-sync), the worker job registry

**Steps:**
1. Write the tests first:
   - snapshot eligibility;
   - the guarded queued → sending update under two concurrent ticks (no double send);
   - the throttle;
   - the 250, 5xx and 4xx outcomes and retries;
   - pause, resume and cancel;
   - the headers (`List-Unsubscribe`, `List-Unsubscribe-Post`, deterministic Message-ID, no CR or LF in the subject);
   - DKIM options only when all three are set.
2. Implement 6.7 and the schedule, start and cancel jobs.
3. Commit `3.3: Sending engine`, tick.

**Verify:** `pnpm vitest run src/features/campaigns/send` → passes

**Done when:** unit and integration tests pass.

#### Task 3.4 - Tracking routes, web version, timeline and click alerts

**Goal:** Engagement is recorded and visible in the CRM.

**Files:** create `src/app/t/c/o/[token]/route.ts`, `src/app/t/c/l/[token]/[n]/route.ts`, `src/app/v/[token]/page.tsx`, `src/features/campaigns/tracking/{links,events}.ts`; modify the person history rendering, notifications (type `campaign_click`, preferences), tests

**Steps:**
1. Implement 6.8: the routes (redirect only to stored links), machine-open flags, totals refresh, timeline entries and the notification.
2. Tests:
   - an unknown n redirects to `BASE_URL`;
   - the redirect target is never taken from the query;
   - the pixel returns a GIF and records once per hit;
   - a machine open is flagged;
   - the notification goes to the owner.
3. Commit `3.4: Tracking routes, web version, timeline and click alerts`, tick.

**Verify:** `pnpm vitest run src/features/campaigns/tracking src/features/notifications` → passes

**Done when:** the tests pass.

#### Task 3.5 - Bounce mailbox and the DSN parser

**Goal:** Async bounces and complaints update consent.

**Files:** create `src/features/campaigns/bounces/{dsn,mailbox}.ts`, `fixtures/*.eml`, tests; modify env and the worker registry

**Steps:**
1. Write the DSN parser tests with four fixtures first.
2. Implement the parser and the optional IMAP job (disabled when the env is unset; uses the `MAIL_PROVIDER_FAKE_DIR` fake in tests).
3. Commit `3.5: Bounce mailbox and the DSN parser`, tick.

**Verify:** `pnpm vitest run src/features/campaigns/bounces` → passes

**Done when:** the tests pass.

#### Task 3.6 - Phase 3 QA gate

**Goal:** Prove sending.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). Record the Phase 4 base commit, commit `3.6: Phase 3 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm check:design` → `0 violation(s)`
- all `src/features/campaigns/**/*.integration.test.ts` and `src/features/marketing/*.integration.test.ts` → pass
- `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e:build && MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm exec playwright test e2e/10-forms-booking.spec.ts e2e/17-email.spec.ts` → passes

**QA focus:** DoD 3 to 6; no send without consent; idempotency; the redirect is safe.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Automated campaigns, reports and insights

#### Task 4.1 - Sequences: model, editor, scheduler, entries and exits

**Goal:** Drip sequences that respect consent and send windows.

**Files:** create `src/features/campaigns/sequences/{model,scheduler,enroll}.ts`, `ui/SequenceEditor.tsx`, the routes under `/campaigns/automated`, the Part 5 action `enroll_in_sequence`, the people bulk action "Enroll in sequence", tests

**Steps:**
1. Write the 6.10 fake-clock tests first.
2. Implement the model, the editor, Activate and Pause, the scheduler job, segment entry with membership memory, the automation action (registered and selectable in the automation editor), the bulk enrol and per-step stats.
3. Commit `4.1: Sequences: model, editor, scheduler, entries and exits`, tick.

**Verify:** `pnpm vitest run src/features/campaigns/sequences src/features/automations` → passes

**Done when:** the tests pass.

#### Task 4.2 - Campaign report and recipients export

**Goal:** Clear numbers for every campaign.

**Files:** create `src/features/campaigns/reports.ts`, `ui/ReportView.tsx`, `src/app/(app)/campaigns/[id]/report/page.tsx`, tests

**Steps:**
1. Implement 6.11's report: tiles, charts, links and recipients with CSV.
2. Tests: every rate formula with a fixture (divide by zero gives "-"); machine opens are excluded by default; the CSV applies visibility.
3. Commit `4.2: Campaign report and recipients export`, tick.

**Verify:** `pnpm vitest run src/features/campaigns` → passes

**Done when:** the tests pass.

#### Task 4.3 - Campaign insights with comparison and type filter

**Goal:** The "premium" comparative insights.

**Files:** create `src/features/campaigns/insights.ts`, `ui/InsightsView.tsx`, tests

**Steps:**
1. Implement 6.11's insights: the comparison table, the average row with arrows, the type and sender filters, the trend chart and the Automated tab.
2. Tests: averages and the arrow threshold; type filtering.
3. Commit `4.3: Campaign insights with comparison and type filter`, tick.

**Verify:** `pnpm vitest run src/features/campaigns` → passes

**Done when:** the tests pass.

#### Task 4.4 - Phase 4 QA gate

**Goal:** Prove automation and reporting.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). Record the Phase 5 base commit, commit `4.4: Phase 4 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm check:design` → `0 violation(s)`
- the sequences, reports and automations integration files → pass
- `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e:build && MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm exec playwright test e2e/09-automations.spec.ts` → passes

**QA focus:** DoD 7 and 8; the scheduler has no double send; exits apply.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 5: Proof and hand-off

#### Task 5.1 - Campaigns e2e spec, demo seed and gallery

**Goal:** End-to-end proof, plus screens for the owner.

**Files:** create `e2e/18-campaigns.spec.ts`, `e2e/campaigns/helpers.ts`, `scripts/seed-demo-campaigns.ts` (wired into the demo seed)

**Steps:**
1. Write the spec with these tests (titles exactly):
   - `settings and sender`: set the address, add a sender, confirm the captured verification email, and the sender is Verified.
   - `consent`:
     - mark three people subscribed (basis explicit) and one unsubscribed through the UI;
     - a form submission with consent ticked becomes Pending; open the captured double opt-in link; GET shows Confirm; POST makes the person Subscribed;
     - the consent history shows both events.
   - `campaign send`:
     - build a campaign from the Announcement starter, edit the heading, and choose the saved filter or definition matching those people;
     - Review shows four recipients and the exclusion counts;
     - test send, then send now;
     - wait until the status is Sent;
     - the capture holds four campaign emails, each with `List-Unsubscribe`, `List-Unsubscribe-Post`, the footer address and the unsubscribe link.
   - `tracking`: fetch one email's pixel URL and one tracked link (expect a 302 to the stored URL). The report shows one unique open and one click, and the person's timeline shows "Clicked".
   - `unsubscribe`: POST `List-Unsubscribe=One-Click` to one recipient's URL (200). The person is Unsubscribed, and a duplicated campaign's Review shows three recipients.
   - `sequence`: create a sequence (email step only), enrol one subscribed person manually, run until the worker sends the step, and the capture holds it.
   - `gallery`: the 16 screens in 6.13.
2. Write the demo seed (6.13).
3. Commit `5.1: Campaigns e2e spec, demo seed and gallery`, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the spec and seed exist.

#### Task 5.2 - Docs

**Goal:** Users, admins and the operator can run Campaigns.

**Files:**
- create `docs/user-guide/campaigns.md` (task-based: set up sending, consent and double opt-in, build a campaign, recipients, test and send, schedule, reports and insights, automated campaigns, unsubscribe and compliance tips);
- add it to `docs/user-guide/index.md` and to the section lists in `scripts/dealflow/build-user-guide-pdf.mjs` and `build-site.mjs` (after Email);
- finish `docs/dealflow/CAMPAIGNS.md` (architecture, env vars, deliverability: SPF, DKIM, DMARC, a bulk SMTP provider, the bounce mailbox);
- update `UPSTREAM.md` ("Part 14") and `self-hosting.md` (the new env vars);
- regenerate the PDFs.

**Steps:**
1. Write the docs.
2. Run `pnpm docs:pdf` (16 PDFs now).
3. Commit `5.2: Docs`, tick.

**Verify:** `ls docs/user-guide/pdf/*.pdf | wc -l` → `16`

**Done when:** the docs exist and the PDFs are rebuilt.

#### Task 5.3 - End-to-end, integration suite and smoke

**Goal:** The once-per-part full runs.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` (specs `00` to `18`), then the full `pnpm test:integration`.
2. Run `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke`. Expect SMOKE PASS, "backup round trip ok (3 deals)", and no leftovers. The backup must include the new tables.
3. Log all three, commit `5.3: End-to-end, integration suite and smoke`, tick.

**Verify:** `ls e2e/screenshots/campaigns/*.png | wc -l` → `16`

**Done when:** all three ran green and are logged.

#### Task 5.4 - Independent review

**Goal:** One fresh-context review of Part 14.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is:
   - the full `.dsh/qa.md`;
   - a blank line;
   - `Final review of PLAN-PART14.md. Base commit {Phase 0 base}.`;
   - "Also check consent end to end (only subscribed people are ever sent to, the transitions match 6.2, suppression survives deletion), every public route in 6.3, 6.5 and 6.8 (token only, no open redirect, GET never mutates, rate limited, noindex), the marketing sanitiser, send idempotency under concurrency, and that no email body, merge value or token is logged."

   Fallbacks: `qa.sh` with the same request, then an evidenced self-review.
2. Fix blockers and majors, commit `5.4: QA fixes round {r}`, at most 3 rounds. After the last round, re-run the Task 4.4 gate commands, `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` and `pnpm test:integration`.
3. Log `- Independent review: {how} round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n}`.
4. Commit `5.4: Independent review`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`

**Done when:** the review ran, blockers and majors are fixed or logged, and the final tree has green evidence.

#### Task 5.5 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order. Write one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `5.5: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least `18`

**Done when:** every checklist item has a line.

#### Task 5.6 - Final report and completion

**Goal:** Hand the owner a short, truthful report.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report, short:
   - DoD items 1 to 9, one line each;
   - the Checklist;
   - Owner actions, numbered, with exact commands:
     - set `MARKETING_SMTP_*` to a bulk-email provider (recommended) or accept the system SMTP;
     - set the SPF, DKIM and DMARC DNS records for the sending domain and run the Domain check;
     - optionally set `CAMPAIGN_DKIM_*` and `CAMPAIGN_BOUNCE_IMAP_*`;
     - add and verify a sender and the postal address in Settings › Campaigns;
     - grant `campaigns.*` flags to the right permission sets;
     - rebuild the live install;
     - review `e2e/screenshots/campaigns/`;
   - changed tests;
   - Open issues.

   Do not repeat the Decisions list.
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `5.6: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- Billing, subscriber caps, tiers, or a trial.
- SMS, social posting, landing-page builder, A/B testing, send-time optimisation, AMP email.
- GeoIP locations, spam-complaint feedback loops beyond ARF in the bounce mailbox, inbox-placement testing.
- Sending through users' personal mailboxes.
- Campaigns to organizations or to leads without a person record.
- Changing Part 13 one-to-one emails, the composer, or tracking for one-to-one email.
- `site/`, `website/` and the separate website repo.

## 10. ASK and STOP triggers

This plan has no ASK triggers. The only STOP cases are the fatal ones in section 4.

| Situation | Safe default | Owner action to log |
|---|---|---|
| Docker stops or fills up after Task 0.1 | try `open -a Docker` and the section 4 dev:up command once; still failing → SKIPPED, finish the non-Docker tasks, `COMPLETE WITH OPEN ISSUES` | "Restart Docker Desktop or give it more disk, then run `pnpm test:integration`, `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e`, `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke`" |
| The filter engine cannot express a deal-based person condition | support person and organization fields only; log it | "Tell the planner which deal conditions you need for segments" |
| No bulk SMTP configured | campaigns use the system SMTP and the settings page shows a warning | "Configure MARKETING_SMTP_* with a bulk email provider before large sends" |
| A real network call would be needed (DNS in tests) | inject the resolver; never call real DNS in tests | none |
| The e2e worker does not run pg-boss jobs | an in-process e2e-only runner behind an env flag; log it | none |
| Subagent tool unavailable | `qa.sh`, then an evidenced self-review | "Run the review yourself with `.dsh/qa.md` and the Task 5.4 request" |
| Google env in `.env` still partial | keep the Environment prefixes | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty, ignoring untracked files the owner left in `site/public/`.
2. `pnpm install --frozen-lockfile` exits 0, and no runtime dependency was added in this part.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes (count at least the baseline plus the new tests).
6. `pnpm test:integration` passes on the final tree.
7. `pnpm build` exits 0.
8. `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` passes, specs `00` to `18`, on the final tree.
9. `ls e2e/screenshots/campaigns/*.png | wc -l` is 16.
10. Smoke printed SMOKE PASS and `backup round trip ok (3 deals)`.
11. `pnpm check:design` prints `0 violation(s)`.
12. The 6.2 transition tests, 6.3 token and route tests, 6.4 sanitiser tests, 6.7 concurrency test, 6.8 redirect tests and 6.10 scheduler tests pass (cite their names).
13. `grep -rnE "console\.(log|info)\(.*(html|body|token)" src/features/campaigns src/features/marketing` prints nothing.
14. Every public route added in this part sends `X-Robots-Tag: noindex` (cite the test).
15. No em dash in any file added or changed in this part (`git diff --name-only {Phase 0 base} | xargs perl -CSD -ne 'print "$ARGV\n" if /\x{2014}/' | sort -u` prints nothing, kit files excepted).
16. `docs/user-guide/campaigns.md`, `docs/dealflow/CAMPAIGNS.md`, `UPSTREAM.md` ("Part 14") and the new env vars in `.env.example` exist.
17. `ls docs/user-guide/pdf/*.pdf | wc -l` is 16.
18. `pnpm check:progress --final` passes.

## 12. Report back

No mid-run reporting. The run ends with the final report (Task 5.6). The owner pastes PROGRESS.md → Final report back to the planner, plus any gallery screens that look wrong.

## Appendix A - DeepSeek Harness overlays

Create these files exactly if either is missing. `loop.sh` passes the first with `--patch`; `qa.sh` passes both.

File: `.dsh/builder.patch.yml`

```yaml
# Dealflow builder overlay for DeepSeek Harness: dsh --profile dealflow --patch .dsh/builder.patch.yml
# A patch row replaces that row's whole config, so each row restates every field it keeps.

# Model for every agent this run creates. DSH_MODEL / DSH_PROVIDER override the defaults.
# The official DeepSeek provider reads DEEPSEEK_API_KEY from the shell or ~/.dsh/.env.
- id: agent-default-model
  config:
    provider: !!js process.env.DSH_PROVIDER || 'deepseek-official'
    model: !!js process.env.DSH_MODEL || 'deepseek-flash'

# Keep the code and the plan out of request metadata: no session-log upload.
- id: session-log-deepseek
  config:
    enabled: false

# Shell commands run with the unconfined local executor: pnpm's store, Docker and Playwright write outside
# this folder, and headless dsh has nobody to approve sandbox escalations. File tools stay confined to the
# folder by fs-sandbox (DSH_PERMISSION_MODE=workspace-write), and .dsh/guard.bash vets every command.
- id: bash-sandbox
  disabled: true

# Permission presets bundle a sandbox mode and refuse an unconfined executor. Without them the session uses
# DSH_PERMISSION_MODE for file tools and the default approval policy (ask, which fails closed headless).
- id: permission
  disabled: true

- insert:
    - id: bash-local
      name: '@deepseek-ai/dsh-bash-local'
      config:
        timeoutMs: 900000
        maxTimeoutMs: 1800000
```

File: `.dsh/qa.patch.yml`

```yaml
# Reviewer overlay, applied after builder.patch.yml by qa.sh. DSH_QA_MODEL lets the checker use another model.
- id: agent-default-model
  config:
    provider: !!js process.env.DSH_QA_PROVIDER || process.env.DSH_PROVIDER || 'deepseek-official'
    model: !!js process.env.DSH_QA_MODEL || process.env.DSH_MODEL || 'deepseek-flash'

# The reviewer goes back to the confined shell: its commands may write only inside this folder.
- id: bash-local
  disabled: true

- id: bash-sandbox
  disabled: false
  config:
    timeoutMs: 900000

- id: permission
  disabled: false
```

## Appendix B - `.dsh/qa.md`

```markdown
# Dealflow QA reviewer

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md to PLAN-PART14.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

If the request is exactly "Reply exactly: QA READY", reply with the two words QA READY and do nothing else.

Hard rules for you:
- You are read-only. Never create, edit, move or delete files, never commit, reset, checkout, stash or push. Commands that only read or that write build output inside this folder (typecheck, lint, build, unit tests) are fine.
- Never call ask_user_question; nobody will answer.
- Never print the contents of .env.
- Stop any server you start.

Input: "Final review of {plan file}. Base commit {hash}.", "Phase N gate review of {plan file}. Base commit {hash}.", or "Part N audit of {plan file}. Base commit {hash}. Focus: ..." (an audit works through every focus item explicitly and reports each one).

Procedure:
1. Read the named plan's sections 2, 3, 6 and 7 and every task (for a phase review: that phase's tasks). For a later part also read the earlier plans' sections where it references them.
2. Run `git --no-optional-locks diff --stat {hash}..HEAD` and read the changed files that matter.
3. Run `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` and note the exact results (use the Environment commands in PROGRESS.md). Read PROGRESS.md for the e2e, integration and smoke results; check the screenshot files the plan lists exist in e2e/screenshots.
4. For every task: each listed file exists; each step is really implemented, not stubbed or left as a placeholder; section 6 contracts match exactly (paths, routes, status codes, redirects, error IDs, env vars, schema, prompts, test hooks); section 7 conventions hold; the task's "Done when" holds.
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; money is computed on integer minor units with no floats, converted totals never add unconverted amounts or drop deals silently (excluded deals are listed), the forecast reuses the deals visibility filter; document public routes take only the publicId and a validated body, never render HTML, issued documents are immutable; domain events are written inside the mutation's transaction, automation actions go through existing services and respect the loop guard, webhook delivery checks every resolved address inside the DNS lookup with no redirects, webhook secrets are encrypted and never returned after creation; public form and booking handlers write nothing on spam paths, bookings re-check the slot under a per-host lock in the same transaction, only `/f/*` and `/book/*` may be framed; reports apply the deals or activities visibility clause, never add values across currencies in SQL, send only aggregated rows to the AI; API calls authenticate only by hashed bearer token and run as the token's user through existing services, exports reuse list visibility, backups keep secrets out of argv and logs, download routes refuse path traversal; bulk actions and undo call the existing services, the next recurring occurrence is created once inside the completion transaction, duplicates respect visibility; the service worker never caches authenticated HTML or API responses, offline data is per user and wiped on sign-out, the VAPID private key never reaches the client; the restyle changes no behaviour or test hook, every visual value matches the plan's measured Pipedrive spec (section 6) through tokens or primitives, no Pipedrive asset is copied, and `check-design` opt-outs carry a genuine reason; dialogs put the close button in the header and scroll only their body, long lists scroll or search, the hidden install, offline and push UI is gated by NEXT_PUBLIC_PWA_UI and not deleted, AI JSON parsing never logs reply content; outbound email HTML is built only by src/features/email-design, variables are escaped and subjects carry no CR or LF, button URLs are structural, the public logo route serves only the stored hash, template saves are admin only and audited, no email content is logged; campaigns send only to subscribed people with consent evidence, suppression survives deletion, public campaign routes take only a token, never mutate on GET, never open-redirect and are rate limited, the marketing HTML sanitiser blocks scripts and event handlers, bulk sends are idempotent under concurrency; no em dashes in new files.
6. Ignore style nits and anything in section 9.

Output exactly one of:

QA RESULT: PASS
(one line per command you ran with its result)

or

QA RESULT: FAIL
1. [blocker|major|minor] file:line or route | what is wrong | what the plan requires (section/task) | how to fix
(at most 25 items, blockers first)
```

## Appendix C - `qa.sh`

```bash
#!/usr/bin/env bash
# Independent QA: a separate DeepSeek Harness process (fresh context) with the reviewer instructions in .dsh/qa.md.
# Usage: ./qa.sh "Final review of PLAN-PART14.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
set -u
cd "$(dirname "$0")"
REQUEST="${1:?pass the review request}"
PROFILE="${DSH_PROFILE:-dealflow}"
command -v dsh >/dev/null 2>&1 || { echo "QA RUNNER ERROR: dsh not found (npm install -g @deepseek-ai/dsh)"; exit 2; }
# The reviewer runs the confined shell (qa.patch.yml) and file tools limited to this folder.
export DSH_PERMISSION_MODE=workspace-write DSH_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1
export BASH_ENV="$PWD/.dsh/guard.bash" DEALFLOW_PROJECT_DIR="$PWD"
unset DSH_TOOLS_MODE
BEFORE="$(git --no-optional-locks status --porcelain 2>/dev/null)"
PROMPT="$(cat .dsh/qa.md)

$REQUEST"
OUT="$(dsh --profile "$PROFILE" --patch .dsh/builder.patch.yml --patch .dsh/qa.patch.yml "$PROMPT" 2>/dev/null)"
CODE=$?
AFTER="$(git --no-optional-locks status --porcelain 2>/dev/null)"
printf '%s\n' "$OUT"
if [ "$BEFORE" != "$AFTER" ]; then
  echo "QA WARNING: the working tree changed during the review; restore those files with git checkout -- <file>"
fi
if printf '%s' "$OUT" | grep -qE "QA RESULT:|QA READY"; then exit 0; fi
echo "QA RUNNER ERROR: no QA RESULT in the output (dsh exit $CODE)"
exit 1
```

## Appendix D - `scripts/check-progress.mjs`

```js
#!/usr/bin/env node
// Verifies PROGRESS.md against the plan and git history (fast verification profile).
// Usage: node scripts/check-progress.mjs          (during the run)
//        node scripts/check-progress.mjs --final  (before setting STATUS: COMPLETE)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART14.md";
const final = process.argv.includes("--final");
const plan = readFileSync(PLAN_FILE, "utf8");
const progress = readFileSync("PROGRESS.md", "utf8");
const problems = [];

const planId = (plan.match(/Plan ID:\s*([A-Za-z0-9._-]+)/) || [])[1];
if (planId && !progress.includes(planId)) problems.push(`PROGRESS.md does not carry plan id ${planId}`);
const tasks = [...plan.matchAll(/^#### Task (\d+\.\d+) [-\u2014] (.+)$/gm)].map((m) => ({ id: m[1], title: m[2].trim() }));
const ticked = new Set([...progress.matchAll(/^- \[x\] (\d+\.\d+)\b/gm)].map((m) => m[1]));
const base = (progress.match(/^- Phase 0: ([0-9a-f]{7,40})/m) || [])[1];
if (!base) problems.push('PROGRESS.md has no "- Phase 0: <hash>" base commit');
const range = base ? `${base}..HEAD` : "HEAD";
const subjects = execSync(`git --no-optional-locks log --format=%s ${range}`, { encoding: "utf8" }).split("\n").filter(Boolean);

for (const s of subjects) {
  if (/^\d+\.\d+\s*[-–,]\s*\d+\.\d+/.test(s)) problems.push(`combined commit not allowed: "${s}"`);
}
const qaLog = (progress.split(/^## QA log$/m)[1] || "").split(/^## /m)[0];
for (const t of tasks) {
  const committed = subjects.some((s) => s.startsWith(`${t.id}: `));
  if (ticked.has(t.id) && !committed) problems.push(`${t.id} is ticked but there is no commit "${t.id}: ..." since ${base}`);
  if (/QA gate$/.test(t.title) && ticked.has(t.id)) {
    const phase = t.id.split(".")[0];
    const line = qaLog.split("\n").find((l) => l.includes(`Phase ${phase} gate`));
    if (!line) problems.push(`${t.id} is ticked but the QA log has no "Phase ${phase} gate" line`);
    else if (!/commands (green|red)/i.test(line)) problems.push(`Phase ${phase} gate line must say "commands green" or "commands red"`);
  }
  if (/^Independent review/.test(t.title) && ticked.has(t.id)) {
    const line = qaLog.split("\n").find((l) => l.startsWith("- Independent review"));
    if (!line) problems.push(`${t.id} is ticked but the QA log has no "- Independent review" line`);
    else if (!/(qa\.sh|QA RESULT)/i.test(line)) problems.push("the Independent review line has no qa.sh result");
  }
}
if (final) {
  const last = tasks[tasks.length - 1];
  for (const t of tasks) if (t !== last && !ticked.has(t.id)) problems.push(`not done: ${t.id} ${t.title}`);
  if (/^##\s*Final report\s*\n+\(written/m.test(progress)) problems.push("Final report section is still empty");
}
if (problems.length) {
  console.log(problems.map((p) => `PROGRESS CHECK: ${p}`).join("\n"));
  process.exit(1);
}
console.log(`PROGRESS CHECK OK: ${ticked.size}/${tasks.length} tasks ticked, all with commits${final ? ", ready to complete" : ""}`);
```

## Appendix E - command guard

File: `.dsh/guard.bash`

```bash
# Sourced by every non-interactive `bash -c` the agent runs (BASH_ENV is exported by loop.sh and qa.sh).
# It hands the command string to guard.mjs before bash runs it; a blocked command exits 126 with the reason.
if [ -n "${BASH_EXECUTION_STRING:-}" ] && [ -n "${DEALFLOW_PROJECT_DIR:-}" ]; then
  if ! printf '%s' "$BASH_EXECUTION_STRING" | node "$DEALFLOW_PROJECT_DIR/.dsh/guard.mjs"; then
    exit 126
  fi
fi
```

File: `.dsh/guard.mjs`

```js
#!/usr/bin/env node
// Command guard for the Dealflow build. .dsh/guard.bash pipes each `bash -c` command string here.
// Shell commands run unconfined (pnpm, Docker and Playwright write outside the folder), so this blocks the
// commands the plan forbids. Exit 2 with a reason on stderr blocks; exit 0 allows.
import { readFileSync } from "node:fs";

let cmd = "";
try {
  cmd = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}
const block = (why) => {
  process.stderr.write(`blocked by Dealflow guard: ${why}. This is a hard limit in the plan; log it and continue.\n`);
  process.exit(2);
};
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART(?:1[0-4]|[1-9])\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
const DENY = [
  [/\/Users\/[^/\s]+\/Downloads\/DEALFLOW(\/|\s|$|["'])|\.\.\/DEALFLOW(\/|\s|$)/, "the old Dealflow app folder is off limits"],
  [/\bgit\s+push\b/, "git push"],
  [/\bgit\s+reset\s+--hard\b/, "git reset --hard"],
  [/\bgit\s+clean\b/, "git clean"],
  [/\bgit\s+(rebase|filter-branch|filter-repo)\b/, "history rewrite"],
  [/\bgit\s+branch\s+-D\b/, "deleting a branch"],
  [/\bgit\s+(checkout|restore)\s+(--\S*\s+)*\.(\s|$)/, "discarding all changes"],
  [/(^|[\s;&|(])sudo\s/, "sudo"],
  [/\brm\s+(-\S+\s+)*\S*\.git(\s|\/|$)/, "deleting git data"],
  [/\bdocker\s+(system|volume|image|container|builder|network)\s+prune\b/, "docker prune"],
  [/\bdocker\s+compose\b.*\bdown\b.*(\s-v\b|--volumes)/, "compose down with volumes"],
  [/\bdocker\s+volume\s+rm\b(?!(\s+dealflow-smoke_[a-z]+)+\s*$)/, "removing a volume other than dealflow-smoke_*"],
  [/\bdocker\s+(rm|rmi|kill|stop)\b(?!.*dealflow-smoke)/, "removing or stopping containers outside dealflow-smoke"],
  [/\b(npm|pnpm|yarn)\s+publish\b/, "publishing a package"],
  [/\bcurl\b[^|]*\|\s*(ba|z)?sh\b/, "piping a download into a shell"],
  [/DROP\s+DATABASE\s+(?!(IF\s+EXISTS\s+)?"?dealflow_e2e\b)/i, "dropping a database other than dealflow_e2e"],
  [/(^|[\s;&|])(cat|less|more|head|tail|bat|nl|strings|xxd|grep)\s+(\S+\s+)*(\S*\/)?\.env(\s|$)/, "printing .env"],
  [/>>?\s*\.env(\s|$)/, "writing .env directly (use scripts/dealflow/env-sync.mjs)"],
  [/\b(sed|perl)\s+-i\b.*(\s|\/)\.env(\s|$)/, "editing .env directly"],
  [/:3333\b/, "port 3333 belongs to the owner's old app"],
  [/dealflow-prod/, "the owner's live dealflow-prod stack is off limits"],
  [/\.env\.production\b/, ".env.production belongs to the owner's live install"],
  [/(localhost|127\.0\.0\.1):(3001|8080|9000)\b/, "ports 3001, 8080 and 9000 belong to the owner's live stack"],
];
for (const [re, why] of DENY) if (re.test(cmd)) block(why);
// rm may only touch paths inside the project, /tmp or /private/tmp.
const project = process.env.DEALFLOW_PROJECT_DIR || process.cwd();
for (const m of cmd.matchAll(/\brm\s+([^;&|\n]*)/g)) {
  for (const arg of m[1].split(/\s+/).filter((a) => a !== "" && !a.startsWith("-"))) {
    const target = arg.replace(/^["']|["']$/g, "");
    if (/^(~|\$HOME|\.\.)/.test(target) || target === "/" || target === "*" || target === "/*") block("deleting outside the project");
    if (target.startsWith("/") && !["/tmp/", "/private/tmp/", `${project}/`].some((ok) => target.startsWith(ok))) {
      block("deleting outside the project");
    }
  }
}
const KIT_WRITES = [
  new RegExp(String.raw`(^|[^0-9&])>>?\s*` + KIT),
  new RegExp(String.raw`\b(rm|mv|truncate|tee)\b[^;&|]*\s` + KIT),
  new RegExp(String.raw`\b(sed|perl)\s+-i\b[^;&|]*\s` + KIT),
  new RegExp(String.raw`\bcp\b[^;&|]*\s` + KIT + String.raw`\s*($|[;&|])`),
];
if (KIT_WRITES.some((re) => re.test(cmd))) block("changing a kit file");
process.exit(0);
```

## Appendix F - `loop.sh`

```bash
#!/usr/bin/env bash
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART14.md (dealflow-wd-p14-v1) is finished.
# Usage: ./loop.sh      Env: DSH_MODEL (default deepseek-flash), MAX_RUNS (30), RUN_TIMEOUT_MIN (240), DSH_PROFILE (dealflow)
set -u
cd "$(dirname "$0")"
command -v dsh >/dev/null 2>&1 || { echo "dsh not found: npm install -g @deepseek-ai/dsh, then ./dsh-setup.sh"; exit 2; }
MAX_RUNS="${MAX_RUNS:-30}"
RUN_TIMEOUT_MIN="${RUN_TIMEOUT_MIN:-240}"
PROFILE="${DSH_PROFILE:-dealflow}"
# File tools stay inside this folder (workspace-write). Shell commands run unconfined through bash-local and
# every one passes .dsh/guard.bash first. Headless dsh has nobody to answer approvals, so they fail closed.
export DSH_PERMISSION_MODE=workspace-write DSH_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1
export BASH_ENV="$PWD/.dsh/guard.bash" DEALFLOW_PROJECT_DIR="$PWD"
unset DSH_TOOLS_MODE
PROMPT='Read PLAN-PART14.md in this folder in full and PROGRESS.md, then follow PLAN-PART14.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p14-v1; earlier parts are finished) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p14-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p14-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
digest() { if [ -f PROGRESS.md ]; then shasum PROGRESS.md | cut -d' ' -f1; else echo none; fi; }
mkdir -p .dsh/logs
STALLED=0
for i in $(seq 1 "$MAX_RUNS"); do
  if finished; then echo "Finished: $(grep -m1 -E '^STATUS:' PROGRESS.md)"; exit 0; fi
  LOG=".dsh/logs/run-$(printf '%02d' "$i")-$(date +%Y%m%d-%H%M%S).log"
  BEFORE="$(digest)"
  echo "=== builder run $i/$MAX_RUNS ($(date)) log: $LOG"
  dsh --profile "$PROFILE" --patch .dsh/builder.patch.yml "$PROMPT" >"$LOG" 2>&1 &
  PID=$!
  ( sleep $((RUN_TIMEOUT_MIN * 60)); kill -TERM "$PID" 2>/dev/null ) &
  WATCHDOG=$!
  wait "$PID"; CODE=$?
  kill "$WATCHDOG" 2>/dev/null; wait "$WATCHDOG" 2>/dev/null
  echo "run $i exited with $CODE; $(grep -m1 -E '^Current:' PROGRESS.md 2>/dev/null)"
  if grep -q "MISSING_CREDENTIAL" "$LOG"; then echo "Stopped: no DeepSeek API key. Put DEEPSEEK_API_KEY in ~/.dsh/.env and rerun."; exit 2; fi
  if [ "$(digest)" = "$BEFORE" ]; then STALLED=$((STALLED + 1)); else STALLED=0; fi
  if [ "$STALLED" -ge 3 ]; then echo "Stopped: PROGRESS.md unchanged for 3 runs. Read the last log in .dsh/logs/."; exit 1; fi
done
echo "Stopped after $MAX_RUNS runs without STATUS: COMPLETE. Check PROGRESS.md."
exit 1
```

## Appendix G - `dsh-setup.sh`

```bash
#!/usr/bin/env bash
# One-time setup of the DeepSeek Harness profile used by loop.sh and qa.sh. Safe to re-run (it rebuilds the profile).
set -u
cd "$(dirname "$0")"
PROFILE="${DSH_PROFILE:-dealflow}"
command -v dsh >/dev/null 2>&1 || { echo "dsh not found: npm install -g @deepseek-ai/dsh"; exit 2; }
echo "dsh $(dsh --version)"
dsh --profile "$PROFILE" --from-default-profile headless --help >/dev/null || { echo "could not create the $PROFILE profile from the headless template"; exit 1; }
dsh --profile "$PROFILE" --patch .dsh/builder.patch.yml --dump-config >/dev/null || { echo "builder overlay does not load"; exit 1; }
dsh --profile "$PROFILE" --patch .dsh/builder.patch.yml --patch .dsh/qa.patch.yml --dump-config >/dev/null || { echo "qa overlay does not load"; exit 1; }
echo "profile $PROFILE: ok"
BASH_ENV="$PWD/.dsh/guard.bash" DEALFLOW_PROJECT_DIR="$PWD" bash -c 'git push origin main' >/dev/null 2>&1
if [ $? -eq 126 ]; then echo "guard self-test (blocks git push): ok"; else echo "guard self-test: FAILED, do not run loop.sh"; exit 1; fi
BASH_ENV="$PWD/.dsh/guard.bash" DEALFLOW_PROJECT_DIR="$PWD" bash -c 'true' || { echo "guard self-test (allows true): FAILED"; exit 1; }
if [ -z "${DEEPSEEK_API_KEY:-}" ] && ! grep -q "^DEEPSEEK_API_KEY=" "${DSH_HOME:-$HOME/.dsh}/.env" 2>/dev/null; then
  echo "note: put DEEPSEEK_API_KEY=... in ${DSH_HOME:-$HOME/.dsh}/.env (keep it out of this project's .env)"
fi
echo "Next: ./qa.sh \"Reply exactly: QA READY\"  then  ./loop.sh"
```

## Appendix H - `AGENTS.md`

```markdown
# Agent notes for this repository

This folder is warpdrive, being extended into Dealflow by an autonomous build.

- If your task prompt names you the QA reviewer, follow `.dsh/qa.md` and ignore the rest of this file.
- Otherwise you are the builder: read `PLAN-PART14.md` in full (Parts 1 to 13 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART14.md rule 18.
```
