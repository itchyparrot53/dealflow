import { and, eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { type AiToolCallRecord, aiActions, settings } from "@/db/schema";
import { readBaseCurrency } from "@/features/settings/readBaseCurrency";
import type { HydratedActor } from "@/server/hydrateActor";
import { err, ok, type Result } from "@/types/result";
import type { AiChatMessage } from "../types";
import { assertAiAllowed, recordAiUsage } from "../usage";
import {
  appendMessage,
  type ConversationView,
  conversationView,
  historyForProvider,
  loadConversation,
  setTitleIfDefault,
} from "./conversations";
import { assistantPrompt } from "./prompt";
import {
  type AssistantCatalogue,
  buildAssistantCatalogue,
  summarizeWrite,
  toolResultText,
} from "./tools";

const MAX_STEPS = 6;
const MAX_TOOL_RESULT = 8_000;
const STEP_LIMIT_MESSAGE =
  "I couldn't finish that within the step limit. Try a more specific request.";

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function promptFor(db: Db, actor: HydratedActor, signal: AbortSignal): Promise<string> {
  const [row] = await db
    .select({ companyName: settings.companyName })
    .from(settings)
    .where(eq(settings.id, true))
    .limit(1);
  const currency = await readBaseCurrency(db, signal);
  const now = new Date();
  return assistantPrompt({
    companyName: (row?.companyName ?? "").trim() === "" ? "our company" : (row?.companyName ?? ""),
    today: now.toISOString().slice(0, 10),
    weekday: now.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }),
    userName: actor.name,
    baseCurrency: currency,
  });
}

// One tool call from the model: reads run immediately, writes only create a pending action.
async function runTool(
  db: Db,
  actor: HydratedActor,
  catalogue: AssistantCatalogue,
  conversationId: string,
  call: AiToolCallRecord,
  signal: AbortSignal,
): Promise<unknown> {
  const kind = catalogue.kind(call.name);
  if (kind === null) return { error: "Unknown tool" };

  const parsed: unknown = safeParse(call.arguments);
  const schema = catalogue.schemas.get(call.name);
  const validated = schema?.safeParse(parsed);
  if (validated === undefined || !validated.success) {
    return { error: "Invalid arguments", issues: validated?.error.issues ?? [] };
  }
  signal.throwIfAborted();

  if (kind === "read") {
    const result = await catalogue.reads.invoke(call.name, validated.data);
    return result.isError === true
      ? { error: toolResultText(result) }
      : safeParse(toolResultText(result));
  }

  const args: Record<string, unknown> = validated.data;
  const summary = summarizeWrite(call.name, args);
  const [action] = await db
    .insert(aiActions)
    .values({ conversationId, userId: actor.id, tool: call.name, args, summary, status: "pending" })
    .returning({ id: aiActions.id });
  if (action === undefined) return { error: "Could not create the pending action" };
  return { status: "pending_confirmation", actionId: action.id, summary };
}

