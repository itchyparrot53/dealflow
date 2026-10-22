# Brand rollout report (2026-10-22)

The Dealflow brand kit at `brand/` is now the source of every app icon, in-app logo, system email
header and social preview. The kit itself was added unchanged and is never edited. No dependency was
added or changed. Every step is its own commit (`brand: 1` to `brand: 8`).

## Decisions

- **Rail link.** The brief says the rail brand cell links to `/` "as today". The old cell linked to
  `/pipeline`. The cell now links to `/`; the root page redirects to `/pipeline`, so the destination
  is unchanged. `src/components/shell/LeftNav.test.tsx` pins the new href.
- **Password reset.** There is no password-reset email in this app. The only reset affordance is the
  settings card note, so there is no template to brand. Adding a reset flow would change behaviour.
- **Booking cancellation email.** Cancelling sends no email to the visitor. It creates a host
  notification, and that notification goes through the system notification renderer, which now has
  the header. A new visitor email would be a behaviour change, so none was added.
- **Customer documents.** Document emails sent through the user's own mailbox keep the user's
  company identity and get no Dealflow header, per the brief. System notifications about documents
  (viewed, accepted, declined) do get the header.
- **Brand lint exclusion.** `biome.json` now excludes `brand/` because several draft SVGs have no
  `<title>` and the kit must not be edited. App code remains fully linted.
- **Offline logo.** The first e2e run showed a broken image on the offline page: the service worker
  precached the offline shell but not its brand mark. All four brand SVGs are now precached and
  `/brand/` is cache-first, with an e2e assertion that the offline logo has a real `naturalWidth`.
- **Public quote gallery.** The design gallery pointed `public-quote` at the first document, which is
  a draft and therefore not publicly visible, so the shot was Next's 404. The fixture now picks the
  first issued quote. That exposed a real 375 px overflow in the document line table, fixed by
  letting the table scroll inside the sheet (`MarkdownLite`) and using `p-6 sm:p-10` on the sheet.

## Per step

### 1. Icons and favicons
- Replaced `src/app/icon.png` (512), `src/app/apple-icon.png` (180) and `src/app/favicon.ico`
  (16/32/48) from `brand/app-icons/app-src/`.
- Added `src/app/icon.svg` from `brand/app-icons/icon.svg`. Next 16 emits it as an additional
  `<link rel="icon" ... type="image/svg+xml" sizes="any">`; verified in the built HTML. No metadata
  override needed.
- Old files were replaced in place, so no conflicting icon route remains.

### 2. PWA
- `public/icons/` now holds the brand `icon-192.png`, `icon-512.png`, `icon-maskable-192.png` (new)
  and `icon-maskable-512.png`, plus `badge-128.png` from `brand/png/mark/`.
- `src/app/manifest.ts` lists all four icons with the correct `purpose`,
  `theme_color: "#211C52"` and `background_color: "#FFFFFF"`.
- `src/features/pwa/sw/sw.ts` uses `badge-128.png` as the notification badge (icon stays
  `icon-192.png`), precaches all four PWA icons and the four brand SVGs.
- Root viewport `themeColor` is `#211C52`.
- `e2e/14-pwa-mobile.spec.ts` now pins the four-icon manifest and the offline logo.

### 3. App shell
- `src/components/shell/LeftNav.tsx`: the brand cell renders
  `public/brand/dealflow-mark-reverse.svg` at 28 px with `alt="Dealflow"`.
- `src/features/navigation/mobile/MoreSheet.tsx`: the rail header renders
  `public/brand/dealflow-logo-horizontal-reverse.svg` at 24 px.
- `src/features/branding/BrandLogo.tsx` is the single `<img>` wrapper for the public SVG masters, so
  no SVG markup or brand hex enters TSX.

### 4. Sign-in and public pages
- Sign-in, magic-link and invite cards: the colour horizontal logo at 32 px, centred, with 24 px
  (`mb-6`) above the card.
- Offline page header: the same logo at 24 px.
- Public document, form and booking footers: the 16 px colour mark beside the existing
  "Powered by Dealflow" text (12 px secondary), linking nowhere.
- App 404 and global error: the 48 px colour mark above the message.

### 5. Emails
- `public/brand/email-logo@2x.png` is the 480x100 master.
- `src/features/mailer/branding.ts` builds the absolute URL from `env.BASE_URL` and emits a 160 px
  wide, 33 px high image (`width="160"`, `height="33"`, `alt="Dealflow"`) plus the plain-text
  fallback `Dealflow`.
- Applied to magic link, invite, every notification (mentions, activities, deals, email events,
  documents, forms, bookings, AI, projects and the fallback), booking confirmation, backup failure
  and webhook auto-disable.

### 6. Social previews
- `public/og/og-image-1200x630.png` and `public/og/x-card-1200x675.png`.
- Root metadata sets `metadataBase` from `env.BASE_URL`, the Open Graph block (siteName "Dealflow",
  1200x630 image) and the Twitter `summary_large_image` block (1200x675 card). Public `/d`, `/f`
  and `/book` inherit them.
- Built HTML was checked: absolute `og:image` and `twitter:image` URLs, widths and heights.

### 7. Docs
- `README.md` opens with the colour horizontal logo at 240 px (relative `brand/` path).
- `docs/dealflow/DESIGN.md` gained a Brand section with the colours, the light/dark file rule and
  links to `brand/README.md` and `brand/brand-guidelines.html`.
- `docs/dealflow/UPSTREAM.md` gained the Brand rollout file list.

