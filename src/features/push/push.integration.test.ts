import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "@/constants/notificationTypes";
import { notificationPushPrefs, pushSubscriptions } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import { notificationLabel } from "@/features/notifications/labels";
import type { AuthUser } from "@/features/permissions/types";
import { deliverPush } from "./deliver";
import { getPushPrefs, setPushPref } from "./prefs";
import { listMySubscriptions, subscribePush, unsubscribePush } from "./subscriptions";
import { pushConfigFrom } from "./vapid";

const ENDPOINT = "https://push.example.test/subscription-1";
const SUB = {
  endpoint: ENDPOINT,
  keys: { p256dh: "p256dh-value", auth: "auth-value" },
  userAgent: "Test browser",
};

function actor(id: string): AuthUser {
  return { id, type: "admin", isActive: true, groupIds: new Set() };
}

function signal(): AbortSignal {
  return new AbortController().signal;
}

describe("push subscriptions", () => {
  it("upserts an endpoint instead of duplicating it", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const first = await subscribePush(db, actor(user.id), SUB, signal());
      expect(first.ok).toBe(true);
      const second = await subscribePush(
        db,
        actor(user.id),
        { ...SUB, keys: { p256dh: "rotated-p256dh", auth: "rotated-auth" } },
        signal(),
      );
      expect(second.ok).toBe(true);
      const rows = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, user.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.p256dh).toBe("rotated-p256dh");
    });
  });

  it("moves a shared endpoint to the user that re-subscribes", async () => {
    await withTestDb(async (db) => {
      const first = await seedUser(db, { name: "First" });
      const second = await seedUser(db, { name: "Second" });
      await subscribePush(db, actor(first.id), SUB, signal());
      await subscribePush(db, actor(second.id), SUB, signal());
      const rows = await db.select().from(pushSubscriptions);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.userId).toBe(second.id);
      expect(await listMySubscriptions(db, first.id, signal())).toHaveLength(0);
      expect(await listMySubscriptions(db, second.id, signal())).toHaveLength(1);
    });
  });

  it("refuses a non-https endpoint with E_PUSH_002", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const result = await subscribePush(
        db,
        actor(user.id),
        { ...SUB, endpoint: "http://push.example.test/subscription-1" },
        signal(),
      );
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected a refusal");
      expect(result.error.id).toBe("E_PUSH_002");
      expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
    });
  });

  it("refuses missing keys with E_PUSH_002", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const result = await subscribePush(
        db,
        actor(user.id),
        { endpoint: ENDPOINT, keys: { p256dh: "", auth: "" } },
        signal(),
      );
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected a refusal");
      expect(result.error.id).toBe("E_PUSH_002");
    });
  });

  it("unsubscribes only the actor's endpoint", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const other = await seedUser(db, { name: "Other" });
      await subscribePush(db, actor(user.id), SUB, signal());
      await subscribePush(
        db,
        actor(other.id),
        { ...SUB, endpoint: "https://push.example.test/subscription-2" },
        signal(),
      );
      const removed = await unsubscribePush(db, actor(user.id), ENDPOINT, signal());
      expect(removed.ok).toBe(true);
      expect(await listMySubscriptions(db, user.id, signal())).toHaveLength(0);
      expect(await listMySubscriptions(db, other.id, signal())).toHaveLength(1);
    });
  });
});

describe("push preferences", () => {
  it("merges the defaults when there are no rows", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const prefs = await getPushPrefs(db, user.id, signal());
      expect(Object.keys(prefs).sort()).toEqual([...NOTIFICATION_TYPES].sort());
      expect(prefs.mention).toBe(true);
      expect(prefs.activity_assigned).toBe(true);
      expect(prefs.project_task_assigned).toBe(true);
      expect(prefs.booking_created).toBe(true);
      expect(prefs.document_accepted).toBe(true);
      expect(prefs.form_submission).toBe(true);
      expect(prefs.comment_reply).toBe(false);
      expect(prefs.deal_won).toBe(false);
    });
  });

  it("persists one override and keeps the other defaults", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      await setPushPref(db, user.id, "mention", false, signal());
      const rows = await db
        .select()
        .from(notificationPushPrefs)
        .where(eq(notificationPushPrefs.userId, user.id));
      expect(rows).toEqual([{ userId: user.id, type: "mention", enabled: false }]);
      const prefs = await getPushPrefs(db, user.id, signal());
      expect(prefs.mention).toBe(false);
      expect(prefs.activity_assigned).toBe(true);
    });
  });

  it("upserts a repeated set", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      await setPushPref(db, user.id, "deal_won", true, signal());
      await setPushPref(db, user.id, "deal_won", false, signal());
      const rows = await db
        .select()
        .from(notificationPushPrefs)
        .where(eq(notificationPushPrefs.userId, user.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.enabled).toBe(false);
    });
  });
});

