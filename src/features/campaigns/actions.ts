"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";
import { saveCampaignAsset, type CampaignAssetView } from "./assets";

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
