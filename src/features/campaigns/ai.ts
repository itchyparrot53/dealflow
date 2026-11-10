import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { chatJson } from "@/features/ai/chatJson";
import { getAiProvider } from "@/features/ai/provider";
import { checkAiRateLimit } from "@/features/ai/rateLimit";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";

// "Suggest with AI" for the Details step (3.1). Three options, fake-provider safe in tests.

const subjectsSchema = z.object({
  subjects: z.array(z.string().trim().min(1).max(200)).length(3),
});

const SYSTEM = [
  "You write campaign subject lines for a small business CRM.",
  'Return JSON only: {"subjects": [three short subject lines, under 60 characters each]}.',
  "No clickbait, no emoji, no exclamation marks.",
].join(" ");

export interface SubjectSuggestionInput {
  name: string;
  type: string;
}

export async function suggestCampaignSubjects(
  db: Db,
  actor: PermSetUser,
  input: SubjectSuggestionInput,
  signal: AbortSignal,
): Promise<Result<string[], AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "campaigns.edit")) {
    return err(
      new AppError(ERROR_IDS.PERM_DENIED, "campaigns.edit required", { userId: actor.id }),
    );
  }
  const provider = getAiProvider();
  if (provider === null) {
    return err(new AppError(ERROR_IDS.AI_UNAVAILABLE, "AI is not configured", {}));
  }
  if (provider.kind === "fake") {
    return ok([
      `${input.name}: what is new`,
      `A ${input.type} update from us`,
      `Inside ${input.name}`,
    ]);
  }
  if (!checkAiRateLimit(actor.id)) {
    return err(new AppError(ERROR_IDS.AI_RATE_LIMITED, "AI rate limit reached", {}));
  }
  const result = await chatJson(
    db,
    actor.id,
    "campaign_subject",
    {
      system: SYSTEM,
      user: `Campaign name: ${input.name}\nCampaign type: ${input.type}`,
      schema: subjectsSchema,
      maxTokens: 400,
    },
    signal,
  );
  if (!result.ok) return err(result.error);
  return ok(result.value.subjects);
}
