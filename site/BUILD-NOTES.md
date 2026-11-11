# Dealflow landing site: build notes

Built in `site/` as plain HTML, CSS and vanilla JavaScript. No framework, build step, CDN, analytics, cookies or runtime dependency. `website/`, the app source, `docs/`, the Docker files, the existing CI workflows and the prompt files were not changed.

## What was delivered

- `site/index.html`, `site/styles.css`, `site/main.js` and `site/404.html`.
- `site/robots.txt` and `site/sitemap.xml`.
- `site/assets/hero.webp`, the nine product shots, the brand files and the self-hosted Inter variable font.
- `site/tools/optimize-images.mjs`, `site/tools/check.mjs` and the git-ignored `site/tools/screens/` output.
- `.github/workflows/pages.yml`, one `**Website:**` line in the root `README.md`, and `site/tools/screens/` in `.gitignore`.
- `sharp` added as the only dependency change, pinned to the version already present in the lockfile.

## Decisions

1. **Hero.** `docs/screenshots/pipeline-diorama.webp` was copied byte-for-byte to `site/assets/hero.webp`. It is 1600x640 and is used at its native aspect ratio with `width="1600"`, `height="640"`, `fetchpriority="high"`, `decoding="async"` and no lazy loading. It was not re-encoded, cropped, tinted or overlaid.
2. **No hero `srcset`.** Section 9.4 mentions a hero `srcset`, but sections 0, 4.2 and 7 and the build instruction require the exact supplied WebP and forbid re-encoding. The exact file is used instead. First load is about 211 KB, well under the 1.5 MB budget, so no responsive hero variants were invented.
3. **`sharp` version.** The lockfile already carried `sharp@0.34.5` as a transitive package. It was added as a direct devDependency at `^0.34.5` so the lockfile diff stays at 17 lines instead of pulling a second `sharp` major line. `site/tools/optimize-images.mjs` was run with it. This is the only package change.
4. **Optional brand illustrations.** `site/assets/section-stack.webp`, `section-email.webp` and `cta-glow.webp` were not present. They were skipped as the brief allows; no placeholders or stock art were created.
5. **404 paths.** The 404 page uses the same relative header, footer and asset paths as the home page, as section 1 requires. It is correct when served at `/404` or `/404.html`. GitHub Pages can serve `404.html` at a deeper requested path, where relative assets resolve against that path; add a deployment-specific `<base>` if you want those deeper 404s styled as well.
6. **GitHub stars failure.** The public repo URL returns 404 from this build environment, so a plain local page load logs a browser network notice for the optional GitHub API request. The page keeps the "Star on GitHub" fallback and never shows 0 or an error. The check script tests both the successful fetch (with an intercepted 200 response) and the failure fallback (with an empty response).
7. **Menu focus.** Escape closes the mobile menu and returns focus to the Menu button. Link clicks and outside taps also close it and return focus to the button. Tab is trapped inside the open sheet.
8. **Progressive enhancement.** All content, screenshots and install commands are in the HTML. With JavaScript disabled the tab strip is hidden and all seven panels stack, the header nav and both header buttons remain visible, and the Menu button is hidden. The `.no-js` class is removed by `main.js` only after the interactions are wired.
9. **Fonts.** Inter is self-hosted from `website/public/assets/fonts/inter-latin-var.woff2`, declared at weights 100 to 900 with `font-display: swap`, and preloaded. There is no Google Fonts or CDN request.
10. **Images.** `site/tools/optimize-images.mjs` uses `sharp` at quality 80, never upscales, writes only to `site/assets/shots/` and leaves the originals in `docs/` untouched. It also verifies that the supplied hero is still 1600x640 before printing the size table.
11. **Repository lint.** The static site is plain JavaScript and sits outside the app tsconfig. `site/tsconfig.json` was added so the repository's existing ESLint project service can parse the site files, and the three site JavaScript files carry a file-level `eslint-disable` because the app's typed rules (AppError, env boundary, AbortSignal fetch) do not apply to a static page. `main.js` also carries a `biome-ignore-all format` pragma so the formatter cannot push it past the brief's 200-line limit; it is 194 lines. `site/styles.css` carries two Biome pragmas before the token block: one disables the app lint rules and one keeps the token block verbatim instead of allowing the formatter to rewrite it. The token block itself is unchanged. `pnpm exec biome check site` and `pnpm exec eslint site` both pass for the site files; the full `pnpm lint` was not run because this change does not touch the app source.
12. **Screenshot capture.** For the full-page check screenshots only, `check.mjs` loads lazy images eagerly and makes the sticky header static so the captured page shows every image and only one header. This changes the check page, not the delivered HTML or CSS.
13. **Responsive link cards.** The four link cards are one column below 600px, two from 600px and four from 1100px, matching the feature grid. Leaving the four-column default in place squeezed each card to 68px at 360 and caused a 5px overflow; the explicit mobile default fixes it.

