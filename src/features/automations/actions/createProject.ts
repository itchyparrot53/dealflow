import { ERROR_IDS } from "@/constants/errorIds";
import { renderVariables } from "@/features/documents/variables";
import { createProjectFromDeal } from "@/features/projects/fromDeal";
import { loadVariableContext } from "./context";
import { registerActionHandler } from "./registry";

// create_project calls the projects service, so the project, its phases and its project.created
// event are written exactly as a user-created project is. An automation may start one on any deal
// in its trigger, not only a won one (6.6).

function failed(detail: string): { ok: false; errorId: string; detail: string } {
  return { ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED, detail };
}

registerActionHandler("create_project", async (ctx, action) => {
  if (action.type !== "create_project") return failed("wrong action");
  if (ctx.dealId === null) return failed("no related deal");

  const variables =
    action.nameTemplate === undefined
      ? {}
      : await loadVariableContext(ctx.db, ctx.dealId, ctx.signal);

  const rendered =
    action.nameTemplate === undefined
      ? ""
      : renderVariables(action.nameTemplate, variables).trim().slice(0, 150);
  if (action.nameTemplate !== undefined && rendered === "") {
    return failed("project name rendered empty");
  }

  const result = await createProjectFromDeal(
    ctx.db,
    ctx.actor,
    ctx.dealId,
    {
      // The default name is the deal title (6.6); an empty template falls back to it too.
      name: rendered === "" ? undefined : rendered,
      phases: action.phases,
      allowAnyStatus: true,
    },
    ctx.signal,
  );
  if (!result.ok) return failed(result.error.id);
  return { ok: true, detail: `project ${result.value.id}` };
});
