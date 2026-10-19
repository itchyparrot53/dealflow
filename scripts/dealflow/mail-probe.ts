import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

// Probes the real mail host (Purelymail) so Part 2's IMAP/SMTP work is planned on facts rather
// than assumptions. Owner credentials only: no credential, no connection. The script may read
// process.env and print to the terminal because it is tooling, not app code, but it never prints
// or stores the password and masks the account address.

try {
  process.loadEnvFile(".env");
} catch {
  // No .env: run on shell variables only.
}

const OUTPUT = "docs/dealflow/mail-probe-result.json";
const IDLE_WAIT_MS = 60_000;
const SENT_FOLDER_POLL_MS = 15_000;
const POLL_INTERVAL_MS = 2_000;

interface FolderProbe {
  path: string;
  specialUse: string | null;
  flags: string[];
}

interface FolderStatusProbe {
  messages: number | null;
  uidNext: number | null;
  uidValidity: string | null;
  highestModseq: string | null;
}

interface ProbeResult {
  status: "ok" | "skipped" | "failed";
  probedAt: string;
  account: string;
  imap: {
    host: string;
    port: number;
    capabilities: string[];
    enabled: string[];
    qresync: boolean;
    condstore: boolean;
    idleAdvertised: boolean;
  };
  folders: FolderProbe[];
  folderStatus: Record<string, FolderStatusProbe>;
  idle: { worked: boolean; latencyMs: number | null };
  send: { ok: boolean; messageId: string; smtpResponse: string };
  sentFolder: { autoSaved: boolean; appendWorked: boolean | null };
  move: { worked: boolean };
  errors: string[];
}

const user = (process.env.MAIL_PROBE_USER ?? "").trim();
const pass = process.env.MAIL_PROBE_PASS ?? "";
const imapHost = (process.env.MAIL_PROBE_IMAP_HOST ?? "").trim() || "imap.purelymail.com";
const imapPort = Number((process.env.MAIL_PROBE_IMAP_PORT ?? "").trim() || "993");
const smtpHost = (process.env.MAIL_PROBE_SMTP_HOST ?? "").trim() || "smtp.purelymail.com";
const smtpPort = Number((process.env.MAIL_PROBE_SMTP_PORT ?? "").trim() || "465");
const to = (process.env.MAIL_PROBE_TO ?? "").trim() || user;

const result: ProbeResult = {
  status: "failed",
  probedAt: new Date().toISOString(),
  account: "",
  imap: {
    host: imapHost,
    port: imapPort,
    capabilities: [],
    enabled: [],
    qresync: false,
    condstore: false,
    idleAdvertised: false,
  },
  folders: [],
  folderStatus: {},
  idle: { worked: false, latencyMs: null },
  send: { ok: false, messageId: "", smtpResponse: "" },
  sentFolder: { autoSaved: false, appendWorked: null },
  move: { worked: false },
  errors: [],
};

function writeResult(): void {
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
}

function note(step: string, error: unknown): void {
  result.errors.push(`${step}: ${error instanceof Error ? error.message : String(error)}`);
}

// a***@example.com: enough to tell which mailbox was probed, not enough to reuse.
function maskAccount(address: string): string {
  const [local = "", domain = ""] = address.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeClient(): ImapFlow {
  return new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: imapPort === 993,
    auth: { user, pass },
    logger: false,
    qresync: true,
  });
}

// 1. Connect and record the capability surface. False means the rest cannot run.
async function probeConnection(client: ImapFlow): Promise<boolean> {
  try {
    await client.connect();
    const capabilities = [...client.capabilities.keys()].sort();
    const enabled = [...client.enabled];
    result.imap.capabilities = capabilities;
    result.imap.enabled = enabled;
    result.imap.qresync = capabilities.includes("QRESYNC") || enabled.includes("QRESYNC");
    result.imap.condstore = capabilities.includes("CONDSTORE") || enabled.includes("CONDSTORE");
    result.imap.idleAdvertised = capabilities.includes("IDLE");
    return true;
  } catch (error) {
    note("connect", error);
    return false;
  }
}

// 2 and 3. Folders, special-use flags, and the status of each (HIGHESTMODSEQ 0 included).
async function probeFolders(client: ImapFlow): Promise<void> {
  try {
    const folders = await client.list();
    result.folders = folders.map((folder) => ({
      path: folder.path,
      specialUse: folder.specialUse ?? null,
      flags: [...folder.flags],
    }));
  } catch (error) {
    note("list", error);
  }

  const paths = [
    "INBOX",
    ...result.folders.filter((folder) => folder.specialUse !== null).map((folder) => folder.path),
  ];
  for (const path of paths) {
    try {
      const status = await client.status(path, {
        messages: true,
        uidNext: true,
        uidValidity: true,
        highestModseq: true,
      });
      if (status === false) continue;
      result.folderStatus[path] = {
        messages: status.messages ?? null,
        uidNext: status.uidNext ?? null,
        uidValidity: status.uidValidity === undefined ? null : status.uidValidity.toString(),
        highestModseq: status.highestModseq === undefined ? null : status.highestModseq.toString(),
      };
    } catch (error) {
      note(`status ${path}`, error);
    }
  }
}

