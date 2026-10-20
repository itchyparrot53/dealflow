import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFakeTransportFactory } from "./fake";
import { fakeList, fakeResetUidValidity } from "./fakeStore";

const SIG = (): AbortSignal => AbortSignal.timeout(5_000);
const ADDRESS = "owner@example.com";
const PASSWORD = "fake-app-password-1";

function raw(to = "friend@example.com", subject = "Hello"): Buffer {
  return Buffer.from(
    [
      `From: ${ADDRESS}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "Message-ID: <fake-1@example.com>",
      "",
      "Body",
    ].join("\r\n"),
  );
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dfmail-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function open() {
  const factory = createFakeTransportFactory(dir);
  const session = await factory.openImap(
    { host: "fake", port: 993, secure: true, username: ADDRESS, password: PASSWORD },
    SIG(),
  );
  if (!session.ok) throw new Error("fake login failed");
  return { factory, session: session.value };
}

describe("fake transport", () => {
  it("creates the folders on first login and rejects a wrong second password", async () => {
    const { session } = await open();
    const folders = await session.listFolders(SIG());
    expect(folders.ok).toBe(true);
    if (!folders.ok) return;
    expect(folders.value.map((folder) => folder.path)).toContain("INBOX");
    expect(folders.value.find((folder) => folder.path === "Sent")?.specialUse).toBe("sent");

    const factory = createFakeTransportFactory(dir);
    const wrong = await factory.openImap(
      { host: "fake", port: 993, secure: true, username: ADDRESS, password: "different-password" },
      SIG(),
    );
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.id).toBe("E_MAIL_004");

    const short = await factory.openImap(
      { host: "fake", port: 993, secure: true, username: ADDRESS, password: "short" },
      SIG(),
    );
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error.id).toBe("E_MAIL_004");
  });

  it("append is listed, fetched and advances uidNext", async () => {
    const { session } = await open();
    const appended = await session.append("INBOX", raw(), [], SIG());
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;
    expect(appended.value.uid).toBe(1);

    const uids = await session.listUids("INBOX", SIG());
    expect(uids.ok).toBe(true);
    if (uids.ok) expect(uids.value).toEqual([1]);

    const fetched = await session.fetchSources("INBOX", [1], 1_000_000, SIG());
    expect(fetched.ok).toBe(true);
    if (fetched.ok) expect(fetched.value[0]?.source?.toString("utf8")).toBe(raw().toString("utf8"));

    const status = await session.status("INBOX", SIG());
    expect(status.ok).toBe(true);
    if (status.ok) expect(status.value.uidNext).toBe(2);
  });

  it("models CONDSTORE with a positive modseq that grows on append", async () => {
    const { session } = await open();
    const before = await session.status("INBOX", SIG());
    await session.append("INBOX", raw(), [], SIG());
    const after = await session.status("INBOX", SIG());
    expect(before.ok).toBe(true);
    expect(after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    expect(before.value.highestModseq).not.toBeNull();
    expect(after.value.highestModseq).not.toBeNull();
    if (before.value.highestModseq !== null && after.value.highestModseq !== null) {
      expect(after.value.highestModseq > before.value.highestModseq).toBe(true);
    }
  });

  it("move returns a uid map and the file changes folder", async () => {
    const { session } = await open();
    await session.append("INBOX", raw(undefined, "one"), [], SIG());
    await session.append("INBOX", raw(undefined, "two"), [], SIG());

    const moved = await session.move("INBOX", [1], "Archive", SIG());
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(moved.value.get(1)).toBe(1);

    const inbox = await session.listUids("INBOX", SIG());
    const archive = await session.listUids("Archive", SIG());
    if (inbox.ok) expect(inbox.value).toEqual([2]);
    if (archive.ok) expect(archive.value).toEqual([1]);
  });

  it("SMTP send delivers to the recipient INBOX and logs the send", async () => {
    const factory = createFakeTransportFactory(dir);
    const sender = factory.smtp({
      host: "fake",
      port: 465,
      secure: true,
      username: ADDRESS,
      password: PASSWORD,
    });
    const sent = await sender.send(
      raw("friend@example.com"),
      { from: ADDRESS, to: ["friend@example.com"] },
      SIG(),
    );
    expect(sent.ok).toBe(true);
    expect(fakeList(dir, "friend@example.com", "INBOX")).toEqual([1]);

    const log = readdirSync(join(dir, "_smtp"));
    expect(log).toHaveLength(1);
  });

  it("fakeResetUidValidity bumps uidValidity and renumbers the files", async () => {
    const { session } = await open();
    await session.append("INBOX", raw(), [], SIG());
    await session.append("INBOX", raw(), [], SIG());
    fakeResetUidValidity(dir, ADDRESS, "INBOX");
    const status = await session.status("INBOX", SIG());
    expect(status.ok).toBe(true);
    if (status.ok) expect(status.value.uidValidity).toBe(2n);
    expect(fakeList(dir, ADDRESS, "INBOX")).toEqual([1, 2]);
  });
});
