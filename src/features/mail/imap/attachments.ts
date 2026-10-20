import { simpleParser } from "mailparser";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { err, ok, type Result } from "@/types/result";
import type { ImapSession } from "../transport/types";
import { locationsFor } from "./locations";

// Re-fetch the message source and pull one attachment by its `idx:{n}` index. Preference order
// keeps the download on the smallest/canonical copy when a message lives in several folders.
const FOLDER_PRIORITY = ["inbox", "sent", "archive", "junk", "trash"];

export async function fetchImapAttachment(args: {
  db: Db;
  accountId: string;
  session: ImapSession;
  providerMessageId: string;
  providerAttachmentId: string;
  signal: AbortSignal;
}): Promise<Result<{ bytes: Buffer }, AppError>> {
  const match = /^idx:(\d+)$/.exec(args.providerAttachmentId);
  if (match === null) {
    return err(
      new AppError(ERROR_IDS.MAIL_LOCATION_MISSING, "unknown attachment id", {
        providerAttachmentId: args.providerAttachmentId,
      }),
    );
  }
  const index = Number(match[1]);

  const locations = await locationsFor(args.db, args.accountId, [args.providerMessageId]);
  if (locations.length === 0) {
    return err(
      new AppError(ERROR_IDS.MAIL_LOCATION_MISSING, "no folder location for this message", {
        accountId: args.accountId,
      }),
    );
  }
  const folders = await args.session.listFolders(args.signal);
  const useOf = new Map(
    folders.ok ? folders.value.map((folder) => [folder.path, folder.specialUse]) : [],
  );
  const ranked = [...locations].sort((a, b) => {
    const rank = (folder: string): number => {
      const use = useOf.get(folder) ?? null;
      const position = use === null ? FOLDER_PRIORITY.length : FOLDER_PRIORITY.indexOf(use);
      return position === -1 ? FOLDER_PRIORITY.length : position;
    };
    return rank(a.folder) - rank(b.folder);
  });
  const location = ranked[0];
  if (location === undefined) {
    return err(new AppError(ERROR_IDS.MAIL_LOCATION_MISSING, "no usable location", {}));
  }

  const fetched = await args.session.fetchSources(
    location.folder,
    [location.uid],
    env.MAIL_MAX_MESSAGE_BYTES,
    args.signal,
  );
  if (!fetched.ok) return fetched;
  const source = fetched.value[0]?.source;
  if (source === null || source === undefined) {
    return err(
      new AppError(ERROR_IDS.MAIL_MESSAGE_TOO_LARGE, "message too large to download", {
        accountId: args.accountId,
      }),
    );
  }

  const parsed = await simpleParser(source);
  const attachment = parsed.attachments[index];
  if (attachment === undefined) {
    return err(
      new AppError(ERROR_IDS.MAIL_LOCATION_MISSING, "attachment index not found", {
        providerAttachmentId: args.providerAttachmentId,
      }),
    );
  }
  return ok({ bytes: attachment.content });
}
