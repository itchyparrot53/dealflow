import type { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { err, ok, type Result } from "@/types/result";
import type { AiChatResult, AiFeature, AiProvider } from "./types";
import { assertAiAllowed, recordAiUsage } from "./usage";

// One JSON-shaped AI call with a single repair attempt. The deps are injected so the unit test runs
// without a database; usage limits themselves live in usage.ts (wired as the defaults there).

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

// Models sometimes wrap JSON in a markdown fence even when asked for JSON only.
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

  const attempt = async (extra?: string): Promise<Result<T, AppError>> => {
    const messages = [
      { role: "system" as const, content: opts.system },
      { role: "user" as const, content: opts.user },
      ...(extra !== undefined ? [{ role: "user" as const, content: extra }] : []),
    ];
    const response = await provider.chat(
      { messages, json: true, maxTokens: opts.maxTokens },
      signal,
    );
    if (!response.ok) return response; // provider failures are not retried
    await deps.record(db, { userId: actorId, feature, result: response.value }, signal);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripJsonFences(response.value.content ?? ""));
    } catch (error) {
      return err(
        new AppError(
          ERROR_IDS.AI_BAD_OUTPUT,
          `response was not JSON: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
    const parsed = opts.schema.safeParse(parsedJson);
    if (!parsed.success) {
      return err(new AppError(ERROR_IDS.AI_BAD_OUTPUT, parsed.error.message));
    }
    return ok(parsed.data);
  };

  const first = await attempt();
  if (first.ok) return first;
  if (first.error.id !== ERROR_IDS.AI_BAD_OUTPUT) return first;

  return attempt(
    `Your previous reply was not valid. Reply with JSON only, matching the schema exactly. Error: ${first.error.message}`,
  );
}
