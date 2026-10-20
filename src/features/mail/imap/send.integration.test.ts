import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { seedUser } from "@/db/testing/factories";
import { processSendAttempt } from "@/features/email/outbox";
import { sendEmail } from "@/features/email/send";
import { hydrateOwner } from "@/features/email/syncCursor";
import { trashThread } from "@/features/email/threadTrash";
import { FakeStorageClient } from "@/features/files/storageFake";
import type { AuthUser } from "@/features/permissions/types";
import { makeTestDb, type TestDb } from "@/test/db";
import { err, ok } from "@/types/result";
import { connectImapMailbox } from "../connect/connect";
import { loadImapCredentials } from "../connect/credentials";
import { createImapProvider } from "../provider/imapProvider";
import type { MailProvider } from "../provider/types";
import { createFakeTransportFactory } from "../transport/fake";
import { fakeAppend, fakeDeliver, fakeList, fakeRead } from "../transport/fakeStore";
import type { MailTransportFactory } from "../transport/types";
import { runAppendRetryJob } from "./appendSent";
import { sendImapMessage } from "./send";

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);
const ADDRESS = "owner@umev.co.uk";
const PASSWORD = "fake-app-password-1";

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

function factory(): MailTransportFactory {
  return createFakeTransportFactory(dir);
}

async function provider(
  transports: MailTransportFactory = factory(),
  limits?: { dailyRecipients?: number; maxRecipients?: number },
): Promise<MailProvider> {
  const credentials = await loadImapCredentials(h.db, accountId, SIG());
  if (!credentials.ok || credentials.value === null) throw new Error("credentials fixture failed");
  return createImapProvider(
    h.db,
    accountId,
    credentials.value,
    transports,
    limits === undefined ? {} : { limits },
  );
}

function send(
  providerValue: MailProvider,
  input: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    threadId?: string;
    idempotencyKey?: string;
  },
) {
  return sendEmail(h.db, {
    actorId: owner.id,
    actorType: owner.type,
    actorGroupIds: owner.groupIds,
    provider: providerValue,
    storage: new FakeStorageClient(),
    input: {
      accountId,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
      to: input.to,
      ...(input.cc !== undefined ? { cc: input.cc } : {}),
      ...(input.bcc !== undefined ? { bcc: input.bcc } : {}),
      subject: input.subject ?? "Hello",
      bodyHtml: "<p>hi</p>",
      ...(input.threadId !== undefined ? { threadId: input.threadId } : {}),
    },
  });
}

async function firstThread(): Promise<{ id: string; providerThreadId: string }> {
  const rows = (
    await h.db.execute(
      sql`SELECT id, provider_thread_id FROM email_threads WHERE account_id=${accountId}`,
    )
  ).rows as { id: string; provider_thread_id: string }[];
  const row = rows[0];
  if (row === undefined) throw new Error("no thread");
  return { id: row.id, providerThreadId: row.provider_thread_id };
}

async function attemptHeader(): Promise<string> {
  const rows = (
    await h.db.execute(
      sql`SELECT message_id_header FROM email_send_attempts WHERE account_id=${accountId} ORDER BY created_at DESC LIMIT 1`,
    )
  ).rows as { message_id_header: string }[];
  return rows[0]?.message_id_header ?? "";
}

