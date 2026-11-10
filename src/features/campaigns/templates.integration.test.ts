import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { persons } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import { captureMailer } from "@/features/mailer/captureMailer";
import { setSystemMailerForTest } from "@/features/mailer/systemMailer";
import type { PermSetUser } from "@/features/permissions/effective";
import { campaignDocumentSchema } from "./blocks/schema";
import { CAMPAIGN_STARTERS } from "./blocks/starters";
import {
  deleteCampaignTemplate,
  duplicateCampaignTemplate,
  listCampaignTemplates,
  saveCampaignTemplate,
} from "./templates";
import { sendCampaignTest } from "./testSend";

type Db = Parameters<Parameters<typeof withTestDb>[0]>[0];

const signal = new AbortController().signal;

function actorOf(id: string, type: "admin" | "regular" = "admin"): PermSetUser {
  return {
    id,
    type,
    isActive: true,
    groupIds: new Set(),
    flags: new Set(type === "regular" ? ["campaigns.edit"] : []),
  };
}

async function captured(
  dir: string,
): Promise<Array<{ to: string; subject: string; html: string }>> {
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json"));
  return Promise.all(
    files.map(async (name) => JSON.parse(await readFile(join(dir, name), "utf8"))),
  );
}

afterEach(() => {
  setSystemMailerForTest(null);
});

describe("starters", () => {
  it("every starter validates against the block document schema", () => {
    for (const starter of CAMPAIGN_STARTERS) {
      const parsed = campaignDocumentSchema.safeParse(starter.document);
      expect(parsed.success, starter.key).toBe(true);
    }
  });
});

describe("saved templates", () => {
  it("saves, lists, duplicates and deletes a template", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const starter = CAMPAIGN_STARTERS[0]!;
      const saved = await saveCampaignTemplate(
        db,
        actorOf(user.id),
        { name: "Monthly", content: starter.document },
        signal,
      );
      expect(saved.ok).toBe(true);
      if (!saved.ok) return;

      const list = await listCampaignTemplates(db, signal);
      expect(list.map((row) => row.name)).toContain("Monthly");

      const copy = await duplicateCampaignTemplate(db, actorOf(user.id), saved.value.id, signal);
      expect(copy.ok).toBe(true);
      if (copy.ok) expect(copy.value.id).not.toBe(saved.value.id);

      const deleted = await deleteCampaignTemplate(db, actorOf(user.id), saved.value.id, signal);
      expect(deleted.ok).toBe(true);
      expect((await listCampaignTemplates(db, signal)).map((row) => row.name)).not.toContain(
        "Monthly",
      );
    });
  });

  it("requires campaigns.edit", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const restricted: PermSetUser = {
        id: user.id,
        type: "regular",
        isActive: true,
        groupIds: new Set(),
        flags: new Set(),
      };
      const result = await saveCampaignTemplate(
        db,
        restricted,
        { name: "No", content: CAMPAIGN_STARTERS[3]!.document },
        signal,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.id).toBe("E_PERM_001");
    });
  });
});

describe("test send", () => {
  it("sends one [Test] email per recipient, restricted to users", async () => {
    await withTestDb(async (db) => {
      const owner = await seedUser(db);
      const recipient = await seedUser(db, { email: "tester@example.com" });
      const [person] = await db
        .insert(persons)
        .values({
          name: "Aria Reyes",
          firstName: "Aria",
          primaryEmail: "aria@example.com",
          ownerId: owner.id,
          visibilityLevel: "all",
        })
        .returning();
      expect(person).toBeDefined();

      const dir = await mkdtemp(join(tmpdir(), "dealflow-test-send-"));
      setSystemMailerForTest(captureMailer(dir));
      const result = await sendCampaignTest(
        db,
        actorOf(owner.id),
        {
          document: CAMPAIGN_STARTERS[1]!.document,
          subject: "Something new",
          personId: person!.id,
          recipients: [recipient.email],
        },
        signal,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.sent).toBe(1);

      const mails = await captured(dir);
      expect(mails).toHaveLength(1);
      expect(mails[0]?.to).toBe("tester@example.com");
      expect(mails[0]?.subject.startsWith("[Test] ")).toBe(true);
      expect(mails[0]?.html).toContain("Aria");
      expect(mails[0]?.html).toContain("Unsubscribe");
    });
  });

  it("refuses a recipient who is not a user of the install", async () => {
    await withTestDb(async (db) => {
      const owner = await seedUser(db);
      const [person] = await db
        .insert(persons)
        .values({
          name: "Aria",
          primaryEmail: "aria@example.com",
          ownerId: owner.id,
          visibilityLevel: "all",
        })
        .returning();
      const result = await sendCampaignTest(
        db,
        actorOf(owner.id),
        {
          document: CAMPAIGN_STARTERS[3]!.document,
          subject: "Test",
          personId: person!.id,
          recipients: ["outsider@example.com"],
        },
        signal,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.id).toBe("E_CAMPAIGN_001");
    });
  });

  it("refuses more than five recipients", async () => {
    await withTestDb(async (db) => {
      const owner = await seedUser(db);
      const [person] = await db
        .insert(persons)
        .values({
          name: "Aria",
          primaryEmail: "aria@example.com",
          ownerId: owner.id,
          visibilityLevel: "all",
        })
        .returning();
      const result = await sendCampaignTest(
        db,
        actorOf(owner.id),
        {
          document: CAMPAIGN_STARTERS[3]!.document,
          subject: "Test",
          personId: person!.id,
          recipients: Array.from({ length: 6 }, (_, index) => `u${index}@example.com`),
        },
        signal,
      );
      expect(result.ok).toBe(false);
    });
  });
});