### 8. Checks and gallery
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`, `pnpm check:design` and `pnpm e2e`
  all pass. Counts are below.
- The 15-design gallery was refreshed: 73 PNGs. The 14-pwa-mobile shots were refreshed too,
  including the More sheet and offline page.

## Files touched

- App metadata and icons: `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/favicon.ico`,
  `src/app/icon.svg`, `src/app/layout.tsx`, `src/app/layout.test.tsx`, `src/app/manifest.ts`.
- PWA and cache: `src/features/pwa/sw/sw.ts`, `src/features/pwa/sw/routes.ts`,
  `src/features/pwa/sw/routes.test.ts`, `public/icons/*`, `e2e/14-pwa-mobile.spec.ts`.
- Brand surface: `src/features/branding/BrandLogo.tsx`, `BrandLogo.test.tsx`, `public/brand/*`.
- Shell: `src/components/shell/LeftNav.tsx`, `LeftNav.test.tsx`,
  `src/features/navigation/mobile/MoreSheet.tsx`.
- Auth, public and errors: `src/app/(auth)/login/page.tsx`, `login/magic/page.tsx`,
  `login/invite/page.tsx`, `src/features/pwa/offline/ui/OfflineApp.tsx`,
  `src/features/public/PoweredBy.tsx`, `PoweredBy.test.tsx`, `src/app/d/[publicId]/page.tsx`,
  `src/app/(app)/not-found.tsx`, `src/app/global-error.tsx`, `src/app/globalError.test.tsx`.
- Documents: `src/features/documents/ui/DocumentView.tsx`, `MarkdownLite.tsx`.
- Email: `src/features/mailer/branding.ts`, `branding.test.ts`, `templates.ts`, `templates.test.ts`,
  `src/features/notifications/email/render.ts`, `render.test.ts`,
  `src/features/scheduling/booking.ts`, `scheduling.integration.test.ts`,
  `src/features/backups/backup.ts`, `backups.integration.test.ts`,
  `src/features/webhooks/deliver.ts`, `webhooks.integration.test.ts`,
  `public/brand/email-logo@2x.png`.
- Social: `public/og/*`.
- Tooling and harness: `biome.json` (`brand/` excluded), `scripts/e2e/seed-session.ts`.
- Docs: `README.md`, `docs/dealflow/DESIGN.md`, `docs/dealflow/UPSTREAM.md`,
  `docs/dealflow/BRAND-ROLLOUT.md`.

## Tests updated (and why)

- `e2e/14-pwa-mobile.spec.ts`: the manifest contract changed to four icons with `any` and
  `maskable` purposes, white background and indigo theme, and the offline page must load its brand
  mark. The old three-icon assertions were replaced, not loosened.
- `src/components/shell/LeftNav.test.tsx`: now pins the reverse SVG, `alt="Dealflow"`, 28 px and the
  `/` link, and asserts that `brightness-0` is gone.
- `src/app/layout.test.tsx`: pins `metadataBase` and both social image blocks.
- `src/app/globalError.test.tsx`: pins the 48 px colour mark on the global error and the app 404.
- `src/features/mailer/templates.test.ts`, `render.test.ts`,
  `src/features/scheduling/scheduling.integration.test.ts`,
  `src/features/backups/backups.integration.test.ts`,
  `src/features/webhooks/webhooks.integration.test.ts`: assert the absolute email logo URL, the
  `width="160"` and `height="33"` attributes, `alt="Dealflow"` and the text fallback.
- New tests: `BrandLogo.test.tsx`, `PoweredBy.test.tsx`, `mailer/branding.test.ts`.
- `src/features/pwa/sw/routes.test.ts`: `/brand/` is cache-first.
- `scripts/e2e/seed-session.ts`: the gallery fixture selects an issued quote, not a draft. This is a
  fixture correction, not an assertion change.

## Check results

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0, no errors |
| `pnpm lint` | exit 0, 13 warnings and 1 info (the same pre-existing `document.cookie` warnings; no errors) |
| `pnpm build` | exit 0 |
| `pnpm test:unit` | 5356 passed / 5356, 843 files |
| `pnpm check:design` | 0 violations in 0 files; 12 opt-outs |
| `pnpm e2e` | 50 passed / 50, all specs 00 to 15 |
| Targeted email integration | 28 passed / 28 (scheduling, backups, webhooks) |
| Targeted document integration | 45 passed / 45 (documents, public) |
| Design gallery | 73 PNGs refreshed under `e2e/screenshots/design/` |
| PWA gallery | `p10-mobile-more.png`, `p10-offline.png` and the other p10 shots refreshed |
| `brightness-0 invert` | no matches in `src/` or `e2e/` |
| Old icons | `src/app/icon.png`, `apple-icon.png`, `favicon.ico` and `icon.svg` byte-match the kit masters |
| Runtime `brand/` paths | none; the app reads only the copies under `public/brand` |
| Em dashes | none in the touched files |

## Not done

- No password reset email exists in this app, so there was no template to brand.
- No visitor booking cancellation email exists; the host cancellation notification is branded.
- Public routes that call `notFound()` still use Next's default 404 because there is no root
  `src/app/not-found.tsx`. The app 404 (`src/app/(app)/not-found.tsx`) carries the mark. Adding a
  root 404 would be a new page, outside the "if they exist" scope.
- The quote and invoice line table now scrolls horizontally inside the sheet at phone widths. All
  columns remain available; no data is hidden or removed.
