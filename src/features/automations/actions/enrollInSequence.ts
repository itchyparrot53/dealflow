import { ERROR_IDS } from "@/constants/errorIds";
import { enrollPerson, resolveActionPerson } from "@/features/campaigns/sequences/enroll";
import { registerActionHandler } from "./registry";

// 6.10's enroll_in_sequence action. The run's record resolves to its primary person (deal, lead or
// activity) and the sequence's own entry flag decides whether automation may add them. The unique
// active enrollment makes a second run of the same automation a no-op.
registerActionHandler("enroll_in_sequence", async (ctx, action) => {
  if (action.type !== "enroll_in_sequence") {
    return { ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED, detail: "wrong action" };
  }
  const personId = await resolveActionPerson(
    ctx.db,
    ctx.entityType,
    ctx.entityId,
    ctx.dealId,
    ctx.signal,
  );
  if (personId === null) {
    return {
      ok: false,
      errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED,
      detail: "no person on this record",
    };
  }
  const result = await enrollPerson(
    ctx.db,
    { sequenceId: action.sequenceId, personId, source: "automation" },
    ctx.signal,
  );
  if (!result.ok) {
    return {
      ok: false,
      errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED,
      detail: result.error.id,
    };
  }
  return {
    ok: true,
    detail: result.value.enrolled ? "enrolled" : "already enrolled",
  };
});
