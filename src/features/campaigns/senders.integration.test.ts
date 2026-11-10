import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import { captureMailer } from "@/features/mailer/captureMailer";
import { setSystemMailerForTest } from "@/features/mailer/systemMailer";
import type { PermSetUser } from "@/features/permissions/effective";
import { addSender, listSenders, setDefaultSender, verifySenderToken } from "./senders";

const signal = new AbortController().signal;

function actorOf(id: string, type: "admin" | "regular" = "admin"): PermSetUser {
  return { id, type, isActive: true, groupIds: new Set(), flags: new Set() };
}

afterEach(() => setSystemMailerForTest(null));

describe("campaign senders", () => {
  it("adds a sender, captures the verification email and verifies it once", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const dir = await mkdtemp(join(tmpdir(), "dealflow-sender-"));
      setSystemMailerForTest(captureMailer(dir));

      const added = await addSender(
        db,
        actorOf(user.id),
        { fromName: "Northwind News", fromEmail: "news@example.com" },
        signal,
      );
      expect(added.ok).toBe(true);
      if (!added.ok) return;
      expect(added.value.verificationSent).toBe(true);

      const files = (await readdir(dir)).filter((name) => name.endsWith(".json"));
      expect(files).toHaveLength(1);
      const mail = JSON.parse(await readFile(join(dir, files[0]!), "utf8")) as { html: string };
      const token = /https:\/\/app\.example\.com\/campaign-verify\/([A-Za-z0-9_-]+)/.exec(
        mail.html,
      )?.[1];
      expect(token).toBeDefined();

      const verified = await verifySenderToken(db, token!, signal);
      expect(verified.ok).toBe(true);
      const [sender] = await listSenders(db, signal);
      expect(sender?.verified).toBe(true);

      const again = await verifySenderToken(db, token!, signal);
      expect(again.ok).toBe(false);
    });
  });

  it("sets a verified sender as the only default", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const first = await addSender(
        db,
        actorOf(user.id),
        { fromName: "One", fromEmail: "one@example.com" },
        signal,
      );
      const second = await addSender(
        db,
        actorOf(user.id),
        { fromName: "Two", fromEmail: "two@example.com" },
        signal,
      );
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;

      // Unverified senders cannot become the default.
      const refused = await setDefaultSender(db, actorOf(user.id), first.value.id, signal);
      expect(refused.ok).toBe(false);
    });
  });

  it("requires marketing.manage", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const denied = await addSender(
        db,
        actorOf(user.id, "regular"),
        { fromName: "No", fromEmail: "no@example.com" },
        signal,
      );
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.error.id).toBe("E_PERM_001");
    });
  });
});
