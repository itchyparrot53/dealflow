# Dealflow website

The marketing site and online user guide for Dealflow, served at `https://dealflow.umev.co.uk`. (The `site/` folder next to this one is the original warpdrive landing page, kept unchanged from upstream.) It is plain static HTML, CSS and images with no dependency on the app's runtime.

| Path | What it is |
|---|---|
| `src/layout.html` | Shared header, footer and meta tags |
| `src/pages/*.html` | Home, Features, Self-hosting (`get-started`), About and FAQ, 404. The first line of each file is a JSON comment with its title, description and path. |
| `src/assets/` | `site.css` and `site.js` (the mobile menu; everything else works without JavaScript) |
| `public/` | The built site. Committed, and what Vercel serves. |
| `vercel.json` | Clean URLs (`/features` serves `features.html`), caching and security headers |
| `screenshots/` | Review screenshots at 375, 768 and 1440 px (not deployed) |

The Docs pages are generated from `docs/user-guide/*.md`, and the screenshots and PDFs are copied from `docs/user-guide/images` and `docs/user-guide/pdf`, so the website and the guide never drift apart.

## Rebuild

From the repository root:

```sh
pnpm docs:pdf      # only when the guide changed: rebuilds the PDFs
pnpm site:build    # rebuilds website/public
```

Commit `website/public` afterwards. The build only writes files; if you rename or remove a page, delete its old file from `website/public` by hand.

## Deploy to Vercel

1. In Vercel, select **Add New › Project** and import this repository.
2. Set **Root Directory** to `website`.
3. Leave **Framework Preset** as **Other** and the build command empty. `vercel.json` tells Vercel to serve `public`.
4. Select **Deploy**.
5. Under **Settings › Domains**, add `dealflow.umev.co.uk` and create the DNS record Vercel shows (a `CNAME` to `cname.vercel-dns.com`).

Or with the Vercel CLI, from the `website` folder:

```sh
vercel deploy --prod
```

## Preview locally

Any static server works. Clean URLs need a server that maps `/features` to `features.html`, for example:

```sh
npx serve website/public
```