function buildRawMessage(): Promise<Buffer> {
  const streamTransport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const domain = user.split("@")[1] ?? "localhost";
  return streamTransport
    .sendMail({
      from: user,
      to,
      subject: `Dealflow mail probe ${new Date().toISOString()}`,
      text: "Automated probe from Dealflow Part 1. Safe to delete.",
      messageId: `<probe-${randomUUID()}@${domain}>`,
    })
    .then((built) => built.message as Buffer);
}

async function sendProbe(raw: Buffer): Promise<number> {
  const smtp = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user, pass },
  });
  const sentAt = Date.now();
  const info = await smtp.sendMail({ envelope: { from: user, to: [to] }, raw });
  result.send = { ok: true, messageId: info.messageId, smtpResponse: info.response };
  smtp.close();
  return sentAt;
}

// 4, 5 and 6. Arm IDLE, send one message, and see whether the server pushes it back.
async function probeDelivery(client: ImapFlow): Promise<Buffer | null> {
  let resolveExists: ((at: number) => void) | null = null;
  const existsSeen = new Promise<number>((resolve) => {
    resolveExists = resolve;
  });
  client.on("exists", () => {
    resolveExists?.(Date.now());
  });
  try {
    await client.mailboxOpen("INBOX");
    void client.idle().catch(() => undefined);
  } catch (error) {
    note("idle", error);
  }

  let raw: Buffer | null = null;
  let sentAt = 0;
  try {
    raw = await buildRawMessage();
    sentAt = await sendProbe(raw);
  } catch (error) {
    note("send", error);
  }

  if (sentAt > 0) {
    const seen = await Promise.race([existsSeen, sleep(IDLE_WAIT_MS).then(() => null)]);
    result.idle.worked = seen !== null;
    result.idle.latencyMs = seen === null ? null : seen - sentAt;
  }
  return raw;
}

async function searchMessageId(client: ImapFlow): Promise<number[]> {
  const uids = await client.search(
    { header: { "message-id": result.send.messageId } },
    { uid: true },
  );
  return uids === false || uids === undefined ? [] : uids;
}

// 7. Does the host save the sent copy itself, and if not, does APPEND work?
async function probeSentFolder(client: ImapFlow, raw: Buffer | null): Promise<void> {
  const sent = result.folders.find((folder) => folder.specialUse === "\\Sent");
  if (sent === undefined || result.send.messageId === "") return;
  try {
    const lock = await client.getMailboxLock(sent.path);
    try {
      const deadline = Date.now() + SENT_FOLDER_POLL_MS;
      let found: number[] = [];
      while (Date.now() < deadline && found.length === 0) {
        found = await searchMessageId(client);
        if (found.length === 0) await sleep(POLL_INTERVAL_MS);
      }
      result.sentFolder.autoSaved = found.length > 0;
      if (!result.sentFolder.autoSaved && raw !== null) {
        await client.append(sent.path, raw, ["\\Seen"]);
        result.sentFolder.appendWorked = (await searchMessageId(client)).length > 0;
      }
    } finally {
      lock.release();
    }
  } catch (error) {
    note("sentFolder", error);
  }
}

// 8. MOVE the probe message from INBOX to \Trash.
async function probeMove(client: ImapFlow): Promise<void> {
  const trash = result.folders.find((folder) => folder.specialUse === "\\Trash");
  if (trash === undefined || result.send.messageId === "") return;
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await searchMessageId(client);
      if (uids.length === 0) return;
      const moved = await client.messageMove(uids, trash.path, { uid: true });
      result.move.worked = moved !== false;
    } finally {
      lock.release();
    }
  } catch (error) {
    note("move", error);
  }
}

async function main(): Promise<void> {
  result.account = maskAccount(user);
  if (user === "" || pass === "") {
    result.status = "skipped";
    result.errors.push("MAIL_PROBE_USER/MAIL_PROBE_PASS not set");
    writeResult();
    console.warn("mail probe skipped: MAIL_PROBE_USER/MAIL_PROBE_PASS not set");
    return;
  }

  const client = makeClient();
  try {
    if (!(await probeConnection(client))) {
      writeResult();
      return;
    }
    await probeFolders(client);
    const raw = await probeDelivery(client);
    await probeSentFolder(client, raw);
    await probeMove(client);
    result.status = result.send.ok && result.idle.worked ? "ok" : "failed";
  } finally {
    try {
      await client.logout();
    } catch {
      // Already closed: logging out is best-effort.
    }
    writeResult();
  }
}

main()
  .then(() => {
    console.warn(
      `mail probe ${result.status}: ${result.errors.length} error(s), idle ${result.idle.worked ? "worked" : "did not fire"}, sent ${result.send.ok ? "ok" : "failed"}`,
    );
  })
  .catch((error: unknown) => {
    result.status = "failed";
    note("fatal", error);
    writeResult();
    console.error(`mail probe failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
