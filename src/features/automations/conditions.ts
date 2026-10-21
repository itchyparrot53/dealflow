import { sql } from "drizzle-orm";
import {
  compileContactFilter,
  ORG_COLUMN_SQL,
  orgFilterSchema,
  PERSON_COLUMN_SQL,
  personFilterSchema,
  ORG_FILTER_CONFIG,
  PERSON_FILTER_CONFIG,
} from "@/features/contacts/contactFilter";
import { filterToSql } from "@/features/saved-filters/filterAst";
import type { FilterDefinition } from "@/features/saved-filters/schemas";
import type { DbOrTx } from "@/server/realtime/channelVersions";

// Condition evaluation. The stored condition is a saved-filter definition; it is checked against
// the record's CURRENT state, not the state at event time, using the same compilers the list views
// use. An empty or absent condition always matches.

export type ConditionEntity = "deal" | "person" | "organization";

interface ExistsRow {
  matches: boolean;
}

function matchesOf(result: unknown): boolean {
  const rows = (result as { rows?: ExistsRow[] }).rows;
  return rows?.[0]?.matches === true;
}

export async function evaluateCondition(
  db: DbOrTx,
  entity: ConditionEntity,
  entityId: string,
  condition: FilterDefinition | null,
  signal: AbortSignal,
): Promise<boolean> {
  signal.throwIfAborted();
  if (condition === null || condition.conditions.length === 0) return true;

  if (entity === "deal") {
    const predicate = filterToSql(condition);
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM deals d
        LEFT JOIN pipelines p ON p.id = d.pipeline_id
        LEFT JOIN stages s ON s.id = d.stage_id
        LEFT JOIN organizations o ON o.id = d.org_id
        WHERE d.id = ${entityId}::uuid AND (${predicate})
      ) AS matches
    `);
    return matchesOf(result);
  }

  // A contact target accepts the contact field set. A deal-shaped condition that does not fit is
  // treated as "no match" rather than as an error: the run then skips as condition_false, which is
  // the safe direction for an automation that was misconfigured.
  if (entity === "person") {
    const parsed = personFilterSchema.safeParse(condition);
    if (!parsed.success) return false;
    const predicate = compileContactFilter(parsed.data, PERSON_FILTER_CONFIG, PERSON_COLUMN_SQL);
    if (predicate === null) return true;
    const result = await db.execute(sql`
      SELECT EXISTS (SELECT 1 FROM persons WHERE persons.id = ${entityId}::uuid AND (${predicate})) AS matches
    `);
    return matchesOf(result);
  }

  const parsed = orgFilterSchema.safeParse(condition);
  if (!parsed.success) return false;
  const predicate = compileContactFilter(parsed.data, ORG_FILTER_CONFIG, ORG_COLUMN_SQL);
  if (predicate === null) return true;
  const result = await db.execute(sql`
    SELECT EXISTS (SELECT 1 FROM organizations WHERE organizations.id = ${entityId}::uuid AND (${predicate})) AS matches
  `);
  return matchesOf(result);
}
