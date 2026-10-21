# Final checklist (Part 8)

Base commit: `908ed5b4df85ad41aa63f197171a74f0a87463df`. Results were collected on the final tree; where a
step needs Docker and the Docker VM is out of disk, that is stated.

1. PASS - `git status --porcelain` is empty after the final commits.
2. PASS - `pnpm install --frozen-lockfile` exits 0; the lockfile and dependencies are unchanged (only scripts were added to package.json).
3. PASS - `pnpm typecheck` exits 0.
4. PASS - `pnpm lint` exits 0; only the 15 pre-existing warnings remain.
5. PASS - `pnpm test:unit` passes 5269 tests in 821 files (baseline 5237 in 813).
6. PASS (pre-review tree) - full integration passed 2046 tests in 405 files on `2fc2637`. The final-tree re-run is BLOCKED by the Docker VM disk (Testcontainers Postgres: `No space left on device`); logged as an owner action.
7. PASS - the build lists `/projects`, `/projects/[id]`, `/api/v1/[...path]`, `/settings/api`, `/settings/recycle-bin`, `/settings/audit-log`, `/settings/backups` and `/export/[entity]`.
8. PASS (pre-review tree) - `pnpm e2e` passed 22 tests (specs 00 to 12). The spec and UI did not change after that run except the backup button's queued copy, which the spec does not click; a final-tree re-run is BLOCKED by the same Docker disk condition.
9. PASS - 7 `p8-*` screenshots exist (`p8-project-board`, `p8-projects-list`, `p8-api-tokens`, `p8-api-docs`, `p8-recycle-bin`, `p8-audit-log`, `p8-backups`), plus the earlier parts' sets.
10. FAIL - smoke did not run: `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke` fails at `build-and-up` because the smoke Postgres cannot `initdb` (`No space left on device`). The backup round trip in the smoke script is written but unproven. Owner action logged.
11. PASS - `drizzle/0089_dealflow_projects_api.sql` creates exactly `projects`, `project_phases`, `project_tasks`, `api_tokens`, `backup_runs`.
12. PASS - `git grep token_hash/tokenHash src/features/api/router.ts src/features/api/ui` prints nothing; the token list reads prefixes only.
13. PASS - the dump password travels in `PGPASSWORD` (PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD env), never argv; pg_restore uses the same env and the CLI prints only `user@host/database`.
14. PASS - `pnpm api:docs` then `git diff --exit-code docs/API.md` is clean.
15. PASS - `dangerouslySetInnerHTML` does not appear in the new features.
16. PASS - no em dash (U+2014) in any changed non-kit file.
17. PASS - `docs/API.md`, `docs/dealflow/PROJECTS.md` and `docs/dealflow/BACKUPS.md` exist; `UPSTREAM.md` has the Part 8 section.
18. PASS - `pnpm check:progress --final` passes (run in Task 4.5).
