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
}

export interface AiChatResult {
  content: string | null;
  toolCalls: AiToolCall[];
  usage: { promptTokens: number; completionTokens: number };
  model: string;
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
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];
