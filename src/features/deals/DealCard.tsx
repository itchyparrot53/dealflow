import { ChevronRight } from "lucide-react";
import type React from "react";
import { Tip } from "@/components/ui/tooltip";
import { DealScoreBadge } from "@/features/ai/ui/DealScoreBadge";
import { initials } from "@/lib/avatar";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import type { ActivityState } from "./cardIndicators";
import { activityState, activityTooltip, rottingState } from "./cardIndicators";
import { DealStatusBadge } from "./DealStatusBadge";
import type { BoardCard } from "./dealRepo";

// String constants: no magic strings, no em dashes.
const STRINGS = {
  roledescription: "draggable deal card",
  contactSeparator: ", ",
  // Next-action dot (6.1 row 9): green when something is booked, grey when nothing is, red when
  // it is overdue. The tooltip names the action and its timing, so colour is never the only signal.
  activityDot: {
    upcoming: "bg-next-green",
    today: "bg-next-green",
    overdue: "bg-next-red",
    none: "bg-next-grey",
  } satisfies Record<ActivityState, string>,
} as const;

interface DealCardProps {
  card: BoardCard;
  ownerName: string;
  // The owner's uploaded photo; when present the footer avatar shows it instead of initials.
  ownerAvatarUrl?: string | null;
  personName: string | null;
  orgName: string | null;
  labels: Array<{ name: string; color: string }>;
  rottingDays: number | null;
  density: "comfortable" | "compact";
  // Seeded from the request on the server, handed to the browser clock after hydration.
  now: Date;
  // Invoked on a plain click (not a drag). Opens the deal, matching Pipedrive where clicking
  // a pipeline card opens the deal. Drag is preserved via the sensor activation distance.
  onOpen?: () => void;
  // Lifted state for the drag overlay: the card floats with the drag elevation and a slight rotation.
  elevated?: boolean;
  // Base currency fallback; the card value is in the deal's own currency (Part 3).
  baseCurrency?: string;
  // dnd-kit keyboard/pointer wiring, spread onto the card's own button so the board does not nest
  // one interactive control (the drag wrapper) inside another (the card button), which axe flags.
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
}

// The measured board card (6.8.1): white, 1 px border, radius 4, 8/10 padding, 14/600 title,
// 13 secondary subtitle, a 20 px avatar and value on the footer, the score chip before the
// 16 px next-activity dot, and a 3 px warning border when the deal is rotting.
export function DealCard(props: DealCardProps): React.ReactNode {
  const {
    card,
    ownerName,
    ownerAvatarUrl,
    personName,
    orgName,
    labels,
    rottingDays,
    density,
    now,
    onOpen,
  } = props;
  const { elevated, baseCurrency, dragProps } = props;
  const compact = density === "compact";
  const activity = activityState(card.nextActivityAt, now);
  const activityTip = activityTooltip(card.nextActivityTitle ?? null, card.nextActivityAt, now);
  const closed = card.status === "won" || card.status === "lost";
  const rot = rottingState(card.stageEnteredAt, closed ? null : rottingDays, now);

  // Pipedrive parity: the deal title leads (bold primary line); the gray description line reads
  // "org, person" (comfortable only), collapsing to whichever of the two is present.
  const primary = card.title;
  const descriptionLine =
    orgName !== null && personName !== null
      ? [orgName, personName].join(STRINGS.contactSeparator)
      : (orgName ?? personName);

  return (
    <button
      type="button"
      {...dragProps}
      aria-roledescription={STRINGS.roledescription}
      aria-label={card.title}
      data-deal-id={card.id}
      data-testid="deal-card"
      onClick={onOpen}
      className={cn(
        "w-full overflow-hidden rounded-md border border-border bg-card px-2.5 py-2 text-left transition-shadow duration-100",
        onOpen !== undefined && "cursor-pointer hover:shadow-card-hover",
        elevated === true && "rotate-2 shadow-drag motion-reduce:rotate-0",
        rot.level > 0 && "border-l-[3px] border-l-warning",
      )}
    >
      <div className="min-w-0 truncate text-sm font-semibold leading-5 text-foreground">
        <span data-testid="deal-card-title">{primary}</span>
      </div>

      {/* Description line: "org, person" (comfortable only). */}
      {!compact && descriptionLine !== null && (
        <div className="truncate text-meta text-muted-foreground">{descriptionLine}</div>
      )}

      <div className="mt-1 flex items-center gap-1.5">
        {/* Owner avatar: the uploaded photo when present, else neutral initials. role="img" so the
            aria-label is valid on both. */}
        {ownerAvatarUrl !== undefined && ownerAvatarUrl !== null && ownerAvatarUrl !== "" ? (
          // biome-ignore lint/performance/noImgElement: tiny board-card avatar, next/image not warranted
          <img
            src={ownerAvatarUrl}
            alt={`owner: ${ownerName}`}
            className="size-5 shrink-0 rounded-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
          />
        ) : (
          <span
            role="img"
            aria-label={`owner: ${ownerName}`}
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-avatar text-caption font-semibold text-avatar-foreground"
          >
            {initials(ownerName)}
          </span>
        )}

        {card.value !== null && (
          <span className="tabular text-meta font-semibold text-muted-foreground">
            {formatCurrency(card.value, card.currency ?? baseCurrency ?? "USD")}
          </span>
        )}

        {labels.map((label) => (
          <span
            key={label.name}
            className="rounded-md px-1.5 text-caption font-medium text-white"
            style={{ backgroundColor: label.color }}
          >
            {label.name}
          </span>
        ))}

        <span className="ml-auto flex items-center gap-1">
          {rot.rotting && (
            <span
              role="status"
              aria-label={`rotting, idle ${rot.ageDays} days`}
              className="tabular text-caption font-semibold text-next-red"
            >
              {rot.ageDays}d
            </span>
          )}
          {typeof card.score === "number" && <DealScoreBadge score={card.score} />}
          <Tip label={activityTip} side="top">
            <span
              role="img"
              aria-label={activityTip}
              data-activity={activity}
              className={cn(
                "flex size-4 items-center justify-center rounded-full text-white",
                STRINGS.activityDot[activity],
              )}
            >
              <ChevronRight aria-hidden="true" className="size-3" strokeWidth={3} />
            </span>
          </Tip>
        </span>
      </div>

      {closed && (
        <div className="mt-1 text-caption text-muted-foreground">
          <DealStatusBadge status={card.status} />
        </div>
      )}
    </button>
  );
}