export async function sendAssistantMessage(
  db: Db,
  actor: HydratedActor,
  conversationId: string,
  content: string,
  signal: AbortSignal,
): Promise<Result<ConversationView, AppError>> {
  const allowed = await assertAiAllowed(db, actor.id, signal);
  if (!allowed.ok) return allowed;
  const provider = allowed.value;

  const owned = await loadConversation(db, actor.id, conversationId, signal);
  if (!owned.ok) return owned;

  await appendMessage(db, conversationId, { role: "user", content }, signal);
  await setTitleIfDefault(db, conversationId, content, signal);

  const catalogue = buildAssistantCatalogue(db, actor);
  const history = await historyForProvider(db, conversationId, signal);
  const messages: AiChatMessage[] = [
    { role: "system", content: await promptFor(db, actor, signal) },
    ...history,
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await provider.chat(
      { messages, tools: catalogue.defs, maxTokens: 1500 },
      signal,
    );
    if (!response.ok) return response;
    await recordAiUsage(
      db,
      { userId: actor.id, feature: "assistant", result: response.value },
      signal,
    );

    const toolCalls: AiToolCallRecord[] = response.value.toolCalls;
    await appendMessage(
      db,
      conversationId,
      { role: "assistant", content: response.value.content, toolCalls },
      signal,
    );
    messages.push({
      role: "assistant",
      content: response.value.content,
      ...(toolCalls.length > 0
        ? {
            tool_calls: toolCalls.map((call) => ({
              id: call.id,
              type: "function" as const,
              function: { name: call.name, arguments: call.arguments },
            })),
          }
        : {}),
    });

    if (toolCalls.length === 0) return ok(await conversationView(db, conversationId, signal));

    for (const call of toolCalls) {
      const toolResult = await runTool(db, actor, catalogue, conversationId, call, signal);
      const text = JSON.stringify(toolResult).slice(0, MAX_TOOL_RESULT);
      await appendMessage(
        db,
        conversationId,
        { role: "tool", content: text, toolCallId: call.id },
        signal,
      );
      messages.push({ role: "tool", content: text, tool_call_id: call.id });
    }
  }

  await appendMessage(
    db,
    conversationId,
    { role: "assistant", content: STEP_LIMIT_MESSAGE },
    signal,
  );
  return ok(await conversationView(db, conversationId, signal));
}

// Claim the action with one statement before running the write. Two concurrent Confirm clicks
// then race on the same row: exactly one UPDATE matches `status = 'pending'` and the loser gets
// E_AI_009 instead of running the write twice.
async function claimAction(
  db: Db,
  actor: HydratedActor,
  actionId: string,
  next: "confirmed" | "rejected",
) {
  const [action] = await db
    .update(aiActions)
    .set({ status: next, decidedAt: new Date() })
    .where(
      and(
        eq(aiActions.id, actionId),
        eq(aiActions.userId, actor.id),
        eq(aiActions.status, "pending"),
      ),
    )
    .returning();
  return action;
}

export async function confirmAiAction(
  db: Db,
  actor: HydratedActor,
  actionId: string,
  signal: AbortSignal,
): Promise<Result<ConversationView, AppError>> {
  const action = await claimAction(db, actor, actionId, "confirmed");
  if (action === undefined) {
    return err(new AppError(ERROR_IDS.AI_ACTION_NOT_FOUND, "pending action not found"));
  }

  const catalogue = buildAssistantCatalogue(db, actor);
  const result = await catalogue.writes.invoke(action.tool, action.args);
  const text = toolResultText(result);
  if (result.isError === true) {
    // The provider was already claimed as confirmed, so downgrade it to failed with the reason.
    await db
      .update(aiActions)
      .set({ status: "failed", result: { error: text }, decidedAt: new Date() })
      .where(eq(aiActions.id, actionId));
    await appendMessage(
      db,
      action.conversationId,
      { role: "assistant", content: `Couldn't do that: ${text}` },
      signal,
    );
  } else {
    await db
      .update(aiActions)
      .set({ result: safeParse(text), decidedAt: new Date() })
      .where(eq(aiActions.id, actionId));
    await appendMessage(
      db,
      action.conversationId,
      { role: "assistant", content: `Done: ${action.summary}` },
      signal,
    );
  }
  return ok(await conversationView(db, action.conversationId, signal));
}

export async function rejectAiAction(
  db: Db,
  actor: HydratedActor,
  actionId: string,
  signal: AbortSignal,
): Promise<Result<ConversationView, AppError>> {
  const action = await claimAction(db, actor, actionId, "rejected");
  if (action === undefined) {
    return err(new AppError(ERROR_IDS.AI_ACTION_NOT_FOUND, "pending action not found"));
  }
  await appendMessage(
    db,
    action.conversationId,
    { role: "assistant", content: `Cancelled: ${action.summary}` },
    signal,
  );
  return ok(await conversationView(db, action.conversationId, signal));
}
