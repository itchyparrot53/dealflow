# Upstream tracking: Dealflow on warpdrive

## Remotes and branches

- `upstream` = `https://github.com/sneg55/warpdrive.git` (read-only source of future fixes)
- `origin` = none. This checkout is the Dealflow repository; nothing is pushed anywhere.
- Our branch: `main`
- Snapshot base: tag `v1.2.0` (commit `d15389f`, "Release 2026-10-02 (veodyn b130b752)"). The step 3
  probe in Task 0.1 compared `v1.2.0` with `upstream/main` and both produced the same diff, because
  `upstream/main` points at the same commit; the tag was chosen because it matches `package.json`
  version `1.2.0`.

## Bringing an upstream fix over

```bash
git fetch upstream --tags
git cherry-pick -x <sha>        # -x records the upstream sha in the commit message
```

If the cherry-pick conflicts, resolve in favour of our Dealflow contracts (PLAN-PART1.md section 6),
then run `pnpm typecheck && pnpm lint && pnpm test:unit`. Never rewrite `main`: our snapshot is the
root commit and every Dealflow task is its own commit on top.

## Migrations

Our migrations are named `00NN_dealflow_<topic>.sql` (`0075_dealflow_auth`, `0076_dealflow_ai` in
Part 1). Upstream numbers its own sequence. When an upstream migration arrives, regenerate it with
the next free number instead of reusing the upstream filename, so the journal stays monotonic.

## Upstream files we changed

Keep this list current: it is the conflict surface for every future cherry-pick.

- `deployWorkflow.test.ts` (deleted): it asserts `.github/workflows/deploy.yml`, which the OSS export
  does not contain and which we do not use (Task 0.3).
- `Dockerfile.test.ts` (changed): the workflow read and the "passed as a build arg by the deploy
  workflow" test were removed for the same reason; the three Dockerfile stage tests stay (Task 0.3).
- `scripts/auditConfig.ts` (new): the export left out this module that `scripts/seedSavedFilters.test.ts`
  imports; it is recreated from the plan's Task 0.3 snippet (Task 0.3).
- `tsconfig.json`, `biome.json`, `eslint.config.mjs`, `vitest.classify.ts` (changed): ignores for the
  kit folder, generated test output and a stray `DEALFLOW/` copy of the old app that sits in this
  workspace; and `scripts/dealflow/*.mjs` added to the ESLint default project (Task 0.1, Task 0.3).
- `.gitignore`, `package.json` (changed): generated paths and the Dealflow scripts from
  PLAN-PART1.md 6.1 (Task 0.1); the package name, description and contributors (Task 1.2); and
  `dev:up` without the explicit compose project name (Task 1.4, AMENDMENT A1).
- `src/constants/strings.ts`, `src/constants/settingsStrings.ts`,
  `src/constants/enrichmentStrings.ts`, `src/app/(app)/settings/email-sync/strings.ts`,
  `src/app/oauth/authorize/consent.tsx`, `src/features/notifications/email/render.ts`,
  `src/features/release/ui/VersionBanner.tsx`, `src/features/leads/inbox/SourceOriginInfo.tsx`,
  `src/features/deal-workspace/composer/VideoCallField.tsx`, `src/app/layout.tsx`,
  `src/features/email/composer/sendFailure.ts` (changed): user-visible copy now says Dealflow
  (Task 1.1).
- `src/components/ui/DatePicker.tsx` (changed): the calendar chunk cache is read instead of being
  write-only, which the linter required (Task 0.7).
- `src/features/mcp/server.ts`, `src/app/api/mcp/route.ts` (changed): MCP server name `dealflow`
  (Task 1.2).
- `README.md`, `LICENSE`, `docs/mcp-server.md` (changed): Dealflow docs, added copyright line,
  renamed MCP guide (Task 1.2).
- `src/config/env.ts`, `.env.example` (changed): telemetry and update check default on, then off
  (Task 1.3); Docker host-port keys, proxy example section and configurable MinIO images (Task 1.4).
- `docker-compose.yml` (changed): no proxy service, loopback publishes for app/ws/MinIO, configurable
  `MINIO_IMAGE`/`MC_IMAGE` and `DEALFLOW_ENV_FILE`, header rewritten (Task 1.4, AMENDMENT A1).
