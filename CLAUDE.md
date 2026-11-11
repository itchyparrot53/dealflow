# Project Instructions

Guidance for working in this codebase (with an AI coding assistant or by hand).

**Project:** Dealflow (built on warpdrive)
**Description:** Single-company, self-hosted business-development CRM: pipeline management, deal workspace, contacts/organizations, two-way email, user management, notifications, and basic stats, with email + password and email-link sign-in (Google optional), IMAP/SMTP mail planned, and a built-in AI layer.

## Stack

- Next.js (App Router) + React, TypeScript
- Drizzle ORM + Postgres (JSONB for custom fields)
- tRPC (typesafe reads) + TanStack Query; Next server actions for mutations/forms
- shadcn/ui + Tailwind; dnd-kit for the board; Zustand for board-local state
- Self-hosted WebSocket server + Postgres LISTEN/NOTIFY for realtime
- Gmail API via OAuth (Google Workspace); Google SSO optional
- pg-boss for background jobs; MinIO (S3-compatible) for file storage
- AI: OpenRouter through the `openai` SDK; system mail: `nodemailer`; mail probing: `imapflow`; passwords: `@node-rs/argon2`
- Playwright for end-to-end tests
- pnpm

## Conventions

- Organize by feature under `src/features/`, not by technical layer. Each feature holds its implementation, types, constants, validation, and tests together.
- Keep files small (target under ~200 lines); split a single responsibility once it grows past ~300. Shared types go in `src/types/` to break import cycles; use `import type`.
- Named constants in `src/constants/`, no magic strings.
- Comments explain WHY, not what.
- No em dashes in any file. Use commas, colons, parentheses, or "vs."/"or"/"to".

## Verification profile (fast)

- Per change, run `pnpm typecheck`.
- Before calling a phase done, run `pnpm typecheck`, `pnpm lint`, `pnpm build` and `pnpm test:unit`.
- Integration tests (`pnpm test:integration`, Docker) run once per part.
- Write new tests for risky server logic only: money, dates, state machines, permissions, public routes, auth, mail sync, threading. Write those test-first.
- Playwright end-to-end (`pnpm e2e`) and a screenshot gallery run once at the end of each part.
- Never mock the database in the tests you do write: integration tests hit a real Postgres and the real Drizzle migrations.
- Never claim something works without running the check that proves it. Evidence before assertions.

## Dealflow conventions

- **Brand rule.** User-visible text, page metadata, docs and the package name say Dealflow. Internal identifiers keep the upstream name by design: cookie names (`wd_*`), localStorage keys, event names (`warpdrive:open-search`), `Symbol.for("warpdrive.*")`, the release repository and user agent, the invalid base URL in `loginReturn.ts`, the MinIO bucket default and `DOCS_SITE_URL`. Comments may explain the history. `src/features/branding/brand.test.ts` pins the visible copy.
- **New work goes in new feature folders** (`src/features/<feature>/`) and **new schema files** under `src/db/schema/` (exported from the index), so the upstream diff stays small and reviewable.
- **Migrations** are named `00NN_dealflow_<topic>.sql` (for example `0075_dealflow_auth.sql`). Never reuse or renumber an upstream migration; take the next free number.
- **Upstream policy:** `docs/dealflow/UPSTREAM.md` records the base commit, how to bring a fix over, and every upstream file we changed. Read it before cherry-picking anything.
- **Feature notes** live in `docs/dealflow/`; working plans and progress logs are not kept in the repository.
- **Every external service has a fake.** `AI_FAKE=true` gives deterministic AI answers and tests inject `ScriptedAiProvider`; `MAIL_FAKE=true` writes captured mail to a folder and tests may inject `setSystemMailerForTest`. Never call a paid or real external service from a test.

## Engineering Conventions

These patterns exist because they catch the failure modes an AI coder actually produces.

### Validate at the boundary (Zod)

External data passes through a Zod schema exactly once, at the point it enters the type system; inside the program the inferred type is trusted, never re-checked. Boundaries: tRPC procedure inputs, server-action arguments, external API responses and push payloads, OAuth callbacks, CSV import rows, file reads, and env vars. Schemas live in `src/schemas/` or the owning feature dir.

### Single env boundary

