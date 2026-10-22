"use client";

import { Forward, Reply, ReplyAll } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { STRINGS } from "@/constants/strings";
import { useIsMobile } from "@/features/navigation/mobile/useIsMobile";
import { Composer } from "./composer/Composer";
import type { ComposerContext } from "./composer/composer.types";
import { buildReplyPrefill, type ReplyMode, type ReplyPrefillSourceMessage } from "./replyPrefill";

interface ReaderActionsProps {
  message: ReplyPrefillSourceMessage;
  // Mailbox address the reply/forward is sent from; excluded from reply-all recipients.
  selfEmail: string;
  accountId: string;
  threadId: string;
  onSent?: () => void;
  // Mode to open in. Omitted by the thread reader, which starts on the footer instead.
  initialMode?: ReplyMode;
  context?: ComposerContext;
}

// Reply / Reply all / Forward for the thread reader. Toggles which mode is active; the
// active mode renders the shared Composer pre-filled via buildReplyPrefill (pure
// recipient/subject/body derivation, unit-tested separately in replyPrefill.test.ts).
// Forward omits threadId so sending forks a new thread instead of replying into this one.
export function ReaderActions({
  message,
  selfEmail,
  accountId,
  threadId,
  onSent,
  initialMode,
  context,
}: ReaderActionsProps): React.ReactNode {
  const [mode, setMode] = useState<ReplyMode | null>(initialMode ?? null);
  const isMobile = useIsMobile();

  if (mode !== null) {
    const composer = (
      <Composer
        accountId={accountId}
        threadId={mode === "forward" ? undefined : threadId}
        prefill={buildReplyPrefill(mode, message, selfEmail)}
        context={context}
        onSent={onSent}
        onClose={() => setMode(null)}
      />
    );
    // On a phone the reply composer opens as a bottom sheet (closes Part 10's open issue) instead
    // of an inline block that pushes the conversation off screen.
    if (isMobile) {
      return (
        <Sheet open onOpenChange={(open) => (!open ? setMode(null) : undefined)}>
          <SheetContent
            aria-label="Reply"
            className="inset-x-0 bottom-0 top-auto h-auto max-h-[85dvh] w-full max-w-none rounded-t-lg rounded-b-none border-t border-l-0 pb-[env(safe-area-inset-bottom)]"
          >
            <SheetTitle className="sr-only">Reply</SheetTitle>
            {composer}
          </SheetContent>
        </Sheet>
      );
    }
    return composer;
  }

  // Persistent bordered footer card (PD parity B10): the sender avatar sits on the left, then the
  // reply / reply-all / forward affordances as glyph + label buttons. Boxed to match PD's reply
  // footer, in the same constrained column as the message cards above it.
  return (
    <div
      data-testid="reader-reply-footer"
      className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
    >
      <Avatar name={message.fromEmail} className="size-8 shrink-0 text-caption" />
      <button
        type="button"
        onClick={() => setMode("reply")}
        className="flex h-8 items-center gap-1.5 rounded-md bg-action px-3 text-sm font-semibold text-action-foreground transition-colors duration-100 hover:bg-primary-hover"
      >
        <Reply aria-hidden="true" className="h-3.5 w-3.5" />
        {STRINGS.inbox.replyAction}
      </button>
      <button
        type="button"
        onClick={() => setMode("replyAll")}
        className="flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-card px-3 text-sm font-semibold text-foreground transition-colors duration-100 hover:bg-muted"
      >
        <ReplyAll aria-hidden="true" className="h-3.5 w-3.5" />
        {STRINGS.inbox.replyAllAction}
      </button>
      <button
        type="button"
        onClick={() => setMode("forward")}
        className="flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-card px-3 text-sm font-semibold text-foreground transition-colors duration-100 hover:bg-muted"
      >
        <Forward aria-hidden="true" className="h-3.5 w-3.5" />
        {STRINGS.inbox.forwardAction}
      </button>
    </div>
  );
}
