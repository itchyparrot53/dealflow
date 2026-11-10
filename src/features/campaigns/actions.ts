"use server";

import { z } from "zod";
import { ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { suggestCampaignSubjects } from "./ai";
import { type CampaignAssetView, saveCampaignAsset } from "./assets";
import { campaignDocumentSchema } from "./blocks/schema";
import { checkDomain, defaultResolver } from "./domainCheck";
import { campaignCreateInput, campaignUpdateInput } from "./schemas";
import { snapshotCampaign } from "./send/batch";
import { enqueueCampaignStart, enqueueCampaignTick } from "./send/job";
import {
  cancelCampaign,
  pauseCampaign,
  resumeCampaign,
  scheduleCampaign,
  unscheduleCampaign,
} from "./send/state";
import { addSender, setDefaultSender } from "./senders";
import { createCampaign, deleteCampaign, duplicateCampaign, updateCampaign } from "./service";
import { saveCampaignSettings } from "./settings";
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
  senderId: z.string().uuid().nullable().optional(),
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
      senderId: parsed.data.senderId,
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

export async function duplicateCampaignAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await duplicateCampaign(db, actor, parsed.data.id, AbortSignal.timeout(15_000));
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

const senderInput = z.object({
  fromName: z.string().trim().min(1).max(120),
  fromEmail: z.string().trim().email().max(320),
});

const settingsInput = z.object({
  postalAddress: z.string().max(1000).nullable(),
  requireDoubleOptIn: z.boolean(),
  consentLabel: z.string().max(500).nullable(),
  sendRatePerMinute: z.number().int().min(1).max(10_000),
});

const domainInput = z.object({
  domain: z.string().trim().min(1).max(255),
  selector: z.string().trim().max(100).nullable(),
});

export async function addCampaignSenderAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string; verificationSent: boolean }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = senderInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await addSender(db, actor, parsed.data, AbortSignal.timeout(20_000));
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: result.value };
}

export async function setDefaultCampaignSenderAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await setDefaultSender(db, actor, parsed.data.id, AbortSignal.timeout(15_000));
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: { id: parsed.data.id } };
}

export async function saveCampaignSettingsAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ saved: boolean }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = settingsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await saveCampaignSettings(db, actor, parsed.data, AbortSignal.timeout(15_000));
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: { saved: true } };
}

export async function checkCampaignDomainAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<Awaited<ReturnType<typeof checkDomain>>>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  if (!can(actor, "marketing.manage")) {
    return { ok: false, error: { id: ERROR_IDS.PERM_DENIED } };
  }
  const parsed = domainInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await checkDomain(
    parsed.data.domain,
    parsed.data.selector,
    defaultResolver,
    AbortSignal.timeout(15_000),
  );
  return { ok: true, value: result };
}

const scheduleInput = z.object({ id: z.string().uuid(), scheduledAt: z.string().datetime() });

export async function sendCampaignNowAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ recipients: number }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  if (!can(actor, "campaigns.send")) return { ok: false, error: { id: ERROR_IDS.PERM_DENIED } };
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const snapshot = await snapshotCampaign(db, parsed.data.id, AbortSignal.timeout(60_000));
  if (!snapshot.ok) return { ok: false, error: { id: snapshot.error.id } };
  await enqueueCampaignTick(parsed.data.id);
  return { ok: true, value: { recipients: snapshot.recipients } };
}

export async function scheduleCampaignAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ scheduledAt: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = scheduleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const at = new Date(parsed.data.scheduledAt);
  const result = await scheduleCampaign(db, actor, parsed.data.id, at, AbortSignal.timeout(15_000));
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  await enqueueCampaignStart(parsed.data.id, at);
  return { ok: true, value: result.value };
}

export async function pauseCampaignAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ status: string }>> {
  return changeState(raw, csrfToken, pauseCampaign);
}

export async function resumeCampaignAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ status: string }>> {
  return changeState(raw, csrfToken, resumeCampaign);
}

export async function unscheduleCampaignAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ status: string }>> {
  return changeState(raw, csrfToken, unscheduleCampaign);
}

export async function cancelCampaignAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ status: string }>> {
  return changeState(raw, csrfToken, cancelCampaign);
}

type StateChange = (
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
) => Promise<{ ok: true; value: { status: string } } | { ok: false; error: { id: string } }>;

async function changeState(
  raw: unknown,
  csrfToken: string | null,
  change: StateChange,
): Promise<ActionResult<{ status: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await change(db, actor, parsed.data.id, AbortSignal.timeout(15_000));
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: result.value };
}
