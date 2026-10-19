import {
  SAVED_FILTER_TARGET_ENTITIES,
  savedFilterDefinitionSchema,
} from "@/features/saved-filters/schemas";

export interface SavedFilterRow {
  id: string;
  name: string;
  // Seeds carry a plain string, so the caller is not forced to narrow before auditing.
  targetEntity: string;
  definition: unknown;
}
export type SavedFilterIssue =
  | { kind: "invalid"; id: string; message: string }
  | { kind: "lossy"; id: string; droppedKeys: string[] }
  | { kind: "degenerate"; id: string };

// A saved filter is conformant when it parses, the parse keeps every condition key it was given,
// and it still narrows something (a condition or the rotting flag).
export function analyzeSavedFilter(row: SavedFilterRow): SavedFilterIssue | null {
  const targetEntity = SAVED_FILTER_TARGET_ENTITIES.find((e) => e === row.targetEntity);
  if (targetEntity === undefined)
    return { kind: "invalid", id: row.id, message: `unknown target entity: ${row.targetEntity}` };
  const schema = savedFilterDefinitionSchema(targetEntity);
  const parsed = schema.safeParse(row.definition);
  if (!parsed.success) return { kind: "invalid", id: row.id, message: parsed.error.message };
  const input = (row.definition ?? {}) as { conditions?: Record<string, unknown>[] };
  const output = parsed.data as { conditions: Record<string, unknown>[]; rotting?: boolean };
  const dropped = (input.conditions ?? []).flatMap((c, i) =>
    Object.keys(c).filter((k) => !(k in (output.conditions[i] ?? {}))),
  );
  if (dropped.length > 0) return { kind: "lossy", id: row.id, droppedKeys: dropped };
  if (output.conditions.length === 0 && output.rotting !== true)
    return { kind: "degenerate", id: row.id };
  return null;
}
