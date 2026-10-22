# Dealflow user-facing inventory (Phase 0)

Checked on 2026-10-22 against the running app on `http://localhost:3001` (Docker image built from the latest commit `e376d2f`), with seed demo data, `AI_FAKE=true` and `MAIL_FAKE=true`. Every page listed was loaded signed in (HTTP 200, content read); interactive flows were clicked through with a headless browser where marked "seen". The Playwright suite (`e2e/00` to `e2e/15`, 50 of 50 passing at the end of Part 11) is the second source of evidence.

**Who** uses the default permission sets: **Everyone** = any signed-in user (the default "Regular" set can create deals, contacts and activities and edit their own); **Admin** = the Admin set or `is_admin`; **Flag** = a permission flag an admin can grant in a permission set (for example `products.manage`).

**Status**: **Works (seen)** = I used it in the running app. **Works (e2e)** = the page loads and the flow is proven by the named Playwright spec, not clicked by me. **Needs setup** = built, but needs keys or an external account this install does not have, so it was not seen working. **Not documented** = deliberately left out of the user guide. **To verify in Phase 1** = the control is there but I have not yet seen the result; it is documented only if it works when I take its screenshots.

## 1. Sign-in and account

| Feature | Who | Where in the UI | Status | Evidence |
|---|---|---|---|---|
| Sign in with email and password | Everyone | `/login`, Password tab | Works (e2e) | `01-auth` |
| Sign in with an email link (15-minute, single use) | Everyone | `/login`, Email link tab | Works (seen) | link requested, confirmation shown; `01-auth` |
| Accept an invite and set a password | Invited users | link in the invite email, `/login/invite` | Works (e2e) | `02-invite-profile` |
| Change password, name, photo, timezone | Everyone | Settings › Personal preferences | Works (e2e) | `02-invite-profile` |
| Forgotten password (email link, then set a new one in Profile) | Everyone | `/login` hint text | Works (e2e) | `06-mail` resets a password |
| Light, dark or system appearance | Everyone | Account menu › Appearance | Works (seen) | Day, Night, System |
| Sign out | Everyone | Account menu › Log out | Works (e2e) | `01-auth` |
| Google sign-in (Workspace SSO) | Everyone, when an admin turns it on | `/login` button | Not documented | owner will not use it (2026-10-22) |
| Dev login route | Developers | `/auth/dev-login` | Not documented | development-only, disabled in production |

## 2. Navigation and everyday tools

| Feature | Who | Where | Status | Evidence |
|---|---|---|---|---|
| Left rail: Pipeline, Forecast, Documents, Insights, Projects, Leads, Contacts, Activities, Inbox, Performance | Everyone | left edge (desktop) | Works (seen) | rail links read |
| Mobile bottom bar: Deals, Activities, Inbox, Contacts, More | Everyone | below 768 px wide | Works (seen) | browser pane at phone width |
| Global search | Everyone | top bar, Open search | Works (seen) | results grouped by Deals, People, Organizations, Leads |
| Quick add menu: Lead, Deal, Activity, Person, Organization, Note, Email (single-letter keys) | Everyone | top bar `+` | Works (seen) | menu opened |
| Command palette (Go to, Create, Actions such as Mark won, Log call, Create quote) | Everyone | Cmd+K / Ctrl+K | Works (seen) | palette opened |
| Keyboard shortcuts and help sheet | Everyone | `?` or palette › Keyboard shortcuts | Works (e2e) | `13-productivity` |
| Undo after a change | Everyone | toast after edits | Works (e2e) | `13-productivity` |
| Page information tooltips | Everyone | (i) next to page titles | Works (seen) | hover shows the page description |
| Docs button | Everyone | top bar | Works | now opens `https://dealflow.umev.co.uk/docs/` (owner decision, 2026-10-22) |

## 3. Pipelines and deals

