# Build the Dealflow landing site

You are building the public landing site for **Dealflow**, an open-source, self-hosted CRM for business development (repo: `https://github.com/itchyparrot53/dealflow`).

Every design and content decision in this brief is final. Build exactly this. Do not invent features, numbers, customers, testimonials or logos. Work autonomously and do not stop to ask questions. Where something is genuinely ambiguous, choose the option closest to this brief and record the choice in `site/BUILD-NOTES.md`.

## 0. Inputs you are given

1. **The Dealflow repository** (you are working inside it). Read `README.md`, `docs/deploy.md`, `docs/reverse-proxy.md`, `docs/user-guide/index.md`, `docs/user-guide/self-hosting.md`, `docs/user-guide/email.md`, `docs/dealflow/MAIL.md`, `docs/dealflow/CAMPAIGNS.md` and `brand/brand-guidelines.html` before writing copy. Do not describe a feature that is not in those files.
2. **Real screenshots** in `docs/screenshots/` and `docs/user-guide/images/`. These are current Dealflow screens, already branded. Use only these, plus the specified HTML and SVG diagrams. Do not make fake dashboards.
3. **Brand assets** in `brand/` and the current site assets in `website/public/assets/`. The logo, app icons, favicons, Open Graph image and the Inter variable font are already there. Copy them into `site/assets/`. Never recolour, crop or redraw a logo.
4. **No hero image** is supplied. The hero uses the real pipeline board screenshot, presented in a glass frame with a soft mint glow. Do not invent a 3D render or a stock image. If the owner later adds `site/assets/hero.webp`, use it and record that in BUILD-NOTES; otherwise the screenshot is the hero.
5. **Constants used throughout this brief:**
   - `REPO = https://github.com/itchyparrot53/dealflow`
   - `SITE = https://itchyparrot53.github.io/dealflow/`
   If the repository owner or name is different, replace both consistently everywhere, including canonical URLs, Open Graph URLs, the README line and the JSON-LD.

The existing `website/` directory is the current static marketing and user-guide site. It is out of scope. Do not modify, delete, rebuild or copy its pages. This brief builds a separate, more designed landing page in `site/`. We will decide later whether to replace `website/`.

## 1. What to deliver

A static site in `site/`: plain HTML, CSS and a little vanilla JS. No framework, no build step, no CDN, no npm runtime dependency.

At runtime the site makes no third-party requests except one optional call to the GitHub API for the star count (section 6.3).

Deliver:

- A GitHub Pages workflow at `.github/workflows/pages.yml` that deploys `site/` on every push to `main` that touches `site/**`.
- One line in the root `README.md`: `**Website:** https://itchyparrot53.github.io/dealflow/`.
- `site/BUILD-NOTES.md`: the decisions you made, the image sizes, and the results of the checks in section 9.

```text
site/
  index.html
  styles.css
  main.js
  404.html
  robots.txt
  sitemap.xml
  assets/
    shots/
      hero-1440.webp
      hero-900.webp
      pipeline.webp
      deal.webp
      inbox.webp
      campaigns.webp
      compose.webp
      insights.webp
      calendar.webp
      projects.webp
      mobile.webp
    brand/
      dealflow-logo-horizontal.svg
      dealflow-logo-stacked-reverse.svg
      favicon.svg
      favicon.ico
      apple-touch-icon-180x180.png
      og-image.png
      x-card.png
    fonts/
      Inter-Variable.woff2
  tools/
    optimize-images.mjs
    check.mjs
  BUILD-NOTES.md
```

Every URL in the site is relative (`./assets/...`, `#install`, `./404.html`), so it works under `/dealflow/` on GitHub Pages and on a custom domain later.

`404.html` uses the same header and footer as the home page, says `This page doesn't exist.` and links home. `robots.txt` allows everything and points at the sitemap. `sitemap.xml` lists the home page at `https://itchyparrot53.github.io/dealflow/`.

## 2. The visual direction: "soft daylight, green and indigo"

The Dealflow product is an indigo rail, green actions and calm light surfaces. The site should feel like a quiet, organised desk: warm paper, pale mint, deep indigo ink and one saturated green accent.

- **Grounds:** large fields of paper and pale mint, lit from the upper left, with soft diagonal window-light shapes and a hint of cool lilac for alternating bands.
- **Surfaces:** frosted white glass panels with a bright top edge, slight translucency and long, soft indigo-tinted shadows.
- **Text:** deep indigo headings, near-black ink body, cool grey secondary text.
- **Accent:** Dealflow green is the only saturated colour. It is used for primary buttons, links, small highlights and the active tab. Indigo is the structural colour: headings, the footer and the closing CTA.
- **Mood:** calm, warm and a little premium. A studio, not a startup billboard.
- **Rules:**
  - no pink, no neon, no purple-blue gradients;
  - no emoji;
  - no stock illustrations;
  - no fake dashboards or browser chrome; only the real screenshots and the small HTML/SVG diagrams specified below.
- **Theme:** light only, deliberately. Set `color-scheme: light` and give every surface an explicit background.

### 2.1 Design tokens: put this block at the top of `styles.css` exactly

