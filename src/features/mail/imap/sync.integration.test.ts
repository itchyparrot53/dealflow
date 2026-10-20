import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import { hydrateOwner } from "@/features/email/syncCursor";
import type { AuthUser } from "@/features/permissions/types";
import { makeTestDb, type TestDb } from "@/test/db";
import { connectImapMailbox } from "../connect/connect";
import { createFakeTransportFactory } from "../transport/fake";
import { fakeDeliver, fakeList, fakeResetUidValidity } from "../transport/fakeStore";
import { runBackfillJob } from "./backfill";
import { syncImapAccount } from "./sync";

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);
const ADDRESS = "owner@umev.co.uk";
const PASSWORD = "fake-app-password-1";
const DAY = 24 * 60 * 60 * 1000;

let h: TestDb;
let dir: string;
let owner: AuthUser;
let accountId: string;

beforeAll(async () => {
  h = await makeTestDb();
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.db.execute(
    sql`TRUNCATE mail_sent_appends, mail_message_locations, mail_folder_cursors, email_message_headers, email_message_attachments, mail_account_credentials, email_send_attempts, email_messages, email_threads, email_accounts, notifications, persons, organizations, deals, stages, pipelines, users, permission_sets, settings, audit_events RESTART IDENTITY CASCADE`,
  );
  dir = mkdtempSync(join(tmpdir(), "dfmail-"));
  const user = await seedUser(h.db, { email: ADDRESS, name: "Owner" });
  const connected = await connectImapMailbox(
    h.db,
    {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: null,
      type: "regular",
      isActive: true,
      groupIds: new Set(),
      flags: new Set(),
    },
    { emailAddress: ADDRESS, password: PASSWORD, preset: "purelymail" },
    { transports: createFakeTransportFactory(dir), enqueueSync: () => Promise.resolve() },
    SIG(),
  );
  if (!connected.ok) throw new Error("connect fixture failed");
  accountId = connected.value.accountId;
  const hydrated = await hydrateOwner(h.db, user.id, SIG());
  if (!hydrated.ok) throw new Error("owner fixture failed");
  owner = hydrated.value;
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function deliver(fields: {
  from: string;
  subject: string;
  messageId: string;
  text?: string;
  inReplyTo?: string;
  references?: string[];
  date?: Date;
}): void {
  fakeDeliver(dir, { to: ADDRESS, ...fields });
}

async function openSession() {
  const opened = await createFakeTransportFactory(dir).openImap(
    { host: "fake", port: 993, secure: true, username: ADDRESS, password: PASSWORD },
    SIG(),
  );
  if (!opened.ok) throw new Error("session fixture failed");
  return opened.value;
}

async function syncNow(
  backfills: string[] = [],
  sessionOverride?: Awaited<ReturnType<typeof openSession>>,
) {
  const session = sessionOverride ?? (await openSession());
  try {
    return await syncImapAccount(
      h.db,
      { account: { id: accountId, emailAddress: ADDRESS }, owner, session, signal: SIG() },
      {
        enqueueBackfill: (id) => {
          backfills.push(id);
          return Promise.resolve();
        },
      },
    );
  } finally {
    await session.close();
  }
}

async function messageCount(): Promise<number> {
  const rows = (
    await h.db.execute(
      sql`SELECT count(*)::int AS n FROM email_messages WHERE account_id=${accountId}`,
    )
  ).rows as { n: number }[];
  return rows[0]?.n ?? 0;
}

async function threadOf(messageId: string): Promise<{ providerThreadId: string } | undefined> {
  const rows = (
    await h.db.execute(sql`
      SELECT t.provider_thread_id FROM email_messages m
      JOIN email_threads t ON t.id = m.thread_id
      WHERE m.account_id=${accountId} AND m.provider_message_id=${messageId}
    `)
  ).rows as { provider_thread_id: string }[];
  const row = rows[0];
  return row === undefined ? undefined : { providerThreadId: row.provider_thread_id };
}

describe("IMAP sync engine", () => {
  test("initial sync stores the last 90 days and enqueues a backfill", async () => {
    deliver({ from: "a@acme.test", subject: "Today", messageId: "<m-now@acme.test>" });
    deliver({
      from: "a@acme.test",
      subject: "Ten days",
      messageId: "<m-10@acme.test>",
      date: new Date(Date.now() - 10 * DAY),
    });
    deliver({
      from: "a@acme.test",
      subject: "Old",
      messageId: "<m-old@acme.test>",
      date: new Date(Date.now() - 100 * DAY),
    });

    const backfills: string[] = [];
    const synced = await syncNow(backfills);
    expect(synced.ok).toBe(true);
    expect(await messageCount()).toBe(2);
    expect(await threadOf("<m-old@acme.test>")).toBeUndefined();
    expect(backfills).toContain(accountId);

    const cursors = (
      await h.db.execute(
        sql`SELECT folder, uid_validity, backfill_before FROM mail_folder_cursors WHERE account_id=${accountId} AND folder='INBOX'`,
      )
    ).rows as { folder: string; uid_validity: string; backfill_before: string | null }[];
    expect(cursors).toHaveLength(1);
    expect(cursors[0]?.backfill_before).not.toBeNull();
  });

  test("threads by In-Reply-To and References, including a child before its parent", async () => {
    deliver({ from: "a@acme.test", subject: "Deal docs", messageId: "<a@acme.test>" });
    expect((await syncNow()).ok).toBe(true);

    deliver({
      from: "a@acme.test",
      subject: "Re: Deal docs",
      messageId: "<b@acme.test>",
      inReplyTo: "<a@acme.test>",
      references: ["<a@acme.test>"],
    });
    expect((await syncNow()).ok).toBe(true);

    deliver({
      from: "a@acme.test",
      subject: "Re: Deal docs",
      messageId: "<c@acme.test>",
      inReplyTo: "<d@acme.test>",
      references: ["<a@acme.test>", "<d@acme.test>"],
    });
    expect((await syncNow()).ok).toBe(true);

    deliver({
      from: "a@acme.test",
      subject: "Re: Deal docs",
      messageId: "<d@acme.test>",
      inReplyTo: "<a@acme.test>",
      references: ["<a@acme.test>"],
    });
    expect((await syncNow()).ok).toBe(true);

    const a = await threadOf("<a@acme.test>");
    expect(a?.providerThreadId).toBe("imap:<a@acme.test>");
    for (const id of ["<b@acme.test>", "<c@acme.test>", "<d@acme.test>"]) {
      expect((await threadOf(id))?.providerThreadId).toBe(a?.providerThreadId);
    }
  });

  test("falls back to subject plus participant within 30 days, but not for a stranger", async () => {
    deliver({ from: "alice@acme.test", subject: "Pricing", messageId: "<p@acme.test>" });
    expect((await syncNow()).ok).toBe(true);
    const base = await threadOf("<p@acme.test>");

    deliver({ from: "alice@acme.test", subject: "Re: Pricing", messageId: "<r@acme.test>" });
    expect((await syncNow()).ok).toBe(true);
    expect((await threadOf("<r@acme.test>"))?.providerThreadId).toBe(base?.providerThreadId);

    deliver({ from: "stranger@other.test", subject: "Re: Pricing", messageId: "<s@other.test>" });
    expect((await syncNow()).ok).toBe(true);
    expect((await threadOf("<s@other.test>"))?.providerThreadId).toBe("imap:<s@other.test>");
  });

  test("stores a message seen in INBOX and Sent once, with two locations", async () => {
    const raw = Buffer.from(
      [
        `From: ${ADDRESS}`,
        "To: friend@acme.test",
        "Subject: Both folders",
        "Message-ID: <dup@umev.co.uk>",
        "",
        "Body",
      ].join("\r\n"),
    );
    const session = await openSession();
    await session.append("INBOX", raw, [], SIG());
    await session.append("Sent", raw, [], SIG());
    await session.close();

    expect((await syncNow()).ok).toBe(true);
    expect(await messageCount()).toBe(1);
    const locations = (
      await h.db.execute(
        sql`SELECT folder FROM mail_message_locations WHERE account_id=${accountId} AND provider_message_id='<dup@umev.co.uk>' ORDER BY folder`,
      )
    ).rows as { folder: string }[];
    expect(locations.map((row) => row.folder)).toEqual(["INBOX", "Sent"]);
    const direction = (
      await h.db.execute(
        sql`SELECT direction FROM email_messages WHERE account_id=${accountId} AND provider_message_id='<dup@umev.co.uk>'`,
      )
    ).rows as { direction: string }[];
    expect(direction[0]?.direction).toBe("outbound");
  });

  test("marks a thread trashed when all its messages move to Trash, and clears it on the way back", async () => {
    deliver({ from: "bob@acme.test", subject: "One", messageId: "<t1@acme.test>" });
    deliver({
      from: "bob@acme.test",
      subject: "Re: One",
      messageId: "<t2@acme.test>",
      inReplyTo: "<t1@acme.test>",
      references: ["<t1@acme.test>"],
    });
    expect((await syncNow()).ok).toBe(true);

    const session = await openSession();
    const inboxUids = fakeList(dir, ADDRESS, "INBOX");
    const moved = await session.move("INBOX", inboxUids, "Trash", SIG());
    expect(moved.ok).toBe(true);
    expect((await syncNow()).ok).toBe(true);

    const trashed = (
      await h.db.execute(sql`SELECT trashed_at FROM email_threads WHERE account_id=${accountId}`)
    ).rows as { trashed_at: string | null }[];
    expect(trashed[0]?.trashed_at).not.toBeNull();

    const trashUids = fakeList(dir, ADDRESS, "Trash");
    const back = await session.move("Trash", trashUids.slice(0, 1), "INBOX", SIG());
    expect(back.ok).toBe(true);
    await session.close();
    expect((await syncNow()).ok).toBe(true);
    const restored = (
      await h.db.execute(sql`SELECT trashed_at FROM email_threads WHERE account_id=${accountId}`)
    ).rows as { trashed_at: string | null }[];
    expect(restored[0]?.trashed_at).toBeNull();
  });

  test("a UIDVALIDITY reset rebuilds the folder without duplicating messages", async () => {
    deliver({ from: "c@acme.test", subject: "One", messageId: "<u1@acme.test>" });
    deliver({ from: "c@acme.test", subject: "Two", messageId: "<u2@acme.test>" });
    expect((await syncNow()).ok).toBe(true);
    expect(await messageCount()).toBe(2);

    fakeResetUidValidity(dir, ADDRESS, "INBOX");
    expect((await syncNow()).ok).toBe(true);
    expect(await messageCount()).toBe(2);
    const cursor = (
      await h.db.execute(
        sql`SELECT uid_validity FROM mail_folder_cursors WHERE account_id=${accountId} AND folder='INBOX'`,
      )
    ).rows as { uid_validity: string }[];
    expect(BigInt(cursor[0]?.uid_validity ?? "0")).toBe(2n);
  });

  test("links a new thread to a known person and their open deal", async () => {
    const person = (
      await h.db.execute(sql`
        INSERT INTO persons (name, owner_id, visibility_level, primary_email)
        VALUES ('Alice Buyer', ${owner.id}, 'all', 'alice@acme.test') RETURNING id
      `)
    ).rows[0] as { id: string };
    const { pipeline, stages } = await seedPipelineWithStages(h.db, ["Lead"]);
    const deal = (
      await h.db.execute(sql`
        INSERT INTO deals (title, pipeline_id, stage_id, owner_id, person_id, visibility_level)
        VALUES ('Acme renewal', ${pipeline.id}, ${stages[0]?.id ?? ""}, ${owner.id}, ${person.id}, 'all')
        RETURNING id
      `)
    ).rows[0] as { id: string };

    deliver({ from: "alice@acme.test", subject: "Renewal", messageId: "<link@acme.test>" });
    expect((await syncNow()).ok).toBe(true);

    const thread = (
      await h.db.execute(sql`
        SELECT person_id, deal_id FROM email_threads WHERE account_id=${accountId}
      `)
    ).rows as { person_id: string | null; deal_id: string | null }[];
    expect(thread[0]?.person_id).toBe(person.id);
    expect(thread[0]?.deal_id).toBe(deal.id);
  });

  test("a second sync with no changes fetches no sources", async () => {
    deliver({ from: "d@acme.test", subject: "Quiet", messageId: "<q@acme.test>" });
    expect((await syncNow()).ok).toBe(true);

    const session = await openSession();
    const spy = vi.fn(session.fetchSources.bind(session));
    const synced = await syncNow([], { ...session, fetchSources: spy });
    expect(synced.ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  test("backfill walks back to the clamp and stores the old message", async () => {
    deliver({
      from: "e@acme.test",
      subject: "Ancient",
      messageId: "<ancient@acme.test>",
      date: new Date(Date.now() - 300 * DAY),
    });
    expect((await syncNow()).ok).toBe(true);
    expect(await threadOf("<ancient@acme.test>")).toBeUndefined();

    let remaining = true;
    let runs = 0;
    const transports = createFakeTransportFactory(dir);
    while (remaining && runs < 6) {
      const result = await runBackfillJob(h.db, accountId, SIG(), { transports });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      remaining = result.value.remaining;
      runs += 1;
    }

    expect(await threadOf("<ancient@acme.test>")).toBeDefined();
    const cursor = (
      await h.db.execute(
        sql`SELECT backfill_done FROM mail_folder_cursors WHERE account_id=${accountId} AND folder='INBOX'`,
      )
    ).rows as { backfill_done: boolean }[];
    expect(cursor[0]?.backfill_done).toBe(true);
    expect(ERROR_IDS.MAIL_UNSUPPORTED).toBe("E_MAIL_015");
  });
});
