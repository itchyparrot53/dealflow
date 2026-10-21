import { and, asc, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { auditEvents, users } from "@/db/schema";
import { decodeCursor, encodeCursor } from "@/features/api/cursor";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";

// Admin audit log (6.8). Keyset paginated newest-first; the filters are actor, action and a date
// range. The writer stores arbitrary before/after JSON, so the reader redacts anything that looks
// like a credential before the page sees it.

export const AUDIT_PAGE_SIZE = 50;

export interface AuditRow {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
}

export interface AuditFilter {
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
}

const SECRET_KEY = /pass(word)?|secret|token|hash|credential|api.?key/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => redact(entry));
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key) ? "[redacted]" : redact(entry);
  }
  return out;
}

export async function listAuditEvents(
  db: Db,
  actor: PermSetUser,
  filter: AuditFilter,
  cursor: string | null,
  signal: AbortSignal,
): Promise<Result<{ rows: AuditRow[]; nextCursor: string | null; actions: string[] }, AppError>> {
  if (actor.type !== "admin") {
    return err(new AppError(ERROR_IDS.PERM_DENIED, "audit log is admin-only"));
  }
  signal.throwIfAborted();
  const clauses = [];
  if (filter.actorId !== undefined) clauses.push(eq(auditEvents.actorId, filter.actorId));
  if (filter.action !== undefined) clauses.push(eq(auditEvents.action, filter.action));
  if (filter.from !== undefined) {
    clauses.push(gte(auditEvents.createdAt, new Date(`${filter.from}T00:00:00.000Z`)));
  }
  if (filter.to !== undefined) {
    clauses.push(lte(auditEvents.createdAt, new Date(`${filter.to}T23:59:59.999Z`)));
  }
  if (cursor !== null) {
    const decoded = decodeCursor(cursor);
    if (decoded.ok) {
      const at = new Date(decoded.value.updatedAt);
      clauses.push(
        or(
          lt(auditEvents.createdAt, at),
          and(eq(auditEvents.createdAt, at), lt(auditEvents.id, decoded.value.id)),
        )!,
      );
    }
  }
  const rows = await db
    .select({
      id: auditEvents.id,
      createdAt: auditEvents.createdAt,
      actorId: auditEvents.actorId,
      actorName: users.name,
      action: auditEvents.action,
      targetType: auditEvents.targetType,
      targetId: auditEvents.targetId,
      before: auditEvents.before,
      after: auditEvents.after,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(clauses.length === 0 ? undefined : and(...clauses))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(AUDIT_PAGE_SIZE + 1);
  signal.throwIfAborted();

  const actionRows = await db
    .select({ action: auditEvents.action })
    .from(auditEvents)
    .groupBy(auditEvents.action)
    .orderBy(asc(auditEvents.action));

  const page = rows.slice(0, AUDIT_PAGE_SIZE);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > AUDIT_PAGE_SIZE && last !== undefined
      ? encodeCursor({ updatedAt: last.createdAt.toISOString(), id: last.id })
      : null;
  return ok({
    rows: page.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      actorId: row.actorId,
      actorName: row.actorName ?? null,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      before: redact(row.before),
      after: redact(row.after),
    })),
    nextCursor,
    actions: actionRows.map((row) => row.action),
  });
}
