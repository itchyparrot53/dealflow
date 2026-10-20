import { ImapFlow } from "imapflow";
import nodemailer, { type Transporter } from "nodemailer";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { MAIL_BATCH_SIZE } from "@/constants/mail";
import { err, ok } from "@/types/result";
import { specialUseOf } from "./specialUse";
import type {
  FetchedSource,
  FolderInfo,
  ImapCredentials,
  ImapSession,
  MailTransportFactory,
  SmtpCredentials,
  SmtpSender,
} from "./types";

// How long a single IMAP command may take before we treat it as a connection problem.
const IMAP_SOCKET_TIMEOUT_MS = 60_000;

// One place for every IMAP failure. The password never enters an error context, and the
// distinction matters to the UI: bad credentials mean "update password", an unreachable server
// means "check the host and port".
function mapImapError(error: unknown, command: string): AppError {
  const shaped = error as {
    authenticationFailed?: boolean;
    code?: string;
    message?: string;
  };
  const text = `${shaped.code ?? ""} ${shaped.message ?? ""}`.toLowerCase();
  if (shaped.authenticationFailed === true || /auth|login failed|invalid credentials/.test(text)) {
    return new AppError(ERROR_IDS.MAIL_AUTH_FAILED, "imap authentication failed", { command });
  }
  if (
    /connect|timeout|timed out|tls|ssl|certificate|econn|eproto|enotfound|etimedout|socket/.test(
      text,
    )
  ) {
    return new AppError(ERROR_IDS.MAIL_CONNECT_FAILED, "imap server unreachable", { command });
  }
  return new AppError(ERROR_IDS.MAIL_IMAP_FAILED, "imap command failed", { command });
}

function newClient(creds: ImapCredentials): ImapFlow {
  return new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.username, pass: creds.password },
    logger: false,
    emitLogs: false,
    qresync: true,
    socketTimeout: IMAP_SOCKET_TIMEOUT_MS,
    maxIdleTime: 300_000,
  });
}

async function withLock<T>(client: ImapFlow, folder: string, run: () => Promise<T>): Promise<T> {
  const lock = await client.getMailboxLock(folder);
  try {
    return await run();
  } finally {
    lock.release();
  }
}

function sessionFor(creds: ImapCredentials, client: ImapFlow): ImapSession {
  return {
    supportsIdle: true,

    async listFolders(signal) {
      signal.throwIfAborted();
      try {
        const folders = await client.list();
        return ok(
          folders.map(
            (folder): FolderInfo => ({
              path: folder.path,
              specialUse: specialUseOf(folder.specialUse),
            }),
          ),
        );
      } catch (error) {
        return err(mapImapError(error, "listFolders"));
      }
    },

    async status(folder, signal) {
      signal.throwIfAborted();
      try {
        const status = await withLock(client, folder, () =>
          client.status(folder, {
            messages: true,
            uidNext: true,
            uidValidity: true,
            highestModseq: true,
          }),
        );
        if (status === false) {
          return err(
            new AppError(ERROR_IDS.MAIL_IMAP_FAILED, "status failed", { command: "status" }),
          );
        }
        return ok({
          uidValidity: status.uidValidity ?? 0n,
          uidNext: status.uidNext ?? 0,
          // Purelymail reports 0 for an empty folder; 0 means "unknown", not "nothing changed".
          highestModseq:
            status.highestModseq === undefined || status.highestModseq === 0n
              ? null
              : status.highestModseq,
          messages: status.messages ?? 0,
        });
      } catch (error) {
        return err(mapImapError(error, "status"));
      }
    },

    async listUids(folder, signal) {
      signal.throwIfAborted();
      try {
        // FETCH 1:* (UID), never SEARCH: Purelymail's SEARCH index lags behind APPEND.
        const messages = await withLock(client, folder, () =>
          client.fetchAll("1:*", { uid: true }, { uid: true }),
        );
        return ok(messages.map((message) => message.uid));
      } catch (error) {
        return err(mapImapError(error, "listUids"));
      }
    },

    async uidsInRange(folder, since, before, signal) {
      signal.throwIfAborted();
      try {
        const query = { since, ...(before !== null ? { before } : {}) };
        const found = await withLock(client, folder, () => client.search(query, { uid: true }));
        return ok(Array.isArray(found) ? found : []);
      } catch (error) {
        return err(mapImapError(error, "uidsInRange"));
      }
    },

    async fetchSources(folder, uids, maxBytes, signal) {
      signal.throwIfAborted();
      try {
        const out: FetchedSource[] = [];
        for (let index = 0; index < uids.length; index += MAIL_BATCH_SIZE) {
          const batch = uids.slice(index, index + MAIL_BATCH_SIZE);
          out.push(...(await fetchBatch(client, folder, batch, maxBytes, signal)));
        }
        return ok(out);
      } catch (error) {
        return err(mapImapError(error, "fetchSources"));
      }
    },

    async fetchHeaderOnly(folder, uid, signal) {
      signal.throwIfAborted();
      try {
        const message = await withLock(client, folder, () =>
          client.fetchOne(String(uid), { headers: true }, { uid: true }),
        );
        if (message === false || message === undefined) return ok(null);
        return ok(message.headers ?? null);
      } catch (error) {
        return err(mapImapError(error, "fetchHeaderOnly"));
      }
    },

    async append(folder, raw, flags, signal) {
      signal.throwIfAborted();
      try {
        const response = await withLock(client, folder, () =>
          client.append(folder, raw, flags.length > 0 ? flags : undefined),
        );
        if (response === false) {
          return err(
            new AppError(ERROR_IDS.MAIL_APPEND_FAILED, "append failed", { command: "append" }),
          );
        }
        return ok({
          uid: response.uid ?? null,
          uidValidity: response.uidValidity ?? null,
        });
      } catch (error) {
        return err(mapImapError(error, "append"));
      }
    },

    async move(folder, uids, destination, signal) {
      signal.throwIfAborted();
      if (uids.length === 0) return ok(new Map<number, number>());
      try {
        const response = await withLock(client, folder, () =>
          client.messageMove(uids.join(","), destination, { uid: true }),
        );
        if (response === false) {
          return err(new AppError(ERROR_IDS.MAIL_IMAP_FAILED, "move failed", { command: "move" }));
        }
        return ok(response.uidMap ?? new Map<number, number>());
      } catch (error) {
        return err(mapImapError(error, "move"));
      }
    },

    async findByMessageId(folder, messageId, signal) {
      signal.throwIfAborted();
      try {
        const found = await withLock(client, folder, () =>
          client.search({ header: { "message-id": messageId } }, { uid: true }),
        );
        return ok(Array.isArray(found) ? found : []);
      } catch (error) {
        return err(mapImapError(error, "findByMessageId"));
      }
    },

    async idle(folder, onExists, signal) {
      signal.throwIfAborted();
      // IDLE blocks the connection, so it gets its own client; the regular session stays usable
      // for polling. The promise resolves when the connection ends (server timeout, network
      // drop or close), and the manager retries later.
      const idleClient = newClient(creds);
      try {
        await idleClient.connect();
        idleClient.on("exists", () => {
          onExists();
        });
        await idleClient.mailboxOpen(folder);
        signal.throwIfAborted();
        await idleClient.idle();
        return ok(undefined);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        return err(mapImapError(error, "idle"));
      } finally {
        await idleClient.logout().catch(() => undefined);
      }
    },

    async close() {
      await client.logout().catch(() => undefined);
    },
  };
}

