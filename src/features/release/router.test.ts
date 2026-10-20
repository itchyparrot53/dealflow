import { afterAll, beforeAll, expect, it } from "vitest";
import { seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeCaller } from "@/server/testCaller";
import { makeTestDb } from "@/test/db";
import { computeStatus } from "./computeStatus";
import { getCurrentVersion, readPackageVersion } from "./currentVersion";
import { readReleaseStatus, upsertReleaseStatus } from "./releaseStatus";

let ctx: Awaited<ReturnType<typeof makeTestDb>>;
beforeAll(async () => {
  ctx = await makeTestDb();
});
afterAll(async () => {
  await ctx.close();
});

function makeActor(id: string): PermSetUser {
  return {
    id,
    type: "admin",
    isActive: true,
    groupIds: new Set<string>(),
    flags: new Set(),
  };
}

// The update check defaults to off in this build (PLAN-PART1 6.2), so the router reports disabled
// and never reveals a cached release. The enabled path is covered explicitly through computeStatus.
it("returns the current version with no update when nothing is cached", async () => {
  const user = await seedUser(ctx.db);
  const caller = makeCaller(ctx.db, makeActor(user.id));
  const s = await caller.version.get();
  expect(s.current).toBe(readPackageVersion());
  expect(s.latest).toBeNull();
  expect(s.updateAvailable).toBeNull();
  expect(s.disabled).toBe(true);
});

it("reports an update available when a newer release is cached", async () => {
  await upsertReleaseStatus(ctx.db, {
    latestTag: "v999.0.0",
    releaseUrl: "https://github.com/sneg55/warpdrive/releases/tag/v999.0.0",
    releaseNotes: "big news",
  });
  const row = await readReleaseStatus(ctx.db);
  const s = computeStatus(getCurrentVersion(), row, false);
  expect(s.latest).toBe("v999.0.0");
  expect(s.releaseNotes).toBe("big news");
  expect(s.updateAvailable).toBe(true);
});
