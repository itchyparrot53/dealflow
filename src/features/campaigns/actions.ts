"use server";

import { z } from "zod";
import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";
import { suggestCampaignSubjects } from "./ai";
import { type CampaignAssetView, saveCampaignAsset } from "./assets";
import { campaignDocumentSchema } from "./blocks/schema";
import { campaignCreateInput, campaignUpdateInput } from "./schemas";
import { createCampaign, deleteCampaign, updateCampaign } from "./service";
import {
  deleteCampaignTemplate,
  duplicateCampaignTemplate,
  saveCampaignTemplate,
} from "./templates";
import { sendCampaignTest } from "./testSend";

// 6.5 upload. The image is at most 1 MB, so it travels through a server action instead of a
// presigned handshake; the bytes are sniffed for the real type before anything is stored.

type ActionResult<T> = { ok: true; value: T } | { ok: false; error: { id: string } };

export async function uploadCampaignAssetAction(
  formData: FormData,
  csrfToken: string | null = null,
): Promise<ActionResult<CampaignAssetView>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };

  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  if (!can(actor, "campaigns.edit")) {
    return { ok: false, error: { id: ERROR_IDS.PERM_DENIED } };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_ASSET_INVALID } };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await saveCampaignAsset(db, actor, { bytes }, AbortSignal.timeout(15_000));
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: result.value };
}

const templateInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  content: z.unknown(),
});

const testInput = z.object({
  document: z.unknown(),
  subject: z.string().max(200),
  preheader: z.string().max(140).optional(),
  personId: z.string().uuid(),
  recipients: z.array(z.string().email()).min(1).max(5),
});

const idInput = z.object({ id: z.string().uuid() });

export async function saveCampaignTemplateAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = templateInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await saveCampaignTemplate(db, actor, parsed.data, AbortSignal.timeout(15_000));
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: result.value };
}

export async function deleteCampaignTemplateAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await deleteCampaignTemplate(
    db,
    actor,
    parsed.data.id,
    AbortSignal.timeout(15_000),
  );
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: { id: parsed.data.id } };
}

export async function duplicateCampaignTemplateAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await duplicateCampaignTemplate(
    db,
    actor,
    parsed.data.id,
    AbortSignal.timeout(15_000),
  );
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: result.value };
}

export async function sendCampaignTestAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ sent: number }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = testInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const document = campaignDocumentSchema.safeParse(parsed.data.document);
  if (!document.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await sendCampaignTest(
    db,
    actor,
    {
      document: document.data,
      subject: parsed.data.subject,
      preheader: parsed.data.preheader,
      personId: parsed.data.personId,
      recipients: parsed.data.recipients,
    },
    AbortSignal.timeout(30_000),
  );
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: result.value };
}

export async function createCampaignAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = campaignCreateInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await createCampaign(db, actor, parsed.data, AbortSignal.timeout(15_000));
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: result.value };
}

export async function updateCampaignAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = campaignUpdateInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await updateCampaign(db, actor, parsed.data, AbortSignal.timeout(15_000));
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: result.value };
}

export async function deleteCampaignAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await deleteCampaign(db, actor, parsed.data.id, AbortSignal.timeout(15_000));
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: { id: parsed.data.id } };
}

export async function suggestCampaignSubjectsAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ subjects: string[] }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = z.object({ name: z.string().max(120), type: z.string().max(40) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await suggestCampaignSubjects(db, actor, parsed.data, AbortSignal.timeout(30_000));
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: { subjects: result.value } };
}
