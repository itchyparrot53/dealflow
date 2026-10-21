import { Repeat } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Tip } from "@/components/ui/tooltip";
import { describeRule, recurrenceRuleSchema } from "../rule";

// Recurrence badge for activity rows (6.3). It accepts the raw JSONB rule because the row
// projections carry it as unknown; an unparseable rule renders nothing instead of a broken badge.
export function RecurrenceBadge({
  rule,
  ended = false,
}: {
  rule: unknown;
  ended?: boolean;
}): React.ReactNode {
  const parsed = recurrenceRuleSchema.safeParse(rule);
  if (!parsed.success) return null;
  const description = describeRule(parsed.data);
  return (
    <Tip label={description}>
      <Badge
        data-testid="recurrence-badge"
        variant="outline"
        className="gap-1 text-muted-foreground"
        aria-label={ended ? `Recurrence ended: ${description}` : description}
      >
        <Repeat className="h-3 w-3" aria-hidden="true" />
        {ended ? "Series ended" : description}
      </Badge>
    </Tip>
  );
}