- `docker-compose.dev.yml` (changed): only the Postgres and MinIO console debug ports (Task 1.4).
- `docker-compose.local.yml` (changed): this machine's override updated for the new base file, no
  proxy stanza, no duplicate publishes (Task 1.4, AMENDMENT A1).
- `Caddyfile` (moved): now `docs/reverse-proxy/Caddyfile.example`, with `$APP_UPSTREAM`,
  `$WS_UPSTREAM` and `$S3_UPSTREAM` variables (Task 1.4).
- `Caddyfile.test.ts` (changed): reads the example path above (Task 1.4).
- `docs/deploy.md` (rewritten): proxy-less topology, host-port variables, first admin via the
  bootstrap link or an email link (Task 1.4).

## Deploy project names

Task 1.4 supersedes ROADMAP.md's "Compose project: dealflow" line. The dev stack uses the folder's
own compose project name (this machine: `warpdrive-main`), so it reuses the owner's existing
containers and volumes; the container smoke test keeps its dedicated `dealflow-smoke` project.

## Part 2 (mail provider) base

Part 2 builds on the Part 1 result at commit `64363ce` (PROGRESS-P1.md). From here, upstream fixes to
the email layer need reading before a cherry-pick: Phase 1 replaces `GmailClient` call sites with the
provider-neutral `MailProvider` in `src/features/mail/provider/`, and Task 1.1 renames the Gmail
columns to `provider_*` / `sync_cursor`. The Gmail adapter keeps the upstream sync engine
(`syncMailbox`) unchanged inside `src/features/mail/provider/gmailAdapter.ts`.

### Part 1 Phase 2 to 5 additions and edits

The audit found these absent from the list above; all were Part 1 work, so a future cherry-pick
that touches them needs a manual read first.

- `src/features/auth/*` (new): `authMethods`, `authTokens`, `bootstrapLocal`, `credentials`,
  `invites`, `magicLink`, `originCheck`, `password`, `passwordActions`, `passwordLogin`,
  `sessionCookies`, `sessionsAdmin`; `bootstrap.ts`, `devLogin.ts` and `loginReturn.ts` (changed).
- `src/app/auth/*` (changed routes): `password`, `magic-link`, `magic/verify`, `invite/accept`,
  `start`, `dev-login`.
- `src/app/(auth)/login/*` (changed): `page.tsx`, `LoginPanel.tsx`, `magic/page.tsx`,
  `invite/page.tsx`.
- `src/app/(app)/settings/*` (changed): `SettingsNav.tsx`, `profile/page.tsx`,
  `profile/PasswordCard.tsx`, `users/InviteUserForm.tsx`, `email-sync/strings.ts`.
- `src/features/mailer/*` (new): the system mailer and its templates.
- `src/features/mcp/tools/types.ts`, `src/server/trpc/root.ts`, `src/db/schema/index.ts`,
  `src/constants/errorIds.ts`, `src/constants/authStrings.ts` (changed): Part 1 registry and
  catalogue additions.
- `src/features/deal-workspace/DealSidebar.tsx`,
  `src/features/deal-workspace/history/NoteCard.tsx`,
  `src/features/deal-workspace/composer/VideoCallField.tsx`,
  `src/features/deals/CreateFilterModal.tsx`, `src/features/email/composer/Composer.tsx`,
  `src/features/identity/actions/invite.ts` (changed): AI entry points and Dealflow copy.

## Part 2 column rename (Task 1.1)

Migration `0078_dealflow_mail_rename` renames the Gmail-specific columns in place: `gmail_thread_id`
to `provider_thread_id`, `gmail_message_id` to `provider_message_id` (messages and send attempts),
`gmail_attachment_id` to `provider_attachment_id`, and `last_history_id` to `sync_cursor`. The
constraint names (`uq_thread_acct_gmail`, `uq_msg_acct_gmail`) are unchanged.

From this commit on, an upstream fix that touches the email layer must be ported by hand: the
upstream column names no longer exist here. Read the upstream diff, map the old names onto the new
ones, and prefer the `MailProvider` layer in `src/features/mail/` over adding new `GmailClient`
call sites. The Gmail adapter keeps the upstream sync engine (`syncMailbox`) unchanged.
