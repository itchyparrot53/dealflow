import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import type { ContactActor } from "@/features/contacts/personsRepo";
import type { PermSetUser } from "@/features/permissions/effective";
import type { EntityCreateSession } from "@/features/permissions/entityCreate";

// Shared API helpers: the two actor shapes the existing services expect, and the few
// serializers the contract pins (money as decimal strings, timestamps as ISO 8601 UTC).

async function primaryGroup(db: Db, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ groupId: users.primaryVisibilityGroupId })
    .from(users)
    .where(eq(users.id, userId));
  return row?.groupId ?? null;
}

// createDeal expects the creation trust boundary shape, so the token's user is widened to it here
// (the same fields createContext derives for a signed-in request).
export async function createSession(db: Db, actor: PermSetUser): Promise<EntityCreateSession> {
  return {
    userId: actor.id,
    isAdmin: actor.type === "admin",
    isActive: actor.isActive,
    sessionLive: true,
    visibilityGroupIds: Array.from(actor.groupIds),
    managedUserIds: Array.from(actor.managedUserIds ?? []),
    primaryVisibilityGroupId: await primaryGroup(db, actor.id),
    flags: Object.fromEntries(Array.from(actor.flags).map((flag) => [flag, true])),
  };
}

// The contacts services take a ContactActor: a PermSetUser plus the create-time group default.
export async function contactActor(db: Db, actor: PermSetUser): Promise<ContactActor> {
  return { ...actor, primaryVisibilityGroupId: await primaryGroup(db, actor.id) };
}

export function iso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return new Date(value).toISOString();
  return value.toISOString();
}

// Values cross the API as decimal strings; Postgres numeric comes back as a string already.
export function money(value: string | null): string | null {
  return value;
}

export function day(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}
