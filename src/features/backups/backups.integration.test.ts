import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as downloadRoute } from "@/app/(app)/settings/backups/[file]/download/route";
import { ERROR_IDS } from "@/constants/errorIds";
import { backupRuns } from "@/db/schema";
import { seedUser } from "@/db/testing/factories";
import { FakeStorageClient } from "@/features/files/storageFake";
import { setSystemMailerForTest } from "@/features/mailer/systemMailer";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb, type TestDb } from "@/test/db";
import { ok } from "@/types/result";
import { type BackupRunners, runBackup } from "./backup";
import { backupFileName } from "./retention";

let h: TestDb;
let admin: PermSetUser;
let regular: PermSetUser;
let dir: string;
let currentActor: PermSetUser | null = null;
const sent: string[] = [];

vi.mock("@/server/trpc/context", () => ({
  createContext: () => Promise.resolve({ actor: currentActor, session: { id: "test-session" } }),
}));
vi.mock("@/db/client", () => ({
  get db() {
    return h.db;
  },
  get pool() {
    return h.pool;
  },
}));

const sig = (): AbortSignal => AbortSignal.timeout(20_000);

function actor(row: { id: string; isAdmin: boolean }): PermSetUser {
  return {
    id: row.id,
    type: row.isAdmin ? "admin" : "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
}

function storage(): FakeStorageClient {
  const fake = new FakeStorageClient();
  fake.objectBytes.set("deals/a.pdf", Buffer.from("pdf"));
  fake.objectBytes.set("avatars/b.png", Buffer.from("png"));
  return fake;
}

const runners: BackupRunners = {
  dump: async (file) => {
    await writeFile(file, "fake dump");
    return { exitCode: 0 };
  },
  archive: async (file) => {
    await writeFile(file, "fake archive");
    return { exitCode: 0 };
  },
};

beforeAll(async () => {
  h = await makeTestDb();
  admin = actor(await seedUser(h.db, { isAdmin: true, name: "Ada Admin" }));
  regular = actor(await seedUser(h.db, { name: "Rita Regular" }));
  dir = await mkdtemp(join(tmpdir(), "dealflow-backup-"));
  setSystemMailerForTest({
    mode: "capture",
    send: async (mail) => {
      sent.push(mail.subject);
      return ok({ messageId: "fake" });
    },
  });
}, 60_000);

afterAll(async () => {
  setSystemMailerForTest(null);
  await rm(dir, { recursive: true, force: true });
  await h.close();
});

describe("runBackup", () => {
  it("writes a run row, mirrors files and prunes to BACKUP_KEEP", async () => {
    const oldName = backupFileName(new Date("2020-01-01T02:00:00Z"));
    await writeFile(join(dir, oldName), "old");

    const result = await runBackup(h.db, { trigger: "manual", startedBy: admin.id }, sig(), {
      dir,
      keep: 1,
      enabled: true,
      storage: storage(),
      runners,
      appVersion: "test",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.running).toBe(false);
    expect(result.value.fileName).toMatch(/^dealflow-backup-.+\.tar\.gz$/);
    const [row] = await h.db.select().from(backupRuns).where(eq(backupRuns.id, result.value.runId));
    expect(row?.status).toBe("succeeded");
    expect(row?.fileCount).toBe(2);
    expect(row?.dbBytes).toBeGreaterThan(0);
    const names = await readdir(dir);
    expect(names).not.toContain(oldName);
    expect(names).toContain(result.value.fileName);
  });

  it("marks the run failed, removes the partial archive and emails admins when pg_dump fails", async () => {
    sent.length = 0;
    const failing: BackupRunners = {
      dump: async () => ({ exitCode: 2 }),
      archive: async () => {
        throw new Error("archive must not run");
      },
    };
    const result = await runBackup(h.db, { trigger: "schedule" }, sig(), {
      dir,
      keep: 2,
      enabled: true,
      storage: storage(),
      runners: failing,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.id).toBe(ERROR_IDS.BACKUP_FAILED);

    const [row] = await h.db.select().from(backupRuns).orderBy(backupRuns.startedAt).limit(5);
    const failed = await h.db.select().from(backupRuns).where(eq(backupRuns.status, "failed"));
    expect(failed.length).toBeGreaterThanOrEqual(1);
    expect(failed.some((run) => run.errorDetail?.includes("pg_dump"))).toBe(true);
    expect(row).toBeDefined();
    expect(sent.length).toBeGreaterThanOrEqual(1);
  });

  it("returns the running run to a second concurrent caller", async () => {
    const slow: BackupRunners = {
      dump: async (file) => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        await writeFile(file, "slow dump");
        return { exitCode: 0 };
      },
      archive: async (file) => {
        await writeFile(file, "archive");
        return { exitCode: 0 };
      },
    };
    const first = runBackup(h.db, { trigger: "manual" }, sig(), {
      dir,
      keep: 2,
      enabled: true,
      storage: storage(),
      runners: slow,
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = await runBackup(h.db, { trigger: "manual" }, sig(), {
      dir,
      keep: 2,
      enabled: true,
      storage: storage(),
      runners: slow,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.running).toBe(true);
    const done = await first;
    expect(done.ok).toBe(true);
  });
});

describe("download route", () => {
  it("refuses a non-admin and a path-traversal name", async () => {
    currentActor = regular;
    const denied = await downloadRoute(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ file: "dealflow-backup-2026-10-21T020000Z.tar.gz" }),
    });
    expect(denied.status).toBe(403);

    currentActor = admin;
    for (const file of ["../x", "dealflow-backup-2026-10-21T020000Z.tar.gz/../../x", "notes.txt"]) {
      const response = await downloadRoute(new NextRequest("http://localhost/x"), {
        params: Promise.resolve({ file }),
      });
      expect(response.status).toBe(404);
    }
  });

  it("returns 404 for a correctly shaped name that does not exist", async () => {
    currentActor = admin;
    const response = await downloadRoute(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ file: "dealflow-backup-2026-10-21T020000Z.tar.gz" }),
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { id: string } };
    expect(body.error.id).toBe(ERROR_IDS.BACKUP_NOT_FOUND);
  });
});