```css
:root {
  /* brand */
  --green: #2d8548;         /* Dealflow Green: primary buttons, active tab */
  --green-hover: #236b39;
  --green-press: #1d5a30;
  --green-ink: #236b39;     /* green text on paper, 6.1:1 */
  --green-light: #58cc85;   /* decorative only, never small text */
  --mint: #eef8f1;          /* pale green fills */
  --mint-strong: #dcebe1;
  --indigo: #211c52;        /* headings, dark panels */
  --indigo-soft: #2e2870;
  --ink: #21232c;           /* body text */
  --muted: #55585f;         /* secondary text, 6.3:1 on --paper */
  --faint: #8b8e96;         /* decorative only, never text */
  --line: rgba(33, 28, 82, 0.10);
  /* grounds */
  --paper: #fbfcfa;         /* page base */
  --mist: #f4f8f5;          /* lightest green-grey */
  --sage: #e6f1e9;          /* mid green-grey */
  --lilac: #f4f3fb;         /* cool alternate band */
  --white: #ffffff;
  --night: #171426;         /* code blocks only */
  /* glass */
  --glass: rgba(255, 255, 255, 0.64);
  --glass-strong: rgba(255, 255, 255, 0.84);
  --glass-edge: rgba(255, 255, 255, 0.80);
  --glass-blur: 18px;
  --shadow-soft: 0 1px 0 rgba(255, 255, 255, 0.9) inset, 0 30px 60px -30px rgba(33, 28, 82, 0.24), 0 2px 8px rgba(33, 28, 82, 0.06);
  --shadow-lift: 0 1px 0 rgba(255, 255, 255, 0.9) inset, 0 40px 80px -32px rgba(45, 133, 72, 0.22), 0 4px 14px rgba(33, 28, 82, 0.08);
  /* type */
  --font-display: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-body: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", "Cascadia Code", Menlo, Consolas, monospace;
  /* scale */
  --r-panel: 28px; --r-card: 20px; --r-control: 12px; --r-pill: 999px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px;
  --space-6: 32px; --space-7: 48px; --space-8: 72px; --space-9: 112px;
  --content: 1160px;
  --gutter: max(20px, env(safe-area-inset-left, 0px));
  color-scheme: light;
}
```

### 2.2 Fonts

- Self-host Inter with `@font-face` and `font-display: swap`.
- Copy `website/public/assets/fonts/inter-latin-var.woff2` to `site/assets/fonts/Inter-Variable.woff2`.
- Declare weights `100 900`.
- Preload the font in `<head>`.
- No Google Fonts, no CDN and no second display face.

| Role | Size (clamp) | Line height | Weight | Letter spacing |
| --- | --- | --- | --- | --- |
| H1 | `clamp(40px, 5.4vw, 74px)` | 1.03 | 800 | -0.03em |
| H2 | `clamp(30px, 3.6vw, 46px)` | 1.08 | 750 | -0.025em |
| H3 | 21px | 1.25 | 700 | -0.01em |
| Lead | `clamp(18px, 1.6vw, 21px)` | 1.55 | 400 | 0 |
| Body | 17px | 1.6 | 400 | 0 |
| Small / meta | 14px | 1.5 | 500 | 0 |
| Badge | 13px | 1 | 600 | 0.01em |
| Code | 14px | 1.6 | 400 | 0 |

- Use sentence case everywhere. Never set headings in all caps.
- Give headings `text-wrap: balance` and keep paragraphs to `max-width: 62ch`.
- Use tabular figures for numbers.

### 2.3 The background and light

- **`body`:** `var(--paper)` with two fixed radial washes:
  - `radial-gradient(1100px 700px at 8% -10%, rgba(45, 133, 72, 0.10), transparent 60%)`;
  - `radial-gradient(900px 600px at 100% 20%, rgba(33, 28, 82, 0.07), transparent 70%)`.

  Both sit under `linear-gradient(180deg, var(--mist), var(--paper) 40%, var(--paper))`.
- **Window light:** a decorative `.light` element (`aria-hidden="true"`, `pointer-events: none`) holds three tall, soft, translucent white parallelograms. Draw them with `linear-gradient` plus `filter: blur(28px)`, at opacity 0.30 to 0.45, rotated -22deg, so they look like the window light in a quiet studio. Use it only in three places: behind the hero, behind the "Your CRM, on your hardware" section and behind the final CTA.
- **Floor fade:** sections alternate between plain `--paper`, a soft `linear-gradient(180deg, transparent, rgba(238, 248, 241, 0.65), transparent)` band, and `--lilac` for one band. Do not use hard section borders.

### 2.4 Components

- **Glass panel** (`.glass`):
  - background `var(--glass)`, `backdrop-filter: blur(var(--glass-blur)) saturate(140%)` (also `-webkit-` prefixed);
  - `border: 1px solid var(--glass-edge)`, `border-radius: var(--r-panel)`, `box-shadow: var(--shadow-soft)`;
  - a `::before` 1px top highlight: `linear-gradient(90deg, transparent, #fff, transparent)` at opacity 0.9;
  - if `@supports not (backdrop-filter: blur(1px))`, use background `var(--glass-strong)`.
- **Card** (`.card`): a glass panel with `border-radius: var(--r-card)` and padding `var(--space-5)`. On hover, only cards that are links lift by 2px and switch to `--shadow-lift` over 200ms. Cards that are not links do not lift.
- **Buttons:**
  - **Primary** (`.btn-primary`):
    - background `var(--green)`, text `#fff`, weight 600, 16px;
    - padding 14px 22px, radius `var(--r-pill)`;
    - shadow `0 10px 24px -10px rgba(45, 133, 72, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.35)`;
    - hover `var(--green-hover)`, active `var(--green-press)`.
  - **Secondary** (`.btn-glass`): glass background, indigo text, a 1px `var(--line)` border and the same size.
  - Both are at least 44px tall.
  - **Icons:** the GitHub icon (inline SVG path, 18px) appears only on GitHub buttons. No other icons go inside buttons.
