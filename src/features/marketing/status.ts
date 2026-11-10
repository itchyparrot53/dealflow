import type { ConsentBasis, ConsentSource, MarketingStatus } from "@/constants/marketing";

// The 6.2 transition table, as data. Pure so the dialog, the bulk action, the import and the
// service all ask the same question, and so the unit test can walk the whole matrix.

export interface TransitionRule {
  from: MarketingStatus;
  to: MarketingStatus;
  sources: readonly ConsentSource[];
}

// Sources that mean "the person asked to stop". Complaint is deliberately separate: it reaches
// unsubscribed the same way but records a suppression reason of its own.
export const UNSUBSCRIBE_SOURCES = [
  "unsubscribe_link",
  "one_click",
  "preference_page",
  "manual",
  "bulk",
] as const satisfies readonly ConsentSource[];

const UNSUBSCRIBE_ALL = [...UNSUBSCRIBE_SOURCES, "complaint"] as const;

export const TRANSITIONS: readonly TransitionRule[] = [
  { from: "not_subscribed", to: "pending", sources: ["form", "manual", "bulk"] },
  {
    from: "not_subscribed",
    to: "subscribed",
    sources: ["manual", "bulk", "import", "form", "double_opt_in"],
  },
  { from: "pending", to: "subscribed", sources: ["double_opt_in"] },
  { from: "pending", to: "not_subscribed", sources: ["manual", "bulk", "system"] },
  { from: "subscribed", to: "unsubscribed", sources: UNSUBSCRIBE_ALL },
  { from: "pending", to: "unsubscribed", sources: UNSUBSCRIBE_ALL },
  { from: "subscribed", to: "bounced", sources: ["bounce"] },
  { from: "pending", to: "bounced", sources: ["bounce"] },
  { from: "unsubscribed", to: "pending", sources: ["form", "preference_page", "manual"] },
  { from: "bounced", to: "pending", sources: ["form", "preference_page", "manual"] },
  { from: "unsubscribed", to: "subscribed", sources: ["double_opt_in"] },
  { from: "bounced", to: "subscribed", sources: ["double_opt_in"] },
];

export function isTransitionAllowed(
  from: MarketingStatus,
  to: MarketingStatus,
  source: ConsentSource,
): boolean {
  return TRANSITIONS.some(
    (rule) => rule.from === from && rule.to === to && rule.sources.includes(source),
  );
}

// A direct subscribe from not_subscribed needs evidence, unless the flow produced it itself
// (double opt-in confirmation, or a form when double opt-in is off).
export function requiresBasis(
  from: MarketingStatus,
  to: MarketingStatus,
  source: ConsentSource,
): boolean {
  return (
    from === "not_subscribed" &&
    to === "subscribed" &&
    (source === "manual" || source === "bulk" || source === "import")
  );
}

export interface AllowedTarget {
  to: MarketingStatus;
  sources: readonly ConsentSource[];
}

// What the change dialog and the bulk action may offer from a status, in table order.
export function allowedTargets(from: MarketingStatus): AllowedTarget[] {
  const byTarget = new Map<MarketingStatus, ConsentSource[]>();
  for (const rule of TRANSITIONS) {
    if (rule.from !== from) continue;
    const existing = byTarget.get(rule.to) ?? [];
    byTarget.set(rule.to, [...existing, ...rule.sources]);
  }
  return [...byTarget].map(([to, sources]) => ({ to, sources: [...new Set(sources)] }));
}

// The basis the flow itself proves; null when the caller must supply one or none applies.
export function impliedBasis(to: MarketingStatus, source: ConsentSource): ConsentBasis | null {
  if (to !== "subscribed") return null;
  if (source === "double_opt_in") return "double_opt_in";
  if (source === "form") return "form_consent";
  return null;
}

export type BounceKind = "hard" | "soft";

// Hard bounces bounce immediately; the third consecutive soft bounce does the same (6.2/6.7).
export function statusAfterBounce(
  kind: BounceKind,
  softBounceCountBefore: number,
): MarketingStatus | null {
  if (kind === "hard") return "bounced";
  return softBounceCountBefore + 1 >= 3 ? "bounced" : null;
}
