import OpenAI from "openai";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { err, ok } from "@/types/result";
import type { AiChatRequest, AiProvider, AiToolCall } from "./types";

// OpenRouter speaks the OpenAI wire format, so the official SDK is the client; only the base URL
// and the two attribution headers differ.
function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

export function createOpenRouterProvider(): AiProvider {
  const client = new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: env.OPENROUTER_BASE_URL,
    defaultHeaders: { "HTTP-Referer": env.BASE_URL, "X-Title": "Dealflow" },
  });

  return {
    kind: "openrouter",
    async chat(req: AiChatRequest, signal) {
      try {
        // Our message union mirrors the SDK's request shape, so the array is accepted as-is.
        const completion = await client.chat.completions.create(
          {
            model: env.OPENROUTER_MODEL,
            messages: req.messages,
            temperature: req.temperature ?? 0.3,
            max_tokens: req.maxTokens ?? 1200,
            ...(req.tools !== undefined ? { tools: req.tools } : {}),
            ...(req.json === true ? { response_format: { type: "json_object" as const } } : {}),
          },
          { signal },
        );
        const choice = completion.choices[0];
        const message = choice?.message;
        const toolCalls: AiToolCall[] = (message?.tool_calls ?? [])
          .filter((call) => call.type === "function")
          .map((call) => ({
            id: call.id,
            name: call.function.name,
            arguments: call.function.arguments,
          }));
        return ok({
          content: message?.content ?? null,
          toolCalls,
          usage: {
            promptTokens: completion.usage?.prompt_tokens ?? 0,
            completionTokens: completion.usage?.completion_tokens ?? 0,
          },
          model: completion.model,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        return err(
          new AppError(ERROR_IDS.AI_PROVIDER_FAILED, "AI provider call failed", {
            status: statusOf(error),
          }),
        );
      }
    },
  };
}