- **Badge** (`.badge`): a pill with glass background, indigo text at 13px/600 and padding 6px 12px. An optional 8px `var(--green)` dot sits in front.
- **Code block** (`.code`):
  - background `var(--night)`, text `#f4eef5`, radius `var(--r-card)`, padding 20px 22px, mono 14px;
  - horizontal scroll inside the block, never on the page;
  - a "Copy" button top-right (glass on dark: `rgba(255, 255, 255, 0.08)`, white text). Clicking it copies the commands without the `$ ` prompts and shows "Copied" for 1.5s;
  - prompt characters (`$`) at 45% opacity and not selectable (`user-select: none`);
  - comments in `#9fb3a6`.
- **Screenshot frame** (`.shot`):
  - a glass panel with radius 22px and 10px padding; the image inside has radius 14px and a 1px `var(--line)` border;
  - no fake window chrome, no traffic-light dots and no browser bar;
  - every image has `width` and `height` attributes, `loading="lazy"` (except the hero and the first tour image) and `decoding="async"`.
- **Focus:** every interactive element gets `outline: 2px solid var(--indigo); outline-offset: 3px` on `:focus-visible`. On the indigo closing panel, use `outline-color: #fff`.
- **Motion:**
  - entrance only: elements with `.reveal` rise 12px over 500ms `cubic-bezier(.2,.7,.2,1)` when they enter the viewport, using IntersectionObserver;
  - they are visible at rest (start at `opacity: 1` and animate only `transform`), so nothing is hidden if JS fails;
  - turn all motion off under `prefers-reduced-motion: reduce`;
  - no parallax and no auto-playing carousels.

## 3. Layout

- **Container:** `width: min(var(--content), 100% - 2 * var(--gutter)); margin-inline: auto`.
- **Section padding:** `var(--space-9)` top and bottom on desktop, `var(--space-8)` below 900px, `var(--space-7)` below 600px.
- **Section heads:** a section head (optional badge, then H2, then lead paragraph) is centred, with a max width of 760px, unless a section below says left-aligned.
- **Breakpoints:** 1100, 900, 600. Test at 1440, 1024, 768, 390 and 360 widths. The page never scrolls horizontally.
- **Grid:** use CSS grid with `minmax(0, 1fr)` tracks so long code and screenshots cannot force the page wider.

## 4. Page structure, copy and layout (in this order)

All copy below is final. Use it word for word. `{stars}` comes from section 6.3.

### 4.0 `<head>`

- **Title:** `Dealflow: the business-development CRM you run yourself`
- **Meta description:** `Dealflow is an open-source, self-hosted CRM for business development: pipeline, deals, contacts, two-way email, campaigns, projects and optional AI on your own server. MIT licensed.`
- **Canonical:** `https://itchyparrot53.github.io/dealflow/`
- **Open Graph and Twitter cards:**
  - title `Dealflow`;
  - description `The business-development CRM you run yourself.`;
  - image `https://itchyparrot53.github.io/dealflow/assets/brand/og-image.png` (absolute URL);
  - `og:image:width` 1200, `og:image:height` 630, `og:image:alt` `The Dealflow logo on an indigo background`;
  - `twitter:card` = `summary_large_image`;
  - `twitter:image` = `https://itchyparrot53.github.io/dealflow/assets/brand/x-card.png`.
- **Favicons:**
  - `./assets/brand/favicon.svg` (`type="image/svg+xml"`);
  - `./assets/brand/favicon.ico` as a fallback;
  - `./assets/brand/apple-touch-icon-180x180.png`.
- **Theme colour:** `<meta name="theme-color" content="#211c52">`.
- **JSON-LD:** a `SoftwareApplication` with:
  - name `Dealflow`, applicationCategory `BusinessApplication`, operatingSystem `Linux, Docker`;
  - description matching the meta description;
  - license `https://opensource.org/licenses/MIT`;
  - offers price `0`, priceCurrency `GBP`;
  - codeRepository `https://github.com/itchyparrot53/dealflow`.
- **Skip link:** "Skip to content", visible on focus.

### 4.1 Header (sticky)

- A sticky glass bar, 64px tall, `top: env(safe-area-inset-top, 0px)`. The glass becomes stronger (`--glass-strong`) once the page scrolls past 24px.
- **Left:** the horizontal colour logo (`./assets/brand/dealflow-logo-horizontal.svg`, 28px tall), linking to `#top`.
- **Centre links (16px, 500, ink):** Features (`#features`), Email (`#email`), Self-host (`#self-host`), Docs (`https://github.com/itchyparrot53/dealflow/blob/main/docs/user-guide/index.md`).
- **Right:**
  - a GitHub button (`.btn-glass`, small: 36px tall, 14px text): GitHub icon + "Star" + a count pill showing `{stars}` (hidden until loaded); it links to the repo;
  - a primary small button "Get started" going to `#install`.
- **Below 900px:** the centre links collapse into a "Menu" button that opens a full-width glass sheet under the bar. It has the four links stacked at 20px and both buttons, closes on Escape, on link click and on outside tap, and traps focus while open.

### 4.2 Hero (`#top`)

