import { eq } from "drizzle-orm";
import { env } from "@/config/env";
import type { Db } from "@/db/client";
import { campaignRecipients, campaigns, organizations, persons, users } from "@/db/schema";
import { getEmailDesign } from "@/features/email-design/design";
import { findMarketingTokenByValue } from "@/features/marketing/tokens";
import { loadCampaignAssetUrls } from "../assets";
import { campaignMergeValues } from "../blocks/personalize";
import { renderCampaign } from "../blocks/render";
import type { CampaignDocument } from "../blocks/schema";
import { getCampaignSettings } from "../settings";

// 6.8's "view in browser" page: the campaign as that recipient received it, with every link left
// untracked. The token is the only credential; the page never records an open or mutates consent.

export interface CampaignWebVersion {
  html: string;
  campaignName: string;
  companyName: string;
}

export async function loadCampaignWebVersion(
  db: Db,
  token: string,
  signal: AbortSignal,
): Promise<CampaignWebVersion | null> {
  const tokenRow = await findMarketingTokenByValue(db, token, signal);
  if (tokenRow === null || tokenRow.campaignRecipientId === null) return null;

  const [recipient] = await db
    .select({
      personId: campaignRecipients.personId,
      email: campaignRecipients.email,
      campaignName: campaigns.name,
      content: campaigns.content,
      preheader: campaigns.preheader,
    })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
    .where(eq(campaignRecipients.id, tokenRow.campaignRecipientId))
    .limit(1);
  if (recipient === undefined || recipient.content === null) return null;

  const [person] =
    recipient.personId === null
      ? []
      : await db.select().from(persons).where(eq(persons.id, recipient.personId)).limit(1);
  const orgId = person?.orgId ?? null;
  const [org] =
    orgId === null
      ? []
      : await db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .limit(1);
  const ownerId = person?.ownerId ?? null;
  const [owner] =
    ownerId === null
      ? []
      : await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, ownerId))
          .limit(1);
  const design = await getEmailDesign(db, signal);
  const settings = await getCampaignSettings(db, signal);
  const assetUrls = await loadCampaignAssetUrls(db, signal);
  const base = env.BASE_URL.replace(/\/$/, "");

  const rendered = renderCampaign(recipient.content as CampaignDocument, {
    design,
    values: campaignMergeValues({
      person: {
        firstName: person?.firstName ?? null,
        lastName: person?.lastName ?? null,
        name: person?.name ?? "",
        email: person?.primaryEmail ?? recipient.email,
      },
      organization: org === undefined ? null : { name: org.name },
      owner: owner === undefined ? null : { name: owner.name, email: owner.email },
      companyName: design.displayName,
      unsubscribeUrl: `${base}/u/${token}`,
      webVersionUrl: `${base}/v/${token}`,
    }),
    postalAddress: settings.postalAddress,
    preheader: recipient.preheader ?? undefined,
    baseUrl: env.BASE_URL,
    assetUrl: (assetId) => assetUrls.get(assetId) ?? null,
  });

  return {
    html: rendered.html,
    campaignName: recipient.campaignName,
    companyName: design.displayName,
  };
}
