import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as oneClickPost } from "@/app/u/[token]/route";
import { consentEvents, marketingTokens, personMarketing, persons } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import { captureMailer } from "@/features/mailer/captureMailer";
import { setSystemMailerForTest } from "@/features/mailer/systemMailer";
import { confirmDoubleOptIn, loadDoubleOptInContext, requestDoubleOptIn } from "./doubleOptIn";
import { transitionMarketingStatus } from "./service";
import { createMarketingToken, hashMarketingToken } from "./tokens";
import { applyUnsubscribe, requestResubscribe } from "./unsubscribe";

type Db = Parameters<Parameters<typeof withTestDb>[0]>[0];

const signal = new AbortController().signal;

async function person(db: Db, email: string) {
  const user = await seedUser(db);
  const [row] = await db
    .insert(persons)
    .values({ name: "Mia Novak", primaryEmail: email, ownerId: user.id, visibilityLevel: "all" })
    .returning();
  if (row === undefined) throw new Error("person seed failed");
  return row;
}

async function captured(
  dir: string,
): Promise<Array<{ to: string; subject: string; html: string }>> {
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json"));
  return Promise.all(
    files.map(async (name) => {
      const raw = await readFile(join(dir, name), "utf8");
      return JSON.parse(raw) as { to: string; subject: string; html: string };
    }),
  );
}

function tokenFromMail(html: string): string {
  const match = /https:\/\/app\.example\.com\/c\/([A-Za-z0-9_-]+)/.exec(html);
  if (match?.[1] === undefined) throw new Error("no confirmation link in the captured email");
  return match[1];
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "dealflow-doi-"));
  setSystemMailerForTest(captureMailer(dir));
});

afterEach(() => {
  setSystemMailerForTest(null);
});