**Desktop:** a single copy block, max width 780px, left-aligned, followed by a full-width screenshot. The screenshot is the hero visual; do not split the hero into two columns.

**Copy block, left-aligned:**
1. **Badge:** green dot + `Open source · MIT · Self-hosted`.
2. **H1:** `Your pipeline, on your own server.`
3. **Lead:** `Dealflow is a self-hosted CRM for business development: pipeline, deals, contacts, two-way email and campaigns, on your own Postgres and your own domain. No per-seat bill.`
4. **Buttons:** primary "Get started" going to `#install`; glass "View on GitHub" with the GitHub icon going to the repo.
5. **Install chip:** a one-line code chip (night background, 14px mono, a copy icon button with aria-label "Copy install command") showing `$ git clone https://github.com/itchyparrot53/dealflow.git`. On narrow screens it scrolls inside itself.
6. **Small muted line:** `Runs on Docker Compose. Not affiliated with Pipedrive.`

**Screenshot:** a `.shot` frame, max width 1100px, margin-top 48px, centred, containing the real pipeline screenshot:
- `./assets/shots/hero-1440.webp` with `srcset` for `hero-900.webp` at 900w and `hero-1440.webp` at 1440w;
- `sizes="(max-width: 900px) 100vw, 1100px"`;
- `width="1440" height="900"`, `fetchpriority="high"`, no lazy loading;
- alt `The Dealflow pipeline board with custom stages, weighted totals and deal cards`.

The frame sits on a soft mint radial glow. Do not add fake browser chrome. Do not use a second hero image.

**Below 900px:** the copy block is full width; the screenshot is full width; the buttons wrap.
**Below 600px:** both buttons are full width, the install chip scrolls inside itself, and the hero has no large side padding.

### 4.3 Facts strip

Four facts in a single glass panel. On desktop they sit in a row of four divided by 1px `var(--line)` vertical rules; below 900px it is a 2x2 grid; below 600px it is 2x2 at a smaller size. Each fact is a number or short term in display 34px/800 indigo, with a 14px muted label under it:

| Big | Label |
| --- | --- |
| 1 Compose file | App, WebSocket, worker, Postgres and MinIO |
| 1 database | Postgres for records, MinIO for files |
| 0 per-seat fees | MIT licensed, no hosted tier |
| Your mailboxes | Gmail or any IMAP/SMTP account |

### 4.4 Product tour (`#features`)

- **Head:** badge `See it`, H2 `Everything the deal touches, in one place.`, lead `The pipeline, the deal workspace, the inbox, campaigns and reports share the same records and the same permission model.`
- **Tabs:** a row of pill tabs (`role="tablist"`, arrow keys move between them, the selected tab is green with white text, the others glass). The row scrolls horizontally inside itself on mobile.
- **Panels:** a `.shot` frame showing the screenshot, with a one-line caption below it (16px muted, centred). Clicking a tab crossfades the panels (150ms; instant with reduced motion). The panels are in the HTML from the start (not injected), so the page works without JS: without JS, show all panels stacked.

| Tab | Screenshot | Caption |
| --- | --- | --- |
| Pipeline | `pipeline.webp` | Custom stages, weighted totals and every deal in one board. |
| Deal | `deal.webp` | Activities, notes, files, email and change history on one timeline. |
| Inbox | `inbox.webp` | Two-way email, linked to the person and the deal. |
| Campaigns | `campaigns.webp` | A block builder, segments, consent and reports. |
| Reports | `insights.webp` | Reports and dashboards over deals and activities. |
| Activities | `calendar.webp` | A week and month calendar for calls, meetings and tasks. |
| Projects | `projects.webp` | Phases and tasks, startable from a won deal. |

### 4.5 Feature grid

- **Head:** H2 `Built for the whole deal.`, with no lead.
- **Grid:** 4 columns at 1100px and above, 2 columns at 600px and above, 1 below.
- **Cards:** each `.card` has a 40px rounded square (radius 12) with a pale mint fill (`var(--mint)` and a 1px `var(--mint-strong)` border) holding a 20px line icon in `var(--green)` (inline SVG, Lucide style: 2px stroke, round caps), then an H3 and a 15px muted paragraph. Use these Lucide shapes: table, layout-panel-left, users, mail, send, file-text, bar-chart-3, shield-check.

| Icon | H3 | Text |
| --- | --- | --- |
| table | Pipeline that fits the work | Multiple pipelines, custom stages, weighted totals, rotting flags, saved filters and board, list and archive views. |
| layout-panel-left | A workspace, not a record | Activities, notes, files, email and change history on one timeline. Participants, followers, labels, lost reasons and close dates. |
| users | Contacts and leads | People and organizations with custom fields, relationships, a shared timeline, duplicate merge, a leads inbox, public forms and booking pages. |
| mail | Two-way email | Gmail over OAuth or any IMAP/SMTP mailbox. Shared threads, templates, signatures, merge fields and scheduled send. |
| send | Campaigns with consent | Double opt-in, suppression, sequences, throttled sending and open, click and bounce tracking. |
| file-text | Quotes and invoices | Product lines snapshot on issue, a public link for the customer, quote acceptance, recorded invoice payments and an overdue job. |
| bar-chart-3 | Reports and forecast | Reports, dashboards, goals, a forecast board and totals in your base currency. |
| shield-check | Admin that holds | Roles, permission sets, visibility groups, audit log, recycle bin, backups and API tokens. |

### 4.6 Email and campaigns (`#email`)

