"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/Textarea";
import {
  confirmAiActionAction,
  createConversationAction,
  rejectAiActionAction,
  sendAssistantMessageAction,
} from "@/features/ai/actions/assistantActions";
import { aiErrorMessage } from "@/features/ai/aiErrors";
import type { ConversationView } from "@/features/ai/assistant/conversations";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { AssistantMessages } from "./AssistantMessages";

const SUGGESTIONS = [
  "Which of my deals need attention this week?",
  "What are my overdue activities?",
  "Summarise my open pipeline",
];

const MESSAGE_MAX = 4_000;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
}

// The assistant drawer: conversations on the left of the header, messages and pending actions in
// the body, one input at the bottom. Writes only happen after Confirm.
export function AssistantSheet({
  open,
  onOpenChange,
  conversationId,
  onConversationChange,
}: Props): React.ReactNode {
  const router = useRouter();
  const utils = trpc.useUtils();
  const conversations = trpc.ai.conversations.list.useQuery(undefined, { enabled: open });
  const current = trpc.ai.conversations.get.useQuery(
    { id: conversationId ?? "" },
    { enabled: open && conversationId !== null },
  );
  const [localView, setLocalView] = useState<ConversationView | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorId, setErrorId] = useState<string | null>(null);

  const view = localView ?? current.data ?? null;

  async function refreshConversations(): Promise<void> {
    await utils.ai.conversations.list.invalidate();
  }

  async function startConversation(): Promise<ConversationView | null> {
    const created = await createConversationAction(readCsrfToken());
    if (!created.ok) {
      setErrorId(created.error.id);
      return null;
    }
    setLocalView(created.value);
    onConversationChange(created.value.id);
    await refreshConversations();
    return created.value;
  }

  async function send(text: string): Promise<void> {
    if (busy || text.trim() === "") return;
    setBusy(true);
    setErrorId(null);
    try {
      let id = conversationId;
      if (id === null) {
        const created = await startConversation();
        if (created === null) return;
        id = created.id;
      }
      const result = await sendAssistantMessageAction(
        { conversationId: id, content: text.slice(0, MESSAGE_MAX) },
        readCsrfToken(),
      );
      if (!result.ok) {
        setErrorId(result.error.id);
        return;
      }
      setLocalView(result.value);
      setDraft("");
      await refreshConversations();
    } finally {
      setBusy(false);
    }
  }

  async function decide(actionId: string, confirm: boolean): Promise<void> {
    if (busy) return;
    setBusy(true);
    setErrorId(null);
    try {
      const result = confirm
        ? await confirmAiActionAction(actionId, readCsrfToken())
        : await rejectAiActionAction(actionId, readCsrfToken());
      if (!result.ok) {
        setErrorId(result.error.id);
        return;
      }
      setLocalView(result.value);
      await utils.invalidate();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const options = (conversations.data ?? []).map((conversation) => ({
    value: conversation.id,
    label: conversation.title,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px]">
        <div className="space-y-2 border-b px-4 py-3 pr-12">
          <SheetTitle>Assistant</SheetTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="assistant-conversation" className="sr-only">
              Conversation
            </Label>
            <div className="min-w-0 flex-1">
              <Select
                value={conversationId ?? ""}
                onChange={(id) => {
                  onConversationChange(id === "" ? null : id);
                  setLocalView(null);
                }}
                options={options}
                ariaLabel="Conversation"
                placeholder="New conversation"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void startConversation()}
              disabled={busy}
            >
              New chat
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {view !== null && (
            <AssistantMessages
              view={view}
              busy={busy}
              onConfirm={(id) => void decide(id, true)}
              onReject={(id) => void decide(id, false)}
            />
          )}
          {(view === null || view.items.length === 0) && (
            <div className="space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  data-testid="assistant-suggestion"
                  className="block w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                  onClick={() => void send(suggestion)}
                  disabled={busy}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          {errorId !== null && (
            <p role="alert" className="text-sm text-destructive">
              {aiErrorMessage(errorId)}
            </p>
          )}
        </div>

        <form
          className="space-y-2 border-t px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <Label htmlFor="assistant-input" className="sr-only">
            Message the assistant
          </Label>
          <Textarea
            id="assistant-input"
            value={draft}
            maxLength={MESSAGE_MAX}
            rows={2}
            placeholder="Message the assistant"
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={busy || draft.trim() === ""}>
              {busy ? "Thinking..." : "Send"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
