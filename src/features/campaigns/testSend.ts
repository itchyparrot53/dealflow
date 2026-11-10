import { and, eq, inArray, isNull } from "drizzle-orm";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { campaignAssets, campaignSettings, organizations, persons, users } from "@/db/schema";
import { getEmailDesign } from "@/features/email-design/design";
import { stripHeaderBreaks } from "@/features/email-design/variables";
import type { SystemMail } from "@/features/mailer/types";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import { type CampaignMime, campaignAssetUrl } from "./assets";
import { campaignMergeValues } from "./blocks/personalize";
import { renderCampaign } from "./blocks/render";
import type { CampaignDocument } from "./blocks/schema";
import { loadVerifiedCampaignSender } from "./send/batch";
import { sendCampaignMail } from "./send/transport";

// "Send test" (2.4): at most five recipients, every one an active user of this install, rendered
// with a chosen person's merge values and tagged so nobody mistakes it for a real campaign.

export const CAMPAIGN_TEST_MAX_RECIPIENTS = 5;

export interface SendCampaignTestInput {
  document: CampaignDocument;
  subject: string;
  preheader?: string;
  personId: string;
  recipients: string[];
  senderId?: string | null;
}

async function validateTestRecipients(db: Db, raw: string[]): Promise<Result<string[], AppError>> {
  const recipients = [...new Set(raw.map((email) => email.trim().toLowerCase()))].filter(
    (email) => email !== "",
  );
  if (recipients.length === 0 || recipients.length > CAMPAIGN_TEST_MAX_RECIPIENTS) {
    return err(
      new AppError(ERROR_IDS.CAMPAIGN_INPUT_INVALID, "choose one to five test recipients", {
        count: recipients.length,
      }),
    );
  }
  const allowed = await db
    .select({ email: users.email })
    .from(users)
    .where(and(inArray(users.email, recipients), eq(users.isActive, true)));
  const allowedEmails = new Set(allowed.map((row) => row.email.toLowerCase()));
  if (recipients.some((email) => !allowedEmails.has(email))) {
    return err(
      new AppError(
        ERROR_IDS.CAMPAIGN_INPUT_INVALID,
        "test recipients must be users of this install",
        {},
      ),
    );
  }
  return ok(recipients);
}

async function testSenderFrom(
  db: Db,
  senderId: string | null | undefined,
  signal: AbortSignal,
): Promise<string | null> {
  if (typeof senderId !== "string" || senderId === "") return env.SMTP_FROM;
  const sender = await loadVerifiedCampaignSender(db, senderId, signal);
  return sender === null ? null : `"${sender.fromName}" <${sender.fromEmail}>`;
}

export async function sendCampaignTest(
  db: Db,
  actor: PermSetUser,
  input: SendCampaignTestInput,
  signal: AbortSignal,
  send: typeof sendCampaignMail = sendCampaignMail,
): Promise<Result<{ sent: number }, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "campaigns.edit")) {
    return err(
      new AppError(ERROR_IDS.PERM_DENIED, "campaigns.edit required", { userId: actor.id }),
    );
  }
  const validated = await validateTestRecipients(db, input.recipients);
  if (!validated.ok) return err(validated.error);
  signal.throwIfAborted();
  const recipients = validated.value;

  const [person] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.id, input.personId), isNull(persons.deletedAt)))
    .limit(1);
  if (person === undefined) {
    return err(new AppError(ERROR_IDS.CONTACT_NOT_FOUND, "sample person not found", {}));
  }
  const [org] =
    person.orgId === null
      ? []
      : await db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, person.orgId))
          .limit(1);
  const [owner] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, person.ownerId))
    .limit(1);

  const from = await testSenderFrom(db, input.senderId, signal);
  if (from === null) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_SENDER_UNVERIFIED, "sender is not verified", {}));
  }
  const design = await getEmailDesign(db, signal);
  const [settings] = await db
    .select({ postalAddress: campaignSettings.postalAddress })
    .from(campaignSettings)
    .where(eq(campaignSettings.id, 1))
    .limit(1);
  const assets = await db
    .select({ id: campaignAssets.id, mime: campaignAssets.mime })
    .from(campaignAssets);
  const assetUrls = new Map(
    assets.map((asset) => [
      asset.id,
      new URL(campaignAssetUrl(asset.id, asset.mime as CampaignMime), env.BASE_URL).toString(),
    ]),
  );

  const values = campaignMergeValues({
    person: {
      firstName: person.firstName,
      lastName: person.lastName,
      name: person.name,
      email: person.primaryEmail,
    },
    organization: org === undefined ? null : { name: org.name },
    owner: owner === undefined ? null : owner,
    companyName: design.displayName,
    unsubscribeUrl: `${env.BASE_URL.replace(/\/$/, "")}/u/test`,
    webVersionUrl: `${env.BASE_URL.replace(/\/$/, "")}/v/test`,
  });

  const rendered = renderCampaign(input.document, {
    design,
    values,
    postalAddress: settings?.postalAddress ?? design.addressLines.join("\n"),
    baseUrl: env.BASE_URL,
    assetUrl: (assetId) => assetUrls.get(assetId) ?? null,
    preheader: input.preheader,
  });
  if (rendered.overLimit) {
    return err(
      new AppError(ERROR_IDS.CAMPAIGN_TOO_LARGE, "test email is over 100 KB", {
        bytes: rendered.bytes,
      }),
    );
  }

  const subject = `[Test] ${stripHeaderBreaks(input.subject, 200)}`;
  let sent = 0;
  for (const to of recipients) {
    const mail: SystemMail = {
      to,
      from,
      subject,
      html: rendered.html,
      text: rendered.text,
      headers: { "X-Dealflow-Test": "1" },
    };
    const result = await send(mail, signal);
    if (result.ok) sent += 1;
  }
  if (sent === 0) {
    return err(new AppError(ERROR_IDS.MAIL_SEND_FAILED, "test send failed", {}));
  }
  return ok({ sent });
}
