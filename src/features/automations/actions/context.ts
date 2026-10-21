import { eq } from "drizzle-orm";
import { deals, organizations, persons, users } from "@/db/schema";
import type { VarContext } from "@/features/documents/variables";
import type { DbOrTx } from "@/server/realtime/channelVersions";

// The deal context automation text fields render against. Keys match Part 4's variable vocabulary,
// so {{person.name}} in an automation subject and in a template mean the same thing.

export interface DealContextRow {
  id: string;
  title: string;
  value: string | null;
  ownerId: string;
  personId: string | null;
  orgId: string | null;
  updatedAt: Date;
}

export async function loadDealRow(
  db: DbOrTx,
  dealId: string,
  signal: AbortSignal,
): Promise<DealContextRow | null> {
  signal.throwIfAborted();
  const [row] = await db
    .select({
      id: deals.id,
      title: deals.title,
      value: deals.value,
      ownerId: deals.ownerId,
      personId: deals.personId,
      orgId: deals.orgId,
      updatedAt: deals.updatedAt,
    })
    .from(deals)
    .where(eq(deals.id, dealId));
  return row ?? null;
}

export async function loadVariableContext(
  db: DbOrTx,
  dealId: string,
  signal: AbortSignal,
): Promise<VarContext> {
  const deal = await loadDealRow(db, dealId, signal);
  if (deal === null) return {};

  const [owner] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, deal.ownerId));
  const [person] =
    deal.personId === null
      ? []
      : await db
          .select({ name: persons.name, firstName: persons.firstName })
          .from(persons)
          .where(eq(persons.id, deal.personId));
  const [org] =
    deal.orgId === null
      ? []
      : await db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, deal.orgId));

  return {
    "deal.title": deal.title,
    "deal.value": deal.value ?? "",
    "person.name": person?.name ?? "",
    "person.first_name": person?.firstName ?? "",
    "organization.name": org?.name ?? "",
    "owner.name": owner?.name ?? "",
    "owner.email": owner?.email ?? "",
  };
}

// For record events that have no deal (person.created, organization.created), text fields still
// get the record's own name.
export async function loadEntityVariables(
  db: DbOrTx,
  entityType: string,
  entityId: string,
  signal: AbortSignal,
): Promise<VarContext> {
  signal.throwIfAborted();
  if (entityType === "organization") {
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, entityId));
    return { "organization.name": org?.name ?? "" };
  }
  if (entityType === "person") {
    const [person] = await db
      .select({ name: persons.name, firstName: persons.firstName })
      .from(persons)
      .where(eq(persons.id, entityId));
    return { "person.name": person?.name ?? "", "person.first_name": person?.firstName ?? "" };
  }
  return {};
}
