"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Tip } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc-client";
import { AssistantSheet } from "./AssistantSheet";

const OPEN_KEY = "df.assistantOpen";
const CONVERSATION_KEY = "df.assistantConversationId";

function readStored(openValue: boolean): {
  open: boolean;
  conversationId: string | null;
} {
  try {
    const conversationId = localStorage.getItem(CONVERSATION_KEY);
    return {
      open: localStorage.getItem(OPEN_KEY) === "1",
      conversationId: conversationId === null || conversationId === "" ? null : conversationId,
    };
  } catch {
    return { open: openValue, conversationId: null };
  }
}

// Top-bar entry point for the assistant drawer. The open state and the selected conversation are
// per-browser preferences, so they live in localStorage rather than the database.
export function AssistantLauncher(): React.ReactNode {
  const status = trpc.ai.status.useQuery();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore per-browser state after mount. A lazy initialiser would make the server and client
  // trees disagree on the first paint, and localStorage is not available during SSR.
  useEffect(() => {
    const stored = readStored(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe restore
    setOpen(stored.open);
    setConversationId(stored.conversationId);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
      localStorage.setItem(CONVERSATION_KEY, conversationId ?? "");
    } catch {
      // Private mode: persistence is a convenience, not a requirement.
    }
  }, [hydrated, open, conversationId]);

  const unavailable =
    status.data !== undefined && (status.data.available === false || status.data.enabled === false);

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Open assistant"
      data-testid="assistant-trigger"
      disabled={unavailable}
      onClick={() => setOpen(true)}
    >
      <Sparkles className="size-4" aria-hidden="true" />
    </Button>
  );

  return (
    <>
      {unavailable ? <Tip label="AI isn't set up on this server">{trigger}</Tip> : trigger}
      <AssistantSheet
        open={open}
        onOpenChange={setOpen}
        conversationId={conversationId}
        onConversationChange={setConversationId}
      />
    </>
  );
}
