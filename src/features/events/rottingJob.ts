import { sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { DEAL_ROTTING_CRON, PGBOSS_QUEUE_DEAL_ROTTING } from "@/constants/jobNames";
import { type Db, db as defaultDb } from "@/db/client";
import { emitDomainEvent } from "./emit";

// Daily rotting sweep. The rule is warpdrive's own (filterAst's rotting narrowing): open deals
// whose time in the current stage is past the stage's rotting_days, counted in whole days. Each
// stage entry fires at most once, guarded by "no deal.rotting event since stage_entered_at"; after
// event retention a deal that is still rotting can fire again, which is the documented trade-off.

const JOB_TIMEOUT_MS = 60_000;

export async function runRottingDeals(db: Db, signal: AbortSignal): Promise<number> {
  signal.throwIfAborted();
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      SELECT d.id
      FROM deals d
      JOIN stages s ON s.id = d.stage_id
      WHERE d.status = 'open'
        AND d.deleted_at IS NULL
        AND s.rotting_days IS NOT NULL
        AND d.stage_entered_at IS NOT NULL
        AND d.stage_entered_at <= now() - (s.rotting_days + 1) * interval '1 day'
        AND NOT EXISTS (
          SELECT 1 FROM domain_events e
          WHERE e.type = 'deal.rotting'
            AND e.entity_id = d.id
            AND e.created_at >= d.stage_entered_at
        )
    `);
    const rows = (result as unknown as { rows: Array<{ id: string }> }).rows;
    for (const row of rows) {
      await emitDomainEvent(
        tx,
        { type: "deal.rotting", entityType: "deal", entityId: row.id, actorId: null },
        signal,
      );
    }
    return rows.length;
  });
}

export async function registerRottingJob(boss: PgBoss): Promise<void> {
  await boss.createQueue(PGBOSS_QUEUE_DEAL_ROTTING);
  await boss.work(PGBOSS_QUEUE_DEAL_ROTTING, async () => {
    await runRottingDeals(defaultDb, AbortSignal.timeout(JOB_TIMEOUT_MS));
  });
  await boss.schedule(PGBOSS_QUEUE_DEAL_ROTTING, DEAL_ROTTING_CRON);
}
