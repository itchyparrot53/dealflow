import { AUTOMATIONS_STRINGS } from "@/constants/automationsStrings";
import { automationDefinitionSchema } from "../definition";

const S = AUTOMATIONS_STRINGS;

// One-line trigger copy for the list. A definition the schema rejects shows as invalid rather
// than throwing inside a server component.
export function triggerSummary(definition: unknown): string {
  const parsed = automationDefinitionSchema.safeParse(definition);
  if (!parsed.success) return "Invalid definition";
  return `When ${S.triggers[parsed.data.trigger.type]}`;
}
