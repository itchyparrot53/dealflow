import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import type { PermissionFlagKey } from "@/constants/permissionFlags";
import { seedUser } from "@/db/testing/factories";
import { FakeGmailClient } from "@/features/email/gmailFake";
import { resolveMailProvider } from "@/features/mail/provider/resolve";
import type { HydratedActor } from "@/server/hydrateActor";
import { makeTestDb, type TestDb } from "@/test/db";
import { ok } from "@/types/result";
import { createFakeTransportFactory } from "../transport/fake";
import { connectImapMailbox } from "./connect";
import { loadImapCredentials } from "./credentials";

const SIG = (): AbortSignal => AbortSignal.timeout(10_000);
const PASSWORD = "fake-app-password-1";
const ADDRESS = "owner@example.com";

let h: TestDb;
let dir: string;
let syncedAccounts: string[];

beforeAll(async () => {
  h = await makeTestDb();
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.db.execute(
    sql`TRUNCATE mail_sent_appends, mail_message_locations, mail_folder_cursors, email_message_headers, mail_account_credentials, email_send_attempts, email_messages, email_threads, email_accounts, users, permission_sets, settings, audit_events RESTART IDENTITY CASCADE`,
  );
  dir = mkdtempSync(join(tmpdir(), "dfmail-"));
  syncedAccounts = [];
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function actorFor(user: { id: string; name: string; email: string }): HydratedActor {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: null,
    type: "regular",
    isActive: true,
    groupIds: new Set<string>(),
    flags: new Set<PermissionFlagKey>(),
  };
}

function connect(user: { id: string; name: string; email: string }, password = PASSWORD) {
  return connectImapMailbox(
    h.db,
    actorFor(user),
    { emailAddress: ADDRESS, password, preset: "purelymail" },
    {
      transports: createFakeTransportFactory(dir),
      enqueueSync: (accountId) => {
        syncedAccounts.push(accountId);
        return Promise.resolve();
      },
    },
    SIG(),
  );
}

async function accountIdFor(userId: string): Promise<string | undefined> {
  const rows = (await h.db.execute(sql`SELECT id FROM email_accounts WHERE user_id=${userId}`))
    .rows as { id: string }[];
  return rows[0]?.id;
}

describe("connectImapMailbox", () => {
  test("stores the password encrypted and loadImapCredentials returns it", async () => {
    const user = await seedUser(h.db, { email: "owner@example.com", name: "Owner" });
    const connected = await connect(user);
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;

    const rows = (
      await h.db.execute(
        sql`SELECT password_enc FROM mail_account_credentials WHERE account_id=${connected.value.accountId}`,
      )
    ).rows as { password_enc: Buffer }[];
    expect(rows[0]?.password_enc).toBeInstanceOf(Buffer);
    expect(rows[0]?.password_enc.equals(Buffer.from(PASSWORD))).toBe(false);

    const loaded = await loadImapCredentials(h.db, connected.value.accountId, SIG());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok || loaded.value === null) return;
    expect(loaded.value.imap.host).toBe("imap.purelymail.com");
    expect(loaded.value.imap.port).toBe(993);
    expect(loaded.value.smtp.host).toBe("smtp.purelymail.com");
    expect(loaded.value.imap.username).toBe(ADDRESS);
    expect(loaded.value.imap.password).toBe(PASSWORD);
  });

  test("resets the account's cursors and locations on a reconnect", async () => {
    const user = await seedUser(h.db, { email: "owner@example.com", name: "Owner" });
    const first = await connect(user);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const accountId = first.value.accountId;

    await h.db.execute(sql`
      INSERT INTO mail_folder_cursors (account_id, folder, uid_validity, last_uid)
      VALUES (${accountId}, 'INBOX', 1, 4)
    `);
    await h.db.execute(sql`
      INSERT INTO mail_message_locations (account_id, folder, uid_validity, uid, provider_message_id)
      VALUES (${accountId}, 'INBOX', 1, 4, '<old@example.com>')
    `);

    const second = await connect(user);
    expect(second.ok).toBe(true);
    const cursors = (
      await h.db.execute(sql`SELECT folder FROM mail_folder_cursors WHERE account_id=${accountId}`)
    ).rows;
    const locations = (
      await h.db.execute(sql`SELECT uid FROM mail_message_locations WHERE account_id=${accountId}`)
    ).rows;
    expect(cursors).toHaveLength(0);
    expect(locations).toHaveLength(0);
    expect(syncedAccounts).toEqual([accountId, accountId]);
  });

  test("a short password is rejected with E_MAIL_004 and stores nothing", async () => {
    const user = await seedUser(h.db, { email: "owner@example.com", name: "Owner" });
    const connected = await connect(user, "short");
    expect(connected.ok).toBe(false);
    if (!connected.ok) expect(connected.error.id).toBe(ERROR_IDS.MAIL_AUTH_FAILED);
    expect(await accountIdFor(user.id)).toBeUndefined();
  });

  test("a second user connecting the same address gets E_MAIL_006", async () => {
    const owner = await seedUser(h.db, { email: "owner@example.com", name: "Owner" });
    const other = await seedUser(h.db, { email: "other@example.com", name: "Other" });
    const first = await connect(owner);
    expect(first.ok).toBe(true);

    const second = await connect(other);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.id).toBe(ERROR_IDS.MAIL_ADDRESS_TAKEN);
    expect(await accountIdFor(other.id)).toBeUndefined();
  });

  test("resolves kind imap after connecting and gmail after the credentials row is gone", async () => {
    const user = await seedUser(h.db, { email: "owner@example.com", name: "Owner" });
    const connected = await connect(user);
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;
    const accountId = connected.value.accountId;

    const imap = await resolveMailProvider(h.db, accountId, SIG(), {
      transports: createFakeTransportFactory(dir),
      gmailClient: () => Promise.resolve(ok(new FakeGmailClient())),
    });
    expect(imap.ok).toBe(true);
    if (imap.ok) expect(imap.value.kind).toBe("imap");

    await h.db.execute(sql`DELETE FROM mail_account_credentials WHERE account_id=${accountId}`);
    const gmail = await resolveMailProvider(h.db, accountId, SIG(), {
      gmailClient: () => Promise.resolve(ok(new FakeGmailClient())),
    });
    expect(gmail.ok).toBe(true);
    if (gmail.ok) expect(gmail.value.kind).toBe("gmail");
  });
});
