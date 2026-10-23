import type { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { err, ok, type Result } from "@/types/result";
import { extractJson } from "./extractJson";
import type { AiChatResult, AiFeature, AiProvider } from "./types";
import { assertAiAllowed, recordAiUsage } from "./usage";

// One JSON-shaped AI call with bounded retries. The deps are injected so the unit test runs without
// a database; usage limits themselves live in usage.ts (wired as the defaults there).

export interface ChatJsonDeps {
  assertAllowed: (
    db: Db,
    actorId: string,
    signal: AbortSignal,
  ) => Promise<Result<AiProvider, AppError>>;
  record: (
    db: Db,
    entry: { userId: string; feature: AiFeature; result: AiChatResult },
    signal: AbortSignal,
  ) => Promise<void>;
}

// Real defaults: the cap check and the usage row. Tests pass their own deps so they need no database.
const DEFAULT_DEPS: ChatJsonDeps = { assertAllowed: assertAiAllowed, record: recordAiUsage };

const FENCED_JSON = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
const MAX_RETRY_TOKENS = 4000;
const DEFAULT_TOKENS = 1200;

// Kept for callers that only want the fence stripped; chatJson now goes through extractJson, which
// also handles prose and reasoning-truncated replies.
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const match = FENCED_JSON.exec(trimmed);
  return match?.[1] ?? trimmed;
}

export async function chatJson<T>(
  db: Db,
  actorId: string,
  feature: AiFeature,
  opts: { system: string; user: string; schema: z.ZodType<T>; maxTokens?: number },
  signal: AbortSignal,
  deps: ChatJsonDeps = DEFAULT_DEPS,
): Promise<Result<T, AppError>> {
  const allowed = await deps.assertAllowed(db, actorId, signal);
  if (!allowed.ok) return allowed;
  const provider = allowed.value;
  const baseTokens = opts.maxTokens ?? DEFAULT_TOKENS;

  const attempt = async (extra?: string, maxTokens?: number): Promise<Result<T, AppError>> => {
    const messages = [
      { role: "system" as const, content: opts.system },
      { role: "user" as const, content: opts.user },
      ...(extra !== undefined ? [{ role: "user" as const, content: extra }] : []),
    ];
    const response = await provider.chat(
      { messages, json: true, maxTokens: maxTokens ?? opts.maxTokens, feature },
      signal,
    );
    if (!response.ok) return response; // provider failures are not retried
    await deps.record(db, { userId: actorId, feature, result: response.value }, signal);

    const content = response.value.content ?? "";
    // A reasoning model can spend the whole budget thinking: the content is empty or cut off.
    // That is not a JSON mistake, so it gets its own id and the bigger-budget retry below.
    if (response.value.finishReason === "length" || content.trim() === "") {
      return err(
        new AppError(
          ERROR_IDS.AI_EMPTY_OR_TRUNCATED,
          `finishReason=${response.value.finishReason ?? "none"}; contentLength=${content.length}`,
        ),
      );
    }

    const extracted = extractJson(content);
    if (!extracted.ok) {
      return err(new AppError(ERROR_IDS.AI_BAD_OUTPUT, extracted.error.message));
    }
    const parsed = opts.schema.safeParse(extracted.value);
    if (!parsed.success) {
      return err(new AppError(ERROR_IDS.AI_BAD_OUTPUT, parsed.error.message));
    }
    return ok(parsed.data);
  };

  const first = await attempt();
  if (first.ok) return first;

  const nudge = `Your previous reply was not valid. Reply with JSON only, matching the schema exactly. Error: ${first.error.message}`;
  if (first.error.id === ERROR_IDS.AI_EMPTY_OR_TRUNCATED) {
    // Doubling the budget is the fix for a reasoning model that never reached the answer; the cap
    // keeps a pathological model from spending without bound.
    return attempt(nudge, Math.min(baseTokens * 2, MAX_RETRY_TOKENS));
  }
  if (first.error.id !== ERROR_IDS.AI_BAD_OUTPUT) return first;
  return attempt(nudge);
}
