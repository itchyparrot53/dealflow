# PLAN: Dealflow on warpdrive, Part 13: Branded, editable email for everything Dealflow sends

> Plan ID: dealflow-wd-p13-v1 · Written: 2026-10-23 (owner request) · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 4, fast verification profile, no human in the loop · Type: change to existing project

Parts 1 to 12 are finished (`PROGRESS-P1.md` to `PROGRESS-P11.md`, and `PROGRESS.md` until Task 0.1 renames it to `PROGRESS-P12.md`); four `frontend-2026:` commits followed Part 12. Part 13 puts every outbound email (product emails to the team and customer emails from your company) through one branded, email-safe HTML renderer, makes every template's copy editable in Settings › Email design, and wraps what people send in the company layout. It adds no new email, trigger or recipient. Where it says "find", locate the existing code and change it; log a file as a Decision only when it is surprising.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 4** in fresh-context sessions, one phase per session. Parts 1 to 12 (`PLAN-PART1.md` to `PLAN-PART12.md`) are finished; their code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART13.md` in full and PROGRESS.md (open earlier `PLAN-PART{N}.md` files only where this plan points to them). If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p13-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 12's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 4.6, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 4.3.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.3, 1.5, 2.4, 3.4):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). The one independent review is Task 4.4.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (system email wording moved into the template registry, the branded layout around sent mail, the document send dialog's message becoming rich text), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs only. This part needs no external service; e2e uses the fake mail transport and the fake AI provider.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove, recreate or call the owner's live Compose project `dealflow-prod` (127.0.0.1:3001, 8080 and 9000) and never read `.env.production`. Never stop, remove or recreate the owner's Compose project `warpdrive-main` (only `up -d` of its postgres, minio and createbuckets with the section 4 ports is allowed), never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack Postgres 5433 and MinIO 9100/9101 (section 4); 3001, 8080 and 9000 belong to `dealflow-prod`: never bind or call them. Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `PLAN-PART3.md`, `PLAN-PART4.md`, `PLAN-PART5.md`, `PLAN-PART6.md`, `PLAN-PART7.md`, `PLAN-PART8.md`, `PLAN-PART9.md`, `PLAN-PART10.md`, `PLAN-PART11.md`, `PLAN-PART12.md`, `PLAN-PART13.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 12's file to `PROGRESS-P12.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p13-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 13: progress files, kit, baseline and environment
(every task through 4.6, titles exactly as in section 8)

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
(written in Task 4.5)
```

## 1. Goal

Every email Dealflow sends goes out in one professional, brand-consistent HTML layout, and its words are editable in the app. Today:

- the seven system senders each build their own fragment of HTML;
- emails people send (composer, replies, scheduled sends, automations) go out as the bare editor HTML;
- quotes and invoices are a plain-text message turned into paragraphs with a link.

After this part there is one renderer with two families:

- **Product emails**, from Dealflow to the team (sign-in link, invite, notifications, backup failure, webhook disabled). Dealflow brand.
- **Customer emails**, from your company to people outside it (composer, replies, scheduled sends, automations, quotes, invoices, booking confirmations and cancellations). Your company's brand: the logo, accent colour, name, address and footer set in **Settings › Email design**.

Admins edit the subject, preview line, body and button label of every product and customer template in **Settings › Email design › Templates**. Each template has a live preview, "Send test to me" and "Reset to default". When someone writes an email, they write the content and Dealflow wraps it in the branded layout, with a preview before sending.

## 2. Definition of done

1. `src/features/email-design/` renders every outbound email through `renderEmail` (6.2). It produces table-based, inline-styled HTML (600 px, Outlook-safe), a plain-text part, a hidden preview line, and no script, external CSS or web font.
2. The 6.3 data model and migration exist:
   - Email design settings (logo, accent colour, display name, address and footer, layout choices);
   - template overrides;
   - a public, cache-safe logo route.
3. All seven system senders go through `sendSystemEmail(key, ...)` with the 6.4 registry, and no file outside `src/features/email-design/` builds email HTML by hand.
4. Customer emails are wrapped. The cases are:
   - new emails use the branded layout;
   - replies use the minimal layout;
   - a per-message "Plain" option sends as today;
   - scheduled sends are wrapped exactly once;
   - quotes and invoices get a summary card and a "View quote" or "View invoice" button;
   - automations and booking emails use the company layout.
5. **Settings › Email design** (admin only) has Branding and Templates tabs, with a live preview, "Send test to me" and "Reset to default". The composer has a Preview.
6. Security (6.8): every variable is escaped, subjects carry no CR or LF, the template body goes through the existing author sanitiser, the logo accepts PNG or JPEG only (at most 256 KB), and the link URLs in buttons are structural (not editable).
7. `e2e/17-email.spec.ts` passes. `pnpm email:gallery` writes 26 previews (13 emails × 600 and 375 px). Specs `00` to `16` still pass.
8. typecheck, lint, build, unit and the full integration suite pass, smoke passes, and one independent review ran. `docs/dealflow/EMAIL.md` and the user guide's Admin page describe the system.

## 3. Decisions already made

- **Two families, one renderer.** Product emails carry the Dealflow logo (the brand rollout's `public/brand/email-logo@2x.png`). Customer emails carry the company's identity, with no Dealflow mark unless the admin turns on "Show Powered by Dealflow" (default off). If no company logo is uploaded, the header shows the company display name as text.
- **Light-only emails.** The layout declares `color-scheme: light` and uses only light colours. That is the most reliable choice across Gmail, Outlook and Apple Mail, and what leading SaaS products send. There is no dark-mode media query.
- **No new runtime dependency.** Hand-written table HTML with inline styles. Reuse the installed `sanitize-html` and `isomorphic-dompurify` through the existing `sanitizeAuthorHtml`, the existing HTML-to-text helper (`src/features/email/plainTextBody` or the function its tests cover; log which), and the existing TipTap editor used by Settings › Email templates.
- **Buttons are structural.** A template edits its button label, never its URL. The URL comes from code (the sign-in link, invite link, notification target, document public link, booking cancel link), so an admin can never break or redirect a link.
- **Replies look personal.** The minimal layout has no logo, card or grey background: the body in the email font, then the signature, and the company footer only if "Footer on replies" is on (default off).
- **What is not wrapped:**
  - inbound mail;
  - mail already wrapped (a `data-df-layout` marker prevents double wrapping);
  - "Plain" sends;
  - the `.ics` attachment content.
- **Stored copies.** The Sent copy and the CRM timeline copy are the wrapped HTML that actually went out ("what was sent").
- **No new emails.** This part restyles and makes editable the emails that exist. It adds no reminder or marketing emails, and changes no trigger or recipient.

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | PROGRESS.md says `dealflow-wd-p12-v1` and `STATUS: COMPLETE`, and four later commits start `frontend-2026:` | log a Decision describing what you found; continue |
| The owner's live stack | `dealflow-prod` runs on 127.0.0.1:3001, 8080 and 9000 | nothing to do; never touch it |
| Dev stack ports | as Part 12: `DEV_PG_PORT=5433 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up`, and e2e with `MINIO_PORT=9100 DEV_PG_PORT=5433` | as Part 12 section 4 |
| Senders | `getSystemMailer` is used by `src/app/auth/magic-link/route.ts`, `src/features/identity/actions/invite.ts`, `src/features/scheduling/booking.ts` (and any cancel module), `src/features/webhooks/deliver.ts`, `src/features/backups/backup.ts`, `src/features/notifications/email/job.ts` | add every extra sender found to the 0.2 inventory and the registry |
| Customer-mail path | `src/features/email/send.ts` merges, sanitises, applies tracking and signature (`sendHelpers.ts`), and stores the outbox or Sent copy; `src/features/documents/send.ts` and `src/features/automations/actions/sendEmail.ts` reuse the mailbox send | wrap at the point where the final body is built for the wire, and log where |
| Latest migration | `drizzle/0092_dealflow_push.sql` (or later) | take the next free number, named `00NN_dealflow_email_design.sql` |
| Editor | TipTap (`@tiptap/react`) is the editor behind Settings › Email templates | reuse that component |
| Docker, kit location, pnpm 9, subagent, Playwright browsers | as Part 12 | as Part 12 |

**Known environment:** after Task 0.1 renames it, copy `PROGRESS-P12.md` → Environment into PROGRESS.md → Environment and follow it.

**Fatal (STOP with `STATUS: BLOCKED`):** pnpm cannot be installed; `pnpm install` fails for a registry reason; Docker is down at Task 0.1.

## 5. Target structure

```
src/features/email-design/
  layout.ts              # renderEmail(): the HTML and text layouts (6.2)
  tokens.ts              # colours, fonts, sizes used by the layout (6.2)
  variables.ts           # renderVariables(), escapeHtml(), stripHeaderBreaks() (6.5)
  registry.ts            # system and customer template definitions with default copy (6.4)
  templates.ts           # resolveTemplate(key): override ?? default; saveTemplate; resetTemplate (6.3)
  design.ts              # getEmailDesign(), saveEmailDesign(), logo upload and parse (6.3)
  imageSize.ts           # PNG and JPEG width and height from the header bytes (6.3)
  sendSystemEmail.ts     # the one entry point for product emails (6.4)
  wrapCustomerEmail.ts   # wraps composer, reply, scheduled, automation, booking and document mail (6.6)
  router.ts, actions.ts, schemas.ts
  ui/EmailDesignSettings.tsx, ui/BrandingTab.tsx, ui/TemplatesTab.tsx, ui/TemplateEditor.tsx, ui/EmailPreview.tsx
src/db/schema/emailDesign.ts            # email_design, email_template_overrides (exported from the index)
drizzle/00NN_dealflow_email_design.sql
src/app/email-assets/logo/[file]/route.ts   # public logo (6.3)
src/app/(app)/settings/email-design/page.tsx
scripts/dealflow/email-gallery.mts      # pnpm email:gallery (6.9)
e2e/17-email.spec.ts
docs/dealflow/EMAIL.md
```

## 6. Contracts

### 6.1 Outbound email inventory (Task 0.2 confirms and completes it)

| Key | Family | Sent by | Trigger (unchanged) | Button (structural URL) |
|---|---|---|---|---|
| `sign_in_link` | product | magic-link route | sign-in link request | "Sign in" → the magic link |
| `invite` | product | invite action | admin invites a user | "Set your password" → the invite link |
| `notification` | product | notifications email job | any notification type with email on | "{notification.cta}" → the notification target |
| `backup_failed` | product | backups | a backup fails | "Open backups" → `/settings/backups` |
| `webhook_disabled` | product | webhook delivery | auto-disable | "Open webhooks" → `/settings/webhooks` |
| `booking_confirmed` | customer | scheduling | a guest books | "Cancel booking" → the cancel link |
| `booking_cancelled` | customer | scheduling cancel | a guest cancels | none |
| `quote_sent` | customer | documents send | Send on a quote | "View quote" → the public link |
| `invoice_sent` | customer | documents send | Send on an invoice | "View invoice" → the public link |
| `customer_message` | customer | composer, reply, scheduled send, automation `send_email` | a user or automation sends | none (the content is the user's) |

`notification` is one template. Each type keeps its own subject line and one-line description in code (`notifications/email/render.ts`), passed in as `{{notification.subject}}` and `{{notification.line}}`, so all of them render in one consistent template. If the job sends digests, add a `notification_digest` key with `{{notifications.list}}` (a pre-rendered, escaped list block) and log it.

### 6.2 The layout

**`renderEmail(input): { html: string; text: string }`** in `layout.ts`.

```ts
type EmailFamily = "product" | "customer";
type EmailLayout = "branded" | "minimal";
interface RenderEmailInput {
  family: EmailFamily;
  layout: EmailLayout;               // product emails are always "branded"
  design: EmailDesign;               // 6.3 (product family uses DEALFLOW_DESIGN from tokens.ts)
  preheader?: string;                // plain text, max 140 chars, hidden preview line
  bodyHtml: string;                  // already sanitised and variable-rendered content
  cta?: { label: string; url: string };
  summary?: { rows: { label: string; value: string }[] };   // documents
  footerExtraHtml?: string;          // e.g. the notification settings line (escaped by the caller)
}
```

**Document skeleton:**
- `<!doctype html>`, `<html lang="en">`.
- `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<meta name="color-scheme" content="light">`, `<meta name="supported-color-schemes" content="light">`.
- `<title>` with the subject.
- One small `<style>`, only for the mobile rule `@media (max-width: 620px) { .df-container { width: 100% !important; } .df-pad { padding-left: 20px !important; padding-right: 20px !important; } }`. Everything else is inline.
- Root `body`: `margin:0;padding:0;background:#F4F4F7`.
- The outermost `table` gets `data-df-layout="{family}-{layout}"` (the marker).
- An Outlook conditional `<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->` wrapper and its closing pair.

**Branded layout:**
- Outer: a full-width presentation table, background `#F4F4F7`, padding `32px 12px`.
- Container: `class="df-container"`, width 600, `max-width:600px`, centred, background `#FFFFFF`, `border:1px solid #E3E3E3`, `border-radius:8px`.
- Header cell (`class="df-pad"`): padding `28px 32px 8px`.
  - Product family: the Dealflow logo image `width="160" height="33"`, `alt="Dealflow"`.
  - Customer family with a logo: the logo image at `height="40"` and the width scaled from the stored size (at most 200), `alt="{company display name}"`.
  - Customer family without a logo: the display name in `font-size:18px;font-weight:600;color:#21232C`.
- Body cell (`df-pad`): padding `16px 32px 8px`, `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#21232C`.
  - Paragraph margins `0 0 16px`.
  - Links in the accent colour.
  - Headings `h1` 22/30 600, `h2` 18/26 600. Inline the styles through a small post-pass that adds `style` to `p`, `a`, `h1`, `h2`, `ul`, `ol`, `li`, `img` and `blockquote` when the tag has none.
- Summary (if given): a table, background `#F7F7FB`, `border-radius:6px`, padding 16, margin `8px 0 16px`. Each row is a label (13px `#65686F`) and a value (15px 600 `#21232C`, right-aligned).
- Button (if given): a bulletproof table button.
  - Cell background: accent. Link: `display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px`.
  - Outlook gets a VML `v:roundrect` in an `[if mso]` block.
  - Under the button, in 13px `#65686F`: `If the button doesn't work, copy this link into your browser:` and the URL as a link (word-break all).
- Footer cell (`df-pad`): padding `24px 32px 28px`, `border-top:1px solid #EFEFF2`, 12px/18px `#65686F`.
  - Product family: `Sent by Dealflow for {company display name}.` plus `footerExtraHtml`.
  - Customer family: the display name, the address lines (when "Show address" is on), the footer text (when set), and `Powered by Dealflow` (only when that setting is on).

**Minimal layout (customer replies):**
- No outer grey and no card: a single presentation table, width 100%, max 600, left-aligned.
- The body in the same font and size.
- The footer (only when "Footer on replies" is on) under a 1 px `#EFEFF2` rule, 12px `#65686F`.
- The same marker attribute.

**Colours (`tokens.ts`):**
- Text `#21232C`, muted `#65686F`, border `#E3E3E3`, page `#F4F4F7`, summary `#F7F7FB`.
- Default accent `#2D8548`.
- `DEALFLOW_DESIGN`: accent `#2D8548`, display name from Settings › Company (fallback "Dealflow"), the Dealflow logo.

**Accent rule:** the button text is white, so an accent whose contrast with `#FFFFFF` is below 4.5:1 is rejected by the save action ("Choose a darker colour so button text stays readable") with the measured ratio. Compute it with the WCAG relative-luminance formula, unit tested.

**Plain text:**
- Brand line (Dealflow or the company name), blank line;
- the body converted to text with links as `text (url)`;
- if there is a button: `{label}: {url}`;
- the summary as `Label: value` lines;
- `--`, then the footer lines.

**Size:** the HTML must stay under 90 KB (Gmail clips at about 102 KB). `renderEmail` throws an `AppError` (`E_EMAIL_DESIGN_001`) if a product template exceeds it, and customer mail logs a warning.

**Unit tests (`layout.test.ts`):**
- the marker is present;
- 600 width and the MSO block;
- no `<script`, `<link`, `@import` or `font-face`;
- the preheader is hidden (`display:none;max-height:0;overflow:hidden`) and escaped;
- the button href is exactly the given URL (escaped);
- product mail has the Dealflow logo with alt text;
- customer mail without a logo shows the name;
- the minimal layout has no `#F4F4F7`;
- the plain text contains the URL;
- the size guard.

### 6.3 Data model, design settings and the logo route

Migration `00NN_dealflow_email_design.sql` and `src/db/schema/emailDesign.ts`:

```sql
CREATE TABLE email_design (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  display_name text,                      -- null = Settings › Company name
  accent_color text NOT NULL DEFAULT '#2D8548' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  show_address boolean NOT NULL DEFAULT true,   -- address lines from Settings › Documents company details
  footer_text text,                       -- plain text, max 500 chars, newlines become <br>
  show_powered_by boolean NOT NULL DEFAULT false,
  new_email_layout text NOT NULL DEFAULT 'branded' CHECK (new_email_layout IN ('branded','plain')),
  reply_layout text NOT NULL DEFAULT 'minimal' CHECK (reply_layout IN ('minimal','branded','plain')),
  footer_on_replies boolean NOT NULL DEFAULT false,
  logo_bytes bytea, logo_mime text CHECK (logo_mime IN ('image/png','image/jpeg')),
  logo_hash text, logo_width integer, logo_height integer,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO email_design (id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE email_template_overrides (
  key text PRIMARY KEY,                   -- a registry key (6.4); unknown keys are rejected by the action
  subject text NOT NULL,                  -- max 200
  preheader text,                         -- max 140
  body_html text NOT NULL,                -- sanitised author HTML, max 20000
  cta_label text,                         -- max 40; ignored for keys without a button
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Logo upload** (`design.ts`):
- Accept PNG or JPEG up to 256 KB through the existing server-action file pattern (the profile photo upload).
- Detect the type from magic bytes, not the file name.
- Read the width and height with `imageSize.ts`: PNG from IHDR; JPEG by scanning the SOF0, SOF1 or SOF2 markers. Unit test both and a corrupt file.
- Reject larger than 2000 px on either side.
- Store the bytes, the type, `logo_hash` (SHA-256 hex of the bytes, first 16 chars), and the size.
- "Remove logo" clears the five columns.

**Public route** `GET /email-assets/logo/{hash}.{png|jpg}`:
- Serve the bytes when `{hash}` equals `logo_hash` and the extension matches the type, with `Cache-Control: public, max-age=31536000, immutable` and `Content-Type`. Otherwise 404.
- No session needed. Add the path to the public allow-list the middleware uses for `/d`, `/f` and `/book`. Rate-limit it with the existing public limiter. It never fails a request for the limit, the same rule as the tracking pixel.
- The logo URL used in emails is `new URL('/email-assets/logo/{hash}.{ext}', env.BASE_URL)`.

**Permissions:** reading the design is open to any signed-in user (for the composer preview). Saving the design and templates is admin only (`actor.type === "admin"`), behind CSRF and Zod, returning ActionResult. Each save writes an audit event `email_design.updated` or `email_template.updated` through the existing audit service. Secrets are never involved.

### 6.4 Template registry and system sending

**`registry.ts`** exports `EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplateDef>`:

```ts
interface EmailTemplateDef {
  key: EmailTemplateKey; family: EmailFamily; name: string; description: string;
  audience: "Your team" | "Customers";
  variables: { name: string; description: string; sample: string }[];   // e.g. { name: "recipient.name", ... }
  defaults: { subject: string; preheader: string; bodyHtml: string; ctaLabel?: string };
  cta?: { urlVariable: string };          // the structural URL variable, never shown in the editor
}
```

**Common variables** for every template: `company.name`, `app.url`, `recipient.name` (falls back to the email address), `recipient.email`.

**Default copy** (sentence case, no em dashes; the builder uses it exactly):

- `sign_in_link`
  - Subject: `Your Dealflow sign-in link`. Preheader: `This link works once and expires in 15 minutes.`
  - Body: `<p>Hi {{recipient.name}},</p><p>Use the button below to sign in to Dealflow. The link works once and expires in {{link.expires_in}}.</p><p>If you didn't ask to sign in, you can ignore this email.</p>`
  - Button `Sign in`. Variables: `link.url` (structural), `link.expires_in`.
- `invite`
  - Subject: `{{inviter.name}} invited you to Dealflow`. Preheader: `Set your password to join {{company.name}} on Dealflow.`
  - Body: `<p>Hi {{recipient.name}},</p><p>{{inviter.name}} has invited you to join {{company.name}} on Dealflow, the CRM your team uses for deals, contacts and email.</p><p>Set your password to get started. This link expires in {{link.expires_in}}.</p>`
  - Button `Set your password`.
- `notification`
  - Subject: `{{notification.subject}}`. Preheader: `{{notification.line}}`.
  - Body: `<p>Hi {{recipient.name}},</p><p>{{notification.line}}</p>`
  - Button `{{notification.cta}}` (the default label per type is computed in code: "Open deal", "Open activity", "Open quote", "Open conversation", "Open form", "Open booking", or "Open Dealflow").
  - Footer extra: `You get these emails because of your notification settings. <a href="{settings url}">Change notification settings</a>.`
- `backup_failed`
  - Subject: `Dealflow backup failed`. Preheader: `The backup at {{backup.time}} did not complete.`
  - Body: `<p>The scheduled backup at {{backup.time}} did not complete.</p><p>Reason: {{backup.error}}</p><p>Check the server's free disk space and the backup folder, then run a backup again from Settings.</p>`
  - Button `Open backups`.
- `webhook_disabled`
  - Subject: `A Dealflow webhook was disabled`. Preheader: `{{webhook.name}} stopped after {{webhook.failures}} failed deliveries.`
  - Body: `<p>The webhook <strong>{{webhook.name}}</strong> ({{webhook.url}}) was turned off after {{webhook.failures}} deliveries in a row failed.</p><p>Fix the receiving service, then turn the webhook back on.</p>`
  - Button `Open webhooks`.
- `booking_confirmed`
  - Subject: `Booked: {{booking.title}} with {{host.name}}`. Preheader: `{{booking.when}} · {{booking.duration}}`.
  - Body: `<p>Hi {{guest.name}},</p><p>Your {{booking.title}} with {{host.name}} is booked.</p><p><strong>When:</strong> {{booking.when}} ({{booking.timezone}})<br><strong>Length:</strong> {{booking.duration}}<br><strong>Where:</strong> {{booking.location}}</p><p>A calendar invite is attached.</p>`
  - Button `Cancel booking`.
- `booking_cancelled`
  - Subject: `Cancelled: {{booking.title}} with {{host.name}}`. Preheader: `Your booking on {{booking.when}} is cancelled.`
  - Body: `<p>Hi {{guest.name}},</p><p>Your {{booking.title}} with {{host.name}} on {{booking.when}} has been cancelled.</p>`
  - No button.
- `quote_sent`
  - Subject: `Quote {{document.number}} from {{company.name}}`. Preheader: `{{document.title}} · {{document.total}}`.
  - Body: `<p>Hi {{customer.name}},</p><p>Thank you for your interest. Your quote for {{document.title}} is ready to view. You can accept it online.</p><p>Best regards,<br>{{sender.name}}</p>`
  - Button `View quote`. Summary rows: Quote `{{document.number}}`, Total `{{document.total}}`, Valid until `{{document.valid_until}}`.
- `invoice_sent`
  - Subject: `Invoice {{document.number}} from {{company.name}}`. Preheader: `{{document.total}} due {{document.due_date}}`.
  - Body: `<p>Hi {{customer.name}},</p><p>Please find your invoice for {{document.title}} below. Payment details are on the invoice.</p><p>Best regards,<br>{{sender.name}}</p>`
  - Button `View invoice`. Summary rows: Invoice, Total, Due date.
- `customer_message`: not editable. It is the user's own content, listed in the Templates tab as "Your emails" with a link to Settings › Email templates (saved templates and signatures) and the Branding tab.

**`sendSystemEmail(db, key, to, vars, signal, opts?)`** in `sendSystemEmail.ts`:
1. Resolves the template (override or default).
2. Renders variables (6.5).
3. Renders the layout (product family uses `DEALFLOW_DESIGN`, customer family uses the company design).
4. Sends through `getSystemMailer()`, adding a `List-Unsubscribe: <{app}/settings/notifications>` header for `notification`.

It returns the mailer's Result. Extend `SystemMail` with optional `headers` and `attachments`, so booking keeps its `.ics`; the SMTP, log and capture mailers pass them through. Every existing sender switches to it and keeps its trigger, recipients, idempotency and error handling. Delete `emailBrandHeaderHtml` and `emailBrandHeaderText` once nothing uses them (keep the logo constants).

**Customer-family system mail** (booking confirmed and cancelled) still goes through the system mailer, as today. Only the layout and copy change. Document emails keep sending from the user's mailbox (6.6).

### 6.5 Variables

`renderVariables(template, vars, { mode: "html" | "text" })` in `variables.ts`:
- Tokens are `{{name}}` with optional spaces inside the braces.
- Names are the registry's variables only; an unknown token renders as `""`, the same as the existing `applyMergeFields`.
- In `html` mode every value is HTML-escaped (`& < > " '`); in `text` mode values are inserted raw.
- Subjects and preheaders render in `text` mode, then `stripHeaderBreaks` removes `\r`, `\n` and other C0 control characters and trims to 200 or 140 chars. This prevents header injection.
- Customer-message merge fields keep the existing `applyMergeFields` (composer behaviour unchanged).

Unit tests:
- escaping (a person named `<img src=x onerror=alert(1)>` renders inert);
- a CR/LF injection in a subject variable;
- unknown tokens;
- spaces inside braces;
- text mode.

### 6.6 Customer email wrapping

`wrapCustomerEmail({ bodyHtml, mode, layoutOverride?, design })`, where `mode` is `"new" | "reply" | "automation" | "document"`:
- Returns the body unchanged when it already contains `data-df-layout`, or when the layout resolves to `plain`.
- Otherwise returns `renderEmail({ family: "customer", ... })`.
- Layout resolution: `layoutOverride` (the composer option) wins. Then `new` and `automation` use `new_email_layout`; `reply` uses `reply_layout`; `document` is always `branded`.

**Composer and send path** (`src/features/email/send.ts`, `sendHelpers.ts`):
- Order: merge fields, sanitise (unchanged), tracking rewrites and the open pixel (unchanged, so only content links are tracked), append the signature (unchanged), then wrap.
- The wrapped HTML is what goes on the wire, into the Sent copy and into the stored message.
- Scheduled sends wrap at the same point before the outbox row is written, so the worker sends the stored copy as is (the marker prevents a second wrap).
- The send input gains `layout?: "branded" | "minimal" | "plain"` (Zod, optional).
- The plain-text part is the layout's text output.
- Reply detection uses the existing thread or in-reply-to input.

**Composer UI:**
- A "Layout" control in the composer footer: a DropdownMenu showing the resolved default, with options "Branded", "Minimal" and "Plain".
- A "Preview" button opens a Dialog (Part 12 anatomy) with an `EmailPreview` iframe (`srcdoc`, `sandbox=""`, width 600, with a 375 toggle) of the exact HTML that will be sent (sample tracking off). The server renders it through a tRPC query `emailDesign.previewCustomer({ bodyHtml, signatureId?, layout, threadId? })`.

**Documents** (`src/features/documents/send.ts`):
1. Resolve `quote_sent` or `invoice_sent`.
2. Render the variables from the document (`document.total` with Part 12's `formatMoney(…, 2)`, dates in the user's locale) and the sender.
3. The existing send dialog pre-fills Subject and Message from the resolved template. Message is now a rich-text field using the same TipTap editor.
4. On send: the edited message becomes the body; add the summary card and the "View quote" or "View invoice" button (public link); wrap with `mode: "document"`; send from the user's mailbox exactly as today. Spec 08 keeps working; its labels stay.

**Automations** (`send_email` action): wrap the saved template body with `mode: "automation"` after merge and sanitise.

**Booking** (`booking_confirmed`, `booking_cancelled`): `sendSystemEmail` with the customer family.

Integration tests (real Postgres, fake transports):
- a new email's wire copy has the `customer-branded` marker, the logo URL (or the name), the signature inside the card, and the footer;
- a reply has `customer-minimal` and no logo;
- `layout: "plain"` has no marker;
- a scheduled send has exactly one marker after the worker sends it;
- a document send has the summary rows and a button pointing at the public link;
- the automation email is wrapped;
- the tracking pixel and rewritten links are still present and only inside the body.

### 6.7 Settings › Email design

A new page at `/settings/email-design`, listed in the settings nav under Company as "Email design", admin only (the nav hides it for others; the page calls `notFound()` for non-admins). Built with Part 12 primitives (FormField, FormGrid, the dialog anatomy, Combobox) and tokens.

**Branding tab:** two columns at 1280 px and wider. Left: the form. Right: a sticky live `EmailPreview` of `quote_sent` with sample data, updating as fields change (debounced 300 ms, rendered server-side through `emailDesign.previewDesign`).

Fields:
- Logo: upload button, current preview at 40 px high, "Remove". Hint: "PNG or JPEG, up to 256 KB. Use a wide logo on a transparent or white background."
- Display name: placeholder showing the company name.
- Accent colour: the existing `ColorPicker` plus a hex input, with the contrast error from 6.2.
- Show address: a switch. The hint shows the address from Settings › Documents, with a link there.
- Footer text: a Textarea, 3 rows, 500 chars.
- Show "Powered by Dealflow": a switch.
- New emails layout: "Branded" or "Plain". Replies layout: "Minimal", "Branded" or "Plain". Footer on replies: a switch.

Actions: Save (primary), and "Send test to me" (sends `quote_sent` with sample data to the admin's own address through the system mailer).

**Templates tab:**
- A table with columns Name, Audience ("Your team" or "Customers" chip), Last edited ("Default" when there is no override), and an Edit button. "Your emails" (customer_message) is a final row that links out.
- Edit opens a full-height Sheet or page section (log which).
  - Left: Subject (an input with an "Insert variable" Combobox that inserts `{{…}}` at the cursor), Preview line (input, 140 chars), Body (the TipTap editor, with the same Insert variable control inserting the token as text), and Button label (when the template has a button).
  - Right: the live preview with sample variables at 600 or 375.
  - Footer: "Reset to default" (AlertDialog confirm; deletes the override), "Send test to me", Save.
  - Variables list: each name with its description, clickable to insert.
- Saving runs `sanitizeAuthorHtml` on the body, validates lengths with Zod, and stores the override.

**Unit tests:**
- the accent contrast check;
- the template save action rejects unknown keys, non-admins and over-length fields;
- reset deletes the row;
- preview rendering escapes variables.

### 6.8 Security rules (the reviewer checks these)

- Variables are escaped in HTML mode; subjects and preheaders are stripped of CR, LF and control characters.
- Template bodies and the composer body go through `sanitizeAuthorHtml` before rendering, and the layout never interpolates unsanitised HTML.
- Button URLs come only from code. Overrides cannot set URLs (there is no field for them), and the save action ignores unknown fields.
- The logo route serves only the stored bytes with the stored type for the exact hash, and never reads a path from the request.
- Preview iframes use `sandbox=""` and `srcdoc`, with no scripts.
- Saves are admin only, CSRF-checked and audited. Test emails go only to the signed-in admin's own address.
- No email content or variable values are logged; log the key, the recipient count and the result only.

### 6.9 Proof: the e2e spec and the gallery

**`e2e/17-email.spec.ts`** (capture mailer and fake mailbox transport, as specs 06 and 08). Test titles exactly:

- `sign-in email uses the layout`: request a link; the captured mail has the `product-branded` marker, the Dealflow logo URL, a button whose href is the link that signs in (use it), a plain-text part with the link, and a subject without line breaks.
- `admin edits the invite template`:
  1. As admin, open Settings › Email design › Templates › Invite.
  2. Change the body to include "Welcome aboard", and save.
  3. Invite a user; the captured mail contains "Welcome aboard" and the set-password button still works.
  4. Reset to default; a second invite no longer contains it.
- `branding applies to customer email`:
  1. Upload a small PNG fixture logo and set the accent to `#1F5FBF`.
  2. Send a new email from the composer; the fake transport's wire copy has `customer-branded`, the logo URL `/email-assets/logo/{hash}.png` (fetch it: 200 `image/png`), the accent on the button styles, and the signature.
  3. A reply has `customer-minimal`.
- `quote email has summary and button`: send a quote (the spec 08 flow). The wire copy contains the number, the total and "View quote" linking to the public page (open it: 200).
- `preview matches what is sent`: the composer Preview iframe's `srcdoc` contains the same marker and signature as the sent copy.
- `contrast guard`: saving accent `#9BE7B3` shows the contrast error.

**`scripts/dealflow/email-gallery.mts`** (`pnpm email:gallery`, run with `tsx`, no database needed):
1. Render every registry key with its sample variables, plus `customer_message` new and reply samples, with the default company design and the Dealflow design. That is 13 emails, counting the notification once.
2. Write `e2e/screenshots/email/{key}.html`.
3. Screenshot each at 600 and 375 px wide with Playwright (`DOCS_CHROME` honoured, as `docs:pdf`) into `e2e/screenshots/email/{key}-{600|375}.png`, 26 files.
4. Print each file's HTML size and fail if any is over 90 KB.

## 7. Conventions

Same as Parts 1 to 12 (CLAUDE.md is the authority). In addition:
- New work lives in `src/features/email-design/` and the new schema file. Changes to upstream files are the minimum needed to call it, listed in `docs/dealflow/UPSTREAM.md` under "Part 13".
- Email HTML is written only in `layout.ts`. Templates hold content HTML (paragraphs, bold, links, lists), never layout tables.
- Keep every existing test hook, trigger, recipient and idempotency rule. Tests that assert old email wording or structure are updated to the new contract (log one Decision per group); never delete the assertion.
- Money, dates and permissions are risky logic: test-first (6.2 contrast, 6.3 image size, 6.5 variables, 6.6 wrapping, 6.7 actions).

## 8. Phases and tasks

`E2E` means `MINIO_PORT=9100 DEV_PG_PORT=5433` in front of the command (section 4).

### Phase 0: Start

#### Task 0.1 - Start Part 13: progress files, kit, baseline and environment

**Goal:** A Part 13 PROGRESS.md and a green baseline.

**Files:** create `PROGRESS.md`; rename `PROGRESS.md` → `PROGRESS-P12.md`; possibly root symlink `PLAN-PART13.md` and the checker copy `scripts/check-progress.mjs`

**Steps:**
1. Check section 4's table and log each result as a Decision.
2. `git mv PROGRESS.md PROGRESS-P12.md`, then create PROGRESS.md in the section 0 format with every task unchecked:
   - record the Phase 0 base commit;
   - copy `PROGRESS-P12.md` → Environment;
   - carry over still-open owner actions.
3. If the kit is in a subfolder, create the root symlink and the byte-identical checker copy.
4. Start the dev stack with the section 4 command. Baseline: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (Environment prefixes), `pnpm test:unit`. Log `- Baseline: ...` with counts.
5. Commit `0.1: Start Part 13: progress files, kit, baseline and environment`, tick.

**Verify:** `pnpm check:progress` → OK

**Done when:** the baseline is green and logged.

#### Task 0.2 - Outbound email inventory

**Goal:** Every email path is known before it is changed.

**Files:** create `docs/dealflow/EMAIL.md`

**Steps:**
1. Find every sender: `grep -rn "getSystemMailer\|sendSystem\|sendEmail(\|sendDocument(" src --include=*.ts`. Also find the booking cancel path and the notification types the email job renders.
2. Write `EMAIL.md` with the 6.1 table completed: file, function, trigger, recipients, current subject, current HTML source, and the registry key it will use. Note any sender not in 6.1, and add it to 6.1's mapping as a Decision, with its current wording as the default copy.
3. Commit `0.2: Outbound email inventory`, tick.

**Verify:** `grep -c "^| " docs/dealflow/EMAIL.md` → at least `12`

**Done when:** every sender is mapped to a key.

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

**QA focus:** the inventory is complete.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: Renderer, data and variables

#### Task 1.1 - Variables and escaping

**Goal:** Safe variable rendering for HTML and headers.

**Files:** create `src/features/email-design/variables.ts`, `variables.test.ts`

**Steps:**
1. Write the 6.5 tests first.
2. Implement `renderVariables`, `escapeHtml` and `stripHeaderBreaks`.
3. Commit `1.1: Variables and escaping`, tick.

**Verify:** `pnpm vitest run src/features/email-design/variables.test.ts` → passes

**Done when:** the 6.5 tests pass.

#### Task 1.2 - The layout renderer

**Goal:** One email layout for both families.

**Files:** create `src/features/email-design/tokens.ts`, `layout.ts`, `layout.test.ts`; add `E_EMAIL_DESIGN_001` (and the next ids this part needs) to `src/constants/errorIds.ts`

**Steps:**
1. Write the 6.2 tests first, including the WCAG contrast function.
2. Implement `renderEmail` exactly as 6.2: the skeleton, both layouts, the summary, the bulletproof button with VML, the footer, the plain text and the size guard.
3. Commit `1.2: The layout renderer`, tick.

**Verify:** `pnpm vitest run src/features/email-design/layout.test.ts` → passes

**Done when:** the 6.2 tests pass.

#### Task 1.3 - Data model, design service, logo and the public route

**Goal:** The design and overrides are stored, and the logo is publicly reachable.

**Files:**
- create `src/db/schema/emailDesign.ts` (exported from the index);
- create `drizzle/00NN_dealflow_email_design.sql` (via `db:generate` with the Environment prefixes, then check the SQL matches 6.3);
- create `src/features/email-design/design.ts`, `imageSize.ts` and their tests;
- create `src/app/email-assets/logo/[file]/route.ts`;
- modify the public path allow-list.

**Steps:**
1. Write the `imageSize` tests first (PNG, JPEG, corrupt).
2. Implement the schema and migration, `getEmailDesign` (merging the company name and Documents address), `saveEmailDesign`, and the logo upload, remove and hash.
3. Implement the route with the hash and type check and the cache headers, plus an integration test (`design.integration.test.ts`: save, then fetch 200 with bytes; a wrong hash gives 404; a wrong extension gives 404).
4. Commit `1.3: Data model, design service, logo and the public route`, tick.

**Verify:** `pnpm vitest run src/features/email-design` → passes

**Done when:** the unit tests pass and the integration test file passes.

#### Task 1.4 - Registry, overrides and sendSystemEmail

**Goal:** One entry point for product emails, with editable copy.

**Files:** create `src/features/email-design/registry.ts`, `templates.ts`, `sendSystemEmail.ts` and tests; modify `src/features/mailer/types.ts`, `smtpMailer.ts`, `logMailer.ts`, `captureMailer.ts` (headers and attachments pass-through)

**Steps:**
1. Implement the 6.4 registry with the default copy exactly as written, plus the keys added in 0.2.
2. Implement `resolveTemplate`, `saveTemplate` and `resetTemplate`, and `sendSystemEmail`.
3. Unit tests: every registry key renders with its sample variables under 90 KB and has no `{{` left; an override wins; reset falls back. Integration tests (`templates.integration.test.ts`): the override round trip, and `sendSystemEmail` through the capture mailer gives the marker, the headers and the attachment.
4. Commit `1.4: Registry, overrides and sendSystemEmail`, tick.

**Verify:** `pnpm vitest run src/features/email-design src/features/mailer` → passes

**Done when:** the tests pass.

#### Task 1.5 - Phase 1 QA gate

**Goal:** Prove the foundation.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). Record the Phase 2 base commit, commit `1.5: Phase 1 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `src/features/email-design/*.integration.test.ts` → pass

**QA focus:** 6.2, 6.3, 6.5 and 6.8 are implemented exactly.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: Every sender on the new system

#### Task 2.1 - Product emails migrated

**Goal:** Sign-in, invite, notifications, backups and webhooks use `sendSystemEmail`.

**Files:** modify `src/app/auth/magic-link/route.ts`, `src/features/identity/actions/invite.ts`, `src/features/notifications/email/job.ts` and `render.ts`, `src/features/backups/backup.ts`, `src/features/webhooks/deliver.ts`, `src/features/mailer/templates.ts` and `branding.ts` (remove the old builders), and the affected tests

**Steps:**
1. Switch each sender to its key, mapping its data to the registry variables (`notification.subject`, `notification.line` and `notification.cta` from `render.ts`).
2. Keep the triggers, recipients, idempotency and error handling.
3. Update the tests that asserted old HTML to the new contract (log it). Run `pnpm vitest run` on each touched folder and the matching integration files (`src/features/notifications`, `src/features/identity`, `src/features/webhooks`, `src/features/backups`, auth).
4. Commit `2.1: Product emails migrated`, tick.

**Verify:** `pnpm vitest run src/features/notifications src/features/identity src/features/webhooks src/features/backups src/features/mailer` → passes

**Done when:** `grep -rn "emailBrandHeaderHtml" src` prints nothing and the tests pass.

#### Task 2.2 - Customer email wrapping in the send path, automations and booking

**Goal:** Every customer email is wrapped once with the right layout.

**Files:** create `src/features/email-design/wrapCustomerEmail.ts` and its test; modify `src/features/email/send.ts`, `sendHelpers.ts`, the scheduled-send storage, `src/features/automations/actions/sendEmail.ts`, `src/features/scheduling/booking.ts` and the cancel module, and their tests

**Steps:**
1. Write the wrap unit tests first: the layout resolution table, the marker guard, plain.
2. Wire it in the 6.6 order. Add the `layout` input. Switch booking to `sendSystemEmail` with the customer family and the `.ics` attachment.
3. Add the 6.6 integration tests (`wrap.integration.test.ts`, plus updates to the existing send integration tests if they assert raw HTML, logged).
4. Commit `2.2: Customer email wrapping in the send path, automations and booking`, tick.

**Verify:** `pnpm vitest run src/features/email src/features/email-design src/features/automations src/features/scheduling` → passes

**Done when:** the 6.6 integration tests pass.

#### Task 2.3 - Quote and invoice emails

**Goal:** Document emails use editable templates, a summary card and a button.

**Files:** modify `src/features/documents/send.ts`, `actions.ts`, the send dialog component under `src/features/documents/ui/`, and their tests

**Steps:**
1. Resolve `quote_sent` or `invoice_sent` and render its variables (6.6).
2. Pre-fill the dialog, and make Message a TipTap field.
3. Build the summary and button, wrap with `mode: "document"`, and send as today.
4. Unit and integration tests: summary values, the button URL equals the public link, and the subject has no line breaks. Commit `2.3: Quote and invoice emails`, tick.

**Verify:** `pnpm vitest run src/features/documents` → passes

**Done when:** the tests pass and spec 08's labels are unchanged.

#### Task 2.4 - Phase 2 QA gate

**Goal:** Prove every sender.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). Record the Phase 3 base commit, commit `2.4: Phase 2 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- the integration files of `src/features/email`, `src/features/email-design`, `src/features/documents`, `src/features/notifications`, `src/features/scheduling` and `src/features/automations` → pass
- `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e:build && MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm exec playwright test e2e/01-auth.spec.ts e2e/02-invite-profile.spec.ts e2e/06-mail.spec.ts e2e/08-documents.spec.ts e2e/09-automations.spec.ts e2e/10-forms-booking.spec.ts` → passes

**QA focus:** DoD items 3, 4 and 6; no trigger or recipient changed.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: Settings and composer UI

#### Task 3.1 - Settings › Email design: Branding tab

**Goal:** Admins set the company email identity with a live preview.

**Files:** create `src/app/(app)/settings/email-design/page.tsx`, `src/features/email-design/ui/EmailDesignSettings.tsx`, `BrandingTab.tsx`, `EmailPreview.tsx`, `router.ts`, `actions.ts`, `schemas.ts`; modify the settings nav, the tRPC root router, and the strings constants

**Steps:**
1. Implement the 6.7 Branding tab, `emailDesign.get`, `emailDesign.previewDesign`, the save action (admin, CSRF, Zod, audit), logo upload and remove, and the test send.
2. Unit tests for the actions (6.7).
3. Commit `3.1: Settings › Email design: Branding tab`, tick.

**Verify:** `pnpm vitest run src/features/email-design` → passes

**Done when:** the page renders for admins and 404s for others, and the tests pass.

#### Task 3.2 - Templates tab and the template editor

**Goal:** Admins edit every template safely.

**Files:** create `src/features/email-design/ui/TemplatesTab.tsx`, `TemplateEditor.tsx`; modify `router.ts`, `actions.ts`, `schemas.ts`

**Steps:**
1. Implement the 6.7 Templates tab and editor: Insert variable, live preview at 600 and 375, Reset with confirm, test send, and save with sanitise and audit.
2. Unit tests: the unknown key is rejected, non-admins are rejected, lengths are enforced, reset deletes, and the preview escapes.
3. Commit `3.2: Templates tab and the template editor`, tick.

**Verify:** `pnpm vitest run src/features/email-design` → passes

**Done when:** the editor round-trips an override and the tests pass.

#### Task 3.3 - Composer layout control and preview

**Goal:** People choose the layout and see the exact email before sending.

**Files:** modify `src/features/email/Composer.tsx` (and its composer folder), the shared compose bar, `src/features/email-design/router.ts` (`previewCustomer`), and the tests

**Steps:**
1. Add the Layout DropdownMenu and the Preview Dialog per 6.6. Pass `layout` on send.
2. Unit tests: the default label follows new or reply and the design; the preview query is called with the body, signature and layout.
3. Commit `3.3: Composer layout control and preview`, tick.

**Verify:** `pnpm vitest run src/features/email src/features/compose` → passes

**Done when:** the tests pass and existing composer hooks are unchanged.

#### Task 3.4 - Phase 3 QA gate

**Goal:** Prove the settings and composer.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). Record the Phase 4 base commit, commit `3.4: Phase 3 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm check:design` → `0 violation(s)`
- `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e:build && MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm exec playwright test e2e/17-email.spec.ts` → passes (write the spec now if Task 4.1 has not, then mark this gate's run in the QA line)

**QA focus:** DoD item 5; admin-only access; preview iframes sandboxed.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Proof and hand-off

#### Task 4.1 - Email e2e spec and gallery

**Goal:** End-to-end proof, plus previews for the owner.

**Files:** create `e2e/17-email.spec.ts` (if not created in 3.4), `e2e/fixtures/email-logo.png` (a 240×60 PNG generated in the test setup or committed, under 10 KB), `scripts/dealflow/email-gallery.mts`; modify `package.json` (`email:gallery`)

**Steps:**
1. Write the six 6.9 tests with the exact titles.
2. Write the gallery script and run `pnpm email:gallery`. Confirm 26 PNGs and every size under 90 KB.
3. Commit `4.1: Email e2e spec and gallery`, tick.

**Verify:** `ls e2e/screenshots/email/*.png | wc -l` → `26`

**Done when:** the spec is written and the gallery exists.

#### Task 4.2 - Docs

**Goal:** Admins and the operator know how email works.

**Files:** modify `docs/dealflow/EMAIL.md` (finish it), `docs/dealflow/UPSTREAM.md`, `docs/user-guide/admin.md` (new section "How to brand your emails" and "How to edit email templates"), `docs/user-guide/email.md` (Layout and Preview in the composer), `docs/user-guide/quotes-and-invoices.md` (the email template); regenerate PDFs

**Steps:**
1. Write the docs.
2. Run `pnpm docs:pdf`, with `DOCS_CHROME` from Environment if needed.
3. Commit `4.2: Docs`, tick.

**Verify:** `ls docs/user-guide/pdf/*.pdf | wc -l` → `15`

**Done when:** the docs describe Part 13 and the PDFs are rebuilt.

#### Task 4.3 - End-to-end, integration suite and smoke

**Goal:** The once-per-part full runs.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` (specs `00` to `17`), then `pnpm test:integration` (full).
2. Run `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke`. Expect SMOKE PASS, "backup round trip ok (3 deals)", and no leftovers.
3. Log all three, commit `4.3: End-to-end, integration suite and smoke`, tick.

**Verify:** `grep -c "SMOKE PASS\|smoke: SKIPPED" PROGRESS.md` → at least `1`

**Done when:** all three ran and are logged.

#### Task 4.4 - Independent review

**Goal:** One fresh-context review of Part 13.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is:
   - the full `.dsh/qa.md`;
   - a blank line;
   - `Final review of PLAN-PART13.md. Base commit {Phase 0 base}.`;
   - "Also check 6.8 point by point, open the wire copies from the e2e run for the sign-in, invite, composer, reply and quote emails, and confirm no sender builds HTML outside src/features/email-design/."

   Fallbacks: `qa.sh` with the same request, then an evidenced self-review.
2. Fix every blocker and major, commit `4.4: QA fixes round {r}`, at most 3 rounds. After the last round, re-run the Task 3.4 gate commands, `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` and `pnpm test:integration`.
3. Log `- Independent review: {how} round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n}`.
4. Commit `4.4: Independent review`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`

**Done when:** the review ran, blockers and majors are fixed or logged, and the final tree has green evidence.

#### Task 4.5 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order. Write one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `4.5: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least `16`

**Done when:** every checklist item has a line.

#### Task 4.6 - Final report and completion

**Goal:** Hand the owner a short, truthful report.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report, short:
   - DoD items 1 to 8, one line each;
   - the Checklist;
   - Owner actions, numbered, with exact commands:
     - rebuild the live install;
     - upload your logo and set the accent in Settings › Email design;
     - send yourself a test of each template;
     - open `e2e/screenshots/email/` to review the previews;
     - check that `BASE_URL` on the live install is the public address, so email images load;
   - changed tests;
   - Open issues.

   Do not repeat the Decisions list.
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `4.6: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- New emails, triggers or recipients (for example invoice reminders, digests that do not exist, marketing email).
- Inbound email rendering changes.
- Dark-mode email styles, AMP email, web fonts.
- A drag-and-drop email builder; per-user layouts; more than one company design.
- Changing the public quote, invoice, form or booking pages.
- Any change to `site/`, `website/` or the separate website repo.

## 10. ASK and STOP triggers

This plan has no ASK triggers. The only STOP cases are the fatal ones in section 4.

| Situation | Safe default | Owner action to log |
|---|---|---|
| Docker stops or fills up after Task 0.1 | try `open -a Docker` and the section 4 dev:up command once; still failing → SKIPPED, finish the non-Docker tasks, `COMPLETE WITH OPEN ISSUES` | "Restart Docker Desktop or give it more disk, then run `pnpm test:integration`, `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e`, `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke`" |
| A sender cannot be moved without changing its trigger | move the HTML only, keep the trigger, log it | none |
| The notification job sends something other than single emails (a digest) | add `notification_digest` per 6.1 and log it | none |
| The existing HTML-to-text helper is missing | write a small converter in `layout.ts` (strip tags, keep link URLs, collapse whitespace) with tests | none |
| The Gmail provider path builds MIME separately | apply the same wrap before its MIME build and log it | none |
| Subagent tool unavailable | `qa.sh`, then an evidenced self-review | "Run the review yourself with `.dsh/qa.md` and the Task 4.4 request" |
| Google env in `.env` still partial | keep the Environment prefixes | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty, ignoring untracked files the owner left in `site/public/`.
2. `pnpm install --frozen-lockfile` exits 0, and no dependency was added in this part.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes (count at least the baseline plus the new tests).
6. `pnpm test:integration` passes on the final tree.
7. `pnpm build` exits 0.
8. `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` passes, specs `00` to `17`, on the final tree.
9. `ls e2e/screenshots/email/*.png | wc -l` is 26, and the gallery script reported every HTML under 90 KB.
10. `grep -rlnE "<table|<html|style=\"" src --include=*.ts | grep -iE "mail|notif|booking|backup|webhook|documents/send" | grep -v "src/features/email-design/"` prints nothing (no email HTML built outside the renderer).
11. `grep -rn "emailBrandHeaderHtml" src` prints nothing.
12. The 6.5 escaping and header-injection tests pass (cite them).
13. Smoke printed SMOKE PASS and `backup round trip ok (3 deals)`.
14. `pnpm check:design` prints `0 violation(s)`.
15. No em dash in any file added or changed in this part (`git diff --name-only {Phase 0 base} | xargs perl -CSD -ne 'print "$ARGV\n" if /\x{2014}/' | sort -u` prints nothing, kit files excepted).
16. `docs/dealflow/EMAIL.md` and `UPSTREAM.md` ("Part 13") are complete.
17. `pnpm check:progress --final` passes.

## 12. Report back

No mid-run reporting. The run ends with the final report (Task 4.6). The owner pastes PROGRESS.md → Final report back to the planner, plus any email gallery previews that look wrong.

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

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md to PLAN-PART13.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

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
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; money is computed on integer minor units with no floats, converted totals never add unconverted amounts or drop deals silently (excluded deals are listed), the forecast reuses the deals visibility filter; document public routes take only the publicId and a validated body, never render HTML, issued documents are immutable; domain events are written inside the mutation's transaction, automation actions go through existing services and respect the loop guard, webhook delivery checks every resolved address inside the DNS lookup with no redirects, webhook secrets are encrypted and never returned after creation; public form and booking handlers write nothing on spam paths, bookings re-check the slot under a per-host lock in the same transaction, only `/f/*` and `/book/*` may be framed; reports apply the deals or activities visibility clause, never add values across currencies in SQL, send only aggregated rows to the AI; API calls authenticate only by hashed bearer token and run as the token's user through existing services, exports reuse list visibility, backups keep secrets out of argv and logs, download routes refuse path traversal; bulk actions and undo call the existing services, the next recurring occurrence is created once inside the completion transaction, duplicates respect visibility; the service worker never caches authenticated HTML or API responses, offline data is per user and wiped on sign-out, the VAPID private key never reaches the client; the restyle changes no behaviour or test hook, every visual value matches the plan's measured Pipedrive spec (section 6) through tokens or primitives, no Pipedrive asset is copied, and `check-design` opt-outs carry a genuine reason; dialogs put the close button in the header and scroll only their body, long lists scroll or search, the hidden install, offline and push UI is gated by NEXT_PUBLIC_PWA_UI and not deleted, AI JSON parsing never logs reply content; outbound email HTML is built only by src/features/email-design, variables are escaped and subjects carry no CR or LF, button URLs are structural, the public logo route serves only the stored hash, template saves are admin only and audited, no email content is logged; no em dashes in new files.
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
# Usage: ./qa.sh "Final review of PLAN-PART13.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
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

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART13.md";
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
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART(?:1[0-3]|[1-9])\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
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
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART13.md (dealflow-wd-p13-v1) is finished.
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
PROMPT='Read PLAN-PART13.md in this folder in full and PROGRESS.md, then follow PLAN-PART13.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p13-v1; earlier parts are finished) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p13-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p13-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
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
- Otherwise you are the builder: read `PLAN-PART13.md` in full (Parts 1 to 12 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART13.md rule 18.
```
