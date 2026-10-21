import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { INSIGHT_EXPLAIN_MAX_ROWS } from "@/constants/insights";
import type { Db } from "@/db/client";
import { chatJson } from "@/features/ai/chatJson";
import { getAiProvider } from "@/features/ai/provider";
import { checkAiRateLimit } from "@/features/ai/rateLimit";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import type { ReportDefinition } from "./definition";
import { describeDefinition } from "./definition";
import { getReport } from "./reports";
import type { ReportResult } from "./result";
import { runReport } from "./run";

// "Explain this report" sends ONLY the definition summary and at most 60 aggregated rows to the
// Part 1 AI layer. No deal titles, person names, emails or notes ever enter the prompt. Failures
// are E_INSIGHT_004 with the AI error id in the context; the report's own errors pass through.

const INSIGHT_MIN = 3;
const INSIGHT_MAX = 5;
const INSIGHT_MAX_CHARS = 240;

const explainSchema = z.object({
  insights: z
    .array(z.string().trim().min(1).max(INSIGHT_MAX_CHARS))
    .min(INSIGHT_MIN)
    .max(INSIGHT_MAX),
});

const SYSTEM_PROMPT =
  "You explain an aggregated CRM report. Reply with JSON only, no other text, in exactly this shape: " +
  `{"insights": string[]} with ${INSIGHT_MIN} to ${INSIGHT_MAX} insights, each at most ${INSIGHT_MAX_CHARS} characters. ` +
  "Use only the numbers given. Never invent records, deals, people or emails.";

export interface ExplainResult {
  insights: string[];
}

export type ExplainTarget = { reportId: string } | { definition: ReportDefinition };

function shorten(text: string): string {
  return text.length <= INSIGHT_MAX_CHARS ? text : `${text.slice(0, INSIGHT_MAX_CHARS - 3)}...`;
}

function rowLabel(row: ReportResult["rows"][number]): string {
  const group = row.gLabel === "" ? "All" : row.gLabel;
  return row.sLabel === null ? group : `${group} / ${row.sLabel}`;
}

/** Deterministic insights for AI_FAKE: largest group, smallest group, total. */
export function fakeInsights(result: ReportResult, entity: "deal" | "activity"): string[] {
  const noun = entity === "deal" ? "deals" : "activities";
  if (result.rows.length === 0) {
    return [
      "There is no data in this range.",
      "Widen the date range or remove a filter to see rows.",
      `No ${noun} matched, so there is nothing to explain yet.`,
    ];
  }
  const byValue = [...result.rows].sort((a, b) => Number(b.value) - Number(a.value));
  const largest = byValue[0];
  const smallest = byValue[byValue.length - 1];
  const valueLine = (row: ReportResult["rows"][number]): string =>
    `${rowLabel(row)}: ${row.value} across ${row.count} ${noun}`;
  return [
    shorten(`Largest group: ${largest === undefined ? "none" : valueLine(largest)}.`),
    shorten(`Smallest group: ${smallest === undefined ? "none" : valueLine(smallest)}.`),
    shorten(`Total: ${result.total.value} across ${result.total.count} ${noun}.`),
  ];
}

function buildPrompt(definition: ReportDefinition, result: ReportResult): string {
  const payload = {
    report: describeDefinition(definition, {}),
    baseCurrency: result.baseCurrency,
    total: result.total,
    excluded: result.excluded,
    rows: result.rows.slice(0, INSIGHT_EXPLAIN_MAX_ROWS).map((row) => ({
      group: row.gLabel,
      segment: row.sLabel,
      value: row.value,
      count: row.count,
    })),
  };
  return JSON.stringify(payload);
}

function unavailable(cause: string): Result<ExplainResult, AppError> {
  return err(
    new AppError(ERROR_IDS.INSIGHT_EXPLAIN_UNAVAILABLE, "AI insight unavailable", { cause }),
  );
}

export async function explainReport(
  db: Db,
  actor: PermSetUser,
  target: ExplainTarget,
  signal: AbortSignal,
): Promise<Result<ExplainResult, AppError>> {
  let definition: ReportDefinition;
  if ("reportId" in target) {
    const report = await getReport(db, actor, target.reportId, signal);
    if (!report.ok) return report;
    definition = report.value.definition;
  } else {
    definition = target.definition;
  }

  const report = await runReport(db, actor, definition, signal);
  if (!report.ok) return report;

  // AI_FAKE resolves to the deterministic provider; its three insights are built here from the
  // result (largest group, smallest group, total) rather than round-tripping through a fake
  // prompt. That keeps e2e and demos byte-stable.
  const provider = getAiProvider();
  if (provider === null) return unavailable(ERROR_IDS.AI_UNAVAILABLE);
  if (provider.kind === "fake")
    return ok({ insights: fakeInsights(report.value, definition.entity) });

  // The per-minute limiter the interactive AI actions share, so bulk and explain cannot burst
  // past the same allowance.
  if (!checkAiRateLimit(actor.id)) return unavailable(ERROR_IDS.AI_RATE_LIMITED);

  const result = await chatJson(
    db,
    actor.id,
    "insight_explain",
    {
      system: SYSTEM_PROMPT,
      user: buildPrompt(definition, report.value),
      schema: explainSchema,
      maxTokens: 500,
    },
    signal,
  );
  if (!result.ok) return unavailable(result.error.id);
  return ok({ insights: result.value.insights });
}
