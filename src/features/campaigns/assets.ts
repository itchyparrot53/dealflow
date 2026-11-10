import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { campaignAssets } from "@/db/schema";
import { imageSize } from "@/features/email-design/imageSize";
import { makeStorageClient, type StorageClient } from "@/features/files/storage";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";

// 6.5: campaign images. At most 1 MB, PNG/JPEG/GIF by magic bytes, stored in MinIO under
// campaign-assets/ and served from the public /email-assets/c route.

export const CAMPAIGN_ASSET_MAX_BYTES = 1024 * 1024;

const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
} as const;

type CampaignMime = keyof typeof EXT_BY_MIME;

export interface CampaignAssetView {
  id: string;
  mime: CampaignMime;
  width: number;
  height: number;
  size: number;
  url: string;
}

export function campaignAssetUrl(id: string, mime: CampaignMime): string {
  return `/email-assets/c/${id}.${EXT_BY_MIME[mime]}`;
}

function assetInvalid(message: string, context?: Record<string, unknown>): AppError {
  return new AppError(ERROR_IDS.CAMPAIGN_ASSET_INVALID, message, context);
}

function view(row: typeof campaignAssets.$inferSelect): CampaignAssetView {
  return {
    id: row.id,
    mime: row.mime as CampaignMime,
    width: row.width ?? 0,
    height: row.height ?? 0,
    size: row.size,
    url: campaignAssetUrl(row.id, row.mime as CampaignMime),
  };
}

export async function saveCampaignAsset(
  db: Db,
  actor: PermSetUser,
  input: { bytes: Buffer },
  signal: AbortSignal,
  storage: StorageClient = makeStorageClient(),
): Promise<Result<CampaignAssetView, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "campaigns.edit")) {
    return err(new AppError(ERROR_IDS.PERM_DENIED, "campaigns.edit required", { userId: actor.id }));
  }
  if (input.bytes.length === 0) return err(assetInvalid("empty file"));
  if (input.bytes.length > CAMPAIGN_ASSET_MAX_BYTES) {
    return err(assetInvalid("image is over 1 MB", { size: input.bytes.length }));
  }
  const info = imageSize(new Uint8Array(input.bytes));
  if (info === null) return err(assetInvalid("not a PNG, JPEG or GIF"));

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const [existing] = await db
    .select()
    .from(campaignAssets)
    .where(eq(campaignAssets.sha256, sha256))
    .limit(1);
  if (existing !== undefined) return ok(view(existing));

  const id = randomUUID();
  const storageKey = `campaign-assets/${id}.${EXT_BY_MIME[info.mime]}`;
  if (storage.putObject === undefined) {
    return err(assetInvalid("storage client cannot write objects"));
  }
  const written = await storage.putObject(storageKey, input.bytes, signal);
  if (!written.ok) return written;

  const [row] = await db
    .insert(campaignAssets)
    .values({
      id,
      sha256,
      mime: info.mime,
      size: input.bytes.length,
      width: info.width,
      height: info.height,
      storageKey,
      createdBy: actor.id,
    })
    .returning();
  signal.throwIfAborted();
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.DB_INSERT_FAILED, "asset insert returned no row"));
  }
  return ok(view(row));
}

export interface CampaignAssetBytes {
  bytes: Buffer;
  mime: CampaignMime;
}

// The public route's read. A missing row, a mismatched extension and a vanished object all return
// null, because the route answers 404 for every one of them (never a 500).
export async function getCampaignAssetBytes(
  db: Db,
  id: string,
  ext: string,
  signal: AbortSignal,
  storage: StorageClient = makeStorageClient(),
): Promise<CampaignAssetBytes | null> {
  signal.throwIfAborted();
  const [row] = await db.select().from(campaignAssets).where(eq(campaignAssets.id, id)).limit(1);
  if (row === undefined) return null;
  const mime = row.mime as CampaignMime;
  if (EXT_BY_MIME[mime] !== ext) return null;
  const fetched = await storage.getObjectBytes(row.storageKey, signal);
  if (!fetched.ok) return null;
  return { bytes: fetched.value, mime };
}
