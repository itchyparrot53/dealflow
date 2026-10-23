import type { AppError } from "@/constants/errorIds";
import type { Result } from "@/types/result";

export type AiChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
    }
  | { role: "tool"; content: string; tool_call_id: string };

export interface AiToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AiChatRequest {
  messages: AiChatMessage[];
  tools?: AiToolDef[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  // Which feature is calling, for the provider's metadata-only JSON failure log.
  feature?: AiFeature;
}

export interface AiChatResult {
  content: string | null;
  toolCalls: AiToolCall[];
  usage: { promptTokens: number; completionTokens: number };
  model: string;
  // "stop", "length", "tool_calls", ... Straight from the provider; "length" means the token
  // budget ran out, which is what a reasoning model does when it never reaches the JSON.
  finishReason: string | null;
}

export interface AiProvider {
  readonly kind: "openrouter" | "fake" | "scripted";
  chat(req: AiChatRequest, signal: AbortSignal): Promise<Result<AiChatResult, AppError>>;
}

export const AI_FEATURES = [
  "assistant",
  "deal_summary",
  "deal_score",
  "email_draft",
  "notes_to_activities",
  "ai_filter",
  "automation_describe",
  // Part 7: "Explain this report" over aggregated report rows.
  "insight_explain",
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];
