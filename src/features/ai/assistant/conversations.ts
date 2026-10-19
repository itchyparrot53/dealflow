import { and, asc, desc, eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { aiActions, aiConversations, aiMessages } from "@/db/schema";
import { err, ok, type Result } from "@/types/result";
import type { AiChatMessage, AiToolCall } from "../types";

export interface ConversationMessageItem {
  kind: "message";
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ConversationActionItem {
  kind: "action";
  id: string;
  tool: string;
  summary: string;
  status: string;
  createdAt: string;
}

export type ConversationItem = ConversationMessageItem | ConversationActionItem;

export interface ConversationView {
  id: string;
  title: string;
  items: ConversationItem[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

const TITLE_LIMIT = 60;
const HISTORY_LIMIT = 40;

export async function createConversation(
  db: Db,
  userId: string,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  const [row] = await db
    .insert(aiConversations)
    .values({ userId })
    .returning({ id: aiConversations.id });
  signal.throwIfAborted();
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INVARIANT, "conversation insert failed");
  return row.id;
}

export async function listConversations(
  db: Db,
  userId: string,
  signal: AbortSignal,
): Promise<ConversationSummary[]> {
  signal.throwIfAborted();
  const rows = await db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      updatedAt: aiConversations.updatedAt,
    })
    .from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(30);
  signal.throwIfAborted();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function loadConversation(
  db: Db,
  userId: string,
  conversationId: string,
  signal: AbortSignal,
): Promise<Result<{ id: string; title: string }, AppError>> {
  signal.throwIfAborted();
  const [row] = await db
    .select({ id: aiConversations.id, title: aiConversations.title })
    .from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
    .limit(1);
  signal.throwIfAborted();
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.AI_CONVERSATION_NOT_FOUND, "conversation not found"));
  }
  return ok(row);
}

export async function conversationView(
  db: Db,
  conversationId: string,
  signal: AbortSignal,
): Promise<ConversationView> {
  signal.throwIfAborted();
  const [conversation] = await db
    .select({ id: aiConversations.id, title: aiConversations.title })
    .from(aiConversations)
    .where(eq(aiConversations.id, conversationId))
    .limit(1);
  const messages = await db
    .select({
      id: aiMessages.id,
      seq: aiMessages.seq,
      role: aiMessages.role,
      content: aiMessages.content,
      createdAt: aiMessages.createdAt,
    })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.seq));
  const actions = await db
    .select({
      id: aiActions.id,
      seq: aiActions.seq,
      tool: aiActions.tool,
      summary: aiActions.summary,
      status: aiActions.status,
      createdAt: aiActions.createdAt,
    })
    .from(aiActions)
    .where(eq(aiActions.conversationId, conversationId))
    .orderBy(asc(aiActions.seq));
  signal.throwIfAborted();

  const items: (ConversationItem & { _at: number; _seq: number; _kind: number })[] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    if (message.content === null || message.content === "") continue;
    items.push({
      kind: "message",
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      _at: message.createdAt.getTime(),
      _seq: message.seq,
      _kind: 0,
    });
  }
  for (const action of actions) {
    items.push({
      kind: "action",
      id: action.id,
      tool: action.tool,
      summary: action.summary,
      status: action.status,
      createdAt: action.createdAt.toISOString(),
      _at: action.createdAt.getTime(),
      _seq: action.seq,
      _kind: 1,
    });
  }
  items.sort((a, b) => a._at - b._at || a._seq - b._seq || a._kind - b._kind);

  return {
    id: conversation?.id ?? conversationId,
    title: conversation?.title ?? "New conversation",
    items: items.map(({ _at, _seq, _kind, ...item }) => item),
  };
}

export async function getConversationView(
  db: Db,
  userId: string,
  conversationId: string,
  signal: AbortSignal,
): Promise<Result<ConversationView, AppError>> {
  const owned = await loadConversation(db, userId, conversationId, signal);
  if (!owned.ok) return owned;
  return ok(await conversationView(db, conversationId, signal));
}

export async function appendMessage(
  db: Db,
  conversationId: string,
  message: {
    role: "user" | "assistant" | "tool";
    content: string | null;
    toolCalls?: AiToolCall[];
    toolCallId?: string;
  },
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  await db.insert(aiMessages).values({
    conversationId,
    role: message.role,
    content: message.content,
    toolCalls: message.toolCalls,
    toolCallId: message.toolCallId ?? null,
  });
  await db
    .update(aiConversations)
    .set({ updatedAt: new Date() })
    .where(eq(aiConversations.id, conversationId));
  signal.throwIfAborted();
}

export async function setTitleIfDefault(
  db: Db,
  conversationId: string,
  content: string,
  signal: AbortSignal,
): Promise<void> {
  const [row] = await db
    .select({ title: aiConversations.title })
    .from(aiConversations)
    .where(eq(aiConversations.id, conversationId))
    .limit(1);
  if (row === undefined || row.title !== "New conversation") return;
  await db
    .update(aiConversations)
    .set({ title: content.slice(0, TITLE_LIMIT) })
    .where(eq(aiConversations.id, conversationId));
  signal.throwIfAborted();
}

// The last 40 messages in sequence order, mapped to the provider's wire shape. A leading assistant
// or tool row cannot start the history (a provider rejects it), so the list is trimmed to its first
// user message.
export async function historyForProvider(
  db: Db,
  conversationId: string,
  signal: AbortSignal,
): Promise<AiChatMessage[]> {
  const rows = await db
    .select({
      seq: aiMessages.seq,
      role: aiMessages.role,
      content: aiMessages.content,
      toolCalls: aiMessages.toolCalls,
      toolCallId: aiMessages.toolCallId,
    })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.seq))
    .limit(HISTORY_LIMIT);
  signal.throwIfAborted();
  const ordered = rows.reverse();

  const mapped: AiChatMessage[] = [];
  for (const row of ordered) {
    if (row.role === "user") {
      mapped.push({ role: "user", content: row.content ?? "" });
    } else if (row.role === "assistant") {
      const toolCalls = (row.toolCalls ?? []).map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.arguments },
      }));
      mapped.push({
        role: "assistant",
        content: row.content,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
    } else {
      mapped.push({ role: "tool", content: row.content ?? "", tool_call_id: row.toolCallId ?? "" });
    }
  }
  const firstUser = mapped.findIndex((message) => message.role === "user");
  return firstUser === -1 ? [] : mapped.slice(firstUser);
}
