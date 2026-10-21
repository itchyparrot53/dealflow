import type { Db } from "@/db/client";
import { auditEvents } from "@/db/schema";
import { redactRecord } from "@/features/audit/redact";

type AuditTarget =
  | "permission_set"
  | "visibility_group"
  | "pipeline"
  | "user"
  | "settings"
  | "deal"
  | "person"
  | "organization";

export interface AuditEventInput {
  actorId: string | null;
  targetType: AuditTarget;
  targetId: string | null;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  correlationId?: string | null;
}

// Writes one security-relevant change to audit_events (permissions spec 9). Secret-looking keys
// are redacted before storage; the reader redacts again so rows from older writers stay safe.
export async function recordAudit(
  db: Db,
  event: AuditEventInput,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  await db.insert(auditEvents).values({
    actorId: event.actorId,
    targetType: event.targetType,
    targetId: event.targetId,
    action: event.action,
    before: redactRecord(event.before),
    after: redactRecord(event.after),
    correlationId: event.correlationId ?? null,
  });
  signal.throwIfAborted();
}
