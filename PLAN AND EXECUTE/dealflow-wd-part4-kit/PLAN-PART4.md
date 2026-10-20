# PLAN: Dealflow on warpdrive, Part 4: Quotes and invoicing

> Plan ID: dealflow-wd-p4-v1 · Written: 2026-10-20 · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 4, fast verification profile, no human in the loop · Type: change to existing project

Parts 1 to 3 are finished (`PROGRESS-P1.md`, `PROGRESS-P2.md`, and `PROGRESS.md` until Task 0.1 renames it to `PROGRESS-P3.md`). Part 3 left 5,004 unit tests, 1,857 integration tests and e2e specs `00` to `07`, all passing, plus products, deal lines, currencies (`src/features/currency/money.ts`, `totals.ts`) and the forecast. Part 4 adds quotes and invoices. This plan is compact: where it says "find" or "reuse", locate the existing code, reuse it, and log the file you used as a Decision.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 4** in fresh-context sessions, one phase per session. Parts 1 to 3 (`PLAN-PART1.md` to `PLAN-PART4.md`) are finished; their code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART4.md` in full and PROGRESS.md (open earlier `PLAN-PART{N}.md` files only where this plan points to them). If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p4-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 3's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 4.5, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 4.2.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.4, 1.6, 2.3, 3.6):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). The one independent review is Task 4.3.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (documents snapshot deal lines; numbering and statuses), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs only. This part needs no external service; e2e uses the fake mail transport.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove or recreate the owner's running Compose project `warpdrive-main`, never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack 3001/5433/8080/9000/9001 (owner's). Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `PLAN-PART4.md`, `PLAN-PART4.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 3's file to `PROGRESS-P3.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p4-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 4: progress files, kit and baseline
(every task through 4.5, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 4990/4990 · documents 30/30

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

Add quotes and invoices built from a deal's product lines: admin-managed templates in a small markdown-lite format, gap-free numbering, a public page per document (quote accept and decline, invoice view), print-to-PDF through the browser, sending through the user's own mailbox (Part 2), hand-recorded payments, and a daily overdue job.

## 2. Definition of done

1. Migration `0081_dealflow_documents` adds the tables in 6.4 and nothing else.
2. Markdown-lite parsing and the document state machine are pure, unit-tested functions; documents never render user HTML.
3. Settings → Documents edits prefixes, default validity and due days, company details, payment instructions and footer, and manages quote and invoice templates (admins only); a default template of each kind exists on first use.
4. From a deal, a user creates a quote or invoice draft whose lines and totals are a snapshot of the deal's product lines (or one line from the deal value), in the deal's currency, using `money.ts`.
5. Issuing assigns `{prefix}-{YYYY}-{NNNN}` from an atomic counter (no duplicates under concurrency, no number consumed by a draft); issued documents cannot be edited; issued invoices cannot be deleted, only voided.
6. Sending emails the customer a link to `/d/{publicId}` through the sender's connected mailbox, linked to the deal; without a mailbox the user can copy the link and mark the document sent.
7. The public page shows the document without sign-in; a quote can be accepted (typed name, checkbox) or declined once, not after expiry; the first view is recorded; the owner is notified of view, accept and decline; drafts, voided documents and quotes of deleted deals return 404.
8. Payments are recorded by hand; an invoice becomes `paid` when payments reach the total and returns to `sent`/`overdue` when a payment is deleted; overpayment is refused; the daily job marks unpaid invoices past their due date `overdue`.
9. `/documents` lists quotes and invoices with status filters and the outstanding total in the base currency; a print preview and the public page print cleanly on A4.
10. typecheck, lint, build, unit and the full integration suite pass; e2e specs `00` to `08` pass; the 7 `p4-*` screenshots exist; smoke passes; one independent review ran.

## 3. Decisions already made

- Stack unchanged; no new dependency. PDF = browser print of the public page or the internal preview (`window.print()`); no server PDF engine.
- One `documents` table with `kind` (`quote` | `invoice`) and shared line, payment and template tables; the UI says "Quote" or "Invoice".
- Lines are a snapshot copied at creation and on "Refresh from deal" (drafts only); later deal edits do not change issued documents.
- Money uses `src/features/currency/money.ts` (`lineNet`, `lineTax`, `dealTotals`, `formatMoney`); totals are stored as `numeric(14,2)` strings.
- Numbers are assigned at issue, not at creation. Year = the issue date's year (UTC). Default prefixes `Q` and `INV`.
- Template variables render when the draft is created, except `document.*` keys, which render at display time (number, totals and dates can change until issue). Unknown variables render as empty text.
- Customer fields (name, email, address) are copied onto the document from the deal's person and organization at creation and are editable while draft.
- Sending reuses the existing compose/send path (the one the composer uses; Part 2 provider layer), so the message lands on the deal timeline. No attachment; the email carries the public link.
- The public page is the PDF source for customers; the internal preview `/documents/{id}/print` is the same component.
- Deals are soft-deleted in warpdrive: `documents.deal_id` is `not null` with `on delete restrict`; a quote of a soft-deleted deal returns 404 publicly, an issued invoice stays visible.
- Permissions: templates and document settings need a new `documents.manage` capability (admin only, declared like Part 3's `products.manage`); creating, editing, issuing, sending, voiding documents and recording payments need edit rights on the deal; reading follows deal visibility.
- Not in this part: deal timeline entries for document events (notifications only), automations and webhooks (Part 5 adds the triggers), credit notes, recurring invoices, online payment, accounting sync.

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | PROGRESS.md says `dealflow-wd-p3-v1` and `STATUS: COMPLETE`; HEAD is `e214c9a` or later | log a Decision describing what you found; continue |
| Kit location | `PLAN-PART4.md` and the kit at the repo root, or in `PLAN AND EXECUTE/dealflow-wd-part4-kit/` | root symlink `PLAN-PART4.md` plus the byte-identical checker copy, as in Part 3; log a Decision |
| Next migration number | the last file in `drizzle/` is `0080_dealflow_sales.sql` | use the next free number and log it |
| Public routes | the auth proxy/middleware has an allowlist (the `/t/click` tracking route is public) | add `/d/` and `/api/public/` the same way the tracking route is exempted; log the file |
| Scheduled jobs | pg-boss schedules exist (see `src/features/release/job.ts`) | register the overdue job the same way |
| Notifications | the notifications feature has a typed list of notification kinds | add the three kinds there; log the file |
| pnpm 9, Docker, subagent | as in Part 3 | as in Part 3 (`PLAN-PART3.md` section 4) |

**Known environment:** copy `PROGRESS-P3.md` → Environment (after Task 0.1 renames it) into PROGRESS.md → Environment and follow it; it holds the tool paths, test locale, the Google variable prefixes for commands that load `.env`, the host database URL, the e2e browser path and the smoke flag. Note: the owner's live dev database has base currency GBP; tests, the demo seed and e2e use their own databases with USD.

**Fatal (STOP with `STATUS: BLOCKED`):** pnpm cannot be installed, or `pnpm install --frozen-lockfile` fails for a registry reason.

## 5. Target structure

```
src/db/schema/documents.ts                     # 6.4 (exported from src/db/schema/index.ts)
drizzle/0081_dealflow_documents.sql
src/features/documents/
  markdownLite.ts, markdownLite.test.ts        # 6.5, pure
  transitions.ts, transitions.test.ts          # 6.6, pure
  numbering.ts, numbering.test.ts              # format pure; counter in service
  variables.ts                                 # 6.5 variable rendering
  settings.ts, templates.ts                    # services
  documents.ts, lines.ts, issue.ts, payments.ts, send.ts, overdueJob.ts
  publicDocuments.ts, publicRateLimit.ts
  actions.ts, router.ts
  documents.integration.test.ts, public.integration.test.ts
  ui/ DocumentsSettings.tsx, TemplateDialog.tsx, DealDocumentsSection.tsx, DocumentEditor.tsx,
      DocumentView.tsx, MarkdownLite.tsx, PaymentDialog.tsx, SendDialog.tsx, DocumentsList.tsx,
      PublicActions.tsx
src/app/d/[publicId]/page.tsx                  # public, outside the app layout
src/app/api/public/documents/[publicId]/{accept,decline}/route.ts
src/app/(app)/documents/page.tsx, src/app/(app)/documents/[id]/page.tsx, src/app/(app)/documents/[id]/print/page.tsx
src/app/(app)/settings/documents/page.tsx
e2e/08-documents.spec.ts
docs/dealflow/DOCUMENTS.md
```

Use the route group and settings layout Part 3 used for `/forecast` and `/settings/products`.

## 6. Contracts

### 6.1 Scripts and env

No new scripts. No new env keys: public links use the existing app base URL from `src/config/env.ts` (the one magic links use).

### 6.2 Error IDs (append; add the `DOC` domain if the registry keeps a list)

| ID | Cause | User copy |
|---|---|---|
| `E_DOC_001` | document not found or not visible | "That document no longer exists." |
| `E_DOC_002` | edit of an issued document | "Issued documents can't be edited. Duplicate it to make changes." |
| `E_DOC_003` | transition not allowed from the current status | "This action isn't available for a {status} document." |
| `E_DOC_004` | accept or decline after `valid_until` | "This quote has expired." |
| `E_DOC_005` | send with no customer email | "Add an email address for the customer first." |
| `E_DOC_006` | send without a connected mailbox | "Connect your mailbox in Settings → Email sync, or copy the link and mark it sent." |
| `E_DOC_007` | payment above the outstanding amount | "That payment is more than the amount still due." |
| `E_DOC_008` | delete of an issued invoice | "Issued invoices can't be deleted. Void it instead." |
| `E_DOC_009` | template not found | "That template no longer exists." |
| `E_DOC_010` | public request rate-limited | "Too many requests. Try again in a minute." |

### 6.3 Test hooks and screenshots

`data-testid`: `documents-settings-form`, `document-template-row`, `deal-documents-section`, `deal-new-quote`, `deal-new-invoice`, `document-row` (with `data-document-id`, `data-status`), `document-editor`, `document-status` (text = status), `document-number`, `document-issue`, `document-send`, `document-copy-link`, `document-mark-sent`, `document-record-payment`, `document-void`, `document-create-invoice`, `document-total`, `document-outstanding`, `public-document`, `public-accept-name`, `public-accept-checkbox`, `public-accept`, `public-decline`, `public-status`, `documents-list`, `documents-outstanding-total`.

Screenshots: `p4-settings-documents`, `p4-deal-documents`, `p4-document-editor`, `p4-public-quote`, `p4-public-quote-accepted`, `p4-invoice-paid`, `p4-documents-list`.

### 6.4 Schema (`src/db/schema/documents.ts`)

Id and FK column types match the referenced tables (uuid with `defaultRandom()`); timestamps `timestamptz`.

```ts
document_settings: id boolean primary key default true (check id), quote_prefix text not null default 'Q',
  invoice_prefix text not null default 'INV', quote_valid_days integer not null default 30,
  invoice_due_days integer not null default 14, company_name text null, company_address text null,
  company_tax_id text null, payment_instructions text null, footer text null, updated_at
  checks: prefixes match ^[A-Z0-9]{1,8}$, days between 1 and 365
document_templates: id, kind text not null (check in ('quote','invoice')), name text not null,
  body text not null (check length <= 20000), terms text null (check length <= 5000),
  include_products boolean not null default true, is_default boolean not null default false,
  created_by -> users.id on delete set null, created_at, updated_at
  partial unique index document_templates_default_uq on (kind) where is_default
document_counters: kind text, year integer, last_number integer not null, primary key (kind, year)
documents: id, kind text not null (check), deal_id -> deals.id on delete restrict not null,
  template_id -> document_templates.id on delete set null, source_quote_id -> documents.id on delete set null,
  public_id text not null unique, number text null unique, title text not null (check length 1..150),
  body text not null, currency char(3) not null, subtotal numeric(14,2) not null, tax numeric(14,2) not null,
  total numeric(14,2) not null, status text not null default 'draft'
    (check in ('draft','sent','viewed','accepted','declined','overdue','paid','void')),
  customer_name text null, customer_email text null, customer_address text null,
  issue_date date null, valid_until date null, due_date date null,
  sent_at, viewed_at, accepted_at, declined_at, paid_at, voided_at (all timestamptz null),
  accepted_name text null, accepted_ip text null, decline_reason text null (check length <= 500),
  created_by -> users.id on delete set null, created_at, updated_at
  indexes: (deal_id), (kind, status), (due_date) where kind = 'invoice'
document_lines: id, document_id -> documents.id on delete cascade, position integer not null, name text not null,
  unit text null, quantity numeric(12,3) not null, item_price numeric(14,2) not null,
  discount_percent numeric(5,2) not null, tax_percent numeric(5,2) not null,
  net numeric(14,2) not null, tax numeric(14,2) not null, gross numeric(14,2) not null
  index (document_id, position)
document_payments: id, document_id -> documents.id on delete cascade, amount numeric(14,2) not null (check > 0),
  paid_on date not null, method text not null (check in ('bank_transfer','card','cash','other')),
  reference text null, recorded_by -> users.id on delete set null, created_at
```

`public_id` = `crypto.randomBytes(18).toString("base64url")` (24 characters).

### 6.5 Markdown-lite and variables (pure)

```ts
// markdownLite.ts
export type MdBlock =
  | { type: "h1" | "h2" | "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "products" }
  | { type: "hr" };
export function parseMarkdownLite(src: string): MdBlock[];
// Lines: "# " → h1, "## " → h2, consecutive "- " lines → ul, "---" → hr, a line exactly "{{products}}" → products,
// blank lines end a paragraph, other consecutive lines join with a space into one p. CRLF is accepted.
export function inlineSegments(text: string): { text: string; bold: boolean }[]; // only **bold**; unmatched ** stays literal
```

`MarkdownLite.tsx` renders blocks with React elements only (never `dangerouslySetInnerHTML`); the `products` block renders the lines table.

```ts
// variables.ts
export type VarContext = Record<string, string>; // flat keys like "person.first_name"
export function renderVariables(src: string, ctx: VarContext, opts: { keepPrefix?: string }): string;
// replaces {{ key }} (spaces allowed) with ctx[key] ?? "", leaves {{products}} intact,
// and leaves keys starting with opts.keepPrefix (used with "document.") untouched for display-time rendering.
```

Keys: `deal.title`, `deal.value`, `person.name`, `person.first_name`, `organization.name`, `owner.name`, `owner.email`, `company.name`, `document.title`, `document.number`, `document.total`, `document.valid_until`, `document.due_date`, `document.issue_date`. Values are plain text; money via `formatMoney`, dates as `Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" })`.

Default templates (inserted with `is_default = true` when `listTemplates` finds none of a kind):

```
Quote: "Standard quote"
# Quote {{document.number}} for {{organization.name}}
Prepared for {{person.name}} by {{owner.name}}, {{company.name}}.
## Summary
{{deal.title}}
{{products}}
terms: "This quote is valid until {{document.valid_until}}."

Invoice: "Standard invoice"
# Invoice {{document.number}}
Billed to {{person.name}}, {{organization.name}}.
{{products}}
terms: "Payment is due by {{document.due_date}}."
```

The body snapshot is the template body, plus `\n\n## Terms\n{terms}` when terms exist; the invoice view also prints `payment_instructions` and the `footer` from settings below the body.

### 6.6 State machine (`transitions.ts`, pure)

```ts
export type DocKind = "quote" | "invoice";
export type DocStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "overdue" | "paid" | "void";
export type DocEvent = "issue" | "markSent" | "view" | "accept" | "decline" | "overdue" | "pay" | "unpay" | "void";
export function nextStatus(kind: DocKind, from: DocStatus, ev: DocEvent): DocStatus | null; // null = not allowed (E_DOC_003)
```

Allowed (anything else returns null):
- quote: draft + issue → sent; draft + markSent → sent; sent + view → viewed; viewed + view → viewed; sent|viewed + accept → accepted; sent|viewed + decline → declined; draft + void → null (drafts are deleted instead).
- invoice: draft + issue → sent; draft + markSent → sent; sent|overdue + view → same status (only `viewed_at` is set); sent + overdue → overdue; sent|overdue + pay → paid; paid + unpay → `sent` (the service then applies `overdue` if past due); sent|overdue + void → void.
- `issue` and `markSent` both assign the number if missing; "Send" on a draft = issue + email; "Send again" on an issued document emails again without a transition.
- Expiry is derived, not a status: a quote is expired when `valid_until < today (UTC)` and it is sent or viewed.

`numbering.ts`: `formatDocNumber(prefix: string, year: number, n: number): string` → `INV-2026-0007` (at least 4 digits, more when needed: `INV-2026-12345`).

### 6.7 Services and actions

Mutations are server actions in the existing pattern (`guardCsrf` → `createContext` → `can()` → Zod → service → `ActionResult`); reads are tRPC procedures in `router.ts`, registered in the app router.

- `settings.ts`: `getDocumentSettings()` (insert the default row when missing), `updateDocumentSettings(input)`.
- `templates.ts`: `listTemplates(kind)`, `createTemplate`, `updateTemplate`, `deleteTemplate` (refuse deleting the last template of a kind), `setDefaultTemplate(id)` (one transaction).
- `documents.ts`: `createDocument({ dealId, kind, templateId?, title?, sourceQuoteId? })`: deal must be visible and editable; title default "Quote for {deal title}" / "Invoice for {deal title}"; lines from `lines.snapshotFromDeal` (deal product lines; with none and `include_products`, one line: name = deal title, quantity 1, price = deal value or 0, tax 0); from an accepted quote (`sourceQuoteId`), copy the quote's lines instead; currency = deal currency (Part 3 `deal_terms`, else base); `valid_until` = today + `quote_valid_days` for quotes; customer fields from the deal's person (name, primary email) and organization (name, address if warpdrive stores one). `updateDraft` (title, body, dates, customer fields; draft only → else `E_DOC_002`), `refreshLines` (draft only), `duplicateDocument` (new draft, title + " (copy)", lines copied), `deleteDraft` (drafts only; issued invoice → `E_DOC_008`; issued quote → `E_DOC_003`), `getDocument(id)` → `DocumentView` (all fields, lines, payments, `outstanding`, `expired`, `publicUrl`).
- `issue.ts`: `issueDocument(id, { via: "issue" | "markSent" })` in one transaction: lock the row (`SELECT ... FOR UPDATE`), check `nextStatus`, take the number with `INSERT INTO document_counters (kind, year, last_number) VALUES ($1, $2, 1) ON CONFLICT (kind, year) DO UPDATE SET last_number = document_counters.last_number + 1 RETURNING last_number`, set `number`, `issue_date` (today UTC), `due_date` = issue + `invoice_due_days` for invoices, `status = 'sent'`, `sent_at = now()`. `voidInvoice(id)`.
- `send.ts`: `sendDocument({ id, to?, subject?, message? })`: recipient default = `customer_email` (none → `E_DOC_005`); the actor's mailbox must be connected (else `E_DOC_006`); issue first when draft (same transaction rules, committed before the send); then send through the existing compose send path, linked to the deal and person, subject default "{Quote|Invoice} {number} from {company name or owner name}", body text: `{message or "Hi {first name}, here is your {quote|invoice}."}\n\nView it here: {publicUrl}\n\n{owner name}`. A send failure after issue leaves the document issued and returns the mail error.
- `payments.ts`: `recordPayment({ documentId, amount, paidOn, method, reference? })` (invoice in sent/overdue; amount ≤ outstanding else `E_DOC_007`; reaching the total → `paid`, `paid_at` = now), `deletePayment(id)` (paid → `unpay`, then `overdue` if `due_date < today`). Money with `parseCents`/`formatCents`.
- `overdueJob.ts`: pg-boss schedule `documents.overdue`, cron `0 6 * * *` UTC, registered like the release job: `UPDATE documents SET status='overdue', updated_at=now() WHERE kind='invoice' AND status='sent' AND due_date < current_date` (`current_date` in UTC: set it in SQL with `(now() at time zone 'utc')::date`). Export the function so tests call it directly.
- `publicDocuments.ts`: `getPublicDocument(publicId, { ip })`: 404 (`E_DOC_001`) for draft, void, or a quote whose deal is soft-deleted; on the first view of a sent quote set `viewed` + `viewed_at`, on an invoice set `viewed_at` only; notify the owner (`document_viewed`) on that first view. `acceptQuote(publicId, { name 1..100, agree: true, ip })`, `declineQuote(publicId, { reason? ≤ 500 })`: state via `nextStatus`, expiry → `E_DOC_004`, a second accept or decline → `E_DOC_003`; notify (`document_accepted`, `document_declined`). Store `accepted_ip` from the first `x-forwarded-for` entry, else the socket address.
- Public routes: the page `src/app/d/[publicId]/page.tsx` (server component, no session required, outside the app layout) and the two POST route handlers. Route handlers check the request origin with the existing origin check (Part 1 `originCheck.ts`), parse JSON bodies up to 16 KB with Zod, and are rate-limited by `publicRateLimit.ts`: in-memory fixed window, 30 requests per minute per IP and per publicId → 429 with `E_DOC_010`. Add `/d/` and `/api/public/` to the auth allowlist.
- Notifications: kinds `document_viewed` ("{customer} viewed {title}"), `document_accepted` ("{name} accepted {title}"), `document_declined` ("{title} was declined"), sent to the document's creator (fallback: the deal owner), linking to `/documents/{id}`.

### 6.8 UI

shadcn wrappers only; add a missing standard wrapper first if its Radix dependency is installed. Money via `formatMoney`.

- Settings → Documents (`/settings/documents`, admins): form (prefixes, quote valid days, invoice due days, company name, address, tax id, payment instructions, footer) and a templates table per kind (name, default badge, edit, set default, delete) with `TemplateDialog` (name, body `Textarea` with a variables help list, terms, include products `Switch`, live preview with `MarkdownLite`).
- Deal page: a "Documents" section registered like Part 3's Products section: rows (kind, number or "Draft", title, total, status `Badge`, date) linking to `/documents/{id}`; buttons "New quote" and "New invoice" (template `Select` in a small `Dialog` when more than one template exists).
- Document page `/documents/{id}`: header with kind, number, status badge, total and outstanding; actions per status (Issue, Send/Send again via `SendDialog` with to/subject/message, Copy link, Mark as sent, Duplicate, Create invoice from an accepted quote, Record payment via `PaymentDialog`, Void with `AlertDialog`, Delete draft with `AlertDialog`, Print preview link). Draft: editable title, dates, customer fields, body `Textarea`, "Refresh from deal". Below: `DocumentView` (same component as the public page) and, for invoices, the payments table with delete.
- `DocumentView`: company name, title, number, dates, customer block, body via `MarkdownLite` with the lines table (Item, Qty, Price, Discount, Tax, Amount; then Subtotal, Tax, **Total**), payment instructions and footer for invoices. Max width 860px, centered.
- Public page `/d/{publicId}`: white page with `DocumentView`; for a quote in sent/viewed and not expired, `PublicActions`: "Type your full name to accept" input, `Checkbox` "I accept this quote", "Accept quote" button, and a "Decline" link opening an optional reason `Textarea`; accepted: green panel "Accepted by {name} on {date}"; declined: "This quote was declined"; expired: "This quote has expired. Contact {owner name}." Invoice: status line ("Due {date}", "Paid on {date}", "Overdue since {date}"). A "Download PDF" button calls `window.print()`. Elements with `data-print-hide` hide in print.
- Print CSS in `src/app/globals.css` under `@media print`: `@page { size: A4; margin: 18mm }`, hide `[data-print-hide]` and the app chrome, black text on white, table borders `1px solid` using the existing border token. `/documents/{id}/print` renders `DocumentView` alone.
- `/documents` (main navigation item "Documents" after "Forecast"): `Tabs` Quotes | Invoices, status filter `Select`, table (number, title, deal, customer, total, status, issue date, due or valid date), and for invoices "Outstanding {amount}" in the base currency via Part 3 `summarize` over outstanding amounts (excluded currencies listed like the board).

### 6.9 Demo seed

Extend the demo seed: document settings with company "Northwind Advisory" and payment instructions "Bank transfer to Example Bank, account 00000000"; the two default templates; on seeded deals with lines: one draft quote, one sent quote, one accepted quote with an invoice created from it, one sent invoice due in the future, one overdue invoice, and one paid invoice with two payments. Numbers come from the counter (issue through the service or the same SQL) so the counters match.

## 7. Conventions

Same as Parts 1 to 3 (CLAUDE.md is the authority). Money stays in `money.ts`; no floats. Public route code never trusts the client for prices, status or ids beyond `publicId`. Tests for markdown-lite, transitions, numbering, totals, public rules, payments and the overdue job are written first.

## 8. Phases and tasks

### Phase 0: Start, schema and pure core

Kick off Part 4, add the tables and the pure functions.

#### Task 0.1 - Start Part 4: progress files, kit and baseline

**Goal:** A Part 4 PROGRESS.md and a green baseline.

**Files:** create `PROGRESS.md`; rename `PROGRESS.md` → `PROGRESS-P3.md`; possibly root symlink `PLAN-PART4.md`, `scripts/check-progress.mjs`

**Steps:**
1. Check section 4's table and log each result as a Decision.
2. `git mv PROGRESS.md PROGRESS-P3.md`; create PROGRESS.md in the section 0 format with every task of section 8 unchecked; record the Phase 0 base commit; copy `PROGRESS-P3.md` → Environment; carry over still-open owner actions as `TODO(owner):` lines.
3. Kit in a subfolder: root symlink plus the byte-identical checker copy. Add `dealflow-wd-part4-kit.zip` to `.git/info/exclude` if it is in the tree.
4. Baseline: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`. Log `- Baseline: typecheck {r} · lint {r} · build {r} · unit {p}/{t}`. No integration run here.
5. Commit `0.1: Start Part 4: progress files, kit and baseline`, tick.

**Verify:** `pnpm check:progress` → OK

**Done when:** PROGRESS.md lists all tasks and the baseline line exists.

#### Task 0.2 - Documents schema and migration

**Goal:** The tables of 6.4.

**Files:** create `src/db/schema/documents.ts`, `drizzle/0081_dealflow_documents.sql` (+ meta); modify `src/db/schema/index.ts`

**Steps:**
1. Write the schema exactly as 6.4; export it.
2. `pnpm drizzle-kit generate --name dealflow_documents` (with the Environment prefixes); check the SQL creates only these tables, indexes and checks; apply with `pnpm db:migrate:dev` (host database URL).
3. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the migration is applied to the dev database and typecheck passes.

#### Task 0.3 - Markdown-lite, variables, transitions, numbering (test-first)

**Goal:** 6.5's pure functions, 6.6 and `formatDocNumber`.

**Files:** create `src/features/documents/{markdownLite.ts,markdownLite.test.ts,variables.ts,transitions.ts,transitions.test.ts,numbering.ts,numbering.test.ts}` (variables tests go in `markdownLite.test.ts`)

**Steps:**
1. Write the tests first and see them fail. Cover: every block type, CRLF, paragraph joining, `{{products}}` only on its own line, `**bold**` and an unmatched `**`; `renderVariables` with spaces in braces, unknown keys → empty, `document.*` kept with `keepPrefix`, `{{products}}` kept; a table test of every allowed transition in 6.6 plus at least six refused ones (accept a draft, pay a quote, void a paid invoice, decline twice, issue a sent document, view a draft); `formatDocNumber("INV", 2026, 7)` → `INV-2026-0007` and `12345` → `INV-2026-12345`.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run src/features/documents` → passes

**Done when:** all three test files pass with the cases above.

#### Task 0.4 - Phase 0 QA gate

**Goal:** Prove the schema and pure core.

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

**QA focus:** Definition of done items 1 and 2.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: Document services

#### Task 1.1 - Settings, templates and the capability

**Goal:** `settings.ts`, `templates.ts`, `documents.manage`, error IDs.

**Files:** create `src/features/documents/{settings.ts,templates.ts,actions.ts,router.ts}`; modify the error registry, permission registry, app router

**Steps:**
1. Error IDs (6.2); capability declared like `products.manage`.
2. Services, actions, reads (`documents.settings`, `documents.templates`); default templates on first list.
3. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** typecheck passes and the reads are registered.

#### Task 1.2 - Create, edit, refresh, duplicate, delete (test-first)

**Goal:** `documents.ts` and `lines.ts`.

**Files:** create `src/features/documents/{documents.ts,lines.ts,documents.integration.test.ts}`; modify `actions.ts`, `router.ts`

**Steps:**
1. Write `documents.integration.test.ts` first (real Postgres via `@/test/db`): a quote from a deal with two lines snapshots them with totals equal to Part 3's `dealTotals`; a deal without lines gives one line from the value; a EUR deal gives a EUR document; variables render (person, organization, company) while `{{document.number}}` stays; editing an issued document → `E_DOC_002`; refresh copies changed deal lines on a draft; duplicate copies lines; a user who cannot see the deal gets `E_DOC_001`.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/documents` → passes

**Done when:** the listed cases pass.

#### Task 1.3 - Issue, numbering and void

**Goal:** `issue.ts`.

**Files:** create `src/features/documents/issue.ts`; modify `actions.ts`, `documents.integration.test.ts`

**Steps:**
1. Add cases first: ten concurrent issues of ten drafts give ten distinct consecutive numbers (warm the pool first, as Part 2's R1 test did); invoice `due_date` = issue + 14; deleting a draft consumes no number; an issued invoice delete → `E_DOC_008`; void keeps the number.
2. Implement until green.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/documents` → passes

**Done when:** the new cases pass.

#### Task 1.4 - Payments and the overdue job

**Goal:** `payments.ts`, `overdueJob.ts`.

**Files:** create `src/features/documents/{payments.ts,overdueJob.ts}`; modify `actions.ts`, the job registry, `documents.integration.test.ts`

**Steps:**
1. Add cases first: two payments reaching the total → `paid`; overpayment → `E_DOC_007`; deleting a payment of a past-due paid invoice → `overdue`; the job marks only sent invoices past due (not paid, not quotes, not future ones).
2. Implement, register the schedule like the release job.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/documents` → passes

**Done when:** the new cases pass.

#### Task 1.5 - Sending through the mailbox

**Goal:** `send.ts`.

**Files:** create `src/features/documents/send.ts`; modify `actions.ts`, `documents.integration.test.ts`

**Steps:**
1. Find the compose send path the composer uses and log it.
2. Add cases first, using the Part 2 fake transport (`MAIL_PROVIDER_FAKE_DIR` fixtures, as the mail integration tests do): sending a draft issues it and delivers one message whose text contains the public URL, linked to the deal; no customer email → `E_DOC_005`; no connected mailbox → `E_DOC_006` and the document stays draft.
3. Implement until green.
4. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/documents` → passes

**Done when:** the new cases pass.

#### Task 1.6 - Phase 1 QA gate

**Goal:** Prove the document services.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 2 base commit, commit `1.6: Phase 1 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm exec vitest run --project integration src/features/documents src/features/products src/features/mail` → passes

**QA focus:** Definition of done items 3 to 6 and 8; issue is one transaction with a row lock.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: Public page and notifications

#### Task 2.1 - Public reads, accept and decline (test-first)

**Goal:** `publicDocuments.ts`, `publicRateLimit.ts`, the public page and route handlers.

**Files:** create `src/features/documents/{publicDocuments.ts,publicRateLimit.ts,public.integration.test.ts}`, `src/app/d/[publicId]/page.tsx`, `src/app/api/public/documents/[publicId]/accept/route.ts`, `.../decline/route.ts`; modify the auth allowlist

**Steps:**
1. Write `public.integration.test.ts` first against the service functions: draft and void → not found; first view sets `viewed` once (second view keeps `viewed_at`); accept stores name, time and IP; a second accept or a decline after accept → `E_DOC_003`; accept after `valid_until` → `E_DOC_004`; a quote of a soft-deleted deal → not found while an issued invoice of a soft-deleted deal is still returned; the 31st request in a minute → `E_DOC_010`.
2. Implement services, the page (minimal markup for now; Task 3.2 finishes the UI), the route handlers (origin check, 16 KB limit, Zod) and the allowlist entries.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/documents` → passes

**Done when:** the listed cases pass and `/d/{publicId}` is reachable without a session.

#### Task 2.2 - Owner notifications

**Goal:** The three notification kinds.

**Files:** modify the notifications kinds list and renderers; `src/features/documents/publicDocuments.ts`; `public.integration.test.ts`

**Steps:**
1. Add the kinds and titles (6.7), send them from view, accept and decline after the transaction commits.
2. Add one case: accepting creates exactly one `document_accepted` notification for the creator.
3. Commit, tick.

**Verify:** `pnpm exec vitest run --project integration src/features/documents src/features/notifications` → passes

**Done when:** the case passes.

#### Task 2.3 - Phase 2 QA gate

**Goal:** Prove the public surface.

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
- `pnpm exec vitest run --project integration src/features/documents src/features/notifications src/features/auth` → passes

**QA focus:** Definition of done item 7; public handlers accept only `publicId` plus the validated body; no session data leaks to the public page.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: Screens

#### Task 3.1 - Settings → Documents

**Goal:** The settings page and template dialog (6.8).

**Files:** create `src/features/documents/ui/{DocumentsSettings.tsx,TemplateDialog.tsx,MarkdownLite.tsx}`, the settings route page; modify the settings navigation

**Steps:**
1. Build the form, templates table and dialog with live preview; hooks from 6.3.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the page renders under the settings layout.

#### Task 3.2 - Deal section, document page, view and public actions

**Goal:** `DealDocumentsSection`, `DocumentEditor`, `DocumentView`, `SendDialog`, `PaymentDialog`, `PublicActions`.

**Files:** create those components and `src/app/(app)/documents/[id]/page.tsx`; modify the deal section registry and `src/app/d/[publicId]/page.tsx`

**Steps:**
1. Build per 6.8, with actions shown only when `nextStatus` allows them.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** a deal shows the section and a document page renders.

#### Task 3.3 - Documents list and navigation

**Goal:** `/documents` (6.8).

**Files:** create `src/features/documents/ui/DocumentsList.tsx`, `src/app/(app)/documents/page.tsx`; modify the main navigation, `router.ts` (list read with filters and the outstanding summary)

**Steps:**
1. List read (visible deals only, reusing the deals visibility filter as Part 3's forecast did), outstanding via `summarize`, the page.
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the page renders with both tabs.

#### Task 3.4 - Print stylesheet and preview

**Goal:** A4 print of the public page and `/documents/{id}/print`.

**Files:** modify `src/app/globals.css`; create `src/app/(app)/documents/[id]/print/page.tsx`

**Steps:**
1. Print rules per 6.8; the preview page renders `DocumentView` alone with a print button (`data-print-hide`).
2. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the preview route builds.

#### Task 3.5 - Demo seed and docs

**Goal:** 6.9 and `docs/dealflow/DOCUMENTS.md`.

**Files:** modify the demo seed; create `docs/dealflow/DOCUMENTS.md`; modify `docs/dealflow/UPSTREAM.md`, `README.md`

**Steps:**
1. Extend the seed per 6.9.
2. DOCUMENTS.md: model, numbering, statuses and transitions, template format and variables, public page and rate limit, payments, overdue job, printing. UPSTREAM.md: every upstream file changed in this part. README: a short "Quotes and invoices" section.
3. Commit, tick.

**Verify:** `pnpm typecheck` → exits 0

**Done when:** the docs exist and the seed compiles.

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
- `pnpm exec vitest run --project integration src/features/documents` → passes

**QA focus:** Definition of done item 9; shadcn-only UI; no `dangerouslySetInnerHTML` in the documents feature.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Hardening and hand-off

#### Task 4.1 - E2E documents spec and screenshots

**Goal:** `e2e/08-documents.spec.ts` and the 7 screenshots.

**Files:** create `e2e/08-documents.spec.ts`; modify `e2e/helpers.ts` only if a helper is missing

**Steps:**
1. As the admin (saved session): open Settings → Documents, set company name "Northwind Advisory" (`p4-settings-documents`); open a seeded deal with product lines, create a quote (`p4-deal-documents`), open it (`p4-document-editor`), make sure the customer has an email (the seeded person or type one into the draft), and send it. If the e2e user has no connected mailbox in this stack, connect the fake IMAP mailbox as `06-mail` does, or use "Mark as sent" and log which path ran. Read the public URL from the page's copy-link value, open it in a new browser context with no session (`p4-public-quote`), accept as "Jamie Rivera" (`p4-public-quote-accepted`); back in the app expect status `accepted` and a notification; create an invoice from the quote, mark it sent, record a payment for the full total, expect `paid` (`p4-invoice-paid`); open `/documents` (`p4-documents-list`).
2. Run the full suite `pnpm e2e` (specs `00` to `08`); fix until green.
3. Commit, tick.

**Verify:** `pnpm e2e` → passes; `ls e2e/screenshots/p4-*.png | wc -l` → `7`

**Done when:** e2e is green and 7 screenshots exist.

#### Task 4.2 - Integration suite and smoke

**Goal:** The once-per-part full runs.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. `pnpm test:integration` (full); fix failures caused by this part; pre-existing ones get `PRE-EXISTING:` Open issues.
2. `DOCKER_BUILDKIT=0 pnpm smoke` → SMOKE PASS, and no `dealflow-smoke` container or volume left.
3. Log both results as Decisions, commit, tick.

**Verify:** `pnpm test:integration` passes and `DOCKER_BUILDKIT=0 pnpm smoke` prints SMOKE PASS (or SKIPPED with the reason from section 10)

**Done when:** both ran and are logged.

#### Task 4.3 - Independent review and hardening

**Goal:** One fresh-context review of Part 4, then fix what it finds.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is the full `.dsh/qa.md`, a blank line, then `Final review of PLAN-PART4.md. Base commit {Phase 0 base}.` Wait for `QA RESULT: PASS` or the numbered list. Fallbacks: `qa.sh` with the same request, then an evidenced self-review (log `qa unavailable (qa.sh failed) - self-review`).
2. Fix every blocker and major; commit `4.3: QA fixes round {r}`; re-run the gate commands of Task 3.6; review again. At most 3 rounds. Minors: fix when cheap, else Open issues.
3. Log `- Independent review: subagent (fresh context) round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n}`.
4. Commit `4.3: Independent review and hardening`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`.

**Done when:** the review ran (or the logged fallback), and blockers and majors are fixed or logged with reasons.

#### Task 4.4 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order; one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `4.4: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least 15.

**Done when:** every checklist item has a line.

#### Task 4.5 - Final report and completion

**Goal:** Hand the owner a short, truthful report and finish.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report, short (the owner reads it on a phone): Definition of done (items 1 to 10, one line each); Checklist (from 4.4); Owner actions (numbered, exact commands, including the dev stack rebuild for migration 0081 and filling in Settings → Documents); Decisions worth reviewing (only `CONTRACT CHANGE:` lines and changed tests); Open issues; Notes for Part 5 (new routes and screenshot names, the document status events Part 5's automations and webhooks will hook into, upstream files changed). Do not repeat the Decisions list.
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `4.5: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`.

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- Server-side PDF generation or PDF attachments.
- Online payment, Stripe, payment links, accounting sync.
- Credit notes, partial invoicing of a quote, recurring invoices, deposits.
- Deal timeline entries, automations, webhooks or AI tools for documents (Part 5 adds triggers and webhook events).
- E-signatures beyond the typed name and checkbox.
- Multiple tax rates per line or tax-inclusive pricing.

## 10. ASK and STOP triggers

This plan has no ASK triggers; the only STOP case is the fatal one in section 4.

| Situation | Safe default | Owner action to log |
|---|---|---|
| Subagent tool unavailable | `qa.sh`, then the evidenced self-review | "Run the review yourself in a new harness session with `.dsh/qa.md` and the request from Task 4.3" |
| Docker not running or out of disk | skip integration, e2e and smoke (SKIPPED) | "Start Docker Desktop / free Docker disk, then run `pnpm test:integration`, `pnpm e2e`, `DOCKER_BUILDKIT=0 pnpm smoke`" |
| A pre-existing upstream test fails | leave it, log `PRE-EXISTING:` | "Review the pre-existing failures in PROGRESS.md" |
| The compose send path cannot be called from a service | call the same lower-level function the composer action calls, keeping deal linking | none |
| Company details empty in the owner's install | documents show the owner's name instead | "Fill in Settings → Documents (company name, address, payment instructions)" |
| Google env in `.env` still partial | keep the Environment prefixes | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty.
2. `pnpm install --frozen-lockfile` exits 0 and `package.json` gained no dependency.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes (count ≥ the baseline).
6. `pnpm test:integration` passes (Task 4.2).
7. `pnpm build` exits 0.
8. `pnpm e2e` passes, specs `00` to `08`.
9. 7 `e2e/screenshots/p4-*.png` exist and the Part 1 to 3 screenshots are still present.
10. Smoke printed SMOKE PASS and left no `dealflow-smoke` container or volume.
11. `drizzle/0081_dealflow_documents.sql` exists and creates exactly the 6 tables of 6.4.
12. `git grep -n "dangerouslySetInnerHTML" -- src/features/documents src/app/d` prints nothing.
13. `git grep -nE "parseFloat|Number\\(" -- src/features/documents` shows no money parsed as a float (explain any hit).
14. `git grep -c "E_DOC_0" src/constants/errorIds.ts` counts at least 10.
15. No em dash in any file added or changed in this part (`git diff --name-only {Phase 0 base} | xargs perl -CSD -ne 'print "$ARGV\n" if /\x{2014}/' | sort -u` prints nothing, kit files excepted).
16. `docs/dealflow/DOCUMENTS.md` exists; `docs/dealflow/UPSTREAM.md` lists this part's upstream files.
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

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md to PLAN-PART4.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

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
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; money is computed on integer minor units with no floats, converted totals never add unconverted amounts or drop deals silently (excluded deals are listed), the forecast reuses the deals visibility filter; document public routes take only the publicId and a validated body, never render HTML, and issued documents are immutable; no em dashes in new files.
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
# Usage: ./qa.sh "Final review of PLAN-PART4.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
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

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART4.md";
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
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART[1234]\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
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
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART4.md (dealflow-wd-p4-v1) is finished.
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
PROMPT='Read PLAN-PART4.md in this folder in full and PROGRESS.md, then follow PLAN-PART4.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p4-v1; earlier parts are finished) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p4-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p4-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
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
- Otherwise you are the builder: read `PLAN-PART4.md` in full (Parts 1 to 3 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART4.md rule 18.
```
