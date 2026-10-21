import { sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { PGBOSS_QUEUE_DOCUMENT_OVERDUE } from "@/constants/jobNames";
import { type Db, db as defaultDb } from "@/db/client";
import { emitDomainEvent } from "@/features/events/emit";

// Daily overdue sweep. Only invoices in `sent` past their due date move; paid,
// void, draft and every quote stay where they are. Exported so a test can call
// the same SQL the worker runs.

export const OVERDUE_INVOICES_CRON = "0 6 * * *";
const JOB_TIMEOUT_MS = 30_000;

export async function runOverdueInvoices(db: Db, signal: AbortSignal): Promise<number> {
  signal.throwIfAborted();
  return db.transaction(async (tx) => {
    // RETURNING id is how each swept invoice gets its own event; the update and the events
    // commit together, so a failed sweep announces nothing.
    const result = await tx.execute(sql`
      UPDATE documents
      SET status = 'overdue', updated_at = now()
      WHERE kind = 'invoice'
        AND status = 'sent'
        AND due_date < (now() at time zone 'utc')::date
      RETURNING id
    `);
    const rows = (result as unknown as { rows: Array<{ id: string }> }).rows;
    for (const row of rows) {
      await emitDomainEvent(
        tx,
        { type: "invoice.overdue", entityType: "invoice", entityId: row.id, actorId: null },
        signal,
      );
    }
    return rows.length;
  });
}

export async function registerOverdueDocumentsJob(boss: PgBoss): Promise<void> {
  await boss.createQueue(PGBOSS_QUEUE_DOCUMENT_OVERDUE);
  await boss.work(PGBOSS_QUEUE_DOCUMENT_OVERDUE, async () => {
    await runOverdueInvoices(defaultDb, AbortSignal.timeout(JOB_TIMEOUT_MS));
  });
  await boss.schedule(PGBOSS_QUEUE_DOCUMENT_OVERDUE, OVERDUE_INVOICES_CRON);
}