| Feature | Who | Where | Status | Evidence |
|---|---|---|---|---|
| Kanban board by stage, stage totals and weighted totals, drag to move stage | Everyone | Pipeline | Works (seen) | 36 demo deals; `07-sales` |
| Switch pipeline, filter, owner filter, pin filters, sort (next activity, value) | Everyone | Pipeline toolbar | Works (seen) | |
| List view, archived deals, export CSV | Everyone (export: `data.export`) | Pipeline › list / archive icons | Works (seen) | |
| Forecast view by expected close month | Everyone | Forecast | Works (seen) | 6-month view, weighted |
| Create a deal | Everyone | `+ Deal`, quick add, palette | Works (e2e) | `07-sales` |
| Deal workspace: stage track, owner, followers, labels, value, expected close, participants, custom fields | Everyone (edit own; others need `deal.edit`) | `/deals/{id}` | Works (seen) | |
| Mark won or lost (with lost reason), reopen | Everyone | deal header | Works (seen) | "Lost, Went with competitor, Reopen" |
| Timeline tabs: Activity, Notes, Email, Files, Changelog | Everyone | deal workspace | Works (seen) | |
| Products on a deal (line items, quantity, discount, tax, currency) | Everyone; catalogue needs `products.manage` | deal workspace, Settings › Products | Works (e2e) | `07-sales` |
| Multi-currency deals with manual rates, converted totals | Admin sets rates | Settings › Currencies | Works (seen) | EUR at 1.08 GBP |
| Edit pipelines and stages (probability, rotting days) | `pipeline.manage` | Pipeline › Edit pipeline, Settings › Company › Pipelines | Works (seen) | |
| Leads inbox: list, saved views, convert to deal, archive | Everyone | Leads | Works (seen) | |

## 4. Contacts and organizations

| Feature | Who | Where | Status | Evidence |
|---|---|---|---|---|
| People and organizations lists, saved views, filters, export CSV | Everyone | Contacts | Works (seen) | 105 people, 52 orgs |
| Person and organization detail with linked deals and timeline | Everyone | `/contacts/people/{id}`, `/contacts/orgs/{id}` | Works (seen) | |
| Contacts timeline (activity across contacts by month) | Everyone | Contacts › Timeline | Works (seen) | |
| Find and merge duplicates, hide non-duplicates | `contact.merge` | Contacts › Find duplicates | Works (seen) | `13-productivity` |
| Bulk edit people and organizations | `bulk.edit` | list selection | Works (e2e) | `13-productivity` |
| Fill the gaps (enrichment from Apollo, RocketReach, GetProspect) | Admin enables | Settings › Enrichment | Needs setup | no provider keys on this install |
| Import CSV (people, orgs, deals, leads, activities) with undo | `data.import` | Settings › Import data | Works (e2e) | `12-projects-data` |

## 5. Activities

| Feature | Who | Where | Status | Evidence |
|---|---|---|---|---|
| Activities list (Overdue, Today, This week, types, done filter), export CSV | Everyone | Activities | Works (seen) | |
| Calendar (day, week, month) | Everyone | Activities › Calendar | Works (seen) | |
| Schedule activity, repeating activities | Everyone | `+ Activity`, deal workspace | Works (e2e) | `13-productivity` |
| Log a call | Everyone | palette › Log call, deal workspace | Works (e2e) | `13-productivity` |
| Activity types | `metadata.manage` | Settings › Company › Activities | Works (seen) | |

## 6. Email

| Feature | Who | Where | Status | Evidence |
|---|---|---|---|---|
| Connect a mailbox over IMAP/SMTP (Purelymail preset or any server) with an app password | Everyone | Settings › Email sync | Works (e2e), live-checked | `06-mail`; live Purelymail check passed 2026-10-20 |
| Inbox: Inbox, Drafts, Outbox, Sent, Archive; Unmatched, Needs linking, follow-ups, labels, attachments, unread filters | Everyone | Inbox | Works (seen) | 10 conversations as demo1 |
| Read a thread, reply, threading, link to a deal or contact | Everyone | Inbox › thread | Works (e2e) | `06-mail` |
| New email, drafts, scheduled send (Outbox) | Everyone | `+ New email`, quick add `E` | Works (e2e) | `06-mail` |
| Open and link tracking ("Your email was opened") | Everyone | Opens and Links switches in the composer, notifications | Works (code), documented with a caveat | switches seen; shared send path mints tracking tokens (`src/features/email/send.ts`); a real open not observed |
| Templates and signatures | Everyone; shared templates | Settings › Email templates | Works (seen) | 3 shared templates |
| Private threads | Everyone | thread privacy toggle | Works (e2e) | |
| Gmail as the mail provider | Admin enables | Settings › Email sync | Not documented | owner will not use it (2026-10-22) |