**Layout:** two columns at 1.05fr and 1fr, text on the left and left-aligned; they stack below 900px.

**Left column:**
- Badge `Email and campaigns`.
- H2 `The inbox is part of the deal.`
- Lead: `Connect Gmail or any IMAP/SMTP mailbox. Replies thread to the person and the deal, and campaigns use the same consent and suppression rules.`
- A list of three short checks, each with an 18px green tick icon:
  - `Gmail OAuth or any IMAP/SMTP mailbox, with Purelymail as a preset`
  - `Templates, signatures, merge fields and scheduled send`
  - `Campaigns with double opt-in, sequences and bounce handling`
- A glass button: "Read the email guide" going to `https://github.com/itchyparrot53/dealflow/blob/main/docs/user-guide/email.md`.

**Right column:** an HTML/CSS illustration, not a screenshot. It is a vertical stack of six glass step chips joined by a 2px dashed `var(--mint-strong)` connector line on the left, with a small green dot at each joint. Each chip has a 13px muted label and a 15px ink line:

1. Inbound: `A reply lands in the shared inbox.`
2. Link: `The thread attaches to the person and the deal.`
3. Thread: `In-Reply-To and References keep the conversation together.`
4. Campaign: `The same contact joins a segment; consent and suppression are re-checked.`
5. Track: `Opens, clicks and bounces land on the timeline.`
6. Notify: `The owner is notified, not buried in another dashboard.`

The first chip has a green 2px border. Below the stack, a small muted line reads `Example flow`. Below it, inside a `.shot`, show `compose.webp` at 100% of the column width, alt `The Dealflow email composer with a template and merge fields`.

### 4.7 AI you control

- **Head:** badge `Optional AI`, H2 `AI with a bill you control.`, lead `Dealflow works without AI. Add an OpenRouter key and set a company cap, plus an optional per-user cap.`
- **Layout:** three cards in a row (stacked below 900px), then a wide budget mock below them.

| H3 | Text |
| --- | --- |
| Your key, your model | Connect OpenRouter and choose the model. The default is DeepSeek v4.1 Flash. No key means no AI, and nothing leaves your server. |
| Caps that hold | A company monthly token cap and an optional per-user cap. Every call is logged, and calls over a cap are refused. |
| Access-aware answers | The assistant uses MCP tools, sees only what the user can see, and asks before it writes. |

**Budget mock** (HTML/CSS, `aria-label="Example AI usage"`): a glass panel with a header row ("AI usage this month" left; `$6.40 of $25.00` right in display 22px). Under it is a 10px rounded track (`var(--sage)`) with a green fill at 26%. Then three rows, each with a name, a small track and an amount:

- `Demo Rep Bianca` with `$2.10 of $5.00` (42%);
- `Demo Rep Chen` with `$1.30 of $5.00` (26%);
- `Demo Rep Esra` with `$3.00 of $5.00` (60%).

A footnote reads `Example figures`. Link line: `How AI is configured` going to `https://github.com/itchyparrot53/dealflow/blob/main/docs/deploy.md`.

### 4.8 Your CRM, on your hardware (`#self-host`)

- **Head:** badge `Self-hosted`, H2 `Your CRM, on your hardware.`, lead `One Compose stack: the app, a WebSocket server, a worker, Postgres and MinIO. Your records and files stay in your database and your bucket.`
- **Layout:** two columns at 1fr and 1fr, stacking below 900px.

**Left column: the architecture diagram.** Build it as inline SVG inside a glass panel. Every colour comes from the tokens (via CSS classes on the SVG elements), and the text uses the body font at 14 to 16px. It reads top to bottom:

1. A box `Your browser or phone`.
2. An arrow labelled `HTTPS`.
3. A box `Your reverse proxy` with the note `TLS`.
4. A large box `Dealflow Compose stack` (green 2px border, `var(--mint)` fill), containing five small boxes: `App`, `WebSocket`, `Worker`, `Postgres`, `MinIO`. Put App, WebSocket and Worker in a row, with Postgres and MinIO in a row underneath.
5. A side column of five small dashed boxes, labelled `optional`, joined by dashed lines to the stack: `Gmail / IMAP`, `SMTP`, `OpenRouter`, `Webhooks`, `Google SSO`.

The SVG has `role="img"` and the aria-label `Dealflow runs as a Docker Compose stack with Postgres and MinIO; Gmail, SMTP, OpenRouter, webhooks and Google SSO are optional connections`. It scales to the column width.

**Right column: install (`#install`).**
- H3 `Install in a few minutes`.
- A code block:

  ```text
  $ git clone https://github.com/itchyparrot53/dealflow.git
  $ cd dealflow
  $ cp .env.example .env
  $ # set BASE_URL, NEXT_PUBLIC_WS_URL, MINIO_ENDPOINT,
  $ # SEED_ADMIN_EMAIL and the generated secrets
  $ docker compose up -d --build
  ```

- Paragraph: `Open http://localhost:3000. With SMTP unset, the sign-in link prints in the app log. On a fresh box, mint the first admin setup link:`
- A one-line code chip: `$ docker compose exec app node dist/bootstrap-link.mjs`.
- H3 `What you need`, then a list:
  - `Docker Engine with the Compose plugin`
  - `A domain, and a second s3. hostname for storage`
  - `A reverse proxy for HTTPS, such as Caddy`
  - `Optionally, an SMTP account and an OpenRouter key`
