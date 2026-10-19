# PROGRESS: dealflow-wd-p1-v1

STATUS: IN PROGRESS
Current: 0.4 · Last updated: 2026-10-19 21:40

## Phase base commits
- Phase 0: ec6a018085d1f6048e4f7113e40332ca30bc7ff5

## Tasks
- [x] 0.1 Repository, upstream remote and kit
- [x] 0.2 Toolchain, install and dev services
- [x] 0.3 Baseline fixes from the OSS export
- [ ] 0.4 Baseline run and health report
- [ ] 0.5 E2E harness and health click-through
- [ ] 0.6 Purelymail probe
- [ ] 0.7 Phase 0 QA gate
- [ ] 1.1 Dealflow name in the app
- [ ] 1.2 Package, docs, licence and MCP names
- [ ] 1.3 Telemetry and update check off by default
- [ ] 1.4 Compose without Caddy and reverse-proxy docs
- [ ] 1.5 CLAUDE.md fast profile and project notes
- [ ] 1.6 Phase 1 QA gate
- [ ] 2.1 Auth env, schema and error IDs
- [ ] 2.2 System mailer
- [ ] 2.3 Local auth services
- [ ] 2.4 Auth routes and safe dev-login
- [ ] 2.5 Login, magic-link and invite pages
- [ ] 2.6 Invite email, profile password and bootstrap link
- [ ] 2.7 Phase 2 QA gate
- [ ] 3.1 AI env, dependency and schema
- [ ] 3.2 Provider layer and JSON helper
- [ ] 3.3 Usage, caps and rate limit
- [ ] 3.4 AI router, Settings page and model check
- [ ] 3.5 Phase 3 QA gate
- [ ] 4.1 Deal context, summary and score
- [ ] 4.2 Deal AI card
- [ ] 4.3 Email draft in the composer
- [ ] 4.4 Notes to activities
- [ ] 4.5 Describe a filter
- [ ] 4.6 Phase 4 QA gate
- [ ] 5.1 Tool catalogue from the MCP registry
- [ ] 5.2 Assistant loop and pending actions
- [ ] 5.3 Assistant actions and reads
- [ ] 5.4 Assistant drawer
- [ ] 5.5 Phase 5 QA gate
- [ ] 6.1 E2E specs and screenshot gallery
- [ ] 6.2 Integration suite and container smoke
- [ ] 6.3 Independent review and hardening
- [ ] 6.4 Final checklist
- [ ] 6.5 Final report and completion

## QA log

## Decisions
- 0.1: chose tag v1.2.0 over upstream/main because the step 3 probe tied exactly (upstream/main points at the same commit as v1.2.0) and the tag matches package.json version 1.2.0.
- 0.1: kept the kit where it arrived (`PLAN AND EXECUTE/dealflow-wd-part1-kit`) instead of moving it to the folder root, and added a root `PLAN-PART1.md` symlink plus a byte-identical copy of the kit's `scripts/check-progress.mjs` at the path contract 6.1 names, because the kit lives in a subfolder here while the plan assumes the root.
- 0.1: excluded the snapshot commit from the nested kit folder (the plan's exclusion pathspecs only match root kit paths) so the snapshot is greenfield warpdrive code and the kit arrives in the 0.1 commit, as section 0 intends.
- 0.1: excluded a stray `DEALFLOW/` folder that appeared in this workspace from the repository via `.git/info/exclude` because it is not part of the warpdrive export (it holds copies of old Dealflow kits) and is not ours to add.
- 0.1: ran pnpm 9.15.9 from `/tmp/dealflow-tools/node_modules/.bin` because `corepack enable pnpm` and `npm install -g pnpm@9.15.9` both fail with EPERM outside this folder under the harness file sandbox; every pnpm command in this run prefixes that PATH.
- 0.1: did not run the section 4 harness check (`./qa.sh "Reply exactly: QA READY"`) in this phase because the harness is only used in Task 6.3; it is recorded there with the section 4 fallback.

- 0.2: reused the already-running dev stack (compose project `warpdrive-main`, started from the repo's `docker-compose.local.yml` before this run) instead of creating the `dealflow` project: its containers hold 5433/9000/9001, quay.io MinIO pulls are unauthorized on this machine and rule 14 forbids touching containers this run did not create; the received `.env` already targets that stack.
- 0.2: host-side DB commands pass `DATABASE_URL=postgres://warpdrive:warpdrive@localhost:5433/warpdrive` on the command line because the received `.env` uses the compose host name `postgres`, which does not resolve on the host, and rule 17 forbids editing `.env`.
- 0.2: `pnpm env:sync` appended 0 keys because `.env` already carries every key `.env.example` declares.

- 0.3: deleted `deployWorkflow.test.ts`, trimmed `Dockerfile.test.ts` and recreated the missing `scripts/auditConfig.ts`, because the OSS export dropped `.github/workflows/deploy.yml`, which both tests read.
- 0.3: typed `auditConfig.SavedFilterRow.targetEntity` as `string` and narrowed it against `SAVED_FILTER_TARGET_ENTITIES`, because `SavedFilterSeed.target` is `string` and the plan's stricter signature failed the existing test's typecheck.
- 0.3: excluded a stray `DEALFLOW/` copy of the old app (with its own node_modules) from tsc, Biome, ESLint and vitest classification, because it sits inside this workspace and its foreign tests, React types and lint findings broke typecheck, lint and test collection.

## Owner actions
- TODO(owner): install pnpm 9.15.9 on the PATH (`corepack enable pnpm` or `npm install -g pnpm@9.15.9`); this run used a temporary copy in /tmp because the harness sandbox blocks writes outside the project folder.

## Open issues
- None

## Final report
(written in Task 6.5)
