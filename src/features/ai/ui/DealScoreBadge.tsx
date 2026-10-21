import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// The AI score badge: 0 to 100, coloured by band (muted, amber, success) and always carrying the
// number as text so colour is never the only signal. Nothing renders when the deal has no score.

const HIGH_MIN = 70;
const MID_MIN = 40;

export function DealScoreBadge({ score }: { score: number }): React.ReactNode {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const tone =
    value >= HIGH_MIN
      ? "bg-success text-success-foreground"
      : value >= MID_MIN
        ? "bg-attention text-attention-foreground"
        : "bg-muted text-muted-foreground";
  return (
    <Tip label={`AI score ${value} of 100`}>
      <span
        data-testid="deal-score-badge"
        data-score={value}
        className={cn(
          "inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
          tone,
        )}
      >
        AI {value}
      </span>
    </Tip>
  );
}
