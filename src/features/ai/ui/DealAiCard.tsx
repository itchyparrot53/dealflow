"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ERROR_IDS } from "@/constants/errorIds";
import type { DealSummaryData } from "@/db/schema";
import { createActivityAction } from "@/features/activities/actions";
import { composeDueAt } from "@/features/activities/activityTime";
import { generateDealSummaryAction, scoreDealAction } from "@/features/ai/actions/dealActions";
import { aiErrorMessage } from "@/features/ai/aiErrors";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";

const MS_PER_DAY = 86_400_000;

type Health = DealSummaryData["health"];

const HEALTH: Record<Health, { label: string; variant: "success" | "destructive" | "secondary" }> =
  {
    good: { label: "On track", variant: "success" },
    at_risk: { label: "At risk", variant: "destructive" },
    stalled: { label: "Stalled", variant: "secondary" },
  };

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Module scope keeps the impure clock read out of the component body (the purity lint rule).
function dueDateAfter(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

interface InsightView {
  summary: DealSummaryData | null;
  summaryAt: string | null;
  score: number | null;
  scoreReasons: string[];
  scoredAt: string | null;
}

type Pending = "summary" | "score" | null;

function SummarySection({
  summary,
  summaryAt,
  pending,
  added,
  onGenerate,
  onAddStep,
}: {
  summary: DealSummaryData | null;
  summaryAt: string | null;
  pending: Pending;
  added: ReadonlySet<number>;
  onGenerate: () => void;
  onAddStep: (step: DealSummaryData["nextSteps"][number], index: number) => void;
}): React.ReactNode {
  if (summary === null) {
    return (
      <Button size="sm" variant="outline" onClick={onGenerate} disabled={pending !== null}>
        {pending === "summary" ? "Generating..." : "Generate summary"}
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <Badge
        data-testid="deal-ai-health"
        data-health={summary.health}
        variant={HEALTH[summary.health].variant}
      >
        {HEALTH[summary.health].label}
      </Badge>
      <p data-testid="deal-ai-summary" className="text-sm">
        {summary.summary}
      </p>
      {summary.risks.length > 0 && (
        <div>
          <p className="text-meta font-semibold text-muted-foreground">Risks</p>
          <ul className="list-disc pl-4 text-sm">
            {summary.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
      )}
      {summary.nextSteps.length > 0 && (
        <div>
          <p className="text-meta font-semibold text-muted-foreground">Next steps</p>
          <ul className="space-y-1">
            {summary.nextSteps.map((step, index) => (
              <li
                key={`${step.subject}-${step.dueInDays}-${step.typeKey}`}
                data-testid="deal-ai-next-step"
                data-added={added.has(index) ? "true" : "false"}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0">
                  {step.subject}
                  <span className="block text-xs text-muted-foreground">
                    {step.typeKey} · in {step.dueInDays} day
                    {step.dueInDays === 1 ? "" : "s"}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={added.has(index)}
                  onClick={() => onAddStep(step, index)}
                >
                  {added.has(index) ? "Added" : "Add"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        {summaryAt !== null && (
          <span className="text-xs text-muted-foreground">Updated {relativeTime(summaryAt)}</span>
        )}
        <Button size="sm" variant="ghost" onClick={onGenerate} disabled={pending !== null}>
          {pending === "summary" ? "Refreshing..." : "Refresh summary"}
        </Button>
      </div>
    </div>
  );
}

function ScoreSection({
  score,
  scoreReasons,
  scoredAt,
  pending,
  onScore,
}: {
  score: number | null;
  scoreReasons: string[];
  scoredAt: string | null;
  pending: Pending;
  onScore: () => void;
}): React.ReactNode {
  if (score === null) {
    return (
      <Button size="sm" variant="outline" onClick={onScore} disabled={pending !== null}>
        {pending === "score" ? "Scoring..." : "Score deal"}
      </Button>
    );
  }
  return (
    <div className="space-y-1">
      <p data-testid="deal-ai-score" data-score={score} className="text-sm font-semibold">
        {score}/100
      </p>
      <ul className="list-disc pl-4 text-sm">
        {scoreReasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2">
        {scoredAt !== null && (
          <span className="text-xs text-muted-foreground">Updated {relativeTime(scoredAt)}</span>
        )}
        <Button size="sm" variant="ghost" onClick={onScore} disabled={pending !== null}>
          {pending === "score" ? "Scoring..." : "Rescore"}
        </Button>
      </div>
    </div>
  );
}

interface Props {
  dealId: string;
  personId: string | null;
  orgId: string | null;
}

// AI insights for one deal: a summary with health, risks and addable next steps, plus a 0-100 score.
// Next steps are created through warpdrive's own createActivityAction, so its permission and
// visibility checks apply to anything the model proposes.
export function DealAiCard({ dealId, personId, orgId }: Props): React.ReactNode {
  const status = trpc.ai.status.useQuery();
  const insight = trpc.ai.dealInsight.useQuery({ dealId });
  const types = trpc.activities.listTypes.useQuery().data ?? [];
  const utils = trpc.useUtils();
  const [pending, setPending] = useState<Pending>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [added, setAdded] = useState<ReadonlySet<number>>(new Set());

  const view: InsightView | null = insight.data ?? null;
  const statusData: { available: boolean; enabled: boolean } | undefined = status.data;
  const unavailable = statusData !== undefined && (!statusData.available || !statusData.enabled);

  async function run(kind: "summary" | "score"): Promise<void> {
    setPending(kind);
    setErrorId(null);
    try {
      const result =
        kind === "summary"
          ? await generateDealSummaryAction(dealId, readCsrfToken())
          : await scoreDealAction(dealId, readCsrfToken());
      if (!result.ok) setErrorId(result.error.id);
      else await utils.ai.dealInsight.invalidate({ dealId });
    } finally {
      setPending(null);
    }
  }

  async function addNextStep(
    step: DealSummaryData["nextSteps"][number],
    index: number,
  ): Promise<void> {
    const typeId =
      types.find((type) => type.key === step.typeKey)?.id ??
      types.find((type) => type.key === "task")?.id;
    if (typeId === undefined) {
      setErrorId(ERROR_IDS.AI_INPUT_INVALID);
      return;
    }
    const dueAt = composeDueAt(dueDateAfter(step.dueInDays), "");
    const result = await createActivityAction(
      {
        typeId,
        subject: step.subject,
        allDay: dueAt.allDay,
        dueAt: dueAt.iso,
        dealId,
        personId,
        orgId,
        note: null,
      },
      readCsrfToken(),
    );
    if (!result.ok) {
      setErrorId(result.error.id);
      return;
    }
    setAdded((current) => new Set(current).add(index));
    await utils.activities.listForEntity.invalidate({ entityType: "deal", entityId: dealId });
  }

  return (
    <section data-testid="deal-ai-card">
      <p className="flex items-center gap-1.5 text-meta text-muted-foreground">
        <Sparkles className="size-3.5" aria-hidden="true" />
        Generated from this deal
      </p>

      {unavailable ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {aiErrorMessage(
            statusData.available === false ? ERROR_IDS.AI_UNAVAILABLE : ERROR_IDS.AI_DISABLED,
          )}
        </p>
      ) : (
        <>
          <div className="mt-3">
            <SummarySection
              summary={view?.summary ?? null}
              summaryAt={view?.summaryAt ?? null}
              pending={pending}
              added={added}
              onGenerate={() => void run("summary")}
              onAddStep={(step, index) => void addNextStep(step, index)}
            />
          </div>
          <div className="mt-4 border-t pt-3">
            <ScoreSection
              score={view?.score ?? null}
              scoreReasons={view?.scoreReasons ?? []}
              scoredAt={view?.scoredAt ?? null}
              pending={pending}
              onScore={() => void run("score")}
            />
          </div>
        </>
      )}

      {errorId !== null && (
        <p data-testid="deal-ai-error" className="mt-2 text-sm text-destructive">
          {aiErrorMessage(errorId)}
        </p>
      )}
    </section>
  );
}