## 7. Notifications

| Feature | Who | Where | Status | Evidence |
|---|---|---|---|---|
| In-app notifications (mentions, assignments, followed deal won, quote viewed, email opened), mark all read | Everyone | top bar bell | Works (seen) | |
| Notification preferences (in app or by email per event) | Everyone | Settings › Notifications | Works (seen) | |
| Push notifications to this browser or installed app | Everyone, once an admin sets VAPID keys | Settings › Notifications | Not documented | owner will not use it (2026-10-22) |
| Mentions with `@` in notes | Everyone | notes | Works (e2e) | demo notifications |

## 8. Stats, reporting and forecasting

| Feature | Who | Where | Status | Evidence |
|---|---|---|---|---|
| Performance: deals won, win rate, average won deal, sales cycle, activities, goals | Everyone; others' stats need `stats.viewOthers` | Performance | Works (seen) | |
| Goals (company, team, person; deals or activities; period) | `goals.manage` | Settings › Goals | Works (seen) | |
| Insights dashboards (shared or private, widgets) | Everyone | Insights › Dashboards | Works (seen) | "Sales overview" with 6 widgets |
| Insights reports (entity, measure, group by, segment, date range, chart type, table, CSV) | Everyone | Insights › Reports | Works (seen) | `11-insights` |
| Explain this report (AI) | Everyone, AI on | report › Explain | Works (e2e) | `11-insights` |

## 9. Quotes, invoices, products, projects

| Feature | Who | Where | Status | Evidence |
|---|---|---|---|---|
| Quotes and invoices from a deal: draft, issue, send, numbering, tax, print preview | `documents.manage` | Documents, deal workspace | Works (seen) | `08-documents` |
| Public quote page: accept by typing your name, decline, download PDF | Customers (no sign-in) | `/d/{publicId}` | Works (seen) | see Question 2 |
| Payments recorded by hand, overdue status | `documents.manage` | invoice detail | Works (e2e) | `08-documents` |
| Document settings (prefixes, company details, payment instructions, templates) | Admin | Settings › Documents | Works (seen) | |
| Products catalogue (code, price, currency, tax) | `products.manage` | Settings › Products | Works (seen) | 7 demo products |
| Projects with phases and tasks, linked deal, status, progress | Everyone | Projects | Works (seen) | `12-projects-data` |

## 10. Forms and booking pages

| Feature | Who | Where | Status | Evidence |
|---|---|---|---|---|
| Web forms that create a lead or deal, embeddable, spam protection | `forms.manage` | Settings › Forms; public `/f/{id}` | Works (seen) | "Contact us" form; `10-forms-booking` |
| Booking pages with availability; public booking and cancel | Everyone | Settings › Booking pages; public `/book/{id}` | Works (seen) | "Intro call" page |

## 11. AI features (OpenRouter; seen with the fake provider)

