// Filesystem fake for the IMAP and SMTP transports, used by integration tests and e2e. It imports
// only node: built-ins and relative modules (the e2e helpers import it directly).
//
// Layout under the fake root:
//   {dir}/{address}/password
//   {dir}/{address}/{Folder}/meta.json      { uidValidity, uidNext, modseq }
//   {dir}/{address}/{Folder}/{uid}.eml
//   {dir}/_smtp/{timestamp}-{n}.json        { from, to, size }
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { AppError, ERROR_IDS } from "../../../constants/errorIds";
import type { SpecialUse } from "../../../constants/mail";
import { err, ok, type Result } from "../../../types/result";

export const FAKE_FOLDERS = ["INBOX", "Sent", "Archive", "Junk", "Trash", "Drafts"] as const;
export type FakeFolder = (typeof FAKE_FOLDERS)[number];

const SPECIAL_USE: Record<FakeFolder, SpecialUse> = {
  INBOX: "inbox",
  Sent: "sent",
  Archive: "archive",
  Junk: "junk",
  Trash: "trash",
  Drafts: "drafts",
};

export function fakeSpecialUse(folder: string): SpecialUse | null {
  const known = FAKE_FOLDERS.find((name) => name === folder);
  return known === undefined ? null : SPECIAL_USE[known];
}

interface Meta {
  uidValidity: string;
  uidNext: number;
  modseq: number;
}

// Synchronous 20 ms sleep so the lock retry does not turn into a hot loop.
const sleepBuffer = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms: number): void {
  Atomics.wait(sleepBuffer, 0, 0, ms);
}

