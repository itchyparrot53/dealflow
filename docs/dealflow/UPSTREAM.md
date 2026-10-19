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
  PLAN-PART1.md 6.1 (Task 0.1).
