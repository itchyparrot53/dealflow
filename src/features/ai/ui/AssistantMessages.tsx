"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ConversationItem, ConversationView } from "@/features/ai/assistant/conversations";
import { renderSimpleText } from "./renderSimpleText";

interface Props {
  view: ConversationView;
  busy: boolean;
  onConfirm: (actionId: string) => void;
  onReject: (actionId: string) => void;
}

function statusVariant(status: string): "secondary" | "success" | "destructive" | "outline" {
  if (status === "confirmed") return "success";
  if (status === "failed") return "destructive";
  if (status === "rejected") return "outline";
  return "secondary";
}

function itemKey(item: ConversationItem): string {
  return `${item.kind}-${item.id}`;
}

function ActionCard({
  item,
  busy,
  onConfirm,
  onReject,
}: {
  item: Extract<ConversationItem, { kind: "action" }>;
  busy: boolean;
  onConfirm: (actionId: string) => void;
  onReject: (actionId: string) => void;
}): React.ReactNode {
  return (
    <div
      data-testid="assistant-action"
      data-status={item.status}
      className="rounded-md border bg-card p-3 text-sm"
    >
      <p>{item.summary}</p>
      <div className="mt-2 flex items-center gap-2">
        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
        {item.status === "pending" && (
          <>
            <Button size="sm" onClick={() => onConfirm(item.id)} disabled={busy}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onReject(item.id)} disabled={busy}>
              Reject
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function AssistantMessages({ view, busy, onConfirm, onReject }: Props): React.ReactNode {
  if (view.items.length === 0) return null;
  return (
    <div className="space-y-3">
      {view.items.map((item) =>
        item.kind === "action" ? (
          <ActionCard
            key={itemKey(item)}
            item={item}
            busy={busy}
            onConfirm={onConfirm}
            onReject={onReject}
          />
        ) : (
          <div
            key={itemKey(item)}
            data-testid="assistant-message"
            data-role={item.role}
            className={item.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                item.role === "user"
                  ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
              }
            >
              {renderSimpleText(item.content)}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
