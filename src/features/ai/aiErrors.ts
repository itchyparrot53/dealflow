import { ERROR_IDS } from "@/constants/errorIds";

// One place that turns an AppError id into the sentence the UI shows. Unknown ids fall back to the
// generic line rather than leaking an id or a provider message.
const MESSAGES: Record<string, string> = {
  [ERROR_IDS.AI_UNAVAILABLE]: "AI isn't set up on this server.",
  [ERROR_IDS.AI_DISABLED]: "AI is turned off for this company.",
  [ERROR_IDS.AI_COMPANY_LIMIT]: "The company has used its AI allowance for this month.",
  [ERROR_IDS.AI_USER_LIMIT]: "You have used your AI allowance for this month.",
  [ERROR_IDS.AI_BAD_OUTPUT]:
    "The AI couldn't finish that reply. Try again, or shorten your request.",
  [ERROR_IDS.AI_EMPTY_OR_TRUNCATED]:
    "The AI couldn't finish that reply. Try again, or shorten your request.",
  [ERROR_IDS.AI_PROVIDER_FAILED]: "The AI service did not answer. Try again in a minute.",
  [ERROR_IDS.AI_RATE_LIMITED]: "Too many AI requests. Wait a minute and try again.",
};

export function aiErrorMessage(id: string): string {
  return MESSAGES[id] ?? "Something went wrong. Try again.";
}
