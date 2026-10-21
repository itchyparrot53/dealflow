# PLAN: Dealflow on warpdrive, Part 6: Web forms and scheduler

> Plan ID: dealflow-wd-p6-v1 · Written: 2026-10-21 · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 4, fast verification profile, no human in the loop · Type: change to existing project

Parts 1 to 5 are finished (`PROGRESS-P1.md` to `PROGRESS-P4.md`, and `PROGRESS.md` until Task 0.1 renames it to `PROGRESS-P5.md`). Part 5 left 5,124 unit tests, 1,951 integration tests and e2e specs `00` to `09`, all passing, plus the event backbone (`src/features/events/`), automations and webhooks. Part 6 adds public web forms and booking pages. This plan is compact: where it says "find" or "reuse", locate the existing code, reuse it, and log the file you used as a Decision.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 4** in fresh-context sessions, one phase per session. Parts 1 to 5 (`PLAN-PART1.md` to `PLAN-PART6.md`) are finished; their code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART6.md` in full and PROGRESS.md (open earlier `PLAN-PART{N}.md` files only where this plan points to them). If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p6-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 5's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 4.5, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 4.2.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.4, 1.3, 2.3, 3.6):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). The one independent review is Task 4.3.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (three new event types and triggers, framing headers for `/f/` and `/book/`), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs only. This part needs no external service; e2e uses the fake mail transport; tests call only local routes, and visitor emails go to the system mailer fake.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove or recreate the owner's running Compose project `warpdrive-main`, never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack 3001/5433/8080/9000/9001 (owner's). Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `PLAN-PART3.md`, `PLAN-PART4.md`, `PLAN-PART5.md`, `PLAN-PART6.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 5's file to `PROGRESS-P5.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p6-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 6: progress files, kit and baseline
(every task through 4.5, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 4990/4990 · forms 20/20

## Decisions
- 0.3: chose … over … because …

## Owner actions
- TODO(owner): …

## Open issues
- None

## Environment
(copy the section 4 "Known environment" commands that this machine needs, and keep them current)

## Final report
(written in Task 4.5)
```

## 1. Goal

Add public web forms and booking pages. Forms create leads or deals and can be embedded on any site; spam is held off by a honeypot, a minimum fill time and a rate limit. Booking pages compute free slots from each host's weekly availability and existing activities; a visitor books one, the host gets an activity and a notification, and the visitor gets a confirmation email with a cancel link. Both feed Part 5's event backbone, so automations and webhooks can react.

## 2. Definition of done

1. Migration `0085_dealflow_forms_booking` adds the four tables of 6.4, and `0086` adds the three notification kinds; nothing else changes.
2. The time-zone helpers, the slot engine and form validation are pure, unit-tested functions, including DST changes and buffers.
3. Admins build forms (fields from a fixed set plus supported custom fields; creates a lead, or a deal in a chosen stage). The public page `/f/{publicId}` works without sign-in and inside an iframe, and shows the embed code.
4. A submission finds or creates the person (by email, case-insensitive) and organization (by name), creates the lead or deal through the existing services, stores the message as a note, records the submission, notifies the form owner, and emits `form.submitted`. Honeypot or too-fast submissions are accepted silently and saved nowhere. Over the rate limit returns 429.
5. Users create booking pages for themselves (admins for anyone). The public page `/book/{publicId}` lists free slots for 14 days at a time in the visitor's time zone.
6. Slots respect availability, notice, days ahead, duration and buffers, and exclude the host's open timed activities. Booking re-checks the slot under a per-host lock, so two visitors can never book the same time.
7. A booking creates an activity for the host, links or creates the person, notifies the host, emails the visitor a confirmation with a cancel link (and an `.ics` invite when the system mailer supports attachments), and emits `booking.created`. Cancelling through the link removes the activity, notifies the host and emits `booking.cancelled`.
8. Automations and webhooks offer `form.submitted`, `booking.created` and `booking.cancelled`.
9. Every public page carries a "Powered by Dealflow" footer. Only `/f/*` and `/book/*` may be framed.
10. typecheck, lint, build, unit and the full integration suite pass. e2e specs `00` to `10` pass, the 7 `p6-*` screenshots exist, smoke passes, and one independent review ran.

## 3. Decisions already made

- Stack unchanged; no new dependency. Time zones use `Intl` only, through the helpers in 6.5.
- Public pages live outside the `(app)` route group, like Part 4's `/d/{publicId}`. Public writes are route handlers under `src/app/api/public/`, with the Part 4 origin check skipped for these two endpoints, because embedded forms post from other sites. They use rate limits from the existing `createRateLimiter`, keyed by `clientIp` (Part 5) plus the public id.
- Spam protection: a hidden `website` honeypot field, and a signed `startedAt` token. The token is an HMAC with the app's existing server secret (find the one sessions or tokens use, and log it). Submissions under 2 seconds or with a bad token are dropped silently. No CAPTCHA.
- Records are created as the form owner or booking host, through the services the app already uses (person, organization, lead, deal, note, activity). Their created events and permissions therefore behave as for a user.
- Bookings are activities. Busy time = the host's not-done activities that have a time, from `due_at` to `end_at`, else `due_at + duration_minutes`, else 30 minutes. All-day activities do not block slots.
- Host time zone = `user_preferences.timezone`, else the page's own `timezone` field (set on create from the host's preference or `UTC`).
- Rescheduling, round-robin or team booking pages, calendar sync (Google or CalDAV) and payments are out of scope.
- Permissions:
  - Forms need a new `forms.manage` capability (admin only, declared like `automations.manage`).
  - Booking pages: any user manages their own, and admins manage all.

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | PROGRESS.md says `dealflow-wd-p5-v1` and `STATUS: COMPLETE` | log a Decision describing what you found; continue |
| Kit location | `PLAN-PART6.md` and the kit at the repo root, or in `PLAN AND EXECUTE/dealflow-wd-part6-kit/` | root symlink plus the byte-identical checker copy; log a Decision |
| Next migration | the last file in `drizzle/` is `0084_dealflow_automation_notifications.sql` | next free numbers; log them |
| Activities | `src/db/schema/activities.ts` has `due_at`, `end_at`, `duration_minutes`, `done`, `assignee_id` and an all-day flag (the comment near `due_at`) | adapt the busy-time query to the real columns; log it |
| Leads | `src/db/schema/leads.ts` has `source_origin`; check its allowed values for a web-form origin | use the web-form value if one exists, else the closest value; log it |
| Person lookup by email | an existing helper finds a person by email address (the email-linking code uses one) | reuse it; log the file |
| Security headers | find where `X-Frame-Options` or CSP `frame-ancestors` is set (`next.config.*` headers or middleware) | allow framing only for `/f/` and `/book/`; log the file |
| System mailer attachments | check whether `SystemMail` accepts attachments | attach the `.ics` if it does, else put the details in the body only; log which |
| pnpm 9, Docker, subagent | as in Part 5 | as in Part 5 |

**Known environment:** copy `PROGRESS-P5.md` → Environment (after Task 0.1 renames it) into PROGRESS.md → Environment and follow it.

**Fatal (STOP with `STATUS: BLOCKED`):** pnpm cannot be installed, or `pnpm install --frozen-lockfile` fails for a registry reason.

## 5. Target structure

```
src/db/schema/forms.ts                          # 6.4 (exported from the index)
drizzle/0085_dealflow_forms_booking.sql, drizzle/0086_dealflow_forms_booking_notifications.sql
src/features/scheduling/
  zonedTime.ts, zonedTime.test.ts               # 6.5
  slots.ts, slots.test.ts                       # 6.6
  bookingPages.ts, busy.ts, booking.ts, cancel.ts, ics.ts, ics.test.ts
  actions.ts, router.ts, scheduling.integration.test.ts
  ui/{BookingPagesList,BookingPageEditor,AvailabilityEditor,PublicBooking,BookingConfirmed}.tsx
src/features/forms/
  fields.ts, fields.test.ts                     # 6.7 definition + submission validation (pure)
  spamToken.ts, spamToken.test.ts
  forms.ts, submit.ts, actions.ts, router.ts, forms.integration.test.ts
  ui/{FormsList,FormEditor,FieldList,EmbedCode,SubmissionsTable,PublicForm}.tsx
src/features/public/PoweredBy.tsx
src/app/f/[publicId]/page.tsx
src/app/book/[publicId]/page.tsx, src/app/book/cancel/[token]/page.tsx
src/app/api/public/forms/[publicId]/submit/route.ts
src/app/api/public/booking/[publicId]/{slots,book}/route.ts, src/app/api/public/booking/cancel/route.ts
src/app/(app)/settings/forms/page.tsx, .../forms/[id]/page.tsx
src/app/(app)/settings/booking/page.tsx, .../booking/[id]/page.tsx
e2e/10-forms-booking.spec.ts
docs/dealflow/FORMS.md, docs/dealflow/SCHEDULING.md
```

## 6. Contracts

### 6.1 Constants and env

No new env keys. `src/constants/formsBooking.ts`:
- `FORM_MIN_FILL_MS = 2000`, `FORM_TOKEN_MAX_AGE_MS = 86_400_000`
- `FORM_SUBMIT_PER_MINUTE = 10`, `BOOKING_SLOTS_PER_MINUTE = 60`, `BOOKING_BOOK_PER_MINUTE = 10`
- `FORM_MAX_FIELDS = 15`, `FORM_FIELD_MAX_CHARS = 2000`, `FORM_BODY_MAX_BYTES = 65_536`
- `SLOT_RANGE_MAX_DAYS = 14`, `BOOKING_DEFAULT_DURATION = 30`

### 6.2 Error IDs (append; add the `FORM` and `BOOKING` domains to the registry and its test allow-list)

| ID | Cause | User copy |
|---|---|---|
| `E_FORM_001` | form missing, inactive, or owner inactive | "This form is not available." |
| `E_FORM_002` | invalid form definition | (inline Zod issues) |
| `E_FORM_003` | submission failed validation (context: field errors) | "Please check the highlighted fields." |
| `E_FORM_004` | rate limited | "Too many submissions. Try again in a minute." |
| `E_FORM_005` | action input failed Zod | (inline) |
| `E_BOOKING_001` | page missing, inactive, or host inactive | "This booking page is not available." |
| `E_BOOKING_002` | slot no longer free | "That time is no longer available. Please pick another." |
| `E_BOOKING_003` | invalid availability or page settings | (inline Zod issues) |
| `E_BOOKING_004` | rate limited | "Too many requests. Try again in a minute." |
| `E_BOOKING_005` | cancel link invalid or already used | "This booking was already cancelled or the link is invalid." |
| `E_BOOKING_006` | action input failed Zod | (inline) |

Copy lives in `src/constants/formsBookingStrings.ts`.

### 6.3 Test hooks and screenshots

`data-testid` values:
- **Forms admin:** `forms-table`, `form-row` (`data-form-id`), `form-new`, `form-editor`, `form-field-add`, `form-field-row`, `form-creates-select`, `form-save`, `form-embed-code`, `form-public-link`, `form-submissions`.
- **Public form:** `public-form`, `public-form-field` (`data-key`), `public-form-submit`, `public-form-success`.
- **Booking admin:** `booking-pages-table`, `booking-page-row`, `booking-page-new`, `booking-editor`, `availability-day` (`data-day`), `booking-save`, `booking-public-link`.
- **Public booking:** `public-booking`, `booking-day` (`data-date`), `booking-slot` (`data-start`), `booking-name`, `booking-email`, `booking-note`, `booking-submit`, `booking-confirmed`, `booking-cancel-confirm`, `booking-cancelled`.
- **Footer:** `powered-by`.

Screenshots: `p6-forms-list`, `p6-form-editor`, `p6-public-form`, `p6-booking-pages`, `p6-booking-editor`, `p6-public-booking`, `p6-booking-confirmed`.

### 6.4 Schema (`src/db/schema/forms.ts`)

Id and FK types match the referenced tables. Timestamps are `timestamptz`.

```ts
web_forms: id, public_id text not null unique, name text not null (1..120), title text not null (1..150),
  description text null (<= 1000), fields jsonb not null, creates text not null check in ('lead','deal'),
  pipeline_id -> pipelines.id on delete set null, stage_id -> stages.id on delete set null,
  owner_id -> users.id on delete restrict not null, success_message text not null default 'Thanks, we will be in touch.',
  redirect_url text null, active boolean not null default true, submission_count integer not null default 0,
  created_by -> users.id on delete set null, created_at, updated_at
web_form_submissions: id, form_id -> web_forms.id on delete cascade, values jsonb not null,
  person_id -> persons.id on delete set null, lead_id -> leads.id on delete set null, deal_id -> deals.id on delete set null,
  created_at; index (form_id, created_at desc)
booking_pages: id, public_id text not null unique, host_id -> users.id on delete cascade, title text not null (1..120),
  description text null (<= 1000), duration_minutes integer not null default 30 (check 15..240),
  buffer_minutes integer not null default 0 (0..120), min_notice_hours integer not null default 4 (0..168),
  days_ahead integer not null default 30 (1..90), timezone text not null, availability jsonb not null,
  activity_type_id -> activity_types.id on delete restrict not null, location text null (<= 300),
  active boolean not null default true, created_at, updated_at
bookings: id, page_id -> booking_pages.id on delete cascade, activity_id -> activities.id on delete set null,
  person_id -> persons.id on delete set null, start_at timestamptz not null, end_at timestamptz not null,
  visitor_name text not null, visitor_email text not null, note text null (<= 1000),
  cancel_token_hash text not null unique, status text not null default 'booked' check in ('booked','cancelled'),
  cancelled_at timestamptz null, created_at
  index (page_id, start_at)
```

- `public_id` = `randomBytes(12).toString("base64url")` (16 characters).
- Cancel token = `randomBytes(24).toString("base64url")`. Only its SHA-256 hex is stored.
- No IP addresses are stored.

### 6.5 Time zones (`zonedTime.ts`, pure)

```ts
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export function tzOffsetMinutes(at: Date, tz: string): number;                    // via Intl formatToParts (hourCycle h23)
export function zonedToUtc(date: string /* YYYY-MM-DD */, time: string /* HH:MM */, tz: string): Date;
// guess = Date.UTC(parts); off1 = offset(guess); t1 = guess - off1; off2 = offset(t1); return off1 === off2 ? t1 : guess - off2.
// A time that does not exist (spring forward gap) resolves forward by the gap; an ambiguous time (fall back) takes the first occurrence.
export function utcToZoned(at: Date, tz: string): { date: string; time: string; weekday: Weekday };
export function addDays(date: string, n: number): string;                          // calendar arithmetic on YYYY-MM-DD in UTC
export function isValidTimeZone(tz: string): boolean;                              // Intl.supportedValuesOf("timeZone") or a try/catch on DateTimeFormat
```

### 6.6 Slot engine (`slots.ts`, pure)

```ts
export type Availability = Record<Weekday, { from: string; to: string }[]>;   // HH:MM, at most 3 ranges a day, from < to, no overlaps
export type SlotPage = { durationMinutes: number; bufferMinutes: number; minNoticeHours: number; daysAhead: number; timezone: string; availability: Availability };
export function computeSlots(page: SlotPage, busy: { start: Date; end: Date }[], now: Date, from: string, to: string): string[];
```

1. Walk every date from `from` to `to` (inclusive, at most 14 days). For the date's weekday, in the page time zone, each range yields starts every `durationMinutes` from `from`, while `start + duration <= to`. Convert each start with `zonedToUtc`.
2. Drop starts earlier than `now + minNoticeHours` or later than `now + daysAhead` days.
3. Drop starts whose `[start - buffer, start + duration + buffer)` overlaps any busy interval (half-open intervals).
4. Return sorted, de-duplicated UTC ISO strings (`toISOString()`).

`availabilitySchema` (Zod) enforces the range rules. The default availability is Mon to Fri 09:00 to 17:00, with an empty Sat and Sun.

`busy.ts`: `loadBusy(db, hostId, fromUtc, toUtc, signal)` loads the host's not-done, non-deleted, timed activities overlapping the window (assignee = host, or owner = host when the assignee is null), using the busy rule from section 3.

### 6.7 Form fields (`fields.ts`, pure)

```ts
export type FormFieldKey = "name" | "email" | "phone" | "organization" | "job_title" | "message" | `cf_${string}`;
export type FormField = { key: FormFieldKey; label: string /* 1..100 */; required: boolean; placeholder: string | null /* <= 100 */ };
export const formDefinitionSchema;  // fields 1..15, keys unique, name and email present and required
export function validateSubmission(fields: FormField[], values: Record<string, unknown>, customDefs: Map<string, CustomFieldDef>):
  Result<Record<string, string>, { fieldErrors: Record<string, string> }>;