One module (`src/config/env.ts`) is the ONLY place `process.env` is read. It validates with Zod and throws at import time so misconfiguration fails fast. Everything else imports the typed `env` object. A lint rule bans raw `process.env` access elsewhere.

### Result types over throws

Any operation that can fail returns a discriminated union `Result<Ok, Err>` with discriminant `ok: true | false`, instead of throwing. Callers narrow with `if (!r.ok) return r`. Throw ONLY for programmer errors (invariant violations, unreachable branches); operational failures (bad input, missing record, timeout, permission denied) are values. This matters most for batch/parallel work (syncing many mailboxes, bulk operations) where one failure must not abandon the rest. `Result`, `ok()`, `err()`, and `assertNever()` live in `src/types/result.ts`. Pair with `switch-exhaustiveness-check`.

### Error ID registry

Every `AppError` carries a stable ID of the form `E_<DOMAIN>_<NNN>`, declared once in `src/constants/errorIds.ts`. Rules: one ID per distinct cause; never reuse a retired ID (mark it retired, keep it searchable); append, do not renumber; domain prefix required. `AppError(id, message, context)` is the only error thrown in app code; raw `throw new Error(...)` is lint-flagged.

### Thread AbortSignal through long operations

Any function that does I/O, waits, or runs longer than ~100ms takes `signal: AbortSignal` (required, not optional) and passes it to every callee that accepts one (fetch, DB client, external clients, inner functions). Call `signal.throwIfAborted()` after awaits that are not signal-aware. Release resources (handles, subprocesses, DB transactions) on abort. Never swallow `AbortError`. This keeps sync jobs and obsoleted requests actually cancellable rather than piling up.

### Use the design system, never reinvent (shadcn, hard rule)

This project is shadcn-based (`components.json`, new-york/slate tokens, cva/cn/tailwind-merge, Radix primitives). **Never hand-roll a component the design system already provides.** Before writing any interactive UI surface (menu, dialog, popover, tabs, tooltip, select), first grep `src/components/ui/` for an existing wrapper and `package.json` for an installed `@radix-ui/*` dep, and use it. If the Radix dep is installed but no `ui/` wrapper exists, add the standard shadcn wrapper, then use it.

- **Dropdown menus** MUST use the `DropdownMenu` primitive (over `@radix-ui/react-dropdown-menu`), never a hand-rolled dismiss hook + `absolute` div.
- **Modals** MUST use the `Dialog` primitive (over `@radix-ui/react-dialog`), never hand-rolled `fixed inset-0` overlays.
- Rationale: hand-rolled menus/dialogs silently drop focus trap, keyboard nav (arrows/type-ahead/Escape), and scroll-lock, and they scatter surface styling. Radius math uses the project token scale (`--radius` = 0.5rem: `rounded-md` = 8px, `rounded-lg` = 10px, base `rounded` = 4px), never stock Tailwind defaults.
- **No native form controls by default.** Native HTML controls (`<select>`, `<input type=checkbox>`, `<input type=radio>`, `<input type=range>`, etc.) are not permitted unless deliberately chosen. Use the design-system wrapper; if none exists, add the standard shadcn wrapper first, then use it.
- Only genuinely presentational, non-interactive helpers (`Button`, `Avatar`) may stay hand-rolled; the rule targets every interactive or accessibility-sensitive control, native ones included.

### Linting

Biome (`biome.json`) plus type-aware ESLint (`eslint.config.mjs`, ESLint flat config) are enforced. Run the whole repo with `pnpm lint` (biome, then eslint); `eslint.config.mjs` is the source of truth for enabled rules.

Type-aware rules on include: `no-floating-promises`, `no-misused-promises`, `no-explicit-any`, `no-non-null-assertion`, `strict-boolean-expressions`, `switch-exhaustiveness-check`, `no-unnecessary-condition`, `consistent-type-imports`, import checks, `no-console` (allow warn/error), a `no-restricted-properties` guard on `process.env`, and `sonarjs/cognitive-complexity`. A `no-restricted-syntax` block bans raw `throw new Error` (use `AppError`), flags `fetch(` without `{ signal }`, and flags hand-rolled menus/modals so they use the shadcn primitives (only `src/components/ui/**` is exempt).

## Git Safety

- Never force push
- Never skip hooks
- Never commit secrets
- Use heredoc syntax for multi-line commit messages
