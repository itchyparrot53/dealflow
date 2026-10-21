import { z } from "zod";
import { type FilterDefinition, filterDefinition } from "@/features/saved-filters/schemas";
import { customRangeIssues } from "./rangeRules";

// The report definition is the one contract every layer shares: the builder edits it, the engine
// compiles it, the AI prompt summarises it. It is pure here, so every rule in 6.5 is unit-tested
// without a database. The field names are the columns warpdrive actually uses.

export const DEAL_GROUP_FIELDS = [
  "stage",
  "pipeline",
  "owner",
  "status",
  "label",
  "lost_reason",
  "source_channel",
  "currency",
  "created_at",
  "won_at",
  "lost_at",
  "expected_close_date",
] as const;

export const ACTIVITY_GROUP_FIELDS = [
  "activity_type",
  "owner",
  "assignee",
  "done",
  "due_at",
  "created_at",
  "done_at",
] as const;

export const DEAL_DATE_FIELDS = ["created_at", "won_at", "lost_at", "expected_close_date"] as const;

export const ACTIVITY_DATE_FIELDS = ["due_at", "created_at", "done_at"] as const;

/** Deal date fields double as the date range's field and as a date grouping. */
export const DEAL_SEGMENT_FIELDS = [
  "stage",
  "pipeline",
  "owner",
  "status",
  "label",
  "lost_reason",
  "source_channel",
  "currency",
] as const;

export const ACTIVITY_SEGMENT_FIELDS = ["activity_type", "owner", "assignee", "done"] as const;

export const INTERVALS = ["day", "week", "month", "quarter", "year"] as const;

export const DATE_PRESETS = [
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
  "this_year",
  "last_year",
  "last_30_days",
  "last_90_days",
  "last_12_months",
  "all_time",
  "custom",
] as const;

export const DEAL_CHARTS = [
  "bar",
  "stacked_bar",
  "line",
  "area",
  "pie",
  "table",
  "kpi",
  "funnel",
] as const;

export const ACTIVITY_CHARTS = [
  "bar",
  "stacked_bar",
  "line",
  "area",
  "pie",
  "table",
  "kpi",
] as const;

export type DealGroupField = (typeof DEAL_GROUP_FIELDS)[number];
export type ActivityGroupField = (typeof ACTIVITY_GROUP_FIELDS)[number];
export type DealDateField = (typeof DEAL_DATE_FIELDS)[number];
export type ActivityDateField = (typeof ACTIVITY_DATE_FIELDS)[number];
export type DealSegmentField = (typeof DEAL_SEGMENT_FIELDS)[number];
export type ActivitySegmentField = (typeof ACTIVITY_SEGMENT_FIELDS)[number];
export type Interval = (typeof INTERVALS)[number];
export type DatePreset = (typeof DATE_PRESETS)[number];
export type DealChart = (typeof DEAL_CHARTS)[number];
export type ActivityChart = (typeof ACTIVITY_CHARTS)[number];

export type DealMeasure =
  | { kind: "count" }
  | { kind: "sum_value" }
  | { kind: "avg_value" }
  | { kind: "weighted_value" };

export type ActivityMeasure = { kind: "count" } | { kind: "sum_duration" };

export interface DealReportDefinition {
  entity: "deal";
  measure: DealMeasure;
  /** The interval is required for a date field and forbidden otherwise. */
  groupBy: { field: DealGroupField; interval?: Interval } | null;
  segmentBy: { field: DealSegmentField } | null;
  dateRange: { field: DealDateField; preset: DatePreset; from?: string; to?: string };
  /** The saved-filter deal AST (Part 5), reused rather than reimplemented. */
  filter: FilterDefinition | null;
  chart: DealChart;
  /** Required when chart is "funnel"; group and segment are ignored then. */
  funnelPipelineId?: string;
}

export type ActivityFilter = {
  ownerIds?: string[];
  activityTypeIds?: string[];
  done?: boolean;
};

export interface ActivityReportDefinition {
  entity: "activity";
  measure: ActivityMeasure;
  groupBy: { field: ActivityGroupField; interval?: Interval } | null;
  segmentBy: { field: ActivitySegmentField } | null;
  dateRange: { field: ActivityDateField; preset: DatePreset; from?: string; to?: string };
  filter: ActivityFilter | null;
  chart: ActivityChart;
}

export type ReportDefinition = DealReportDefinition | ActivityReportDefinition;

export interface NameLookup {
  pipelineName?: (id: string) => string | null;
}

const DEAL_DATE_SET: ReadonlySet<string> = new Set(DEAL_DATE_FIELDS);
const ACTIVITY_DATE_SET: ReadonlySet<string> = new Set(ACTIVITY_DATE_FIELDS);

export function isDealDateField(field: string): field is DealDateField {
  return DEAL_DATE_SET.has(field);
}

