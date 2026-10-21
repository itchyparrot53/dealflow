import { ERROR_IDS } from "@/constants/errorIds";
import { createNote } from "@/features/collaboration/notesRepo";
import { renderVariables } from "@/features/documents/variables";
import { loadVariableContext } from "./context";
import { registerActionHandler } from "./registry";

// add_note uses the notes service, so the note is visible on the deal timeline and follows the
// same mention and visibility rules as a note a user typed.

registerActionHandler("add_note", async (ctx, action) => {
  if (action.type !== "add_note") {
    return { ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED, detail: "wrong action" };
  }
  if (ctx.dealId === null) {
    return { ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED, detail: "no related deal" };
  }
  const variables = await loadVariableContext(ctx.db, ctx.dealId, ctx.signal);
  const body = renderVariables(action.body, variables).slice(0, 5000);
  if (body.trim() === "") {
    return { ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED, detail: "note empty" };
  }

  const result = await createNote(
    ctx.db,
    ctx.actor,
    { entityType: "deal", entityId: ctx.dealId, body, pinned: false },
    ctx.signal,
  );
  if (!result.ok) {
    return { ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED, detail: result.error.id };
  }
  return { ok: true, detail: `note ${result.value.id}` };
});