| Feature | Who | Where | Status | Evidence |
|---|---|---|---|---|
| Assistant chat with suggested questions; asks before it changes data | Everyone, AI on | top bar, Open assistant | Works (seen) | `05-assistant` |
| Deal summary: risks, next steps, add suggested activity | Everyone | deal › AI insights › Generate summary | Works (seen) | fake summary returned |
| Deal score badge and bulk scoring | Everyone; bulk is admin | deal › Score deal; Insights | Works (e2e) | `03-ai-deal`, `11-insights` |
| Draft an email with AI | Everyone | composer | Works (e2e) | `04-ai-compose-filter` |
| Describe a filter in plain English | Everyone | Leads, People, Organizations › Describe a filter | Works (seen) | `04-ai-compose-filter` |
| Notes to activities | Everyone | deal notes | Works (e2e) | `03-ai-deal` |
| Automation "Describe it" drafting and AI actions | `automations.manage` | Settings › Automations | Works (e2e) | `09-automations` |
| AI settings: on or off, monthly token limits per company and user, usage by feature and user | Admin | Settings › AI | Works (seen) | |

## 12. Admin and settings

| Feature | Who | Where | Status | Evidence |
|---|---|---|---|---|
| Users: invite, admin toggle, permission set, deactivate | `permissions.manage` / Admin | Settings › Users | Works (seen) | `02-invite-profile` |
| Teams with managers | Admin | Settings › Teams | Works (seen) | |
| Permission sets (Regular, Admin, custom) | `permissions.manage` | Settings › Permission sets | Works (seen) | |
| Visibility groups | Admin | Settings › Visibility groups | Works (seen) | |
| Company settings: name, base currency, labels, lost reasons | `metadata.manage` | Settings › Company settings | Works (seen) | |
| Data fields (custom fields, hide built-in fields) | `metadata.manage` | Settings › Data fields | Works (seen) | |
| Automations: triggers, conditions, actions, templates, run log | `automations.manage` | Settings › Automations | Works (seen) | 2 demo automations |
| Webhooks: signed events, retries, auto-disable | Admin | Settings › Webhooks | Works (seen) | `09-automations` |
| API tokens and REST API | Everyone (tokens act as you) | Settings › API | Works (seen) | `docs/API.md` |
| Connected apps (MCP clients through OAuth), revoke | Everyone | Settings › Connected apps | Works (seen) | |
| Recycle bin (restore within 30 days) | Everyone for own items | Settings › Recycle bin | Works (seen) | |
| Audit log (permissions, users, pipeline access, settings) | Admin | Settings › Audit log | Works (seen) | |
| Backups: daily dump plus file mirror, Back up now; restore from the server only | Admin | Settings › Backups | Works (seen) | restore steps shown on page |

## 13. Install and mobile

| Feature | Who | Where | Status | Evidence |
|---|---|---|---|---|
| Install as an app (PWA) | Everyone | browser install prompt | Works (e2e) | `14-pwa-mobile` |
| Offline: read-only recent records, "You're offline" page | Everyone | automatic | Works (seen) | `/offline` lists recent records |
| Self-hosting with Docker Compose (app, ws, worker, Postgres, MinIO), reverse proxy routes | Operator | `docs/deploy.md`, `docs/reverse-proxy.md` | Works | this install runs that way |

## Differences between the code or plans and the running app

1. `CLAUDE.md` describes IMAP/SMTP mail as "planned". It is built and live-checked against Purelymail, so the guide documents it as working.
2. The top bar **Docs** button opens the upstream warpdrive docs site (`DOCS_SITE_URL` in `src/constants/docs.ts`), not Dealflow help.
3. Demo quote Q-2026-0011 has no customer name, so its public page reads "Quote Q-2026-0011 for" and "Prepared for by". The template fields simply render empty; screenshots will use a quote that has a customer.
4. The demo draft document's public link returns 404 by design (only issued documents are public).
5. The rail labels the stats page **Performance** while its URL is `/dashboard`; the guide uses the visible name.

## Owner decisions (2026-10-22)

1. The top bar Docs button opens the user guide at `https://dealflow.umev.co.uk/docs/` (`USER_GUIDE_URL` in `src/constants/docs.ts`); `DOCS_SITE_URL` stays for the upstream MCP developer docs.
2. Google sign-in, Gmail and push notifications are left out of the guide. Enrichment is mentioned only as optional admin setup.
3. The website lives at `https://dealflow.umev.co.uk`.
