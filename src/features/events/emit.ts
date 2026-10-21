import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { DOMAIN_EVENTS_CHANNEL } from "@/constants/automations";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { currentChain } from "./chainContext";
import type { DomainEventDraft, DomainEventType } from "./types";

// The outbox writer. It runs in the SAME db/tx as the mutation that caused the event, so a
// rolled-back change leaves no event behind, and the NOTIFY that wakes the dispatcher is only
// delivered if that transaction commits.
export async function emitDomainEvent(
  db: DbOrTx,
  ev: DomainEventDraft,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  const chain = currentChain();
  const chainId = chain?.chainId ?? randomUUID();
  const depth = chain?.depth ?? 0;
  const automationId = chain?.automationId ?? null;
  const changesJson = ev.changes === undefined ? null : JSON.stringify(ev.changes);

  await db.execute(sql`
    INSERT INTO domain_events
      (type, entity_type, entity_id, actor_id, changes, chain_id, depth, automation_id)
    VALUES (
      ${ev.type}, ${ev.entityType}, ${ev.entityId}::uuid, ${ev.actorId},
      ${changesJson}::jsonb, ${chainId}::uuid, ${depth}, ${automationId}
    )
  `);
  signal.throwIfAborted();

  // Delivered on commit. A failed NOTIFY must not fail the mutation: the dispatcher also polls.
  await db
    .execute(sql`NOTIFY ${sql.raw(DOMAIN_EVENTS_CHANNEL)}`)
    .catch((error: unknown) => {
      console.error("domain event notify failed", error);
    });
}

// Maps an audited field change to the domain events it means. The field names are the ones
// recordChange actually receives: deal "stageId" (changeStage, dealMove), deal "status"
// (markWon, markLost, reopenDeal), deal "deleted"/"deletedAt" (both delete paths), and person
// or organization updates. Activity completion is emitted by the activity service (Task 1.2).
export function eventTypesForChange(
  entityType: string,
  field: string,
  _oldValue: unknown,
  newValue: unknown,
): DomainEventType[] {
  switch (entityType) {
    case "deal": {
      if (field === "stageId") return ["deal.stage_changed", "deal.updated"];
      if (field === "status") {
        if (newValue === "won") return ["deal.won", "deal.updated"];
        if (newValue === "lost") return ["deal.lost", "deal.updated"];
        return ["deal.updated"];
      }
      if (field === "deleted" || field === "deletedAt") return ["deal.deleted"];
      return ["deal.updated"];
    }
    case "person":
      return ["person.updated"];
    case "organization":
      return ["organization.updated"];
    case "activity":
      if ((field === "done" || field === "completed") && newValue === true) {
        return ["activity.completed"];
      }
      return [];
    default:
      return [];
  }
}