- Three glass link buttons, small, in one row that wraps:
  - "Deployment guide" going to `https://github.com/itchyparrot53/dealflow/blob/main/docs/deploy.md`;
  - "Reverse proxy" going to `https://github.com/itchyparrot53/dealflow/blob/main/docs/reverse-proxy.md`;
  - "Operator guide" going to `https://github.com/itchyparrot53/dealflow/blob/main/docs/user-guide/self-hosting.md`.

**Under both columns:** a full-width comparison glass panel titled H3 `What it takes to run`. It is a 3-column table (the first column is row labels) with a header row of empty, `Dealflow`, and `Typical SaaS CRM`. The Dealflow column is highlighted with a `var(--mint)` background and a green header.

| | Dealflow | Typical SaaS CRM |
| --- | --- | --- |
| Where it runs | Your server, one Compose file | The vendor's cloud |
| Data | Postgres and MinIO, on your disk | The vendor's database |
| Pricing | MIT, no per-seat fee | Per seat, per month |
| Email and campaigns | Included, your mailboxes | Add-ons or separate tools |
| AI | Optional, your key, capped | Bundled or metered |
| Exit | Database dump and files | Export tools vary |

On mobile, the table scrolls inside its panel.

### 4.9 Your data, your rules

- **Head:** H2 `Your data, your rules.`, lead `No telemetry by default and no account with us. The outbound calls are the ones you configure.`
- **Grid:** 3 columns of compact rows (2 columns on tablet, 1 on mobile). Each row has a 20px green line icon, a bold 16px title and 15px muted text:

| Title | Text |
| --- | --- |
| Permissions checked on the server | Deals, contacts, email, campaigns, reports and AI answers respect the same visibility rules. |
| Visibility groups and teams | Decide who sees which records, with permission sets for what they can do. |
| Sign-in your way | Email and password, single-use email links, and Google Workspace SSO when configured. |
| Audit log | Permission changes, users, groups, pipeline access and settings, with filters. |
| Backups you can test | Daily archives, a restore CLI and a 30-day recycle bin. |
| Health you can watch | A health endpoint for your monitoring, plus a smoke test that boots the Compose stack. |

Use Lucide shapes: lock, users, key-round, scroll-text, database-backup, activity.

### 4.10 On your phone

**Layout:** two columns; the phone is on the right on desktop and on top on mobile.

**Left column:**
- Badge `Mobile`.
- H2 `Install it like an app.`
- Lead `Dealflow installs as a PWA with offline snapshots, web push and mobile layouts for the screens people use on a phone.`
- Three checks:
  - `Offline snapshots of the records you opened`
  - `Web push for notifications`
  - `A bottom navigation below 768px`

**Right column:** `mobile.webp` inside a CSS phone frame. The frame is a rounded rectangle (radius 44px) with an 8px `var(--indigo)` border and an inner radius of 36px, and no notch drawing. It is 300px wide, sits on a soft green glow (`radial-gradient` of `var(--green-light)` at low opacity), and is tilted -4deg on desktop and level on mobile. Alt: `Dealflow on a phone: the pipeline board in a mobile layout`.

### 4.11 Built in the open

- **Head:** badge `Open source`, H2 `Built in the open.`, lead `MIT licensed and developed on GitHub. Read every line, run it anywhere, and help shape what comes next.`
- **Stat cards:** a row of 3 glass stat cards (stacked on mobile):
  - `{stars}` with the label `GitHub stars` (fallback `Star on GitHub`);
  - `MIT` with the label `Licence`;
  - `5` with the label `Long-running services in one Compose file`.
- **Link cards:** a row of 4 link cards, each a whole clickable card with an H3 and a short line:
  - "User guide" with `Task-by-task help for the team` going to `https://github.com/itchyparrot53/dealflow/blob/main/docs/user-guide/index.md`;
  - "Deploy" with `Install, environment and upgrades` going to `https://github.com/itchyparrot53/dealflow/blob/main/docs/deploy.md`;
  - "REST API" with `Tokens, scopes and endpoints` going to `https://github.com/itchyparrot53/dealflow/blob/main/docs/API.md`;
  - "GitHub" with `Source, issues and releases` going to the repo.
- **Status note:** a glass note with a 4px green left edge inside the panel padding (not a coloured card border):

  > `Dealflow runs one company's business development in production and is actively developed. It is single-company by design: back up your data and pin a release before upgrading.`

### 4.12 FAQ

- **Head:** H2 `Questions, answered.`
- **List:** a single column with a max width of 820px. Use native `<details>` and `<summary>` items in glass panels with radius 16, a 1px line between items and a green chevron that rotates on open. One item opens at a time. Each item keeps its `id` (from the question) for linking.

