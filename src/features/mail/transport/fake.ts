import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { err, ok } from "@/types/result";
import {
  FAKE_FOLDERS,
  fakeAppend,
  fakeList,
  fakeLogin,
  fakeLogSmtp,
  fakeMessageDate,
  fakeMove,
  fakeRead,
  fakeSpecialUse,
  fakeStatus,
} from "./fakeStore";
import type {
  FetchedSource,
  FolderInfo,
  ImapCredentials,
  ImapSession,
  MailTransportFactory,
  SmtpCredentials,
  SmtpSender,
} from "./types";

function folderInfo(): FolderInfo[] {
  return FAKE_FOLDERS.map((path) => ({ path, specialUse: fakeSpecialUse(path) }));
}

function headersOf(raw: Buffer): Buffer {
  const text = raw.toString("utf8");
  const end = text.search(/\r?\n\r?\n/);
  return Buffer.from(end === -1 ? text : text.slice(0, end));
}

function session(dir: string, creds: ImapCredentials): ImapSession {
  const address = creds.username;
  return {
    // The fake cannot hold a connection open, so the idle manager skips it.
    supportsIdle: false,

    listFolders: () => Promise.resolve(ok(folderInfo())),

    status: (folder) => Promise.resolve(ok(fakeStatus(dir, address, folder))),

    listUids: (folder) => Promise.resolve(ok(fakeList(dir, address, folder))),

    uidsInRange: (folder, since, before) => {
      const uids = fakeList(dir, address, folder).filter((uid) => {
        const date = fakeMessageDate(dir, address, folder, uid);
        if (date < since) return false;
        return before === null || date < before;
      });
      return Promise.resolve(ok(uids));
    },

    fetchSources: (folder, uids, maxBytes) => {
      const out: FetchedSource[] = [];
      for (const uid of uids) {
        const raw = fakeRead(dir, address, folder, uid);
        out.push({
          uid,
          size: raw.length,
          internalDate: fakeMessageDate(dir, address, folder, uid),
          source: raw.length <= maxBytes ? raw : null,
        });
      }
      return Promise.resolve(ok(out));
    },

    fetchHeaderOnly: (folder, uid) =>
      Promise.resolve(ok(headersOf(fakeRead(dir, address, folder, uid)))),

    append: (folder, raw) => {
      const appended = fakeAppend(dir, address, folder, raw);
      return Promise.resolve(ok({ uid: appended.uid, uidValidity: appended.uidValidity }));
    },

    move: (folder, uids, destination) =>
      Promise.resolve(ok(fakeMove(dir, address, folder, uids, destination))),

    findByMessageId: (folder, messageId) => {
      const wanted = messageId.trim().toLowerCase();
      const found = fakeList(dir, address, folder).filter((uid) =>
        fakeRead(dir, address, folder, uid).toString("utf8").toLowerCase().includes(wanted),
      );
      return Promise.resolve(ok(found));
    },

    idle: () => Promise.resolve(err(new AppError(ERROR_IDS.MAIL_UNSUPPORTED, "fake: no idle"))),

    close: () => Promise.resolve(),
  };
}

function smtp(dir: string, creds: SmtpCredentials): SmtpSender {
  const address = creds.username;
  return {
    verify: () => Promise.resolve(ok(undefined)),

    send: (raw, envelope) => {
      // The caller has already stripped Bcc from the wire copy; the fake delivers exactly that
      // to the envelope recipients (which include Bcc recipients the header no longer names).
      for (const recipient of envelope.to) fakeAppend(dir, recipient, "INBOX", raw);
      fakeLogSmtp(dir, { from: envelope.from, to: envelope.to, size: raw.length });
      // Keep the sender's own mailbox present even when a test only sends.
      fakeLogin(dir, address, creds.password);
      return Promise.resolve(ok({ response: "250 fake ok" }));
    },
  };
}

export function createFakeTransportFactory(dir: string): MailTransportFactory {
  return {
    openImap: (creds: ImapCredentials, signal: AbortSignal) => {
      signal.throwIfAborted();
      const loggedIn = fakeLogin(dir, creds.username, creds.password);
      if (!loggedIn.ok) return Promise.resolve(loggedIn);
      return Promise.resolve(ok(session(dir, creds)));
    },
    smtp: (creds) => smtp(dir, creds),
  };
}
