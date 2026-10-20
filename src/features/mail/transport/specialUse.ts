import type { SpecialUse } from "@/constants/mail";

const SPECIAL_USES: readonly SpecialUse[] = ["inbox", "sent", "archive", "junk", "trash", "drafts"];

// IMAP servers report the flag WITH a leading backslash (`\Sent`, `\Junk`, `\Inbox`), sometimes
// through SPECIAL-USE and sometimes inferred from the folder name. Strip it before matching;
// unknown flags (for example `\All`) map to null.
export function specialUseOf(value: string | null | undefined): SpecialUse | null {
  if (value === null || value === undefined) return null;
  const flag = value.trim().replace(/^\\/, "").toLowerCase();
  return SPECIAL_USES.find((use) => use === flag) ?? null;
}
