// Live proof of the real IMAP/SMTP transports, parser and thread keys against the owner's
// Purelymail test mailbox. The only real network call the plan allows: mail goes from that
// mailbox to itself, nothing else is contacted.
//
//   pnpm mail:live-check
//
// Credentials come from MAIL_PROBE_USER / MAIL_PROBE_PASS in .env (never printed). Without them
// the script writes status "skipped" and does nothing.
import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { MAIL_PRESETS } from "@/constants/mail";
import { buildMime, deriveMessageId } from "@/features/email/mime";
import { normalizeMessageId } from "@/features/mail/parse/messageId";
import { parseRawMessage } from "@/features/mail/parse/parseRaw";
import { stripBccHeader } from "@/features/mail/parse/stripBcc";
import { createRealTransportFactory } from "@/features/mail/transport/real";
import type {
  FolderInfo,
  ImapCredentials,
  ImapSession,
  MailTransportFactory,
  SmtpCredentials,
} from "@/features/mail/transport/types";

interface LiveResult {
  status: "ok" | "failed" | "skipped";
  checkedAt: string;
  account: string;
  folders: { path: string; specialUse: string | null }[];
  sendOk: boolean;
  appendUid: number | null;
  inboundFound: boolean;
  bccStripped: boolean;
  replyThreadsToA: boolean;
  sentSearchFound: boolean;
  movedToTrash: boolean;
  timingsMs: Record<string, number>;
  errors: string[];
}

try {
  process.loadEnvFile(".env");
} catch {
  // No .env: the probe keys will be absent and the run reports skipped.
}