## Image sizes

The hero is the supplied file, not a new encode.

| File | Size | Dimensions |
| --- | ---: | --- |
| `site/assets/hero.webp` | 45.9 KB | 1600x640 |
| `site/assets/shots/pipeline.webp` | 91.9 KB | 1440x900 |
| `site/assets/shots/deal.webp` | 45.7 KB | 1440x900 |
| `site/assets/shots/inbox.webp` | 37.4 KB | 1440x900 |
| `site/assets/shots/campaigns.webp` | 37.5 KB | 1440x900 |
| `site/assets/shots/compose.webp` | 23.2 KB | 1440x900 |
| `site/assets/shots/insights.webp` | 26.2 KB | 1440x900 |
| `site/assets/shots/calendar.webp` | 21.4 KB | 1440x900 |
| `site/assets/shots/projects.webp` | 19.3 KB | 1440x900 |
| `site/assets/shots/mobile.webp` | 23.5 KB | 390x844 |

Brand files copied unchanged: horizontal colour logo 10,902 bytes, stacked reverse logo 11,133 bytes, favicon SVG 345 bytes, favicon ICO 3,826 bytes, Apple touch icon 2,966 bytes, OG image 28,888 bytes (1200x630), X card 29,837 bytes (1200x675), Inter variable font 48,432 bytes.

## Checks run

Environment: macOS, Node 24.16.0, pnpm 9.15.9 via Corepack, Chromium 1248 from the repository's Playwright install.

Local serve:

```bash
npx --yes serve site -l 4173
```

The default npm cache on this machine contained root-owned files, so the serve command was run with `npm_config_cache=/tmp/dealflow-npm-cache`; this is an environment workaround, not a site change. The page returned HTTP 200 and every local asset returned 200. The only console entry on an unseeded load is the optional GitHub API 404 described above. No page, script, style, font or image error was observed.

Acceptance script:

```bash
node site/tools/check.mjs
```

Final result: **all checks passed**. The script covers:

