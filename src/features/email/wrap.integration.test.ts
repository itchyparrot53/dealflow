import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import { gmailProviderForTest } from "@/features/mail/provider/gmailAdapter";
import { FakeStorageClient } from "../files/storageFake";
import { FakeGmailClient } from "./gmailFake";
import { sendEmail } from "./send";

type Db = Parameters<Parameters<typeof withTestDb>[0]>[0];

async function seedAccount(db: Db, userId: string): Promise<string> {
  const row = (
    await db.execute(
      sql`INSERT INTO email_accounts (user_id, email_address) VALUES (${userId}, 'sender@example.com') RETURNING id`,
    )
  ).rows[0] as { id: string };
  return row.id;
}

async function seedSignature(db: Db, userId: string): Promise<string> {
  const row = (
    await db.execute(sql`
      INSERT INTO signatures (user_id, name, body_html)
      VALUES (${userId}, 'Test Sig', '<p>Best regards, Sam</p>')
      RETURNING id
    `)
  ).rows[0] as { id: string };
  return row.id;
}

function decodeParts(mimeText: string): string {
  return [
    ...mimeText.matchAll(/Content-Transfer-Encoding: base64\r?\n\r?\n([\s\S]*?)(?=\r?\n--|$)/g),
  ]
    .map((match) => Buffer.from((match[1] ?? "").replace(/\s+/g, ""), "base64").toString("utf-8"))
    .join("\n");
}

async function storedBody(db: Db, accountId: string): Promise<string> {
  const row = (
    await db.execute(
      sql`SELECT body_html FROM email_messages WHERE account_id=${accountId} ORDER BY sent_at DESC LIMIT 1`,
    )
  ).rows[0] as { body_html: string | null } | undefined;
  return row?.body_html ?? "";
}

describe("customer email wrapping in the send path", () => {
  it("wraps a new email in the branded layout with the signature, footer and tracking inside", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const accountId = await seedAccount(db, user.id);
      const signatureId = await seedSignature(db, user.id);
      const gmail = new FakeGmailClient();
      const result = await sendEmail(db, {
        actorId: user.id,
        actorType: "regular",
        actorGroupIds: new Set<string>(),
        provider: gmailProviderForTest(db, accountId, gmail),
        storage: new FakeStorageClient(),
        input: {
          accountId,
          idempotencyKey: "44444444-4444-4444-4444-444444444444",
          to: ["customer@example.com"],
          subject: "Hello",
          bodyHtml: '<p>Body text with a <a href="https://example.com/page">link</a>.</p>',
          signatureId,
          trackOpens: true,
          trackLinks: true,
        },
      });
      expect(result.ok).toBe(true);

      const body = await storedBody(db, accountId);
      expect(body.match(/data-df-layout=/g)).toHaveLength(1);
      expect(body).toContain('data-df-layout="customer-branded"');
      expect(body).toContain("Body text");
      expect(body).toContain("Best regards, Sam");
      expect(body).toContain('<div style="margin:0 0 2px;">Dealflow</div>');
      // Tracking is inside the layout: both the pixel and the rewritten link survive.
      expect(body).toContain("/t/open/");
      expect(body).toContain("/t/click/");
      expect(body.indexOf("/t/open/")).toBeGreaterThan(body.indexOf("data-df-layout"));

      const sendCall = gmail.calls.find((call) => call.method === "sendRaw");
      expect(sendCall).toBeDefined();
      if (sendCall === undefined) return;
      const mime = Buffer.from(
        (sendCall.args as { rawBase64: string }).rawBase64,
        "base64url",
      ).toString("utf-8");
      expect(decodeParts(mime)).toContain("Best regards, Sam");
    });
  }, 60_000);

  it("sends plain when the composer chooses it: no marker, no layout", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const accountId = await seedAccount(db, user.id);
      const gmail = new FakeGmailClient();
      const result = await sendEmail(db, {
        actorId: user.id,
        actorType: "regular",
        actorGroupIds: new Set<string>(),
        provider: gmailProviderForTest(db, accountId, gmail),
        storage: new FakeStorageClient(),
        input: {
          accountId,
          idempotencyKey: "55555555-5555-5555-5555-555555555555",
          to: ["customer@example.com"],
          subject: "Plain",
          bodyHtml: "<p>Plain body.</p>",
          layout: "plain",
        },
      });
      expect(result.ok).toBe(true);
      const body = await storedBody(db, accountId);
      expect(body).not.toContain("data-df-layout");
      expect(body).toContain("Plain body.");
    });
  }, 60_000);
});