function mask(address: string): string {
  const [local = "", domain = ""] = address.split("@");
  return `${local.slice(0, 2)}${"*".repeat(Math.max(0, local.length - 2))}@${domain}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function matchedSource(
  session: ImapSession,
  freshUids: number[],
  messageId: string,
  ownAddress: string,
  signal: AbortSignal,
): Promise<{ uid: number; raw: Buffer } | null> {
  // Parsed ids are lowercased (normalizeMessageId), so compare against the normalised form.
  const wanted = normalizeMessageId(messageId) ?? messageId;
  const fetched = await session.fetchSources("INBOX", freshUids, 15_728_640, signal);
  if (!fetched.ok) return null;
  for (const message of fetched.value) {
    if (message.source === null) continue;
    const parsed = await parseRawMessage(message.source, { ownAddress });
    if (parsed.providerMessageId === wanted) return { uid: message.uid, raw: message.source };
  }
  return null;
}

async function waitForMessage(
  session: ImapSession,
  messageId: string,
  ownAddress: string,
  knownUids: Set<number>,
  signal: AbortSignal,
  timeoutMs = 90_000,
): Promise<{ uid: number; raw: Buffer } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const listed = await session.listUids("INBOX", signal);
    const fresh = listed.ok ? listed.value.filter((uid) => !knownUids.has(uid)) : [];
    if (fresh.length > 0) {
      const hit = await matchedSource(session, fresh, messageId, ownAddress, signal);
      if (hit !== null) return hit;
    }
    await sleep(5_000);
  }
  return null;
}

function sentFolderPath(folders: FolderInfo[]): string | null {
  return (
    folders.find((folder) => folder.specialUse === "sent")?.path ??
    folders.find((folder) => folder.path.toLowerCase() === "sent")?.path ??
    null
  );
}

interface Check {
  session: ImapSession;
  factories: { factory: MailTransportFactory; smtp: SmtpCredentials };
  account: string;
  domain: string;
  folders: FolderInfo[];
  result: LiveResult;
  timings: Record<string, number>;
  signal: AbortSignal;
}

async function sendA(
  check: Check,
): Promise<{ uid: number; raw: Buffer; messageId: string } | null> {
  const iso = new Date().toISOString();
  const messageId = deriveMessageId({
    accountId: "live-check",
    idempotencyKey: `a-${iso}`,
    domain: check.domain,
  });
  const raw = buildMime({
    from: check.account,
    to: [check.account],
    bcc: [check.account],
    subject: `Dealflow live check ${iso}`,
    html: "<p>Dealflow live check A.</p>",
    text: "Dealflow live check A.",
    messageId,
  });
  // Snapshot INBOX before sending: a message that lands between the send and the snapshot would
  // otherwise be "known" and the waiter would ignore it.
  const listedBefore = await check.session.listUids("INBOX", check.signal);
  const known = new Set(listedBefore.ok ? listedBefore.value : []);
  const sent = await check.factories.factory
    .smtp(check.factories.smtp)
    .send(
      Buffer.from(stripBccHeader(raw)),
      { from: check.account, to: [check.account] },
      check.signal,
    );
  check.result.sendOk = sent.ok;
  if (!sent.ok) {
    check.result.errors.push(`smtp A: ${sent.error.id}`);
    return null;
  }
  const folder = sentFolderPath(check.folders);
  if (folder === null) {
    check.result.errors.push("no Sent folder");
    return null;
  }
  const appended = await check.session.append(folder, Buffer.from(raw), ["\\Seen"], check.signal);
  check.result.appendUid = appended.ok ? appended.value.uid : null;
  if (!appended.ok) check.result.errors.push(`append A: ${appended.error.id}`);

  const started = performance.now();
  const arrived = await waitForMessage(
    check.session,
    messageId,
    check.account,
    known,
    check.signal,
  );
  check.timings.inboundMs = Math.round(performance.now() - started);
  check.result.inboundFound = arrived !== null;
  if (arrived === null) {
    check.result.errors.push("A never arrived in INBOX");
    return null;
  }
  const headers = arrived.raw.toString("utf8").split(/\r?\n\r?\n/)[0] ?? "";
  check.result.bccStripped = !/^bcc:/im.test(headers);
  return { uid: arrived.uid, raw: arrived.raw, messageId };
}

async function sendReply(
  check: Check,
  parent: { uid: number; messageId: string },
): Promise<{ uid: number } | null> {
  const iso = new Date().toISOString();
  const messageId = deriveMessageId({
    accountId: "live-check",
    idempotencyKey: `b-${iso}`,
    domain: check.domain,
  });
  const raw = buildMime({
    from: check.account,
    to: [check.account],
    subject: `Re: Dealflow live check ${iso}`,
    html: "<p>Dealflow live check B.</p>",
    text: "Dealflow live check B.",
    messageId,
    inReplyTo: parent.messageId,
    references: parent.messageId,
  });
  const listedBefore = await check.session.listUids("INBOX", check.signal);
  const known = new Set(
    (listedBefore.ok ? listedBefore.value : []).filter((uid) => uid !== parent.uid),
  );
  const sent = await check.factories.factory
    .smtp(check.factories.smtp)
    .send(
      Buffer.from(stripBccHeader(raw)),
      { from: check.account, to: [check.account] },
      check.signal,
    );
  if (!sent.ok) {
    check.result.errors.push(`smtp B: ${sent.error.id}`);
    return null;
  }
  const folder = sentFolderPath(check.folders);
  if (folder !== null)
    await check.session.append(folder, Buffer.from(raw), ["\\Seen"], check.signal);

  const started = performance.now();
  const arrived = await waitForMessage(
    check.session,
    messageId,
    check.account,
    known,
    check.signal,
  );
  check.timings.replyMs = Math.round(performance.now() - started);
  if (arrived === null) {
    check.result.errors.push("B never arrived in INBOX");
    return null;
  }
  const parsed = await parseRawMessage(arrived.raw, { ownAddress: check.account });
  const parentId = normalizeMessageId(parent.messageId) ?? parent.messageId;
  check.result.replyThreadsToA = parsed.inReplyTo === parentId && parsed.references[0] === parentId;
  return { uid: arrived.uid };
}

async function main(): Promise<LiveResult> {
  const started = performance.now();
  const timings: Record<string, number> = {};
  const errors: string[] = [];
  const account = process.env.MAIL_PROBE_USER ?? "";
  const password = process.env.MAIL_PROBE_PASS ?? "";
  const result: LiveResult = {
    status: "skipped",
    checkedAt: new Date().toISOString(),
    account: account === "" ? "" : mask(account),
    folders: [],
    sendOk: false,
    appendUid: null,
    inboundFound: false,
    bccStripped: false,
    replyThreadsToA: false,
    sentSearchFound: false,
    movedToTrash: false,
    timingsMs: timings,
    errors,
  };
  if (account === "" || password === "") return result;

  const preset = MAIL_PRESETS.purelymail;
  const imap: ImapCredentials = {
    host: process.env.MAIL_PROBE_IMAP_HOST ?? preset.imapHost,
    port: Number(process.env.MAIL_PROBE_IMAP_PORT ?? preset.imapPort),
    secure: true,
    username: account,
    password,
  };
  const smtp: SmtpCredentials = {
    host: process.env.MAIL_PROBE_SMTP_HOST ?? preset.smtpHost,
    port: Number(process.env.MAIL_PROBE_SMTP_PORT ?? preset.smtpPort),
    secure: true,
    username: account,
    password,
  };
  const factory = createRealTransportFactory();
  const signal = AbortSignal.timeout(300_000);
  const opened = await factory.openImap(imap, signal);
  if (!opened.ok) {
    errors.push(`openImap: ${opened.error.id}`);
    result.status = "failed";
    return result;
  }
  result.status = "failed";
  const session = opened.value;
  try {
    const listed = await session.listFolders(signal);
    if (!listed.ok) {
      errors.push(`listFolders: ${listed.error.id}`);
      return result;
    }
    result.folders = listed.value.map((folder) => ({
      path: folder.path,
      specialUse: folder.specialUse,
    }));
    const check: Check = {
      session,
      factories: { factory, smtp },
      account,
      domain: account.split("@")[1] ?? "dealflow.invalid",
      folders: listed.value,
      result,
      timings,
      signal,
    };

    const parent = await sendA(check);
    if (parent === null) return result;
    const reply = await sendReply(check, parent);
    if (reply === null) return result;

    await sleep(8_000);
    const found = await session.findByMessageId(
      sentFolderPath(check.folders) ?? "Sent",
      parent.messageId,
      signal,
    );
    result.sentSearchFound = found.ok && found.value.length > 0;
    const move = await session.move(
      "INBOX",
      [parent.uid, reply.uid],
      check.folders.find((folder) => folder.specialUse === "trash")?.path ?? "Trash",
      signal,
    );
    result.movedToTrash = move.ok;
    if (!move.ok) errors.push(`move to Trash: ${move.error.id}`);

    result.status =
      result.sendOk &&
      result.inboundFound &&
      result.bccStripped &&
      result.replyThreadsToA &&
      result.sentSearchFound &&
      result.movedToTrash
        ? "ok"
        : "failed";
    timings.totalMs = Math.round(performance.now() - started);
    return result;
  } finally {
    await session.close();
  }
}

main()
  .then((result) => {
    mkdirSync("docs/dealflow", { recursive: true });
    writeFileSync("docs/dealflow/mail-live-check.json", `${JSON.stringify(result, null, 2)}\n`);
    console.warn(`mail-live-check: ${result.status}`);
  })
  .catch((error: unknown) => {
    console.error("mail-live-check failed:", error);
    process.exit(1);
  });
