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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// a***@example.com: enough to tell which mailbox was probed, not enough to reuse.
function maskAccount(address: string): string {
  const [local = "", domain = ""] = address.split("@");
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: imapPort === 993,
    auth: { user, pass },
    logger: false,
    qresync: true,
  });

  try {
    // 1. Connect and record the capability surface.
    try {
      await client.connect();
      const capabilities = [...client.capabilities.keys()].sort();
      const enabled = [...client.enabled];
      result.imap.capabilities = capabilities;
      result.imap.enabled = enabled;
      result.imap.qresync = capabilities.includes("QRESYNC") || enabled.includes("QRESYNC");
      result.imap.condstore = capabilities.includes("CONDSTORE") || enabled.includes("CONDSTORE");
      result.imap.idleAdvertised = capabilities.includes("IDLE");
    } catch (error) {
      result.errors.push(`connect: ${messageOf(error)}`);
      result.status = "failed";
      writeResult();
      console.warn(`mail probe failed: connect: ${messageOf(error)}`);
      return;
    }

    // 2. Folders and their special-use flags.
    try {
      const folders = await client.list();
      result.folders = folders.map((folder) => ({
        path: folder.path,
        specialUse: folder.specialUse ?? null,
        flags: [...folder.flags],
      }));
    } catch (error) {
      result.errors.push(`list: ${messageOf(error)}`);
    }

    // 3. Status of INBOX and every special-use folder (captures the HIGHESTMODSEQ 0 behaviour).
    const statusPaths = [
      "INBOX",
      ...result.folders.filter((f) => f.specialUse !== null).map((f) => f.path),
    ];
    for (const path of statusPaths) {
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
        result.errors.push(`status ${path}: ${messageOf(error)}`);
      }
    }

    // 4. IDLE: wait for the EXISTS that our own message should trigger.
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
      result.errors.push(`idle: ${messageOf(error)}`);
    }

    // 5. Send a probe message through SMTP, reusing one raw buffer for APPEND and MOVE later.
    let raw: Buffer | null = null;
    let sentAt = 0;
    try {
      const streamTransport = nodemailer.createTransport({ streamTransport: true, buffer: true });
      const domain = user.split("@")[1] ?? "localhost";
      const messageId = `<probe-${randomUUID()}@${domain}>`;
      const built = await streamTransport.sendMail({
        from: user,
        to,
        subject: `Dealflow mail probe ${new Date().toISOString()}`,
        text: "Automated probe from Dealflow Part 1. Safe to delete.",
        messageId,
      });
      raw = built.message as Buffer;
      const smtp = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user, pass },
      });
      sentAt = Date.now();
      const info = await smtp.sendMail({ envelope: { from: user, to: [to] }, raw });
      result.send = { ok: true, messageId: info.messageId, smtpResponse: info.response };
      smtp.close();
    } catch (error) {
      result.errors.push(`send: ${messageOf(error)}`);
    }

    // 6. Did the server push the new message over IDLE within a minute?
    if (sentAt > 0) {
      const seen = await Promise.race([existsSeen, sleep(IDLE_WAIT_MS).then(() => null)]);
      result.idle.worked = seen !== null;
      result.idle.latencyMs = seen === null ? null : seen - sentAt;
    }

    // 7. Did the host save the sent message into \Sent, or can APPEND put it there?
    const sentFolder = result.folders.find((f) => f.specialUse === "\\Sent");
    if (sentFolder !== undefined && result.send.messageId !== "") {
      try {
        const lock = await client.getMailboxLock(sentFolder.path);
        try {
          const deadline = Date.now() + SENT_FOLDER_POLL_MS;
          let found = false;
          while (Date.now() < deadline && !found) {
            const uids = await client.search(
              { header: { "message-id": result.send.messageId } },
              { uid: true },
            );
            found = uids !== false && uids !== undefined && uids.length > 0;
            if (!found) await sleep(POLL_INTERVAL_MS);
          }
          result.sentFolder.autoSaved = found;
          if (!found && raw !== null) {
            await client.append(sentFolder.path, raw, ["\\Seen"]);
            const after = await client.search(
              { header: { "message-id": result.send.messageId } },
              { uid: true },
            );
            result.sentFolder.appendWorked =
              after !== false && after !== undefined && after.length > 0;
          }
        } finally {
          lock.release();
        }
      } catch (error) {
        result.errors.push(`sentFolder: ${messageOf(error)}`);
      }
    }

    // 8. MOVE: the probe message from INBOX to \Trash.
    const trash = result.folders.find((f) => f.specialUse === "\\Trash");
    if (trash !== undefined && result.send.messageId !== "") {
      try {
        const lock = await client.getMailboxLock("INBOX");
        try {
          const uids = await client.search(
            { header: { "message-id": result.send.messageId } },
            { uid: true },
          );
          const list = uids === false || uids === undefined ? [] : uids;
          if (list.length > 0) {
            const moved = await client.messageMove(list, trash.path, { uid: true });
            result.move.worked = moved !== false;
          }
        } finally {
          lock.release();
        }
      } catch (error) {
        result.errors.push(`move: ${messageOf(error)}`);
      }
    }

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
    result.errors.push(`fatal: ${messageOf(error)}`);
    writeResult();
    console.error(`mail probe failed: ${messageOf(error)}`);
    process.exit(1);
  });