export function isActivityDateField(field: string): field is ActivityDateField {
  return ACTIVITY_DATE_SET.has(field);
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

function dateRangeSchema<F extends readonly [string, ...string[]]>(fields: F) {
  return z
    .object({
      field: z.enum(fields),
      preset: z.enum(DATE_PRESETS),
      from: isoDate.optional(),
      to: isoDate.optional(),
    })
    .superRefine(customRangeIssues);
}

function groupBySchema<F extends readonly [string, ...string[]]>(
  fields: F,
  dateFields: ReadonlySet<string>,
) {
  return z
    .object({ field: z.enum(fields), interval: z.enum(INTERVALS).optional() })
    .superRefine((group, ctx) => {
      const isDate = dateFields.has(group.field);
      if (isDate && group.interval === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "a date group needs an interval",
          path: ["interval"],
        });
      }
      if (!isDate && group.interval !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: "only a date group takes an interval",
          path: ["interval"],
        });
      }
    })
    .nullable();
}

const dealMeasureSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("count") }),
  z.object({ kind: z.literal("sum_value") }),
  z.object({ kind: z.literal("avg_value") }),
  z.object({ kind: z.literal("weighted_value") }),
]);

const activityMeasureSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("count") }),
  z.object({ kind: z.literal("sum_duration") }),
]);

const activityFilterSchema = z
  .object({
    ownerIds: z.array(z.uuid()).optional(),
    activityTypeIds: z.array(z.uuid()).optional(),
    done: z.boolean().optional(),
  })
  .nullable();

const dealDefinitionSchema = z.object({
  entity: z.literal("deal"),
  measure: dealMeasureSchema,
  groupBy: groupBySchema(DEAL_GROUP_FIELDS, DEAL_DATE_SET),
  segmentBy: z.object({ field: z.enum(DEAL_SEGMENT_FIELDS) }).nullable(),
  dateRange: dateRangeSchema(DEAL_DATE_FIELDS),
  filter: filterDefinition.nullable(),
  chart: z.enum(DEAL_CHARTS),
  funnelPipelineId: z.uuid().optional(),
});

const activityDefinitionSchema = z.object({
  entity: z.literal("activity"),
  measure: activityMeasureSchema,
  groupBy: groupBySchema(ACTIVITY_GROUP_FIELDS, ACTIVITY_DATE_SET),
  segmentBy: z.object({ field: z.enum(ACTIVITY_SEGMENT_FIELDS) }).nullable(),
  dateRange: dateRangeSchema(ACTIVITY_DATE_FIELDS),
  filter: activityFilterSchema,
  chart: z.enum(ACTIVITY_CHARTS),
});

type ParsedDefinition =
  | z.infer<typeof dealDefinitionSchema>
  | z.infer<typeof activityDefinitionSchema>;

interface ChartState {
  hasGroup: boolean;
  isDateGroup: boolean;
  hasSegment: boolean;
  funnelPipelineId?: string;
}

type ChartRule = (state: ChartState, issue: (message: string) => void) => void;

const DATE_GROUP: ChartRule = (state, issue) => {
  if (!state.isDateGroup) issue("line and area need a date group");
};

// One rule per chart, so the schema stays a table of 6.5's rules rather than a branch pile.
const CHART_RULES: Record<ParsedDefinition["chart"], ChartRule> = {
  bar: () => undefined,
  table: () => undefined,
  stacked_bar: (state, issue) => {
    if (!state.hasSegment) issue("a stacked bar needs a segment");
  },
  line: DATE_GROUP,
  area: DATE_GROUP,
  pie: (state, issue) => {
    if (!state.hasGroup || state.isDateGroup) issue("a pie needs a non-date group");
    if (state.hasSegment) issue("a pie takes no segment");
  },
  kpi: (state, issue) => {
    if (state.hasGroup) issue("a kpi takes no group");
    if (state.hasSegment) issue("a kpi takes no segment");
  },
  funnel: (state, issue) => {
    if (state.funnelPipelineId === undefined) issue("a funnel needs a pipeline");
  },
};

function chartIssues(def: ParsedDefinition, ctx: z.RefinementCtx): void {
  const issue = (message: string): void => {
    ctx.addIssue({ code: "custom", message, path: ["chart"] });
  };
  CHART_RULES[def.chart](
    {
      hasGroup: def.groupBy !== null,
      isDateGroup:
        def.groupBy !== null &&
        (def.entity === "deal"
          ? isDealDateField(def.groupBy.field)
          : isActivityDateField(def.groupBy.field)),
      hasSegment: def.segmentBy !== null,
      funnelPipelineId: def.entity === "deal" ? def.funnelPipelineId : undefined,
    },
    issue,
  );
}

const definitionUnion = z.discriminatedUnion("entity", [
  dealDefinitionSchema,
  activityDefinitionSchema,
]);

// The inferred output is structurally ReportDefinition; the cast only bridges Zod's input type
// (where defaults are optional) to the checked output type callers read.
export const reportDefinitionSchema = definitionUnion.superRefine(
  chartIssues,
) as unknown as z.ZodType<ReportDefinition>;

export { describeDefinition } from "./describe";
