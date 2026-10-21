import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import type { PermSetUser } from "@/features/permissions/effective";
import type { EntityCreateSession } from "@/features/permissions/entityCreate";

// Build the create-session shape createLead and createDeal expect from the actor a background
// service already hydrated. Empty flags never widen access: the create services read deal.create
// and the pipeline gate from them, and the session names the actor it was built for.
export async function loadEntityCreateSession(
  db: Db,
  actor: PermSetUser,
  signal: AbortSignal,
): Promise<EntityCreateSession> {
  signal.throwIfAborted();
  const flags: Record<string, boolean> = {};
  for (const flag of actor.flags) flags[flag] = true;
  const [row] = await db
    .select({ primaryGroup: users.primaryVisibilityGroupId })
    .from(users)
    .where(eq(users.id, actor.id));
  signal.throwIfAborted();
  return {
    userId: actor.id,
    isAdmin: actor.type === "admin",
    isActive: actor.isActive,
    sessionLive: true,
    visibilityGroupIds: Array.from(actor.groupIds),
    managedUserIds: Array.from(actor.managedUserIds ?? []),
    primaryVisibilityGroupId: row?.primaryGroup ?? null,
    flags,
  };
}
