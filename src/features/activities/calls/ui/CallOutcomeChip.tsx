import { Badge } from "@/components/ui/Badge";
import type { CallDirection, CallOutcome } from "@/constants/productivity";
import { CALL_DIRECTION_LABELS, CALL_OUTCOME_LABELS } from "@/constants/productivityStrings";

// The outcome chip shown on a call activity in the timeline (6.3/6.6).
export function CallOutcomeChip({
  outcome,
  direction,
  durationSeconds,
  className,
}: {
  outcome: CallOutcome;
  direction: CallDirection;
  durationSeconds: number | null;
  className?: string;
}): React.ReactNode {
  const minutes = durationSeconds === null ? null : Math.max(1, Math.round(durationSeconds / 60));
  return (
    <Badge
      data-testid="call-outcome-chip"
      data-outcome={outcome}
      variant={outcome === "connected" ? "success" : "secondary"}
      className={className}
      title={`${CALL_DIRECTION_LABELS[direction]} call`}
    >
      {CALL_OUTCOME_LABELS[outcome]}
      {minutes === null ? "" : ` (${String(minutes)} min)`}
    </Badge>
  );
}
