import { eq } from "drizzle-orm";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { campaignSettings } from "@/db/schema";
import { bounceMailboxConfigured } from "@/features/campaigns/bounces/config";
import { recordAudit } from "@/features/identity/audit";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";

// Settings > Campaigns backing store (6.9). One seeded singleton; reads fall back to the 6.9
// defaults so a fresh install behaves without a write.

export const DEFAULT_CONSENT_LABEL =
  "I'd like to receive news and offers by email. I can unsubscribe at any time.";

export type TransportMode = "marketing" | "system" | "log";

export interface CampaignSettingsView {
  postalAddress: string;
  requireDoubleOptIn: boolean;
  consentLabel: string;
  sendRatePerMinute: number;
  maxRatePerMinute: number;
  transport: TransportMode;
  transportHost: string | null;
  // Read-only observability for 6.9's bounce mailbox section. Credentials never enter this view.
  bounceMailbox: {
    configured: boolean;
    lastRunAt: string | null;
    lastProcessed: number | null;
  };
}

export function transportMode(): TransportMode {
  if (env.MARKETING_SMTP_HOST !== "") return "marketing";
  return env.SMTP_HOST !== "" ? "system" : "log";
}

function transportHostLabel(): string | null {
  const host = env.MARKETING_SMTP_HOST !== "" ? env.MARKETING_SMTP_HOST : env.SMTP_HOST;
  if (host === "") return null;
  // Never return credentials; only the host, masked enough to be useful.
  return host;
}

export async function getCampaignSettings(
  db: Db,
  signal: AbortSignal,
): Promise<CampaignSettingsView> {
  const [row] = await db.select().from(campaignSettings).where(eq(campaignSettings.id, 1)).limit(1);
  signal.throwIfAborted();
  return {
    postalAddress: row?.postalAddress ?? "",
    requireDoubleOptIn: row?.requireDoubleOptIn ?? true,
    consentLabel: row?.consentLabel ?? DEFAULT_CONSENT_LABEL,
    sendRatePerMinute: row?.sendRatePerMinute ?? env.CAMPAIGN_SEND_RATE_PER_MINUTE,
    maxRatePerMinute: env.CAMPAIGN_SEND_RATE_PER_MINUTE,
    transport: transportMode(),
    transportHost: transportHostLabel(),
    bounceMailbox: {
      configured: bounceMailboxConfigured(),
      lastRunAt: row?.bounceLastRunAt?.toISOString() ?? null,
      lastProcessed: row?.bounceLastProcessed ?? null,
    },
  };
}

export interface SaveCampaignSettingsInput {
  postalAddress: string | null;
  requireDoubleOptIn: boolean;
  consentLabel: string | null;
  sendRatePerMinute: number;
}

export async function saveCampaignSettings(
  db: Db,
  actor: PermSetUser,
  input: SaveCampaignSettingsInput,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "marketing.manage")) {
    return err(
      new AppError(ERROR_IDS.PERM_DENIED, "marketing.manage required", { userId: actor.id }),
    );
  }
  const rate = Math.floor(input.sendRatePerMinute);
  if (!Number.isFinite(rate) || rate < 1 || rate > env.CAMPAIGN_SEND_RATE_PER_MINUTE) {
    return err(
      new AppError(ERROR_IDS.CAMPAIGN_INPUT_INVALID, "send rate is outside the allowed range", {
        rate,
        max: env.CAMPAIGN_SEND_RATE_PER_MINUTE,
      }),
    );
  }
  const address = input.postalAddress?.trim() ?? "";
  if (address.length > 1000) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_INPUT_INVALID, "postal address is too long", {}));
  }
  const [before] = await db
    .select()
    .from(campaignSettings)
    .where(eq(campaignSettings.id, 1))
    .limit(1);
  await db
    .insert(campaignSettings)
    .values({
      id: 1,
      postalAddress: address === "" ? null : address,
      requireDoubleOptIn: input.requireDoubleOptIn,
      consentLabel: input.consentLabel?.trim() ?? null,
      sendRatePerMinute: rate,
      updatedBy: actor.id,
    })
    .onConflictDoUpdate({
      target: campaignSettings.id,
      set: {
        postalAddress: address === "" ? null : address,
        requireDoubleOptIn: input.requireDoubleOptIn,
        consentLabel: input.consentLabel?.trim() ?? null,
        sendRatePerMinute: rate,
        updatedBy: actor.id,
        updatedAt: new Date(),
      },
    });
  await recordAudit(
    db,
    {
      actorId: actor.id,
      targetType: "settings",
      targetId: null,
      action: "campaign_settings.updated",
      before:
        before === undefined
          ? null
          : {
              postalAddress: before.postalAddress,
              requireDoubleOptIn: before.requireDoubleOptIn,
              consentLabel: before.consentLabel,
              sendRatePerMinute: before.sendRatePerMinute,
            },
      after: {
        postalAddress: address === "" ? null : address,
        requireDoubleOptIn: input.requireDoubleOptIn,
        consentLabel: input.consentLabel?.trim() ?? null,
        sendRatePerMinute: rate,
      },
    },
    signal,
  );
  return ok(undefined);
}