describe("IMAP send", () => {
  test("sends without Bcc on the wire, appends the full copy to Sent and stores the outbound row", async () => {
    const providerValue = await provider();
    const sent = await send(providerValue, {
      to: ["friend@acme.test"],
      bcc: ["hidden@acme.test"],
      subject: "Project update",
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.value.status).toBe("sent");

    const wire = fakeRead(dir, "friend@acme.test", "INBOX", 1).toString("utf8");
    expect(wire).not.toContain("Bcc:");
    const sentCopy = fakeRead(dir, ADDRESS, "Sent", 1).toString("utf8");
    expect(sentCopy).toContain("Bcc: hidden@acme.test");

    const header = await attemptHeader();
    const messages = (
      await h.db.execute(sql`
        SELECT provider_message_id, direction, thread_id FROM email_messages WHERE account_id=${accountId}
      `)
    ).rows as { provider_message_id: string; direction: string; thread_id: string }[];
    expect(messages).toHaveLength(1);
    expect(messages[0]?.direction).toBe("outbound");
    const thread = await firstThread();
    expect(thread.providerThreadId).toBe(`imap:${header}`);

    const headers = (
      await h.db.execute(
        sql`SELECT rfc822_message_id FROM email_message_headers WHERE account_id=${accountId}`,
      )
    ).rows as { rfc822_message_id: string }[];
    expect(headers[0]?.rfc822_message_id).toBe(header);

    const appends = (
      await h.db.execute(sql`SELECT status FROM mail_sent_appends WHERE account_id=${accountId}`)
    ).rows as { status: string }[];
    expect(appends[0]?.status).toBe("done");
    expect(header.endsWith(`@${ADDRESS.split("@")[1]}>`)).toBe(true);
  });

  test("the provider maxRecipients option is enforced", async () => {
    const credentials = await loadImapCredentials(h.db, accountId, SIG());
    if (!credentials.ok || credentials.value === null)
      throw new Error("credentials fixture failed");
    const rejected = await sendImapMessage({
      db: h.db,
      accountId,
      credentials: credentials.value,
      transports: factory(),
      raw: "From: owner@umev.co.uk\r\nTo: a@x.test, b@x.test, c@x.test\r\n\r\nBody",
      messageIdHeader: "<cap@umev.co.uk>",
      envelope: { from: ADDRESS, to: ["a@x.test", "b@x.test", "c@x.test"] },
      providerThreadId: null,
      parentProviderMessageId: null,
      reply: {},
      attemptId: randomUUID(),
      signal: SIG(),
      limits: { maxRecipients: 2 },
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.id).toBe(ERROR_IDS.MAIL_TOO_MANY_RECIPIENTS);
  });

  test("the Message-ID header uses the sending mailbox's domain", async () => {
    expect((await send(await provider(), { to: ["friend@acme.test"] })).ok).toBe(true);
    expect(await attemptHeader()).toMatch(/@umev\.co\.uk>$/);
  });

  test("a reply carries In-Reply-To and References and stays in the same thread", async () => {
    const providerValue = await provider();
    expect((await send(providerValue, { to: ["friend@acme.test"] })).ok).toBe(true);
    const firstHeader = await attemptHeader();
    const thread = await firstThread();

    const reply = await send(providerValue, {
      to: ["friend@acme.test"],
      threadId: thread.id,
      subject: "Re: Hello",
    });
    expect(reply.ok).toBe(true);

    const replyCopy = fakeRead(dir, ADDRESS, "Sent", 2).toString("utf8");
    expect(replyCopy).toContain(`In-Reply-To: ${firstHeader}`);
    expect(replyCopy).toContain("References:");
    expect(replyCopy).toContain(firstHeader);
    expect((await firstThread()).providerThreadId).toBe(thread.providerThreadId);
  });

  test("a failed APPEND never fails the send and the retry job finishes it", async () => {
    const failing: MailTransportFactory = {
      async openImap(creds, signal) {
        const opened = await factory().openImap(creds, signal);
        if (!opened.ok) return opened;
        const session = opened.value;
        return ok({
          ...session,
          append: () => Promise.resolve(err(new AppError(ERROR_IDS.MAIL_APPEND_FAILED, "nope"))),
        });
      },
      smtp: (creds) => factory().smtp(creds),
    };

    const sent = await send(await provider(failing), { to: ["friend@acme.test"] });
    expect(sent.ok).toBe(true);
    if (sent.ok) expect(sent.value.status).toBe("sent");

    const pending = (
      await h.db.execute(
        sql`SELECT status, tries FROM mail_sent_appends WHERE account_id=${accountId}`,
      )
    ).rows as { status: string; tries: number }[];
    expect(pending[0]?.status).toBe("pending");
    expect(pending[0]?.tries).toBe(1);

    const retried = await runAppendRetryJob(h.db, SIG(), { transports: factory() });
    expect(retried.ok).toBe(true);
    const done = (
      await h.db.execute(sql`SELECT status FROM mail_sent_appends WHERE account_id=${accountId}`)
    ).rows as { status: string }[];
    expect(done[0]?.status).toBe("done");
    expect(fakeList(dir, ADDRESS, "Sent")).toHaveLength(1);
  });

  test("over the daily limit the send is deferred, not failed or sent", async () => {
    await h.db.execute(sql`
      INSERT INTO email_send_attempts (idempotency_key, message_id_header, account_id, payload, status, sent_at)
      VALUES
        (${randomUUID()}, '<old-1@umev.co.uk>', ${accountId},
          '{"to":["a@acme.test"],"subject":"s","html":"h"}'::jsonb, 'sent', now() - interval '2 hours'),
        (${randomUUID()}, '<old-2@umev.co.uk>', ${accountId},
          '{"to":["b@acme.test"],"subject":"s","html":"h"}'::jsonb, 'sent', now() - interval '1 hour')
    `);

    const sent = await send(await provider(factory(), { dailyRecipients: 2 }), {
      to: ["friend@acme.test"],
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.value.status).toBe("deferred");

    const row = (
      await h.db.execute(sql`
        SELECT status, scheduled_at FROM email_send_attempts
        WHERE account_id=${accountId} AND status IN ('pending','failed')
        ORDER BY created_at DESC LIMIT 1
      `)
    ).rows as { status: string; scheduled_at: string }[];
    expect(row[0]?.status).toBe("pending");
    expect(new Date(row[0]?.scheduled_at ?? 0).getTime()).toBeGreaterThan(
      Date.now() + 20 * 60 * 60 * 1000,
    );
    expect(fakeList(dir, "friend@acme.test", "INBOX")).toHaveLength(0);
  });

  test("more than the per-message cap is refused before any attempt row exists", async () => {
    const to = Array.from({ length: 251 }, (_, index) => `user${index}@acme.test`);
    const sent = await send(await provider(), { to });
    expect(sent.ok).toBe(false);
    if (!sent.ok) expect(sent.error.id).toBe(ERROR_IDS.MAIL_TOO_MANY_RECIPIENTS);
    const attempts = (
      await h.db.execute(
        sql`SELECT count(*)::int AS n FROM email_send_attempts WHERE account_id=${accountId}`,
      )
    ).rows as { n: number }[];
    expect(attempts[0]?.n).toBe(0);
  });

  test("reconcile adopts a message that is already in Sent", async () => {
    const messageId = "<reconciled@umev.co.uk>";
    const raw = Buffer.from(
      [
        `From: ${ADDRESS}`,
        "To: friend@acme.test",
        "Subject: Reconcile me",
        `Message-ID: ${messageId}`,
        "",
        "Body",
      ].join("\r\n"),
    );
    await provider();
    const session = await factory().openImap(
      { host: "fake", port: 993, secure: true, username: ADDRESS, password: PASSWORD },
      SIG(),
    );
    if (!session.ok) throw new Error("session fixture failed");
    await session.value.append("Sent", raw, [], SIG());
    await session.value.close();

    const idempotencyKey = randomUUID();
    await h.db.execute(sql`
      INSERT INTO email_send_attempts
        (idempotency_key, message_id_header, account_id, payload, status, send_started_at)
      VALUES (${idempotencyKey}, ${messageId}, ${accountId},
        '{"to":["friend@acme.test"],"subject":"Reconcile me","html":"<p>x</p>"}'::jsonb,
        'sending', now() - interval '15 minutes')
    `);

    const outcome = await processSendAttempt(h.db, {
      accountId,
      idempotencyKey,
      provider: await provider(),
      storage: new FakeStorageClient(),
      signal: SIG(),
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value.status).toBe("sent");
    const stored = (
      await h.db.execute(
        sql`SELECT status FROM email_send_attempts WHERE account_id=${accountId} AND idempotency_key=${idempotencyKey}`,
      )
    ).rows as { status: string }[];
    expect(stored[0]?.status).toBe("sent");
  });

  test("downloads an inbound attachment by its idx id", async () => {
    const raw = Buffer.from(
      [
        "From: sender@acme.test",
        `To: ${ADDRESS}`,
        "Subject: With attachment",
        "Message-ID: <att@acme.test>",
        "MIME-Version: 1.0",
        'Content-Type: multipart/mixed; boundary="b"',
        "",
        "--b",
        "Content-Type: text/plain",
        "",
        "Body",
        "--b",
        'Content-Type: application/pdf; name="a.pdf"',
        'Content-Disposition: attachment; filename="a.pdf"',
        "Content-Transfer-Encoding: base64",
        "",
        "aGVsbG8=",
        "--b--",
        "",
      ].join("\r\n"),
    );
    fakeAppend(dir, ADDRESS, "INBOX", raw);

    const providerValue = await provider();
    const synced = await providerValue.sync(SIG());
    expect(synced.ok).toBe(true);
    const downloaded = await providerValue.fetchAttachment({
      providerMessageId: "<att@acme.test>",
      providerAttachmentId: "idx:0",
      signal: SIG(),
    });
    expect(downloaded.ok).toBe(true);
    if (downloaded.ok) expect(downloaded.value.bytes.toString("utf8")).toBe("hello");
  });

  test("trashing a thread moves it to the mailbox Trash and the next sync keeps it trashed", async () => {
    fakeDeliver(dir, {
      to: ADDRESS,
      from: "sender@acme.test",
      subject: "Delete me",
      messageId: "<trash-me@acme.test>",
    });
    const providerValue = await provider();
    expect((await providerValue.sync(SIG())).ok).toBe(true);
    const thread = await firstThread();

    const trashed = await trashThread(
      h.db,
      { actor: owner, threadId: thread.id, provider: providerValue },
      SIG(),
    );
    expect(trashed.ok).toBe(true);
    expect(fakeList(dir, ADDRESS, "Trash")).toHaveLength(1);

    expect((await providerValue.sync(SIG())).ok).toBe(true);
    const rows = (
      await h.db.execute(sql`SELECT trashed_at FROM email_threads WHERE account_id=${accountId}`)
    ).rows as { trashed_at: string | null }[];
    expect(rows[0]?.trashed_at).not.toBeNull();
  });
});