// Every write takes a directory lock, retrying for up to 2 s. Two concurrent sync runs therefore
// see consistent metadata instead of a half-written uidNext.
function withLock<T>(path: string, run: () => T): T {
  const lock = `${path}.lock`;
  const started = Date.now();
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      if (Date.now() - started > 2_000) {
        throw new AppError(ERROR_IDS.MAIL_IMAP_FAILED, "fake store lock timeout", { path });
      }
      sleepSync(20);
    }
  }
  try {
    return run();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

function addressDir(dir: string, address: string): string {
  return join(dir, address.trim().toLowerCase());
}

function folderDir(dir: string, address: string, folder: string): string {
  return join(addressDir(dir, address), folder);
}

function metaPath(dir: string, address: string, folder: string): string {
  return join(folderDir(dir, address, folder), "meta.json");
}

function readMeta(dir: string, address: string, folder: string): Meta {
  return JSON.parse(readFileSync(metaPath(dir, address, folder), "utf8")) as Meta;
}

function writeMeta(dir: string, address: string, folder: string, meta: Meta): void {
  writeFileSync(metaPath(dir, address, folder), JSON.stringify(meta, null, 2));
}

function ensureMailbox(dir: string, address: string): void {
  for (const folder of FAKE_FOLDERS) {
    const path = folderDir(dir, address, folder);
    if (!existsSync(path)) mkdirSync(path, { recursive: true });
    if (!existsSync(join(path, "meta.json"))) {
      writeMeta(dir, address, folder, { uidValidity: "1", uidNext: 1, modseq: 1 });
    }
  }
}

// Login: the first login creates the mailbox with that password; later logins must match. A short
// password is rejected so tests and e2e can exercise the authentication error path.
export function fakeLogin(dir: string, address: string, password: string): Result<void, AppError> {
  if (password.length < 8) {
    return err(new AppError(ERROR_IDS.MAIL_AUTH_FAILED, "fake: password too short"));
  }
  ensureMailbox(dir, address);
  const file = join(addressDir(dir, address), "password");
  if (!existsSync(file)) {
    writeFileSync(file, password);
    return ok(undefined);
  }
  const stored = readFileSync(file, "utf8");
  if (stored !== password) {
    return err(new AppError(ERROR_IDS.MAIL_AUTH_FAILED, "fake: wrong password"));
  }
  return ok(undefined);
}

// Append one RFC 822 message to a folder. Bumps uidNext and modseq.
export function fakeAppend(
  dir: string,
  address: string,
  folder: string,
  raw: Buffer,
): { uid: number; uidValidity: bigint } {
  ensureMailbox(dir, address);
  return withLock(folderDir(dir, address, folder), () => {
    const meta = readMeta(dir, address, folder);
    const uid = meta.uidNext;
    writeFileSync(join(folderDir(dir, address, folder), `${uid}.eml`), raw);
    writeMeta(dir, address, folder, {
      uidValidity: meta.uidValidity,
      uidNext: uid + 1,
      modseq: meta.modseq + 1,
    });
    return { uid, uidValidity: BigInt(meta.uidValidity) };
  });
}

// UIDs present in a folder, ascending. Files are named by uid.
export function fakeList(dir: string, address: string, folder: string): number[] {
  const path = folderDir(dir, address, folder);
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((name) => /^\d+\.eml$/.test(name))
    .map((name) => Number(name.slice(0, -4)))
    .sort((a, b) => a - b);
}

export function fakeRead(dir: string, address: string, folder: string, uid: number): Buffer {
  return readFileSync(join(folderDir(dir, address, folder), `${uid}.eml`));
}

// Metadata the fake reports as the message date: the file's modification time.
export function fakeMessageDate(dir: string, address: string, folder: string, uid: number): Date {
  return statSync(join(folderDir(dir, address, folder), `${uid}.eml`)).mtime;
}

// Folder metadata in the shape the sync engine consumes. The fake has CONDSTORE "unknown", and
// uidValidity comes from meta.json so a reset is visible.
export function fakeStatus(
  dir: string,
  address: string,
  folder: string,
): { uidValidity: bigint; uidNext: number; highestModseq: bigint | null; messages: number } {
  if (!existsSync(metaPath(dir, address, folder))) {
    return { uidValidity: 1n, uidNext: 1, highestModseq: null, messages: 0 };
  }
  const meta = readMeta(dir, address, folder);
  return {
    uidValidity: BigInt(meta.uidValidity),
    uidNext: meta.uidNext,
    highestModseq: meta.modseq === 0 ? null : BigInt(meta.modseq),
    messages: fakeList(dir, address, folder).length,
  };
}

// Move messages between folders, returning old uid -> new uid in the destination.
export function fakeMove(
  dir: string,
  address: string,
  folder: string,
  uids: number[],
  destination: string,
): Map<number, number> {
  ensureMailbox(dir, address);
  return withLock(folderDir(dir, address, folder), () => {
    const map = new Map<number, number>();
    for (const uid of uids) {
      const source = join(folderDir(dir, address, folder), `${uid}.eml`);
      if (!existsSync(source)) continue;
      const moved = withLock(folderDir(dir, address, destination), () => {
        const destinationMeta = readMeta(dir, address, destination);
        const newUid = destinationMeta.uidNext;
        renameSync(source, join(folderDir(dir, address, destination), `${newUid}.eml`));
        writeMeta(dir, address, destination, {
          uidValidity: destinationMeta.uidValidity,
          uidNext: newUid + 1,
          modseq: destinationMeta.modseq + 1,
        });
        return newUid;
      });
      map.set(uid, moved);
    }
    if (map.size > 0) {
      // Removing a message bumps the source folder's MODSEQ on a real server, which is how a
      // sync notices that a UID vanished without the message count changing for other folders.
      const sourceMeta = readMeta(dir, address, folder);
      writeMeta(dir, address, folder, {
        uidValidity: sourceMeta.uidValidity,
        uidNext: sourceMeta.uidNext,
        modseq: sourceMeta.modseq + 1,
      });
    }
    return map;
  });
}

// Test-only: renumber the folder's files and bump UIDVALIDITY, simulating a server-side reset.
export function fakeResetUidValidity(dir: string, address: string, folder: string): void {
  withLock(folderDir(dir, address, folder), () => {
    const path = folderDir(dir, address, folder);
    const uids = fakeList(dir, address, folder);
    uids.forEach((uid, index) => {
      if (uid !== index + 1) renameSync(join(path, `${uid}.eml`), join(path, `${index + 1}.eml`));
    });
    const meta = readMeta(dir, address, folder);
    writeMeta(dir, address, folder, {
      uidValidity: String(BigInt(meta.uidValidity) + 1n),
      uidNext: uids.length + 1,
      modseq: meta.modseq + 1,
    });
  });
}

export interface FakeMailFields {
  to: string | string[];
  from?: string;
  fromName?: string;
  subject?: string;
  text?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  // Date header and the file's internal date, so tests can put mail outside the initial window.
  date?: Date | string;
}

function newMessageId(): string {
  return `<fake-${Date.now()}-${Math.random().toString(36).slice(2)}@dealflow.invalid>`;
}

function buildRaw(fields: FakeMailFields): string {
  const from = fields.from ?? "fake@dealflow.invalid";
  const fromName = fields.fromName;
  const to = Array.isArray(fields.to) ? fields.to.join(", ") : fields.to;
  const lines = [
    fromName !== undefined ? `From: ${fromName} <${from}>` : `From: ${from}`,
    `To: ${to}`,
    `Subject: ${fields.subject ?? "Fake message"}`,
    `Date: ${fields.date !== undefined ? new Date(fields.date).toUTCString() : new Date().toUTCString()}`,
    `Message-ID: ${fields.messageId ?? newMessageId()}`,
  ];
  if (fields.inReplyTo !== undefined) lines.push(`In-Reply-To: ${fields.inReplyTo}`);
  if (fields.references !== undefined && fields.references.length > 0) {
    lines.push(`References: ${fields.references.join(" ")}`);
  }
  lines.push("MIME-Version: 1.0", 'Content-Type: text/plain; charset="utf-8"', "");
  lines.push(fields.text ?? "Fake message body.");
  return lines.join("\r\n");
}

// Deliver a raw message or a set of fields into each recipient's INBOX, creating the mailbox.
export function fakeDeliver(dir: string, input: string | Buffer | FakeMailFields): void {
  if (typeof input === "string" || Buffer.isBuffer(input)) {
    const raw = Buffer.isBuffer(input) ? input : Buffer.from(input);
    const text = raw.toString("utf8");
    const toHeader = /^To:\s*(.+)$/im.exec(text)?.[1] ?? "";
    const recipients = toHeader
      .split(",")
      .map((part) => /<([^>]+)>/.exec(part)?.[1] ?? part.trim())
      .filter((address) => address !== "");
    for (const address of recipients) fakeAppend(dir, address, "INBOX", raw);
    return;
  }
  const raw = Buffer.from(buildRaw(input));
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const when = input.date !== undefined ? new Date(input.date) : new Date();
  for (const address of recipients) {
    const appended = fakeAppend(dir, address, "INBOX", raw);
    utimesSync(join(folderDir(dir, address, "INBOX"), `${appended.uid}.eml`), when, when);
  }
}

// SMTP log entry for every fake send, one JSON file per message.
export function fakeLogSmtp(
  dir: string,
  entry: { from: string; to: string[]; size: number },
): void {
  const logDir = join(dir, "_smtp");
  mkdirSync(logDir, { recursive: true });
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  writeFileSync(join(logDir, name), JSON.stringify(entry, null, 2));
}
