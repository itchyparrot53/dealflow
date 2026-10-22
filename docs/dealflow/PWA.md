# PWA, offline records, push and mobile

Dealflow installs as a progressive web app (PWA): a manifest, icons, a hand-written service worker
and an offline page. It stores read-only copies of the records you recently viewed, can send web
push notifications to a device, and has mobile-first layouts for the screens people use on a phone.
This page covers each of those.

## Install

The app is installable from any Chromium browser (Chrome, Edge, Arc) and from Safari on iOS 16.4 or
later.

- **Desktop:** open Dealflow, then choose "Install app" in the account menu (avatar, top right) or
  in **Settings > Profile > Install app**. The browser may also show its own install icon in the
  address bar. The app then opens in its own window at `/deals?source=pwa`.
- **Android:** the same "Install app" entry, or Chrome's menu > "Add to Home screen".
- **iOS Safari:** "Install app" in **Settings > Profile** explains the route: tap Share, then **Add
  to Home Screen**. Push on iOS only works from the installed app, not a Safari tab.

The manifest declares the name and short name "Dealflow", `display: standalone`, scope `/`,
background `#ffffff`, theme `#0f172a` and icons at 192, 512 and a maskable 512. The apple touch icon
is the existing one. When the app is already running standalone, the install entry hides itself.

## What works offline

Offline mode is **read-only**. There is no edit queue and nothing is uploaded when you reconnect.

- **What is stored.** Opening a deal, a person or an organization saves a compact snapshot
  (name/title, a few fields, the saved time) in this browser's IndexedDB. The activities list saves
  today's rows. Each user gets their own database (`dealflow-offline-{userId}`), and each type keeps
  the newest 50 records; re-opening a record replaces its old copy. Note bodies, email bodies and
  custom fields are never stored.
- **The `/offline` page.** It has tabs for Deals, People, Organizations and Today, each a list with
  the time the snapshot was saved, plus a read-only detail view. It needs no session, which is what
  lets the service worker serve it with no network. When a navigation fails, the worker shows this
  page; "Try again" reloads.
- **The banner.** When the browser goes offline, a slim banner says "You're offline. Changes can't
  be saved until you reconnect."
- **What is cached.** Only static assets (`/_next/static/*`, icons, fonts, the manifest) and the
  `/offline` page itself. No authenticated HTML, API, tRPC or export response is ever cached, and
  the public and embed routes are bypassed. Old caches (same `dealflow-` prefix) are deleted when a
  new worker activates.
- **Shared devices.** `/offline` reads the IndexedDB of the last user who signed in on this browser
  profile, so on a shared computer that person's saved records are visible there until they sign
  out or someone else signs in. Signing out (account menu > Log out) wipes every
  `dealflow-offline-*` database and every `dealflow-*` cache first; signing in as a different user
  wipes them automatically. This is the documented trade-off for not requiring a session offline.

## Updates

The service worker is generated at build time (`pnpm build:sw`, run by `pnpm build`). It is served
as `/sw.js` with `Cache-Control: no-cache` and `Service-Worker-Allowed: /`, so the browser always
checks for a new one.

When a new worker is installed and waiting, open tabs show a **"New version available"** toast with
a **Reload** action. Reload asks the waiting worker to take over (`SKIP_WAITING`) and reloads once
it controls the page, so you never land back on the old bundle. In development no worker is
registered; any existing worker is unregistered so `pnpm dev` cannot serve a stale asset.

## Push notifications

Push uses the `web-push` package and VAPID keys that live only in the server environment.

1. Generate a key pair: `pnpm push:vapid`. It prints `VAPID_PUBLIC_KEY=...` and
   `VAPID_PRIVATE_KEY=...`. The script never writes `.env`.
2. Add the three values to `.env`:
   `VAPID_PUBLIC_KEY=...`, `VAPID_PRIVATE_KEY=...` and
   `VAPID_SUBJECT=mailto:you@example.com` (a `mailto:` or `https:` contact URL). All three are set
   together or push stays off; a half-configured pair fails at boot, like the Google keys.
3. Restart the app and the worker.

Then open **Settings > Notifications**:

- The push card shows the status for this device: "Push is on for this device", "Push is off",
  "Not supported in this browser" or "Not set up on this server".
- **Enable push** asks the browser for permission, subscribes this device with the public key and
  saves the subscription. **Turn off on this device** unsubscribes and removes it server-side.
- Every notification type has a Push switch next to In-app and Email. A type with no saved choice
  uses the default: on for mentions, activity and project-task assignments, accepted quotes, form
  submissions and new bookings; off for the other types.
- On iOS the card explains that push needs the app added to the Home Screen (iOS 16.4 or later).

Delivery details:

- Push is sent after the notification row commits. With a worker running it goes through the
  `push.deliver` pg-boss queue; without one (tests, scripts) it is delivered inline. Either way it is
  best-effort: a push failure is logged and never fails the notification or its email.
- The payload is the same text the in-app notification shows, plus its link. No notes, emails or
  extra fields are included.
- A subscription the push service reports as gone (404 or 410) is deleted immediately; other
  failures are counted and the subscription is removed after 5 consecutive failures. A success
  resets the count and records the time.
- Nothing is sent when the VAPID keys are missing.
- For tests and local checks, `PUSH_FAKE=true` writes each delivery to `PUSH_FAKE_DIR`
  (default `.push-capture`) as `{ endpoint, payload }` JSON instead of calling a push service. The
  e2e stack runs in this mode; it holds test keys only.

## Mobile layout

Below 768px the left rail is replaced by a fixed bottom navigation with **Deals, Activities, Inbox,
Contacts** and **More**. More opens a sheet with every other navigation item, including Settings.
The bar respects the bottom safe-area inset and the content above it keeps enough padding to clear
it. The top bar compacts to search, notifications and the avatar.

- **Deal board:** one 85vw snap column per swipe, scrolling inside the board only, never the page.
- **Deal workspace:** a single column, with the sidebar sections below the main panel. The composer
  bar stays with the content.
- **Activities:** rows become cards below 768px, with a large Done/Undo control; the calendar opens
  in its agenda view.
- **Contacts:** the people and organization lists are card-friendly rows with the name, the
  organization or people count, and the owner.
- **Inbox:** the thread takes the full width; the context sidebar is hidden on a phone.
- **Documents, projects, insights:** one column, with wide tables scrolling inside their own
  container and charts constrained to the viewport.

Primary controls are at least 40px tall on mobile. This part does not restyle anything beyond these
layout changes; the visual design pass is a separate part.

## Operating notes

- `pnpm build` runs `build:sw` first and writes `public/sw.js`, which is git-ignored. The Docker
  image builds it through `build:docker`.
- `pnpm push:vapid` only prints; `.env` is changed only by `scripts/dealflow/env-sync.mjs`, which
  appends missing keys.
- The e2e stack sets `PUSH_FAKE=true`, `PUSH_FAKE_DIR=.push-capture` and the test VAPID pair from
  `e2e/fixtures/vapid.json`. Unit and integration tests inject the fake sender, so no test calls a
  real push service.
