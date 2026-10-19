"use server";

import { z } from "zod";
import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { confirmAiAction, rejectAiAction, sendAssistantMessage } from "../assistant/assistant";
import {
  type ConversationView,
  conversationView,
  createConversation,
} from "../assistant/conversations";
import { checkAiRateLimit } from "../rateLimit";

// Assistant calls can involve several provider round trips, so they get a longer budget than the
// 8s action default.
const TIMEOUT_MS = 90_000;

const messageInput = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(4_000),
});
const idSchema = z.string().uuid();

const signal = (): AbortSignal => AbortSignal.timeout(TIMEOUT_MS);

type ActionContext =
  | { ok: true; actor: NonNullable<Awaited<ReturnType<typeof createContext>>["actor"]> }
  | { ok: false; error: { id: string } };

async function context(csrfToken: string | null): Promise<ActionContext> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: ERROR_IDS.PERM_DENIED } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  if (!checkAiRateLimit(actor.id)) return { ok: false, error: { id: ERROR_IDS.AI_RATE_LIMITED } };
  return { ok: true, actor };
}

export async function createConversationAction(
  csrfToken: string | null,
): Promise<ActionResult<ConversationView>> {
  const c = await context(csrfToken);
  if (!c.ok) return c;
  const id = await createConversation(db, c.actor.id, signal());
  return { ok: true, value: await conversationView(db, id, signal()) };
}

export async function sendAssistantMessageAction(
  raw: unknown,
  csrfToken: string | null,
): Promise<ActionResult<ConversationView>> {
  const c = await context(csrfToken);
  if (!c.ok) return c;
  const parsed = messageInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.AI_INPUT_INVALID } };
  return toClientResult(
    await sendAssistantMessage(
      db,
      c.actor,
      parsed.data.conversationId,
      parsed.data.content,
      signal(),
    ),
  );
}

export async function confirmAiActionAction(
  actionId: string,
  csrfToken: string | null,
): Promise<ActionResult<ConversationView>> {
  const c = await context(csrfToken);
  if (!c.ok) return c;
  const parsed = idSchema.safeParse(actionId);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.AI_INPUT_INVALID } };
  return toClientResult(await confirmAiAction(db, c.actor, parsed.data, signal()));
}

export async function rejectAiActionAction(
  actionId: string,
  csrfToken: string | null,
): Promise<ActionResult<ConversationView>> {
  const c = await context(csrfToken);
  if (!c.ok) return c;
  const parsed = idSchema.safeParse(actionId);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.AI_INPUT_INVALID } };
  return toClientResult(await rejectAiAction(db, c.actor, parsed.data, signal()));
}