- No horizontal page scroll at 1440, 1024, 768, 390 and 360 (`scrollWidth` equals `innerWidth` at each width). Full-page screenshots are in `site/tools/screens/` and are git-ignored.
- `@axe-core/playwright`: zero serious or critical violations at all five widths.
- Every internal anchor resolves to a real `id`, including `#features`, `#email`, `#self-host`, `#install`, `#top` and `#faq`.
- Every `./assets/` reference in HTML and every `url()` in `styles.css` returns 200 (16 unique files).
- Tabs: ArrowRight moves selection and focus, End moves to the last tab, every click shows the right panel.
- Copy buttons: the hero chip copies the command without `$ `; the install block copies the six commands and comments without prompts, then shows `Copied`.
- Mobile menu at 390: opens with `aria-expanded="true"`, focus enters the sheet, Escape closes it and returns focus, an outside tap closes it.
- GitHub stars: an intercepted 1284 count renders as `1.3k` in the header, the mobile menu, the stat card and the closing CTA; an empty response keeps `Star on GitHub`, keeps both count pills hidden and never shows 0.
- No JavaScript: the deal and projects panels are visible, the install block is visible, the header nav is visible, the Menu button is hidden, and 13 `h2` headings are present.
- First load at 1440: about 211 KB, under the 1.5 MB limit. This varies slightly between runs with local transfer-size accounting, but stays far below the budget.
- Every external link points at `https://github.com/itchyparrot53/dealflow...` and opens in the same tab. There are no `target="_blank"` links.
- No lorem ipsum and no banned marketing words.
- Contrast ratios, all above 4.5:1: white on Dealflow green 4.61:1, muted on glass over sage 6.76:1, ink on paper 15.21:1, green ink on paper 6.31:1, code text on night 15.80:1, code comments on night 8.13:1, the 45% `$` prompt on night 4.50:1. The prompt uses white at 45% opacity so the specified opacity still clears the threshold.
- No console or page errors after excluding the known optional GitHub API network notice.

Lighthouse, run with `npx lighthouse` against the local server:

| Preset | Performance | Accessibility | Best practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Mobile (default) | 99 | 100 | 96 | 100 |
| Desktop | 100 | 100 | 96 | 100 |

The mobile run was repeated after the final markup changes and kept the same 99/100/96/100 scores (LCP 2.2 s). Desktop LCP was 0.5 s. Best practices is 96 because Lighthouse records the optional GitHub API 404 as a browser console error. Every required category is at least 95. If the repository exists at the published URL, that request succeeds and the console entry disappears.

404, robots and sitemap:

- `/404` rendered the shared header and footer, the heading `This page doesn't exist.` and the link home. CSS and the logo loaded from the site root.
- `robots.txt` allows everything and points at `https://itchyparrot53.github.io/dealflow/sitemap.xml`.
- `sitemap.xml` lists `https://itchyparrot53.github.io/dealflow/`.

Playwright browser: Chromium was already present at `~/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app`. `pnpm exec playwright install chromium` was attempted, but the command stalled on the network and was stopped; all checks ran against the installed Chromium 1248.

## Known limitations and follow-ups

- The public GitHub repository at `https://github.com/itchyparrot53/dealflow` returned 404 during this build, so the star count could not be fetched for real. The code handles success and failure; the local console notice is the failed optional request, not a page error.
- The hero is a single 1600x640 asset with no `srcset`, as recorded in decision 2. The 1.5 MB budget has a large margin.
- Deep-path 404 styling on GitHub Pages depends on how the host resolves relative URLs. The delivered page is correct at the site root and at `/404.html`.
- If the repository owner or name changes, replace the constants consistently: the canonical URL, OG and Twitter URLs, JSON-LD `codeRepository`, sitemap URL, robots sitemap line, README website line, all GitHub links, and the GitHub API URL in `main.js` and `site/tools/check.mjs`.

## GitHub setup for the owner

1. Push the repository with `site/` and `.github/workflows/pages.yml` on `main`.
2. Enable GitHub Pages: **Settings > Pages > Source: GitHub Actions.**
3. Push a commit that touches `site/**`, or run **Deploy landing site** from the Actions tab. The workflow publishes the `site` folder and reports the Pages URL in the `github-pages` environment.
4. To use a custom domain, set it in **Settings > Pages > Custom domain**, add the matching `CNAME` file inside `site/` if you want the file in the repository, and update the canonical, OG, Twitter, JSON-LD, sitemap, robots and README URLs to the new domain.
5. The workflow only runs on `main` and only when `site/**` changes. If your default branch is not `main`, update the `branches` value in `pages.yml`.
6. Ensure Actions has permission to deploy Pages. The workflow requests `pages: write`, `id-token: write` and `contents: read`.