// trims, enforces required, max 2000 characters, email format, number and date formats for custom fields,
// option membership for single-option custom fields; unknown keys are ignored.
```

- `cf_{id}` keys must reference active custom field definitions on person, lead or deal. Only the text, long text, number, date and single-option types are allowed; map warpdrive's custom-field type names and log the mapping.
- On submit, a custom field value is written to the record that owns the definition.

`spamToken.ts`:

```ts
export function issueFormToken(formPublicId: string, now: number): string;   // `${now}.${hmacHex(secret, publicId + "." + now)}`
export function checkFormToken(formPublicId: string, token: string, now: number): "ok" | "too_fast" | "invalid";
// invalid: bad format or signature, or older than FORM_TOKEN_MAX_AGE_MS; too_fast: now - issued < FORM_MIN_FILL_MS. Constant-time compare.
```

### 6.8 Services and public endpoints

Admin mutations are server actions in the usual pattern. Reads are tRPC routers registered in the app router.

**Forms** (`forms.ts`):
- `listForms`, `getForm`, `createForm`, `updateForm`, `deleteForm`, `setFormActive`, `listSubmissions(formId, limit 100)`.
- `creates = "deal"` needs a pipeline and a stage in that pipeline.
- `redirect_url` must be `https:`.
- `owner_id` must be an active user.

**Submit** (`submit.ts`, route `POST /api/public/forms/{publicId}/submit`):
1. Check the rate limit, then require a body of at most 64 KB that is JSON or form-encoded: `{ values, website?, token }`.
2. Look up the form. If it is not available → 404 `E_FORM_001`.
3. If the honeypot is non-empty, or the token is `too_fast` or `invalid` → 200 `{ ok: true, message }` and nothing is written.
4. Run `validateSubmission`. On failure → 422 `E_FORM_003` with the field errors.
5. In one transaction, as the form owner:
   - Find the person by email or create them (name, email, phone, job title).
   - Find the organization by `lower(name)` or create it, and link it when the person has none.
   - Create the lead (title "{name} via {form name}", web-form origin, owner = form owner), or the deal (title "{organization or name} via {form name}", the chosen pipeline and stage, owner = form owner).
   - Write custom field values.
   - Add the message as a note on the lead or deal.
   - Insert the submission and increment `submission_count`.
   - `emitDomainEvent` `form.submitted`, with the entity = the lead or deal, and changes `[{ field: "form", old: null, new: formId }]`.
6. After commit, notify the owner (`form_submission`).
7. Respond `{ ok: true, message, redirectUrl }`. The page redirects when a URL is set.

The page also accepts a classic HTML form post (`application/x-www-form-urlencoded`) and answers with a 303 to `/f/{publicId}?done=1`, so the form works without JavaScript.

**Booking pages** (`bookingPages.ts`):
- `listMyPages`, `listAllPages` (admins), `getPage`, `createPage`, `updatePage`, `deletePage`, `setPageActive`.
- Defaults: 30 minutes, buffer 0, notice 4 h, 30 days ahead, the default availability, the host's time zone, and the first activity type named like "meeting" (else the first type).

**Slots** (route `GET /api/public/booking/{publicId}/slots?from=YYYY-MM-DD&to=YYYY-MM-DD`):
- Check the rate limit.
- `to - from` must be at most 14 days.
- Load busy time for the window, padded by the buffer.
- Respond `{ timezone, durationMinutes, slots }`.

**Book** (`booking.ts`, route `POST /api/public/booking/{publicId}/book`, body `{ start, name 1..100, email, note? <= 1000, website? }`):
1. Check the rate limit. A non-empty honeypot → 200 `{ ok: true }`, nothing written.
2. Open a transaction and take `pg_advisory_xact_lock(hashtext('booking:' || host_id))`.
3. Recompute the slots for that day. If `start` is not among them → 409 `E_BOOKING_002`.
4. As the host:
   - Find or create the person.
   - Create the activity: type = the page's; subject "{page title} with {name}"; `due_at` = start; `end_at` = start + duration; `duration_minutes`; note = visitor note plus location; assignee and owner = host; linked to the person.
   - Insert the booking with the cancel-token hash.
   - `emitDomainEvent` `booking.created`, with the entity = the activity.
5. After commit:
   - Notify the host (`booking_created`).
   - Email the visitor through `getSystemMailer()`. Subject "Booked: {page title} with {host name}". Text: the time in the page time zone, the location, and the cancel link `{BASE_URL}/book/cancel/{token}`. Attach `invite.ics` when supported.
   - A mail failure is logged and does not undo the booking.
6. Respond `{ ok: true, start, end, hostName, timezone }`.

**Cancel** (`cancel.ts`):
- The page `/book/cancel/{token}` shows the booking and a "Cancel booking" button, which posts to `POST /api/public/booking/cancel` `{ token }`.
- Find the booking by token hash with status `booked` (else `E_BOOKING_005`).
- In one transaction: delete the activity through the activities delete service, set `cancelled`, and `emitDomainEvent` `booking.cancelled` (entity = the booking's person, else the activity id).
- After commit, notify the host (`booking_cancelled`).

**`ics.ts`:** `buildIcs({ uid, start, end, summary, description, location, organizerName, organizerEmail })` returns an RFC 5545 VCALENDAR with one VEVENT.
- UTC times, CRLF line endings, 75-octet line folding, and escaped commas, semicolons and newlines.
- Unit-tested against a fixed expected string.

**Notifications:** add kinds `form_submission` ("New submission on {form name}"), `booking_created` ("{name} booked {page title} on {date}") and `booking_cancelled` ("{name} cancelled {page title}") with migration `0086`. Email defaults: on for bookings, off for form submissions.

**Events:**
- Append `form.submitted`, `booking.created` and `booking.cancelled` to `DOMAIN_EVENT_TYPES`.
- Add the three to the automation trigger union (no filters, except `form.submitted` with an optional `formId`) and to the webhook event list.
- `conditionTarget` for them is the person: from the lead or deal's person for forms, and from the booking's person for bookings.
- `snapshot.ts` adds:
  - `form.submitted`: `{ form: { id, name }, values, lead|deal { id, title }, person { id, name, email } }`.
  - booking events: `{ booking: { id, start, end, status, pageTitle, visitorName, visitorEmail }, host { id, name } }`.
- Update the trigger picker, webhook dialog groups and docs.

**Framing:** for `/f/*` and `/book/*` only, send `Content-Security-Policy: frame-ancestors *` and no `X-Frame-Options`. Every other route keeps its current headers.

### 6.9 UI

All screens use shadcn wrappers only.

**Settings → Forms** (`/settings/forms`, admins; nav item after Webhooks):
- Table: name, creates, owner, submissions, active `Switch`, and a row menu (Edit, Copy link, Delete).
- "New form" opens the editor.

**Form editor** (`/settings/forms/{id}`):
- Name, title, description.
- "Creates" `Select` (Lead or Deal; Deal shows pipeline and stage `Select`s).
- Owner `Select`, success message, redirect URL.
- `FieldList`: ordered fields, up and down buttons, an "Add field" `Select` (fixed keys plus eligible custom fields), label, placeholder, a required `Switch`, and remove. Name and email can be neither removed nor made optional.
- A live preview of the public form.
- `EmbedCode` with copy buttons for the link and `<iframe src="{BASE_URL}/f/{publicId}" width="100%" height="640" style="border:0" title="{title}"></iframe>`.
- A "Submissions" tab (`SubmissionsTable`, last 100, with links to the created records).

**Public form** (`/f/{publicId}`):
- White, centered `max-w-[560px]`.
- Title and description, fields with labels and required marks, and the hidden honeypot (`name="website"`, visually hidden, `tabindex="-1"`, `autocomplete="off"`).
- A hidden token, and a submit button.
- Inline field errors. The success message replaces the form.
- Works without JavaScript through the 303 path.
- `PoweredBy` footer.

**Settings → Booking pages** (`/settings/booking`, every user; admins see all with a host column):
- Table with title, duration, active, link, and a row menu.

**Booking editor** (`/settings/booking/{id}`):
- Title, description.
- Duration, buffer, notice and days ahead as `Select`s or number inputs.
- Time zone `Select` (searchable `Command` over `Intl` zones), activity type `Select`, location.
- `AvailabilityEditor`: seven rows, each with a `Switch` and up to three from/to time `Select`s (15-minute steps).
- A "Public link" copy button.

**Public booking** (`/book/{publicId}`):
- Host name, title, duration, location and description.
- A 14-day date strip with previous and next buttons, shown in the visitor's time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`, label shown).
- Slot buttons for the chosen day.
- After a slot is picked: name, email, an optional note, and "Confirm booking".
- `BookingConfirmed`: "You're booked for {weekday, d MMM, HH:mm} ({time zone})" with "Add to calendar" (downloads the same `.ics` from a data URL) and a note that a confirmation email is on its way.
- A 409 shows the copy and reloads the slots.
- `PoweredBy` footer.

**Cancel page:** booking summary, a "Cancel booking" button, and a cancelled state.

### 6.10 Demo seed

- One active form "Contact us", creating leads, owned by the first admin, with name, email, organization and message fields, plus two seeded submissions.
- One active booking page "Intro call" (30 minutes, default availability, `Europe/London`) for the first admin, plus one future booking that has its activity.

## 7. Conventions

Same as Parts 1 to 5 (CLAUDE.md is the authority).
- Public handlers trust only the public id, the token and the validated body.
- Records are created through existing services inside one transaction, and events are emitted inside it.
- Tests for the time-zone helpers, slots, field validation, the spam token, ICS, submit, book, cancel and the double-booking lock are written first.

## 8. Phases and tasks

### Phase 0: Start, schema and pure core

#### Task 0.1 - Start Part 6: progress files, kit and baseline

**Goal:** A Part 6 PROGRESS.md and a green baseline.

**Files:** create `PROGRESS.md`; rename `PROGRESS.md` → `PROGRESS-P5.md`; possibly root symlink `PLAN-PART6.md`, `scripts/check-progress.mjs`

**Steps:**
1. Check section 4's table; log each result as a Decision.
2. `git mv PROGRESS.md PROGRESS-P5.md`, then create PROGRESS.md in the section 0 format with every task unchecked.
   - Record the Phase 0 base commit.
   - Copy `PROGRESS-P5.md` → Environment.
   - Carry over still-open owner actions.
3. If the kit is in a subfolder, add the root symlink plus the byte-identical checker copy.
4. Baseline: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`. Log `- Baseline: ...`.
5. Commit `0.1: Start Part 6: progress files, kit and baseline`, tick.

**Verify:** `pnpm check:progress` → OK

**Done when:** PROGRESS.md lists all tasks and the baseline line exists.

#### Task 0.2 - Forms and booking schema and migrations

**Goal:** The tables of 6.4 and the notification kinds.

**Files:** create `src/db/schema/forms.ts`, `drizzle/0085_dealflow_forms_booking.sql`, `drizzle/0086_dealflow_forms_booking_notifications.sql` (+ meta); modify `src/db/schema/index.ts`, `src/constants/notificationTypes.ts`, the notification defaults and their tests (update the enum count and the defaults; never weaken an assertion)

**Steps:**
1. Write the schema exactly as 6.4 and generate `--name dealflow_forms_booking`.
2. Generate the `ALTER TYPE` migration with `--custom --name dealflow_forms_booking_notifications`.
3. Apply both to the dev database.
4. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** both migrations are applied and typecheck passes.

#### Task 0.3 - Pure core: time zones, slots, fields, spam token, ICS (test-first)

**Goal:** `zonedTime.ts`, `slots.ts`, `fields.ts`, `spamToken.ts`, `ics.ts`.

**Files:** create those files and their `.test.ts` files; create `src/constants/formsBooking.ts`

**Steps:**
1. Write the tests first and see them fail. Cover:
   - **Time zones:** `zonedToUtc("2026-03-29","01:30","Europe/London")` (the gap) resolves forward; `zonedToUtc("2026-10-25","01:30","Europe/London")` takes the first occurrence; `America/New_York` and `Asia/Kolkata` round trips.
   - **Slots:**
     - a Monday 09:00 to 10:00 range with 30-minute slots gives 2 starts;
     - a busy 09:15 to 09:45 interval removes both when the buffer is 0;
     - an exact-boundary busy 10:00 interval keeps the 09:30 slot (half-open);
     - notice and days-ahead cut-offs;
     - a week spanning the London DST change keeps 09:00 local on both sides;
     - a range wider than 14 days is clamped or refused (choose and log).
   - **Fields:** a missing required field, a bad email, a 2001-character value, an invalid single-option value; the definition schema rejects duplicate keys and an optional email.
   - **Spam token:** too fast, tampered, expired, ok.
   - **ICS:** an exact expected string, including folding and escaping.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run src/features/scheduling src/features/forms` → passes

**Done when:** all cases pass.

#### Task 0.4 - Phase 0 QA gate

**Goal:** Prove the schema and the pure core.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 1 base commit, commit `0.4: Phase 0 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes

**QA focus:** Definition of done items 1 and 2; DST cases are real tests, not skipped.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: Forms backend

#### Task 1.1 - Forms service and the capability

**Goal:** `forms.ts`, `forms.manage`, error IDs, the reads.

**Files:** create `src/features/forms/{forms.ts,actions.ts,router.ts}`; modify the error registry and its test allow-list, the permission registry, the app router

**Steps:**
1. Add the error IDs from 6.2 and declare the capability like `automations.manage`.
2. Implement the services, actions and reads with the 6.8 rules.
3. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** typecheck passes and the reads are registered.

#### Task 1.2 - Public submit and events (test-first)

**Goal:** `submit.ts`, the submit route, the `/f/{publicId}` page (minimal markup for now), the framing headers, and the three event types.

**Files:** create `src/features/forms/{submit.ts,forms.integration.test.ts}`, `src/app/api/public/forms/[publicId]/submit/route.ts`, `src/app/f/[publicId]/page.tsx`; modify `src/features/events/types.ts`, `src/features/automations/definition.ts` (+ its test), `src/features/events/snapshot.ts`, the webhook event list, the security headers file

**Steps:**
1. Write the cases first (real Postgres):
   - a submission creates person, organization, lead and note, writes the submission, bumps the count, emits `form.submitted` and creates a `form_submission` notification;
   - a second submission with the same email in a different case reuses the person;
   - creates = deal puts the deal in the chosen stage;
   - honeypot and too-fast submissions write nothing and return ok;
   - an invalid email gives 422 with field errors;
   - an inactive form gives 404;
   - the 11th submission in a minute gives 429;
   - an automation with trigger `form.submitted` gets a run.
2. Implement until green.
3. Add the framing headers.
4. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/forms src/features/events` → passes

**Done when:** every case passes.

#### Task 1.3 - Phase 1 QA gate

**Goal:** Prove the forms backend.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 2 base commit, commit `1.3: Phase 1 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/forms src/features/events src/features/automations src/features/leads` → passes

**QA focus:** Definition of done items 3, 4 and 8 (forms side); the public handler writes nothing on spam paths.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: Scheduler backend

#### Task 2.1 - Booking pages service and busy time

**Goal:** `bookingPages.ts`, `busy.ts`, the reads and actions.

**Files:** create `src/features/scheduling/{bookingPages.ts,busy.ts,actions.ts,router.ts}`; modify the app router

**Steps:**
1. Implement the services with the defaults in 6.8, and owner-or-admin checks.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** typecheck passes and the reads are registered.

#### Task 2.2 - Slots, booking and cancel (test-first)

**Goal:** `booking.ts`, `cancel.ts`, the three public routes, and the public and cancel pages (minimal markup for now).

**Files:** create `src/features/scheduling/{booking.ts,cancel.ts,scheduling.integration.test.ts}`, the routes and pages in section 5

**Steps:**
1. Write the cases first:
   - the slots route excludes an existing timed activity of the host but not an all-day one;
   - booking creates the activity with the right `due_at`/`end_at`, links or creates the person, writes the booking, emits `booking.created`, creates a `booking_created` notification, and sends one visitor email with the cancel link (captured with the system mailer fake);
   - ten concurrent bookings of the same slot (warm the pool first) give exactly one success and nine `E_BOOKING_002`;
   - a slot inside the notice window is refused;
   - cancelling removes the activity, sets `cancelled`, emits `booking.cancelled`, and a second cancel gives `E_BOOKING_005`;
   - an inactive page gives 404;
   - the 11th booking request in a minute gives 429.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/scheduling` → passes

**Done when:** every case passes.

#### Task 2.3 - Phase 2 QA gate

**Goal:** Prove the scheduler backend.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 3 base commit, commit `2.3: Phase 2 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/scheduling src/features/activities src/features/events` → passes

**QA focus:** Definition of done items 5 to 7; the advisory lock and the re-check sit in the same transaction as the insert.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: Screens

#### Task 3.1 - Forms admin screens

**Goal:** `/settings/forms` and the editor (6.9).

**Files:** create `FormsList.tsx`, `FormEditor.tsx`, `FieldList.tsx`, `EmbedCode.tsx`, `SubmissionsTable.tsx`, the two route pages; modify the settings navigation

**Steps:**
1. Build per 6.9 with the hooks. Every client action passes the CSRF token (`readCsrfToken()`), as Part 5's fix did.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** both pages render and save.

#### Task 3.2 - Public form page

**Goal:** The finished `/f/{publicId}` (6.9).

**Files:** create `src/features/forms/ui/PublicForm.tsx`, `src/features/public/PoweredBy.tsx`; modify `src/app/f/[publicId]/page.tsx`

**Steps:**
1. Server-render the form with a fresh token, a progressive-enhancement submit, the no-JavaScript 303 path and the success state.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the page renders and submits.

#### Task 3.3 - Booking admin screens

**Goal:** `/settings/booking` and the editor (6.9).

**Files:** create `BookingPagesList.tsx`, `BookingPageEditor.tsx`, `AvailabilityEditor.tsx`, the two route pages; modify the settings navigation

**Steps:**
1. Build per 6.9 with the hooks and CSRF tokens.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** both pages render and save.

#### Task 3.4 - Public booking and cancel pages

**Goal:** The finished `/book/{publicId}` and `/book/cancel/{token}`.

**Files:** create `PublicBooking.tsx`, `BookingConfirmed.tsx`; modify both pages

**Steps:**
1. Build the date strip, slots, form, confirmation with the `.ics` download, the 409 handling and the cancel flow.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** both pages render and complete their flows.

#### Task 3.5 - Triggers in the editors, demo seed and docs

**Goal:** The new events in the automation and webhook screens, plus 6.10 and the docs.

**Files:** modify `TriggerPicker.tsx`, `WebhookDialog.tsx`, the demo seed; create `docs/dealflow/FORMS.md`, `docs/dealflow/SCHEDULING.md`; modify `docs/dealflow/AUTOMATIONS.md`, `WEBHOOKS.md`, `UPSTREAM.md`, `README.md`

**Steps:**
1. Add the three triggers (form picker for `form.submitted`) and the webhook event group "Forms and booking".
2. Write the seed per 6.10.
3. Docs:
   - FORMS.md: fields, spam protection, embedding, no-JavaScript support, records created, events.
   - SCHEDULING.md: availability, the slot rules, busy time, time zones and DST, booking, cancel, `.ics`, events.
   - Update the event lists in AUTOMATIONS.md and WEBHOOKS.md.
   - UPSTREAM.md: every upstream file changed.
   - README: a short section.
4. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the triggers appear, the docs exist and the seed compiles.

#### Task 3.6 - Phase 3 QA gate

**Goal:** Prove the screens build.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 4 base commit, commit `3.6: Phase 3 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/forms src/features/scheduling src/features/automations src/features/webhooks` → passes

**QA focus:** Definition of done items 3, 5, 8 and 9; shadcn-only UI; every client action sends the CSRF token.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Hardening and hand-off

#### Task 4.1 - E2E forms and booking spec and screenshots

**Goal:** `e2e/10-forms-booking.spec.ts` and the 7 screenshots.

**Files:** create `e2e/10-forms-booking.spec.ts`; modify `e2e/helpers.ts` only if a helper is missing

**Steps:**
1. Forms, as the admin (saved session):
   - Open Settings → Forms (`p6-forms-list`).
   - Create a form "Website enquiry" that creates leads and add a phone field (`p6-form-editor`).
   - Open its public link in a new browser context with no session (`p6-public-form`). Wait 2.5 s (the fill-time rule), submit name "Riley Chen", email `riley.chen@example.com`, organization "Chen Studio" and a message, and expect the success message.
   - Back in the app, expect a lead "Riley Chen via Website enquiry" and a notification.
2. Booking:
   - Create a booking page "Discovery call" with Mon to Sun 09:00 to 17:00 in `UTC`, notice 0 and 30 minutes (`p6-booking-editor`, then `p6-booking-pages`).
   - Open its public link in a fresh context (`p6-public-booking`), pick the first slot, and book as "Sam Ortiz", `sam.ortiz@example.com`.
   - Expect the confirmation (`p6-booking-confirmed`) and an activity "Discovery call with Sam Ortiz" for the admin.
   - Read the cancel link from the captured system mail (`MAIL_FAKE` folder; add a helper if missing), open it, cancel, and expect the cancelled state and the activity gone.
3. Run the full `pnpm e2e` (specs `00` to `10`); fix until green.
4. Commit, tick.

**Verify:** `pnpm e2e` → passes; `ls e2e/screenshots/p6-*.png | wc -l` → `7`

**Done when:** e2e is green and 7 screenshots exist.

#### Task 4.2 - Integration suite and smoke

**Goal:** The once-per-part full runs.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run `pnpm test:integration` (full). Fix failures caused by this part; pre-existing ones get `PRE-EXISTING:` Open issues.
2. Run `DOCKER_BUILDKIT=0 pnpm smoke` → SMOKE PASS, with no `dealflow-smoke` container or volume left.
3. Log both results as Decisions, commit, tick.

**Verify:** `pnpm test:integration` passes and `DOCKER_BUILDKIT=0 pnpm smoke` prints SMOKE PASS (or SKIPPED with the reason from section 10)

**Done when:** both ran and are logged.

#### Task 4.3 - Independent review and hardening

**Goal:** One fresh-context review of Part 6, then fix what it finds.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is the full `.dsh/qa.md`, a blank line, then `Final review of PLAN-PART6.md. Base commit {Phase 0 base}.` Wait for `QA RESULT: PASS` or the numbered list.
   - Fallbacks: `qa.sh` with the same request, then an evidenced self-review (log `qa unavailable (qa.sh failed) - self-review`).
2. Fix every blocker and major and commit `4.3: QA fixes round {r}`. Re-run the gate commands of Task 3.6 and review again. At most 3 rounds.
   - Minors: fix when cheap, else Open issues.
3. Log `- Independent review: subagent (fresh context) round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n}`.
4. Commit `4.3: Independent review and hardening`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`.

**Done when:** the review ran (or the logged fallback), and blockers and majors are fixed or logged with reasons.

#### Task 4.4 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order. Write one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `4.4: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least 16.

**Done when:** every checklist item has a line.

#### Task 4.5 - Final report and completion

**Goal:** Hand the owner a short, truthful report and finish.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report, short (the owner reads it on a phone). Do not repeat the Decisions list. Include:
   - Definition of done: items 1 to 10, one line each.
   - Checklist: from 4.4.
   - Owner actions: numbered, with exact commands, including the dev stack rebuild for migrations 0085 and 0086, setting a time zone in your profile, and creating your booking page.
   - Decisions worth reviewing: only `CONTRACT CHANGE:` lines and changed tests.
   - Open issues.
   - Notes for Part 7: new routes and screenshots, the event types, and the upstream files changed.
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `4.5: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`.

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- Rescheduling links, round-robin or collective team booking, group events.
- Calendar sync (Google Calendar, CalDAV) and video-meeting link generation.
- Paid bookings and booking questions beyond name, email and note.
- Multi-step or conditional forms, file uploads in forms, CAPTCHA services.
- Form analytics beyond the submission count; A/B tests.
- Reminder emails before a booking (an automation can be used later).

## 10. ASK and STOP triggers

This plan has no ASK triggers; the only STOP case is the fatal one in section 4.

| Situation | Safe default | Owner action to log |
|---|---|---|
| Subagent tool unavailable | `qa.sh`, then the evidenced self-review | "Run the review yourself in a new harness session with `.dsh/qa.md` and the request from Task 4.3" |
| Docker not running or out of disk | skip integration, e2e and smoke (SKIPPED) | "Start Docker Desktop / free Docker disk, then run `pnpm test:integration`, `pnpm e2e`, `DOCKER_BUILDKIT=0 pnpm smoke`" |
| A pre-existing upstream test fails | leave it, log `PRE-EXISTING:` | "Review the pre-existing failures in PROGRESS.md" |
| The system mailer cannot attach files | details in the email body; "Add to calendar" on the confirmation page still downloads the `.ics` | none |
| The security headers are set in a place that cannot vary by path | add a path-scoped header rule in `next.config.*` and log it | none |
| The owner has no time zone in their profile | booking pages use the page's time zone (`UTC` until set) | "Set your time zone in your profile before sharing a booking page" |
| Google env in `.env` still partial | keep the Environment prefixes | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty.
2. `pnpm install --frozen-lockfile` exits 0 and `package.json` gained no dependency.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes (count ≥ the baseline).
6. `pnpm test:integration` passes (Task 4.2).
7. `pnpm build` exits 0 and lists `/f/[publicId]`, `/book/[publicId]`, `/book/cancel/[token]`, `/settings/forms`, `/settings/booking`.
8. `pnpm e2e` passes, specs `00` to `10`.
9. 7 `e2e/screenshots/p6-*.png` exist, and the Part 1 to 5 screenshots are still present.
10. Smoke printed SMOKE PASS and left no `dealflow-smoke` container or volume.
11. `drizzle/0085_dealflow_forms_booking.sql` creates exactly the 4 tables of 6.4.
12. `git grep -nE "x-forwarded-for" -- src/features/forms src/features/scheduling src/app/f src/app/book src/app/api/public` prints nothing (they use `clientIp`).
13. `git grep -n "dangerouslySetInnerHTML" -- src/features/forms src/features/scheduling src/app/f src/app/book` prints nothing.
14. A request for `/settings` in the built app still sends its previous framing headers, and `/f/{publicId}` sends `frame-ancestors *` (check with `curl -sI` against the e2e server, or with the e2e spec's response headers).
15. No em dash in any file added or changed in this part (`git diff --name-only {Phase 0 base} | xargs perl -CSD -ne 'print "$ARGV\n" if /\x{2014}/' | sort -u` prints nothing, kit files excepted).
16. `docs/dealflow/FORMS.md` and `docs/dealflow/SCHEDULING.md` exist; `UPSTREAM.md` lists this part's upstream files.
17. `pnpm check:progress --final` passes.

## 12. Report back

No mid-run reporting. The run ends with the final report (Task 4.5). The owner pastes PROGRESS.md → Final report back to the planner (the Decisions list is not needed).

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

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md to PLAN-PART6.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

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
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; money is computed on integer minor units with no floats, converted totals never add unconverted amounts or drop deals silently (excluded deals are listed), the forecast reuses the deals visibility filter; document public routes take only the publicId and a validated body, never render HTML, issued documents are immutable; domain events are written inside the mutation's transaction, automation actions go through existing services and respect the loop guard, webhook delivery checks every resolved address inside the DNS lookup with no redirects, webhook secrets are encrypted and never returned after creation; public form and booking handlers write nothing on spam paths, bookings re-check the slot under a per-host lock in the same transaction, and only `/f/*` and `/book/*` may be framed; no em dashes in new files.
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
# Usage: ./qa.sh "Final review of PLAN-PART6.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
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

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART6.md";
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
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART[1-6]\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
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
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART6.md (dealflow-wd-p6-v1) is finished.
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
PROMPT='Read PLAN-PART6.md in this folder in full and PROGRESS.md, then follow PLAN-PART6.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p6-v1; earlier parts are finished) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p6-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p6-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
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
- Otherwise you are the builder: read `PLAN-PART6.md` in full (Parts 1 to 5 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART6.md rule 18.
```
