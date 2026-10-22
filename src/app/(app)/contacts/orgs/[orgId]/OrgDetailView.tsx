import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import type React from "react";
import { users } from "@/db/schema";
import { toContactActor } from "@/features/contacts/actorAdapters";
import { getContactFollowers } from "@/features/contacts/followers";
import { getOrg } from "@/features/contacts/orgsRepo";
import { listPeopleForOrg } from "@/features/contacts/personOptionsRepo";
import { listDefs } from "@/features/custom-fields/defsRepo";
import { listHiddenBuiltins } from "@/features/custom-fields/hiddenBuiltinsRepo";
import { resolveCustomFieldRefLabels } from "@/features/custom-fields/refLabels";
import { CustomFieldRefLabelsProvider } from "@/features/custom-fields/refLabelsContext";
import { cachedDetailLoad } from "@/features/navigation/cachedDetailLoad";
import { can } from "@/features/permissions/can";
import type { VisiblePersonOrOrg } from "@/features/permissions/types";
import { RememberRecord } from "@/features/pwa/offline/remember";
import { toOrgSnapshot } from "@/features/pwa/offline/snapshots";
import { readBaseCurrency } from "@/features/settings/readBaseCurrency";
import { OrgDetailClient } from "./OrgDetailClient";

// One-line postal address for the offline card. The stored jsonb is a loose map, so only the
// string parts are used and anything missing is simply skipped.
function formatOrgAddress(address: Record<string, unknown> | null): string | null {
  if (address === null) return null;
  const parts = ["street", "city", "region", "postalCode", "country"]
    .map((key) => address[key])
    .filter((value): value is string => typeof value === "string" && value.trim() !== "");
  return parts.length === 0 ? null : parts.join(", ");
}

// Shared org-detail loader. Exported so both the full page ([orgId]/page.tsx) and the intercepted
// slide-over drawer (@modal/(.)[orgId]/page.tsx) render identical content, and generateMetadata can
// reuse the cached load. Mirrors PersonDetailView.
export const loadOrg = cachedDetailLoad((ctx, actor, orgId) =>
  getOrg(ctx.db, toContactActor(actor), orgId, AbortSignal.timeout(10_000)),
);

export async function OrgDetailView({ orgId }: { orgId: string }): Promise<React.ReactNode> {
  const loaded = await loadOrg(orgId);
  if (loaded.kind === "unauth") {
    redirect("/login");
  }
  if (loaded.kind === "notfound") {
    notFound();
  }
  const { ctx, actor, value: org } = loaded;

  // All four reads need only the already-loaded org, so they are issued together.
  const [defs, baseCurrency, { followers, isFollowedBySelf }, hidden, people] = await Promise.all([
    listDefs(ctx.db, "organization", {}, AbortSignal.timeout(10_000)),
    readBaseCurrency(ctx.db, AbortSignal.timeout(8000)),
    getContactFollowers(ctx.db, actor, "organization", org.id, AbortSignal.timeout(10_000)),
    listHiddenBuiltins(ctx.db, AbortSignal.timeout(10_000)),
    // The offline card shows the visible people count; this is the same visibility-scoped read
    // the org's people picker uses, so an invisible person never inflates it.
    listPeopleForOrg(ctx.db, toContactActor(actor), org.id, AbortSignal.timeout(10_000)),
  ]);
  const [owner] = await ctx.db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, org.ownerId));

  const record: VisiblePersonOrOrg = {
    kind: "organization",
    ownerId: org.ownerId,
    visibilityLevel: org.visibilityLevel,
    visibilityGroupId: org.visibilityGroupId,
    visibleToUserIds: org.visibleToUserIds,
  };
  const canMerge = can(actor, "contact.merge", record);
  const canDelete = can(actor, "contact.delete", record);

  const refLabels = await resolveCustomFieldRefLabels(
    ctx.db,
    actor,
    defs,
    [{ customFields: org.customFields as Record<string, unknown> }],
    AbortSignal.timeout(8000),
  );

  return (
    <CustomFieldRefLabelsProvider value={refLabels}>
      <RememberRecord
        userId={actor.id}
        snapshot={toOrgSnapshot({
          id: org.id,
          name: org.name,
          address: formatOrgAddress(org.address),
          peopleCount: people.length,
          ownerName: owner?.name ?? null,
        })}
      />
      <OrgDetailClient
        org={org}
        defs={defs}
        hiddenBuiltins={hidden.organization}
        canMerge={canMerge}
        canDelete={canDelete}
        baseCurrency={baseCurrency}
        followers={followers}
        isFollowedBySelf={isFollowedBySelf}
      />
    </CustomFieldRefLabelsProvider>
  );
}
