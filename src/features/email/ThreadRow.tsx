"use client";

import { ChevronDown, Paperclip } from "lucide-react";
import { useState } from "react";
import { useActionError } from "@/components/shell/ActionErrorProvider";
import { Checkbox } from "@/components/ui/Checkbox";
import { ROW_ACTION_BUTTON } from "@/constants/formStyles";
import { STRINGS } from "@/constants/strings";
import { MASK_CLASS } from "@/features/observability/replayMasking";
import { cn } from "@/lib/utils";
import { readCsrfToken } from "@/utils/csrfCookie";
import type { InboxThread } from "./emailReads";
import { archiveThreadAction, unarchiveThreadAction } from "./folderActions";
import { formatInboxListDate } from "./inboxDate";
import { decodeEmailSnippet } from "./snippetText";
import { ThreadLabelChips } from "./ThreadLabelChips";
import { ThreadPrivacyToggle } from "./ThreadPrivacyToggle";

// "linked" is a chrome-less view (no folder query, filter chips, or archive affordance):
// the caller passes an already-fetched `threads` list, e.g. the deal/contact Email tab.
export type ThreadFolder = "inbox" | "sent" | "archive" | "linked";

// Sent threads only ever go one direction (already sent, nothing to archive back from) and
// "linked" has no chrome at all. Shared by the per-row button and the bulk action bar so
// both gates read from the same source instead of drifting apart.
export function canArchiveInFolder(folder: ThreadFolder): boolean {
  return folder !== "sent" && folder !== "linked";
}

// "linked" is the only chrome-less view: no checkbox column, header select-all, or bulk
// action bar. "sent" still supports selection (for bulk mark-read/unread) even though it
// can't archive, see canArchiveInFolder.
export function canSelectInFolder(folder: ThreadFolder): boolean {
  return folder !== "linked";
}

// Per-row archive/unarchive affordance. Inbox rows archive; Archive rows unarchive; Sent
// rows get no affordance. A real <button> (mutation), separate from the row's nav handler.
function RowArchiveButton({
  folder,
  threadId,
  onDone,
}: {
  folder: ThreadFolder;
  threadId: string;
  onDone: () => void;
}): React.ReactNode {
  const [busy, setBusy] = useState(false);
  const reportError = useActionError();
  if (!canArchiveInFolder(folder)) return null;
  const isArchive = folder === "archive";

  async function run(): Promise<void> {
    setBusy(true);
    const action = isArchive ? unarchiveThreadAction : archiveThreadAction;
    const res = await action(readCsrfToken(), { threadId });
    setBusy(false);
    if (res.ok) onDone();
    else reportError(res.error.id);
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        // The row owns open-thread navigation; archive stays its own action.
        e.stopPropagation();
        void run();
      }}
      className={ROW_ACTION_BUTTON}
    >
      {isArchive ? "Unarchive" : "Archive"}
    </button>
  );
}

interface ThreadRowProps {
  thread: InboxThread;
  folder: ThreadFolder;
  active: boolean;
  selected: boolean;
  onToggleSelected: (threadId: string) => void;
  onOpen: (threadId: string) => void;
  onArchiveDone: () => void;
  // Refresh the list after the owner flips this thread's visibility, so the lock and the projected
  // visibility stay in sync with the DB. Optional: chrome-less callers omit it.
  onVisibilityChanged?: () => void;
}

// A single thread row, laid out as a five-column grid: selection checkbox, sender, subject +
// snippet, icons, date. The whole row opens the thread (6.7.6 U23); selection, privacy and
// archive stop propagation so they keep their own actions. Snippet masking is preserved.
export function ThreadRow({
  thread,
  folder,
  active,
  selected,
  onToggleSelected,
  onOpen,
  onArchiveDone,
  onVisibilityChanged,
}: ThreadRowProps): React.ReactNode {
  const subject = thread.subject ?? "(no subject)";
  const sender = thread.senderName ?? thread.senderEmail;
  const unlinked = thread.personId === null && thread.dealId === null;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the sr-only Open button is the row's keyboard path
    <li
      // The row is the navigation target; nested controls guard their own clicks (6.7.6 U23).
      onClick={() => onOpen(thread.id)}
      className={cn(
        "group relative grid grid-cols-[32px_200px_1fr_auto_72px] items-center gap-3 h-11 px-4",
        "[content-visibility:auto] [contain-intrinsic-size:auto_44px]",
        "cursor-pointer",
        active ? "bg-info-soft" : "hover:bg-muted",
      )}
    >
      {/* Keyboard path to the row action: hidden until focused, so the row itself never becomes a
          tab stop with a bogus role (the grid contains its own buttons). */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(thread.id);
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-1 focus:z-10 focus:rounded-md focus:bg-card focus:px-2 focus:py-1 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring"
      >
        Open {subject}
      </button>
      {/* The checkbox column is always present so every folder lines up; chrome-less views
          render an empty cell instead of shifting the sender into column one. The wrapper is a
          pure propagation guard: selecting must not also open the thread. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: propagation guard only */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: propagation guard only */}
      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        {canSelectInFolder(folder) && (
          <Checkbox
            label={`Select ${subject}`}
            checked={selected}
            onCheckedChange={() => onToggleSelected(thread.id)}
          />
        )}
      </div>

      {/* Correspondent column. Pipedrive leads each row with the counterparty; the display name
          wins over the address, and the unread dot plus semibold weight carry the unread state. */}
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 truncate text-sm",
          thread.unread ? "font-semibold" : "font-normal",
        )}
      >
        {thread.unread && (
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        )}
        {sender !== null && <span className="truncate">{sender}</span>}
      </div>

      {/* Subject then the snippet on one line, truncated together. */}
      <div className="min-w-0 truncate text-sm">
        <span className="text-sm font-medium text-foreground">{subject}</span>
        {thread.snippet !== null && thread.snippet !== "" && (
          <>
            {" · "}
            <span className={cn("text-muted-foreground", MASK_CLASS)}>
              {decodeEmailSnippet(thread.snippet)}
            </span>
          </>
        )}
      </div>

      {/* Icons: attachment, labels, unlinked, privacy, then the hover-only archive action. */}
      <div className="flex items-center justify-end gap-1.5">
        {thread.hasAttachment && (
          <Paperclip
            role="img"
            aria-label={STRINGS.inbox.hasAttachmentLabel}
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          />
        )}
        <ThreadLabelChips labels={thread.labels} />
        {unlinked && (
          <span className="shrink-0 rounded bg-warning/20 px-1.5 py-0.5 text-xs text-warning-foreground">
            Unlinked
          </span>
        )}
        {/* Privacy toggle stays visible (the lock reflects private/shared at a glance); owner-only.
            A16: a caret sits next to the lock so the affordance reads as a dropdown. */}
        {thread.isOwner && (
          <div className="flex shrink-0 items-center text-muted-foreground">
            <ThreadPrivacyToggle
              threadId={thread.id}
              visibility={thread.visibility}
              onChanged={onVisibilityChanged}
            />
            <ChevronDown data-privacy-caret="true" aria-hidden="true" className="-ml-1 h-3 w-3" />
          </div>
        )}
        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <RowArchiveButton folder={folder} threadId={thread.id} onDone={onArchiveDone} />
        </div>
      </div>

      <span className="text-right text-meta text-muted-foreground tabular-nums">
        {formatInboxListDate(thread.lastMessageAt)}
      </span>
    </li>
  );
}
