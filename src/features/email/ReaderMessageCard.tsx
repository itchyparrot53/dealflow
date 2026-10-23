"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { ThreadMessage } from "./emailReads";
import { InboundAttachmentList } from "./InboundAttachmentList";
import { formatReaderDate } from "./inboxDate";
import { MessageBodyFrame } from "./MessageBodyFrame";
import { MessageTrackingHistory } from "./MessageTrackingHistory";

interface ReaderMessageCardProps {
  message: ThreadMessage;
  // Remote-content gate is shared across the whole thread (one "show remote content" click reveals
  // every message's remote assets), so it is lifted to ThreadPane and threaded in here.
  allowRemote: boolean;
  onShowRemote: () => void;
}

// One message in the reader's reading column, wrapped as a bordered card. The header row carries
// the sender (avatar, name, address), the To/Cc line, the date on the right and the remote-content
// control; the body sits in the white paper panel; attachments and (outbound only) the persisted
// open/click history follow below.
export function ReaderMessageCard({
  message,
  allowRemote,
  onShowRemote,
}: ReaderMessageCardProps): React.ReactNode {
  return (
    <article
      data-testid="reader-message-card"
      className="rounded-lg border border-border bg-card p-4"
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {/* Per-message avatar (Pipedrive shows one beside each sender). */}
          <Avatar
            name={message.fromName ?? message.fromEmail}
            className="size-8 shrink-0 text-caption"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm">
              <span className="truncate font-semibold text-foreground">
                {message.fromName ?? message.fromEmail}
              </span>
              {message.fromName !== null && (
                <span className="truncate text-meta text-muted-foreground">
                  {message.fromEmail}
                </span>
              )}
              {message.direction === "outbound" && (
                <span className="rounded bg-accent px-1 text-accent-foreground">Sent</span>
              )}
            </div>
            {message.toEmails.length > 0 && (
              // Recipients line (Pipedrive shows To: / Cc: in the message header). Matters most on
              // sent mail, where the body doesn't say who it went to.
              <p className="mt-0.5 truncate text-meta text-muted-foreground">
                <span className="font-medium">To:</span> <span>{message.toEmails.join(", ")}</span>
                {message.ccEmails.length > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium">Cc:</span>{" "}
                    <span>{message.ccEmails.join(", ")}</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-meta tabular-nums text-muted-foreground">
            {formatReaderDate(message.sentAt)}
          </span>
          {/* Remote assets stay blocked until the owner explicitly reveals them; the click
              re-queries the server with allowRemote:true (see MessageBodyFrame). */}
          {!allowRemote && (
            <Button variant="secondary" size="sm" onClick={onShowRemote}>
              Show remote content
            </Button>
          )}
        </div>
      </header>
      <MessageBodyFrame html={message.bodyHtml} />
      {message.attachments.length > 0 && (
        <InboundAttachmentList attachments={message.attachments} />
      )}
      {message.direction === "outbound" && <MessageTrackingHistory tracking={message.tracking} />}
    </article>
  );
}