describe("push.config", () => {
  const empty = {
    PUSH_FAKE: false,
    VAPID_PUBLIC_KEY: "",
    VAPID_PRIVATE_KEY: "",
    VAPID_SUBJECT: "",
  };

  it("is off without keys and never carries the private key", () => {
    const config = pushConfigFrom(empty);
    expect(config).toEqual({ enabled: false, publicKey: "" });
    expect(JSON.stringify(config)).not.toContain("PRIVATE");
  });

  it("returns only the public key when configured", () => {
    const config = pushConfigFrom({
      PUSH_FAKE: false,
      VAPID_PUBLIC_KEY: "public-key-value",
      VAPID_PRIVATE_KEY: "private-key-value",
      VAPID_SUBJECT: "mailto:ops@example.test",
    });
    expect(config).toEqual({ enabled: true, publicKey: "public-key-value" });
    expect(JSON.stringify(config)).not.toContain("private-key-value");
  });

  it("is enabled in capture mode even without keys", () => {
    expect(pushConfigFrom({ ...empty, PUSH_FAKE: true })).toEqual({ enabled: true, publicKey: "" });
  });
});

async function captureDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "dealflow-push-"));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

function mention(userId: string): {
  id: string;
  userId: string;
  type: "mention";
  entityType: null;
  entityId: null;
  payload: Record<string, unknown>;
} {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId,
    type: "mention",
    entityType: null,
    entityId: null,
    payload: { title: "Acme renewal" },
  };
}

describe("push delivery", () => {
  it("capture mode writes one file per subscription with the expected payload", async () => {
    const capture = await captureDir();
    try {
      await withTestDb(async (db) => {
        const user = await seedUser(db);
        await subscribePush(db, actor(user.id), SUB, signal());
        await subscribePush(
          db,
          actor(user.id),
          { ...SUB, endpoint: "https://push.example.test/subscription-2" },
          signal(),
        );
        const result = await deliverPush(db, mention(user.id), signal(), {
          mode: "fake",
          captureDir: capture.dir,
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.sent).toBe(2);
        const files = await readdir(capture.dir);
        expect(files).toHaveLength(2);
        const captured = await Promise.all(
          files.map(
            async (file) =>
              JSON.parse(await readFile(join(capture.dir, file), "utf8")) as {
                endpoint: string;
                payload: string;
              },
          ),
        );
        expect(captured.map((entry) => entry.endpoint).sort()).toEqual(
          [SUB.endpoint, "https://push.example.test/subscription-2"].sort(),
        );
        const first = captured[0];
        if (first === undefined) throw new Error("no capture file");
        expect(JSON.parse(first.payload)).toEqual({
          title: notificationLabel("mention", { title: "Acme renewal" }),
          body: "",
          url: "/",
          tag: mention(user.id).id,
        });
      });
    } finally {
      await capture.cleanup();
    }
  });

  it("writes nothing when the type's preference is off", async () => {
    const capture = await captureDir();
    try {
      await withTestDb(async (db) => {
        const user = await seedUser(db);
        await subscribePush(db, actor(user.id), SUB, signal());
        await setPushPref(db, user.id, "mention", false, signal());
        const result = await deliverPush(db, mention(user.id), signal(), {
          mode: "fake",
          captureDir: capture.dir,
        });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.sent).toBe(0);
        expect(await readdir(capture.dir).catch(() => [])).toHaveLength(0);
      });
    } finally {
      await capture.cleanup();
    }
  });

  it("is a silent no-op when push is not configured", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      await subscribePush(db, actor(user.id), SUB, signal());
      const result = await deliverPush(db, mention(user.id), signal());
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual({ sent: 0, removed: 0 });
      expect(await db.select().from(pushSubscriptions)).toHaveLength(1);
    });
  });

  it("deletes a subscription the push service reports as gone (410)", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      await subscribePush(db, actor(user.id), SUB, signal());
      const result = await deliverPush(db, mention(user.id), signal(), {
        mode: "send",
        sender: () => Promise.resolve({ ok: false, statusCode: 410 }),
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.removed).toBe(1);
      expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
    });
  });

  it("removes the subscription after five failures", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      await subscribePush(db, actor(user.id), SUB, signal());
      const sender = (): Promise<{ ok: false; statusCode: number }> =>
        Promise.resolve({ ok: false, statusCode: 500 });
      for (let i = 0; i < 4; i += 1) {
        await deliverPush(db, mention(user.id), signal(), { mode: "send", sender });
      }
      const [afterFour] = await db.select().from(pushSubscriptions);
      expect(afterFour?.failures).toBe(4);
      await deliverPush(db, mention(user.id), signal(), { mode: "send", sender });
      expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
    });
  });

  it("resets failures and records the success time after a successful send", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      await subscribePush(db, actor(user.id), SUB, signal());
      await db.update(pushSubscriptions).set({ failures: 3 });
      const result = await deliverPush(db, mention(user.id), signal(), {
        mode: "send",
        sender: () => Promise.resolve({ ok: true }),
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.sent).toBe(1);
      const [row] = await db.select().from(pushSubscriptions);
      expect(row?.failures).toBe(0);
      expect(row?.lastSuccessAt).not.toBeNull();
    });
  });
});