| Question | Answer |
| --- | --- |
| Is Dealflow free? | Yes. It is MIT licensed, with no paid tier and no per-seat fee. |
| Is there a hosted version? | No. Dealflow runs on your server. There is no Dealflow cloud and no account to create with us. |
| Is it multi-tenant? | No. One install serves one company. If you need separate companies, run separate instances. |
| What does it need to run? | Docker Engine with the Compose plugin, a domain and a second s3. hostname for storage, and a reverse proxy for HTTPS. Postgres and MinIO run in the Compose stack. |
| Do I need AI? | No. Without an OpenRouter key every AI surface is unavailable and nothing leaves your server. With a key, you set a company cap and an optional per-user cap. |
| How does email work? | Connect Gmail through Google OAuth, or any IMAP/SMTP mailbox with an app password. Campaigns use a separate sending account when you configure one, and fall back to your system SMTP. |
| Can I import from Pipedrive? | Contacts and leads can come in by CSV, and the REST API can write deals and other records. There is no one-click Pipedrive migration. |
| How do backups work? | The worker writes a daily archive with the database dump, stored files and a manifest. Restore from the CLI with the app stopped, and deleted records sit in a 30-day recycle bin. |
| Is it ready for production? | Dealflow runs a real business-development workflow in production and is actively developed. Back up your data and pin a release before upgrading. |
| Does it support SSO? | Google Workspace SSO when its three environment variables are set. Email and password and single-use email links work without Google. |
| Is Dealflow affiliated with Pipedrive? | No. Dealflow is an independent open-source project and is not affiliated with, endorsed by or connected to Pipedrive. |

### 4.13 Final CTA

- **Panel:** a large indigo panel (radius 32, padding 64px desktop and 32px mobile), centred, with a soft green radial glow behind it and the reverse stacked logo (`./assets/brand/dealflow-logo-stacked-reverse.svg`, 96px tall) at the top.
- **H2:** `Your pipeline. Your server. Your data.`
- **Lead:** `Run it on your own box.`
- **Buttons:** primary "Get started" going to `#install`; glass outline "Star on GitHub" with the icon and `{stars}`.

The closing panel is the only dark section. It is not dark mode.

### 4.14 Footer

- **Background:** `var(--paper)` with a 1px top line.
- **Left:** the horizontal colour logo, 24px tall, with the muted 14px line `The business-development CRM you run yourself.` and `No cookies. No tracking.` under it.
- **Columns (14px; titles 600 indigo, links muted, turning indigo on hover):**
  - **Product:** Features (`#features`), Email (`#email`), Self-host (`#self-host`), Docs (`docs/user-guide/index.md`).
  - **Resources:** Deployment (`docs/deploy.md`), API (`docs/API.md`), Backups (`docs/dealflow/BACKUPS.md`), Upstream (`docs/dealflow/UPSTREAM.md`).
  - **Community:** GitHub (repo), Issues (repo `/issues`), Releases (repo `/releases`), Contributing (`CLAUDE.md`).
- **Bottom row:**
  - left: `© 2026 Dealflow contributors · MIT licence`;
  - right: `Not affiliated with Pipedrive.`

All footer doc links go to `https://github.com/itchyparrot53/dealflow/blob/main/...`.

## 5. Copy rules (for any small text this brief does not list)

- Sentence case; plain, warm and specific; "you" for the reader.
- No exclamation marks and no emoji.
- Do not use these words: revolutionary, seamless, supercharge, unleash, game-changing, blazing.
- "Dealflow" with a capital D in sentences. The logo is an image, so its lettering stays as drawn.
- Write "Pipedrive" only in the non-affiliation lines and the migration FAQ. Do not name any other product or competitor. Dealflow is a CRM for business development.
- No "one container", "one SQLite file" or "single binary". Dealflow is a Docker Compose stack with Postgres and MinIO.
- No "public beta". The project runs a real workflow in production.
- No invented numbers. The structural counts in the facts strip (1 Compose file, 1 database, 0 per-seat fees, 5 long-running services) are allowed, and the AI amounts are examples marked "Example figures".
- Use "self-hosted" and "single-company" accurately.
- Use "Docker Compose", "Postgres", "MinIO", "OpenRouter" and "DeepSeek v4.1 Flash" with those spellings.

## 6. Behaviour (`main.js`, under 200 lines, no dependencies)

1. **Sticky header:** the scroll state class and the mobile menu. The menu is accessible: `aria-expanded`, `aria-controls`, a focus trap, Escape to close and focus returning to the button.
2. **Tabs:** the product-tour tabs follow the WAI-ARIA tabs pattern. The FAQ opens one item at a time.
3. **GitHub data:**
   - fetch `https://api.github.com/repos/itchyparrot53/dealflow` for `stargazers_count`;
   - cache it in `localStorage` for one hour, wrapping every read and write in try/catch;
   - format stars as `1.2k` above 999;
   - on any failure, keep the fallback text; never show "0" or an error;
   - fill every `[data-stars]` element.
4. **Copy buttons:** use `navigator.clipboard.writeText`. If that fails, select the text. Show "Copied" for 1.5s and announce it via an `aria-live="polite"` region.
5. **Reveal:** IntersectionObserver adds `.in` to `.reveal` elements. Do nothing under reduced motion.
6. **Without JS:** the page still reads fully. All content is in the HTML. Tabs fall back to stacked panels via a `.no-js` class that the script removes. The header links and both buttons stay visible in a static row, and the Menu button is hidden.

## 7. Images

- **`site/tools/optimize-images.mjs`** (run with `node`). Use `sharp`. It is already in the lockfile as a transitive package; add it as a devDependency if a direct import is not available. This is the only permitted package change.
  - Write the outputs listed below into `site/assets/shots/`.
  - Use quality 82 for the hero, 80 for the rest, and never upscale.
  - Keep the originals in place; do not delete anything in `docs/`.
  - Record the output file sizes in BUILD-NOTES.md.

