# Dealflow brand kit

Logo: the leaf mark (variant A, chosen 2026-10-22). Colours: green `#2D8548`, light green `#58CC85`, indigo `#211C52`, white. Wordmark: Inter 600, outlined (no font needed). Open `brand-guidelines.html` for usage rules.

## Masters (SVG, scalable, use these first)
- `svg/logo-horizontal/` - horizontal logo: `colour` (default, light backgrounds), `reverse` (dark backgrounds), `white`, `black`, `green` (single-colour).
- `svg/logo-stacked/` - stacked logo, same five colourways.
- `svg/wordmark/` - "Dealflow" lettering only, same five colourways.
- `svg/mark/` - leaf mark only, same five colourways (tight-cropped).
- `svg/app-icon/` - app icon artwork: `dealflow-app-icon.svg` (full-bleed, iOS/Android masks it), `-rounded.svg` (with corners, for PWA "any" icons and docs), `-maskable.svg` (leaf inside the 80% safe zone), `dealflow-favicon.svg`, `safari-pinned-tab.svg`.

## PNG exports (transparent backgrounds)
- `png/logo-horizontal/` @1x 240px, @2x 480px, @3x 720px wide.
- `png/logo-stacked/` @1x 160px, @2x 320px, @3x 480px wide.
- `png/wordmark/` @1x 200px, @2x 400px, @3x 600px wide.
- `png/mark/` 64, 128, 256, 512, 1024px squares.

## Web and app icons (`app-icons/`)
| File | Use |
|---|---|
| `favicon.ico` | Browser tab (16, 32, 48 in one file) |
| `icon.svg` | Modern browsers' scalable favicon |
| `favicon-16/32/48/64/96/128.png` | Individual favicon sizes |
| `apple-touch-icon.png` | iOS home screen (180px) |
| `icon-192.png`, `icon-512.png` | PWA / Android icons (purpose "any") |
| `icon-maskable-192.png`, `icon-maskable-512.png` | PWA / Android adaptive icons (purpose "maskable") |
| `app-icon-1024.png` | App stores, marketplace listings, large previews |
| `mstile-150.png` | Windows tiles |
| `safari-pinned-tab.svg` | Safari pinned tab (single colour) |
| `app-src/icon.png`, `app-src/apple-icon.png`, `app-src/favicon.ico` | Drop-in replacements for the Dealflow app's `src/app/` icons |

`web/site.webmanifest` and `web/head-snippet.html` show how to wire them up on a website.

## Social and marketing (`social/`)
| File | Size | Use |
|---|---|---|
| `og-image-1200x630.png` | 1200×630 | Link previews (Open Graph: LinkedIn, Slack, iMessage, Facebook) |
| `x-card-1200x675.png` | 1200×675 | X (Twitter) large summary card |
| `linkedin-share-1200x627.png` | 1200×627 | LinkedIn post image |
| `linkedin-banner-1584x396.png` | 1584×396 | LinkedIn company page cover |
| `x-header-1500x500.png` | 1500×500 | X profile header |
| `avatar-400.png` | 400×400 | Profile picture (X, LinkedIn, GitHub, Slack) |
| `linkedin-company-logo-300.png` | 300×300 | LinkedIn company logo |
| `youtube-avatar-800.png` | 800×800 | YouTube and other large avatars |
| `email-header-1200x300.png` | 1200×300 | Email newsletter header |
| `email-signature-600x160.png` | 600×160 | Email signature logo (display at 300×80) |

## Print (`print/`)
- `dealflow-logo-horizontal-colour.pdf`, `dealflow-logo-stacked-colour.pdf`, `dealflow-logo-horizontal-black.pdf` - vector PDFs for documents, quotes and invoices. Colours are RGB; ask a printer to convert to CMYK (approximate CMYK green 66/0/46/48) or use the black version for single-colour print.

## Tokens (`tokens/`)
- `brand-colors.css` and `brand-colors.json` - brand colours as CSS variables and JSON.

## Typeface
Inter (SIL Open Font License 1.1). The logo files contain outlines, so no font installation is needed to use them.
