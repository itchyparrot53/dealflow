import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { err, ok, type Result } from "@/types/result";
import type { AiChatRequest, AiChatResult, AiProvider } from "./types";

type ScriptedItem = Partial<AiChatResult> | AppError;

// Test double for the provider boundary: each call records a deep copy of the request and returns
// the next queued result, so a test can script multi-step tool loops deterministically.
export class ScriptedAiProvider implements AiProvider {
  readonly kind = "scripted" as const;
  readonly calls: AiChatRequest[] = [];
  private readonly queue: ScriptedItem[];

  constructor(...items: ScriptedItem[]) {
    this.queue = [...items];
  }

  push(...items: ScriptedItem[]): void {
    this.queue.push(...items);
  }

  chat(req: AiChatRequest): Promise<Result<AiChatResult, AppError>> {
    this.calls.push(structuredClone(req));
    const next = this.queue.shift();
    if (next === undefined) {
      return Promise.resolve(
        err(new AppError(ERROR_IDS.AI_PROVIDER_FAILED, "scripted provider queue is empty")),
      );
    }
    if (next instanceof AppError) return Promise.resolve(err(next));
    return Promise.resolve(
      ok({
        content: next.content ?? null,
        toolCalls: next.toolCalls ?? [],
        usage: next.usage ?? { promptTokens: 100, completionTokens: 50 },
        model: next.model ?? "test/model",
      }),
    );
  }
}
