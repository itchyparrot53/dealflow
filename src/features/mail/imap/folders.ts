import type { AppError } from "@/constants/errorIds";
import { MAIL_FOLDER_SYNC_USES, type SpecialUse } from "@/constants/mail";
import type { Result } from "@/types/result";
import type { FolderInfo, ImapSession } from "../transport/types";

const SYNCED = new Set<string>(MAIL_FOLDER_SYNC_USES);

// Purelymail reports NO SPECIAL-USE flags (only INBOX, Sent, Archive, Junk, Trash and Drafts by
// name), so a missing flag falls back to the folder's last path segment.
const USE_BY_NAME: Record<string, SpecialUse> = {
  inbox: "inbox",
  sent: "sent",
  archive: "archive",
  junk: "junk",
  trash: "trash",
  drafts: "drafts",
};

function folderUse(folder: FolderInfo): SpecialUse | null {
  if (folder.specialUse !== null) return folder.specialUse;
  const lastSegment = folder.path.split(/[./]/).at(-1)?.trim().toLowerCase() ?? "";
  return USE_BY_NAME[lastSegment] ?? null;
}

// The folders the CRM mirrors: inbox, sent, archive, junk and trash. Drafts and anything else are
// ignored on purpose (no draft sync in this part).
export async function discoverFolders(
  session: ImapSession,
  signal: AbortSignal,
): Promise<Result<{ path: string; specialUse: SpecialUse }[], AppError>> {
  const listed = await session.listFolders(signal);
  if (!listed.ok) return listed;
  const out: { path: string; specialUse: SpecialUse }[] = [];
  for (const folder of listed.value) {
    const use = folderUse(folder);
    if (use === null || !SYNCED.has(use)) continue;
    out.push({ path: folder.path, specialUse: use });
  }
  return { ok: true, value: out };
}
