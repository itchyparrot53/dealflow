"use server";

import { eq } from "drizzle-orm";
import { env } from "@/config/env";
import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import {
  type EmailDesignView,
  getEmailDesign,
  removeEmailLogo,
  saveEmailDesign,
  uploadEmailLogo,
} from "./design";
import { sampleVariables } from "./registry";
import { designInputSchema, templateInputSchema, templateKeySchema } from "./schemas";
import { sendSystemEmail } from "./sendSystemEmail";
import { type ResolvedTemplate, resetTemplate, saveTemplate } from "./templates";

// Settings > Email design actions. Every mutation is CSRF-guarded and admin-gated in the service;
// the read-only preview is a tRPC query. The test send goes only to the signed-in admin.

async function guard(csrfToken: string | null): Promise<ActionResult<never>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: ERROR_IDS.PERM_DENIED } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_LOGIN_REJECTED } };
  return { ok: true, value: undefined as never };
}

export async function saveEmailDesignAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<EmailDesignView>> {
  const allowed = await guard(csrfToken);
  if (!allowed.ok) return allowed;
  const parsed = designInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { id: ERROR_IDS.EMAIL_DESIGN_INPUT_INVALID } };
  }
  const { actor } = await createContext();
  return toClientResult(await saveEmailDesign(db, actor, parsed.data, SIG()));
}

export async function uploadEmailLogoAction(
  formData: FormData,
  csrfToken: string | null = null,
): Promise<ActionResult<EmailDesignView>> {
  const allowed = await guard(csrfToken);
  if (!allowed.ok) return allowed;
  const file = formData.get("file");
  if (file === null || typeof file === "string") {
    return { ok: false, error: { id: ERROR_IDS.EMAIL_DESIGN_INPUT_INVALID } };
  }
  const { actor } = await createContext();
  return toClientResult(
    await uploadEmailLogo(
      db,
      actor,
      { size: file.size, arrayBuffer: () => file.arrayBuffer() },
      SIG(),
    ),
  );
}

export async function removeEmailLogoAction(
  csrfToken: string | null = null,
): Promise<ActionResult<EmailDesignView>> {
  const allowed = await guard(csrfToken);
  if (!allowed.ok) return allowed;
  const { actor } = await createContext();
  return toClientResult(await removeEmailLogo(db, actor, SIG()));
}

export async function sendEmailDesignTestAction(
  csrfToken: string | null = null,
): Promise<ActionResult<{ messageId: string }>> {
  const allowed = await guard(csrfToken);
  if (!allowed.ok) return allowed;
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_LOGIN_REJECTED } };
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, actor.id));
  if (user === undefined) return { ok: false, error: { id: ERROR_IDS.AUTH_LOGIN_REJECTED } };
  const design = await getEmailDesign(db, SIG());
  const variables = {
    ...sampleVariables("quote_sent"),
    "company.name": design.displayName,
    "app.url": env.BASE_URL,
  };
  return toClientResult(
    await sendSystemEmail(db, "quote_sent", user.email, variables, SIG(), { design }),
  );
}

export async function sendEmailTemplateTestAction(
  key: string,
  csrfToken: string | null = null,
): Promise<ActionResult<{ messageId: string }>> {
  const allowed = await guard(csrfToken);
  if (!allowed.ok) return allowed;
  const parsedKey = templateKeySchema.safeParse(key);
  if (!parsedKey.success) {
    return { ok: false, error: { id: ERROR_IDS.EMAIL_DESIGN_INPUT_INVALID } };
  }
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_LOGIN_REJECTED } };
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, actor.id));
  if (user === undefined) return { ok: false, error: { id: ERROR_IDS.AUTH_LOGIN_REJECTED } };
  const design = await getEmailDesign(db, SIG());
  return toClientResult(
    await sendSystemEmail(
      db,
      parsedKey.data,
      user.email,
      {
        ...sampleVariables(parsedKey.data as never),
        "company.name": design.displayName,
        "app.url": env.BASE_URL,
      },
      SIG(),
      { design },
    ),
  );
}

export async function saveEmailTemplateAction(
  key: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<ResolvedTemplate>> {
  const allowed = await guard(csrfToken);
  if (!allowed.ok) return allowed;
  const parsedKey = templateKeySchema.safeParse(key);
  const parsed = templateInputSchema.safeParse(input);
  if (!parsedKey.success || !parsed.success) {
    return { ok: false, error: { id: ERROR_IDS.EMAIL_DESIGN_INPUT_INVALID } };
  }
  const { actor } = await createContext();
  return toClientResult(await saveTemplate(db, actor, parsedKey.data, parsed.data, SIG()));
}

export async function resetEmailTemplateAction(
  key: string,
  csrfToken: string | null = null,
): Promise<ActionResult<ResolvedTemplate>> {
  const allowed = await guard(csrfToken);
  if (!allowed.ok) return allowed;
  const parsedKey = templateKeySchema.safeParse(key);
  if (!parsedKey.success) {
    return { ok: false, error: { id: ERROR_IDS.EMAIL_DESIGN_INPUT_INVALID } };
  }
  const { actor } = await createContext();
  return toClientResult(await resetTemplate(db, actor, parsedKey.data, SIG()));
}
