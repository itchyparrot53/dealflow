# PROGRESS: dealflow-wd-p1-v1

STATUS: IN PROGRESS
Current: 0.2 · Last updated: 2026-10-19 21:20

## Phase base commits
- Phase 0: ec6a018085d1f6048e4f7113e40332ca30bc7ff5

## Tasks
- [x] 0.1 Repository, upstream remote and kit
- [ ] 0.2 Toolchain, install and dev services
- [ ] 0.3 Baseline fixes from the OSS export
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

## Owner actions
- TODO(owner): install pnpm 9.15.9 on the PATH (`corepack enable pnpm` or `npm install -g pnpm@9.15.9`); this run used a temporary copy in /tmp because the harness sandbox blocks writes outside the project folder.

## Open issues
- None

## Final report
(written in Task 6.5)
