"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import type { AutomationDefinition } from "./definition";
import { draftAutomation } from "./describe";
import {
  type Automation,
  createAutomation,
  deleteAutomation,
  duplicateAutomation,
  setAutomationEnabled,
  updateAutomation,
} from "./service";
import { AUTOMATION_TEMPLATES, buildTemplateContext } from "./templates";

// Automation actions. CSRF and the session live here; the service owns automations.manage.

async function guard(csrfToken: string | null): Promise<Result<PermSetUser, { id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return err({ id: "E_AUTH_CSRF" });
  const { actor } = await createContext();
  if (actor === null) return err({ id: ERROR_IDS.AUTH_SESSION_DEAD });
  return ok(actor);
}

export async function createAutomationAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<Automation>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await createAutomation(db, g.value, input, SIG()));
}

export async function updateAutomationAction(
  id: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<Automation>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updateAutomation(db, g.value, id, input, SIG()));
}

export async function setAutomationEnabledAction(
  id: string,
  enabled: boolean,
  csrfToken: string | null = null,
): Promise<ActionResult<Automation>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await setAutomationEnabled(db, g.value, id, enabled, SIG()));
}

export async function duplicateAutomationAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<Automation>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await duplicateAutomation(db, g.value, id, SIG()));
}

export async function deleteAutomationAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<void>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deleteAutomation(db, g.value, id, SIG()));
}

export async function draftAutomationAction(
  text: string,
  csrfToken: string | null = null,
): Promise<ActionResult<AutomationDefinition>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await draftAutomation(db, g.value, { text }, SIG()));
}

export async function createAutomationFromTemplateAction(
  key: string,
  csrfToken: string | null = null,
): Promise<ActionResult<Automation>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  const template = AUTOMATION_TEMPLATES.find((entry) => entry.key === key);
  if (template === undefined) {
    return { ok: false, error: { id: ERROR_IDS.AUTOMATION_INPUT_INVALID } };
  }
  const context = await buildTemplateContext(db, SIG());
  if (context === null) {
    return { ok: false, error: { id: ERROR_IDS.AUTOMATION_INPUT_INVALID } };
  }
  return toClientResult(
    await createAutomation(
      db,
      g.value,
      {
        name: template.name,
        description: template.description,
        definition: template.build(context),
        enabled: false,
      },
      SIG(),
    ),
  );
}