| Source | Output |
| --- | --- |
| `docs/user-guide/images/board.png` | `hero-1440.webp`, `hero-900.webp` (hero, quality 82) |
| `docs/screenshots/pipeline.png` | `pipeline.webp` |
| `docs/screenshots/deal-workspace.png` | `deal.webp` |
| `docs/screenshots/inbox.png` | `inbox.webp` |
| `docs/screenshots/campaigns.png` | `campaigns.webp` |
| `docs/user-guide/images/compose.png` | `compose.webp` |
| `docs/user-guide/images/insights-dashboard.png` | `insights.webp` |
| `docs/user-guide/images/calendar.png` | `calendar.webp` |
| `docs/user-guide/images/projects.png` | `projects.webp` |
| `docs/user-guide/images/mobile-board.png` | `mobile.webp` |

- **Brand files to copy into `site/assets/brand/`:**
  - `brand/svg/logo-horizontal/dealflow-logo-horizontal-colour.svg` to `dealflow-logo-horizontal.svg`;
  - `brand/svg/logo-stacked/dealflow-logo-stacked-reverse.svg` to `dealflow-logo-stacked-reverse.svg`;
  - `brand/app-icons/icon.svg` to `favicon.svg`;
  - `brand/app-icons/favicon.ico` to `favicon.ico`;
  - `brand/app-icons/apple-touch-icon.png` to `apple-touch-icon-180x180.png`;
  - `website/public/assets/og-image.png` to `og-image.png`;
  - `website/public/assets/x-card.png` to `x-card.png`.

- **Font:** copy `website/public/assets/fonts/inter-latin-var.woff2` to `site/assets/fonts/Inter-Variable.woff2`.

- Never recolour, crop or redraw a logo. Never use a screenshot that is not in the source list. Do not use the same screenshot twice on the page without a reason; the hero uses `board.png` and the tour uses `pipeline.png`, so they are different boards.
- **Alt text:** every screenshot's alt text describes what it shows. Use the tour captions as the basis. Decorative elements get `aria-hidden="true"` or `alt=""`.

## 8. Deploy

`.github/workflows/pages.yml`:

- on `push` to `main` with `paths: ['site/**']`, plus `workflow_dispatch`;
- permissions `pages: write`, `id-token: write`, `contents: read`;
- steps:
  1. `actions/checkout@v4`;
  2. `actions/configure-pages@v5`;
  3. `actions/upload-pages-artifact@v3` with `path: site`;
  4. `actions/deploy-pages@v4`;
- a `deploy` job with `environment: github-pages` and `url: ${{ steps.deployment.outputs.page_url }}`.

Add `site/tools/screens/` to `.gitignore`. Do not change the rest of `.gitignore`.

Write an owner note in BUILD-NOTES.md: "Enable GitHub Pages: Settings > Pages > Source: GitHub Actions."

The root README line goes directly under the badge row, before the hero screenshot:

`**Website:** https://itchyparrot53.github.io/dealflow/`

## 9. Acceptance checks (all must pass; record the results in BUILD-NOTES.md)

1. **Local serve:** `npx --yes serve site -l 4173` serves the page with no console errors.
2. **Playwright script** (`site/tools/check.mjs`; use the repo's Playwright, Chromium only):
   - at 1440, 1024, 768, 390 and 360 widths: no horizontal scroll (`scrollWidth <= innerWidth`) and full-page screenshots saved to `site/tools/screens/` (git-ignored);
   - `@axe-core/playwright` reports zero serious or critical violations;
   - every internal anchor resolves to an element;
   - every `./assets/` reference returns 200;
   - the tabs work by keyboard;
   - the mobile menu opens, closes on Escape and returns focus to the button.
3. **Contrast:** every text/background pair in this brief meets 4.5:1 (3:1 for 24px and above). Check white button text on `--green`, muted text on glass over `--sage`, and the code block. If a glass surface over a busy background drops below that, increase that panel's background opacity (and only that panel's).
4. **Weight:** the total page weight on first load at 1440 is under 1.5 MB (the hero `srcset` keeps desktop at the 1440 image), and Lighthouse (if `npx lighthouse` can run) scores at least 95 for performance, accessibility, best practices and SEO. Record the scores, or why it could not run.
5. **Content:**
   - no lorem ipsum;
   - no invented numbers beyond the structural counts in section 4.3 and the example figures marked "Example";
   - every external link uses `https://github.com/itchyparrot53/dealflow/...` and opens in the same tab;
   - `rel="noopener"` only on any `target="_blank"` link (there should be none).
6. **Without JS:** with JS disabled, every section is readable and the install commands are visible.

## 10. Don'ts

- No frameworks, Tailwind, CDNs, Google Fonts links, analytics, cookies, cookie banners or third-party embeds.
- No customer logos, testimonials, "trusted by" rows, user counts or download counts. Do not fake proof.
- No dark mode, no auto-playing animation and no parallax.
- No emoji, no all-caps eyebrows and no cards with coloured left borders (the single status note in section 4.11 is the only allowed edge accent).
- Do not claim one container, one SQLite file, no database or no object storage. Dealflow runs as a Compose stack with Postgres and MinIO.
- Do not claim a hosted tier, a free cloud plan or a multi-tenant mode.
- Do not use pink or a pink-glass direction, and do not write generic work-OS copy about boards, docs, dashboards and automations.
- Do not change anything outside `site/`, `.github/workflows/pages.yml`, `.gitignore`, the one README line, and the optional `sharp` devDependency.
- Do not modify `website/`, the app source, `docs/`, the existing CI workflows or the Docker files.
- Do not use a screenshot that is not in section 7, and do not make a fake dashboard.
