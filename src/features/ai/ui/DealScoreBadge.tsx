import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// The AI score badge: 0 to 100, coloured by band (muted, amber, success) and always carrying the
// number as text so colour is never the only signal. Nothing renders when the deal has no score.

const HIGH_MIN = 70;
const MID_MIN = 40;

export function DealScoreBadge({ score }: { score: number }): React.ReactNode {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  // 6.7.2: the band is a small dot; the pill itself is quiet and outlined, never a filled green
  // badge on every card.
  const dot =
    value >= HIGH_MIN ? "bg-success" : value >= MID_MIN ? "bg-warning" : "bg-muted-foreground";
  return (
    <Tip label={`AI score ${value} of 100`}>
      <span
        data-testid="deal-score-badge"
        data-score={value}
        className={cn(
          "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-border px-1.5 font-medium tabular",
          "text-[11px]", // design-ok: score pill
        )}
      >
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", dot)} />
        AI {value}
      </span>
    </Tip>
  );
}