describe("double opt-in and unsubscribe", () => {
  it("stores only the token hash", async () => {
    await withTestDb(async (db) => {
      const row = await person(db, "mia@example.com");
      const minted = await createMarketingToken(
        db,
        { purpose: "doi", personId: row.id, expiresAt: new Date(Date.now() + 60_000) },
        signal,
      );
      const [stored] = await db
        .select()
        .from(marketingTokens)
        .where(eq(marketingTokens.tokenHash, hashMarketingToken(minted.token)));
      expect(stored?.tokenHash).toBe(hashMarketingToken(minted.token));
      expect(stored?.tokenHash).not.toBe(minted.token);
    });
  });

  it("sends one confirmation, and confirms exactly once", async () => {
    await withTestDb(async (db) => {
      const row = await person(db, "mia@example.com");
      const requested = await requestDoubleOptIn(db, row.id, signal);
      expect(requested.ok).toBe(true);
      const mails = await captured(dir);
      expect(mails).toHaveLength(1);
      expect(mails[0]?.to).toBe("mia@example.com");
      expect(mails[0]?.subject).toContain("confirm your subscription");

      const token = tokenFromMail(mails[0]?.html ?? "");
      const first = await confirmDoubleOptIn(
        db,
        token,
        { ip: "203.0.113.9", userAgent: "vitest" },
        signal,
      );
      expect(first.ok).toBe(true);
      const [marketing] = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, row.id));
      expect(marketing?.status).toBe("subscribed");

      const second = await confirmDoubleOptIn(db, token, { ip: null, userAgent: null }, signal);
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.error.id).toBe("E_MARKETING_002");
    });
  });

  it("refuses an expired confirmation", async () => {
    await withTestDb(async (db) => {
      const row = await person(db, "mia@example.com");
      const minted = await createMarketingToken(
        db,
        { purpose: "doi", personId: row.id, expiresAt: new Date(Date.now() - 1000) },
        signal,
      );
      const result = await confirmDoubleOptIn(
        db,
        minted.token,
        { ip: null, userAgent: null },
        signal,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.id).toBe("E_MARKETING_002");
    });
  });

  it("never mutates on the GET context read", async () => {
    await withTestDb(async (db) => {
      const row = await person(db, "mia@example.com");
      await requestDoubleOptIn(db, row.id, signal);
      const mails = await captured(dir);
      const token = tokenFromMail(mails[0]?.html ?? "");

      const before = await loadDoubleOptInContext(db, token, signal);
      expect(before.valid).toBe(true);
      const after = await loadDoubleOptInContext(db, token, signal);
      expect(after.valid).toBe(true);

      const [stored] = await db
        .select()
        .from(marketingTokens)
        .where(eq(marketingTokens.tokenHash, hashMarketingToken(token)));
      expect(stored?.usedAt).toBeNull();
    });
  });

  it("limits a second confirmation request for the same person within a day", async () => {
    await withTestDb(async (db) => {
      const row = await person(db, "mia@example.com");
      const first = await requestDoubleOptIn(db, row.id, signal);
      expect(first.ok && first.value.sent).toBe(true);
      const second = await requestDoubleOptIn(db, row.id, signal);
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.value.sent).toBe(false);
        expect(second.value.limited).toBe("person");
      }
      expect(await captured(dir)).toHaveLength(1);
    });
  });

  it("requires the exact one-click body for the 200 path", async () => {
    await withTestDb(async (db) => {
      const row = await person(db, "mia@example.com");
      await transitionMarketingStatus(
        db,
        { personId: row.id, to: "subscribed", source: "manual", basis: "explicit" },
        signal,
      );
      // The route resolves the app's singleton connection, so this test asserts the HTTP
      // contract only; the state change is asserted through the service below.
      const token = randomUUID();
      const call = (body: string) =>
        oneClickPost(
          new NextRequest(`http://localhost/u/${token}`, {
            method: "POST",
            body,
            headers: { "content-type": "application/x-www-form-urlencoded" },
          }),
          { params: Promise.resolve({ token }) },
        );

      const wrong = await call("intent=unsubscribe");
      expect(wrong.status).toBe(400);

      const correct = await call("List-Unsubscribe=One-Click");
      expect(correct.status).toBe(200);
      expect(correct.headers.get("x-robots-tag")).toBe("noindex");

      const [still] = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, row.id));
      expect(still?.status).toBe("subscribed");
    });
  });

  it("unsubscribes with the one-click source and records the event", async () => {
    await withTestDb(async (db) => {
      const row = await person(db, "mia@example.com");
      await transitionMarketingStatus(
        db,
        { personId: row.id, to: "subscribed", source: "manual", basis: "explicit" },
        signal,
      );
      const minted = await createMarketingToken(db, { purpose: "unsub", personId: row.id }, signal);

      const result = await applyUnsubscribe(
        db,
        minted.token,
        { source: "one_click", ip: null, userAgent: null },
        signal,
      );
      expect(result.ok).toBe(true);
      const [after] = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, row.id));
      expect(after?.status).toBe("unsubscribed");
      const events = await db
        .select()
        .from(consentEvents)
        .where(eq(consentEvents.personId, row.id));
      expect(events.at(-1)?.source).toBe("one_click");
    });
  });

  it("unsubscribes through the link and resubscribes only through double opt-in", async () => {
    await withTestDb(async (db) => {
      const row = await person(db, "mia@example.com");
      await transitionMarketingStatus(
        db,
        { personId: row.id, to: "subscribed", source: "manual", basis: "explicit" },
        signal,
      );
      const minted = await createMarketingToken(db, { purpose: "unsub", personId: row.id }, signal);

      const unsubscribed = await applyUnsubscribe(
        db,
        minted.token,
        { source: "unsubscribe_link", ip: null, userAgent: null },
        signal,
      );
      expect(unsubscribed.ok).toBe(true);

      const resubscribe = await requestResubscribe(db, minted.token, signal);
      expect(resubscribe.ok).toBe(true);
      if (resubscribe.ok) expect(resubscribe.value.sent).toBe(true);
      const [pending] = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, row.id));
      expect(pending?.status).toBe("pending");

      const mails = await captured(dir);
      expect(mails).toHaveLength(1);
      const token = tokenFromMail(mails[0]?.html ?? "");
      const confirmed = await confirmDoubleOptIn(db, token, { ip: null, userAgent: null }, signal);
      expect(confirmed.ok).toBe(true);
      const [subscribed] = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, row.id));
      expect(subscribed?.status).toBe("subscribed");
    });
  });

  it("returns an invalid context for an unknown token", async () => {
    await withTestDb(async (db) => {
      const context = await loadDoubleOptInContext(db, randomUUID(), signal);
      expect(context.valid).toBe(false);
    });
  });
});