function smtpError(error: unknown, fallback: "send" | "verify"): AppError {
  const shaped = error as { code?: string; responseCode?: number; message?: string };
  const code = shaped.code ?? "";
  if (code === "EAUTH" || shaped.responseCode === 535) {
    return new AppError(ERROR_IDS.MAIL_AUTH_FAILED, "smtp authentication failed", {});
  }
  if (/ECONNECTION|ETIMEDOUT|ESOCKET|ECONNREFUSED|ENOTFOUND|TLS|SSL/i.test(code)) {
    return new AppError(ERROR_IDS.MAIL_CONNECT_FAILED, "smtp server unreachable", {});
  }
  return fallback === "verify"
    ? new AppError(ERROR_IDS.MAIL_CONNECT_FAILED, "smtp verify failed", {})
    : new AppError(ERROR_IDS.MAIL_SEND_FAILED, "smtp send failed", {});
}

function smtpSender(creds: SmtpCredentials): SmtpSender {
  const transport: Transporter = nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.username, pass: creds.password },
  });
  return {
    async verify(signal) {
      signal.throwIfAborted();
      try {
        await transport.verify();
        return ok(undefined);
      } catch (error) {
        return err(smtpError(error, "verify"));
      }
    },

    async send(raw, envelope, signal) {
      signal.throwIfAborted();
      try {
        const info = await transport.sendMail({ envelope, raw });
        signal.throwIfAborted();
        return ok({ response: info.response ?? "" });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        return err(smtpError(error, "send"));
      }
    },
  };
}

export function createRealTransportFactory(): MailTransportFactory {
  return {
    async openImap(creds, signal) {
      signal.throwIfAborted();
      const client = newClient(creds);
      try {
        await client.connect();
        signal.throwIfAborted();
        return ok(sessionFor(creds, client));
      } catch (error) {
        await client.logout().catch(() => undefined);
        return err(mapImapError(error, "connect"));
      }
    },
    smtp: smtpSender,
  };
}

// One batch: metadata first, then the source only for messages small enough to store. The
// fetches run one at a time because imapflow forbids overlapping fetches on one selected mailbox.
async function fetchBatch(
  client: ImapFlow,
  folder: string,
  batch: number[],
  maxBytes: number,
  signal: AbortSignal,
): Promise<FetchedSource[]> {
  if (batch.length === 0) return [];
  const metadata = await withLock(client, folder, () =>
    client.fetchAll(batch.join(","), { uid: true, size: true, internalDate: true }, { uid: true }),
  );
  const out: FetchedSource[] = [];
  for (const message of metadata) {
    signal.throwIfAborted();
    const size = message.size ?? 0;
    let source: Buffer | null = null;
    if (size <= maxBytes) {
      const full = await withLock(client, folder, () =>
        client.fetchOne(String(message.uid), { source: true }, { uid: true }),
      );
      source = full === false || full === undefined ? null : (full.source ?? null);
    }
    out.push({
      uid: message.uid,
      size,
      internalDate: message.internalDate instanceof Date ? message.internalDate : null,
      source,
    });
  }
  return out;
}
