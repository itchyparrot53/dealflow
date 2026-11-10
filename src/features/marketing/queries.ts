import { and, desc, eq } from "drizzle-orm";
import type { ConsentBasis, ConsentSource, MarketingStatus } from "@/constants/marketing";
import type { Db } from "@/db/client";
import type { Person } from "@/db/schema";
import { campaignEvents, campaigns, consentEvents, personMarketing, users } from "@/db/schema";
import { toContactActor } from "@/features/contacts/actorAdapters";
import { getPerson } from "@/features/contacts/personsRepo";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";

// The read side of the person Marketing section (6.12). Visibility is the person read itself, so a
// contact the actor cannot see returns null and never leaks a consent trail.

export interface ConsentEventView {
  id: string;
  fromStatus: MarketingStatus | null;
  toStatus: MarketingStatus;
  source: ConsentSource;
  basis: ConsentBasis | null;
  actorName: string | null;
  createdAt: string;
  // Only populated for actors with marketing.manage, per 6.2's evidence rule.
  ip: string | null;
  userAgent: string | null;
}

export interface CampaignActivityView {
  campaignId: string;
  name: string;
  campaignType: string;
  eventType: string;
  at: string;
}

export interface PersonMarketingView {
  status: MarketingStatus;
  consentBasis: ConsentBasis | null;
  statusChangedAt: string | null;
  canManage: boolean;
  events: ConsentEventView[];
  lastCampaign: CampaignActivityView | null;
}

export async function getPersonMarketingView(
  db: Db,
  actor: PermSetUser,
  personId: string,
  signal: AbortSignal,
): Promise<PersonMarketingView | null> {
  signal.throwIfAborted();
  const person: Person | null = await getPerson(db, toContactActor(actor), personId, signal).then(
    (result) => (result.ok ? result.value : null),
  );
  if (person === null) return null;

  const canManage = can(actor, "marketing.manage");
  const [row] = await db
    .select()
    .from(personMarketing)
    .where(eq(personMarketing.personId, personId))
    .limit(1);
  const rows = await db
    .select({
      id: consentEvents.id,
      fromStatus: consentEvents.fromStatus,
      toStatus: consentEvents.toStatus,
      source: consentEvents.source,
      basis: consentEvents.basis,
      createdAt: consentEvents.createdAt,
      ip: consentEvents.ip,
      userAgent: consentEvents.userAgent,
      actorName: users.name,
    })
    .from(consentEvents)
    .leftJoin(users, eq(users.id, consentEvents.actorUserId))
    .where(eq(consentEvents.personId, personId))
    .orderBy(desc(consentEvents.createdAt))
    .limit(50);
  signal.throwIfAborted();

  const [last] = await db
    .select({
      campaignId: campaigns.id,
      name: campaigns.name,
      campaignType: campaigns.type,
      eventType: campaignEvents.type,
      at: campaignEvents.createdAt,
    })
    .from(campaignEvents)
    .innerJoin(campaigns, eq(campaigns.id, campaignEvents.campaignId))
    .where(and(eq(campaignEvents.personId, personId)))
    .orderBy(desc(campaignEvents.createdAt))
    .limit(1);
  signal.throwIfAborted();

  return {
    status: row?.status ?? "not_subscribed",
    consentBasis: (row?.consentBasis as ConsentBasis | null) ?? null,
    statusChangedAt: row?.statusChangedAt.toISOString() ?? null,
    canManage,
    events: rows.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      source: event.source as ConsentSource,
      basis: event.basis as ConsentBasis | null,
      actorName: event.actorName,
      createdAt: event.createdAt.toISOString(),
      ip: canManage ? event.ip : null,
      userAgent: canManage ? event.userAgent : null,
    })),
    lastCampaign:
      last === undefined
        ? null
        : {
            campaignId: last.campaignId,
            name: last.name,
            campaignType: last.campaignType,
            eventType: last.eventType,
            at: last.at.toISOString(),
          },
  };
}
