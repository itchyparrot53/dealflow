import { eq } from "drizzle-orm";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { SENDER_TOKEN_TTL_HOURS } from "@/constants/marketing";
import type { Db } from "@/db/client";
import { campaignSenders } from "@/db/schema";
import { sendSystemEmail } from "@/features/email-design/sendSystemEmail";
import {
  consumeMarketingToken,
  createMarketingToken,
  deleteMarketingToken,
} from "@/features/marketing/tokens";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";

// 6.9's senders. A sender is Pending until the address clicks its 48 hour verification link; an
// unverified sender cannot send (the checklist and the send path both refuse it).

export interface SenderView {
  id: string;
  fromName: string;
  fromEmail: string;
  verified: boolean;
  isDefault: boolean;
  createdAt: string;
}

export async function listSenders(db: Db, signal: AbortSignal): Promise<SenderView[]> {
  const rows = await db.select().from(campaignSenders).orderBy(campaignSenders.createdAt);
  signal.throwIfAborted();
  return rows.map((row) => ({
    id: row.id,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    verified: row.verifiedAt !== null,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
  }));
}

export interface AddSenderResult {
  id: string;
  verificationSent: boolean;
}

export async function addSender(
  db: Db,
  actor: PermSetUser,
  input: { fromName: string; fromEmail: string },
  signal: AbortSignal,
): Promise<Result<AddSenderResult, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "marketing.manage")) {
    return err(
      new AppError(ERROR_IDS.PERM_DENIED, "marketing.manage required", { userId: actor.id }),
    );
  }
  const fromName = input.fromName.trim();
  const fromEmail = input.fromEmail.trim().toLowerCase();
  if (fromName === "" || fromName.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail)) {
    return err(
      new AppError(ERROR_IDS.CAMPAIGN_INPUT_INVALID, "sender name or email is invalid", {}),
    );
  }
  const [existing] = await db
    .select({ id: campaignSenders.id })
    .from(campaignSenders)
    .where(eq(campaignSenders.fromEmail, fromEmail))
    .limit(1);
  if (existing !== undefined) {
    return err(
      new AppError(ERROR_IDS.CAMPAIGN_INPUT_INVALID, "that sender address already exists", {
        fromEmail,
      }),
    );
  }

  const [row] = await db
    .insert(campaignSenders)
    .values({ fromName, fromEmail, createdBy: actor.id })
    .returning({ id: campaignSenders.id });
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.DB_INSERT_FAILED, "sender insert returned no row"));
  }

  const minted = await createMarketingToken(
    db,
    {
      purpose: "sender",
      senderId: row.id,
      expiresAt: new Date(Date.now() + SENDER_TOKEN_TTL_HOURS * 60 * 60 * 1000),
    },
    signal,
  );
  const sent = await sendSystemEmail(
    db,
    "campaign_sender_verification",
    fromEmail,
    {
      "sender.name": fromName,
      "sender.email": fromEmail,
      "company.name": fromName,
      verify_url: `${env.BASE_URL.replace(/\/$/, "")}/campaign-verify/${minted.token}`,
    },
    signal,
  );
  if (!sent.ok) {
    // The row stays Pending and can be re-verified later; a failed email must not lose the sender.
    await deleteMarketingToken(db, minted.tokenHash, signal).catch(() => undefined);
    return ok({ id: row.id, verificationSent: false });
  }
  return ok({ id: row.id, verificationSent: true });
}

export async function verifySenderToken(
  db: Db,
  token: string,
  signal: AbortSignal,
): Promise<Result<{ senderId: string }, AppError>> {
  signal.throwIfAborted();
  const consumed = await consumeMarketingToken(db, token, new Date(), signal);
  if (consumed === null || consumed.purpose !== "sender" || consumed.senderId === null) {
    return err(
      new AppError(
        ERROR_IDS.MARKETING_TOKEN_INVALID,
        "verification link expired or already used",
        {},
      ),
    );
  }
  const [row] = await db
    .update(campaignSenders)
    .set({ verifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(campaignSenders.id, consumed.senderId))
    .returning({ id: campaignSenders.id });
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "sender not found", {}));
  }
  return ok({ senderId: row.id });
}

export async function setDefaultSender(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "marketing.manage")) {
    return err(
      new AppError(ERROR_IDS.PERM_DENIED, "marketing.manage required", { userId: actor.id }),
    );
  }
  const [target] = await db
    .select({ id: campaignSenders.id, verifiedAt: campaignSenders.verifiedAt })
    .from(campaignSenders)
    .where(eq(campaignSenders.id, id))
    .limit(1);
  if (target === undefined || target.verifiedAt === null) {
    return err(
      new AppError(ERROR_IDS.CAMPAIGN_SENDER_UNVERIFIED, "sender is not verified", { id }),
    );
  }
  return db.transaction(async (tx) => {
    await tx
      .update(campaignSenders)
      .set({ isDefault: false })
      .where(eq(campaignSenders.isDefault, true));
    await tx
      .update(campaignSenders)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(campaignSenders.id, id));
    return ok(undefined);
  });
}
