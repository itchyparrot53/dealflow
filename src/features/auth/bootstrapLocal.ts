import { eq, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { settings, users, visibilityGroupMembers } from "@/db/schema";
import { ok, type Result } from "@/types/result";
import { BOOTSTRAP_LOCK_KEY } from "./bootstrap";
import { ensureSeedData } from "./seed";

// First-admin bootstrap for local sign-in. Mirrors the Google first-run election (same advisory
// lock, same seed data) but starts from an email the owner typed, with no Google identity.
//
// The recovery path (`pnpm auth:bootstrap-link`) passes allowAfterBootstrap: true: shell access to
// the box is the proof of ownership, and without it a lost admin would need a database edit.
export async function ensureBootstrapAdmin(
  db: Db,
  email: string,
  seedAdminEmail: string,
  opts: { allowAfterBootstrap: boolean },
  signal: AbortSignal,
): Promise<Result<{ userId: string } | null, AppError>> {
  const normalized = email.trim().toLowerCase();
  const seed = seedAdminEmail.trim().toLowerCase();
  if (seed === "" || normalized !== seed) return ok(null);
  signal.throwIfAborted();

  const userId = await db.transaction(async (tx): Promise<string | null> => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`);
    signal.throwIfAborted();

    const [s] = await tx
      .select({ bootstrappedAt: settings.bootstrappedAt })
      .from(settings)
      .limit(1);
    const bootstrapOpen = s === undefined || s.bootstrappedAt === null;

    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);
    if (existing !== undefined) {
      // Bootstrap still open and the seed address already exists (for example from an earlier
      // partial run): promote it, close bootstrap, and leave everything else alone.
      if (!bootstrapOpen) return existing.id;
      const handles = await ensureSeedData(tx, signal);
      await tx
        .update(users)
        .set({ isAdmin: true, permissionSetId: handles.adminSetId })
        .where(eq(users.id, existing.id));
      await tx.update(settings).set({ bootstrappedAt: new Date() }).where(eq(settings.id, true));
      return existing.id;
    }

    if (!bootstrapOpen && !opts.allowAfterBootstrap) return null;

    const handles = await ensureSeedData(tx, signal);
    const [created] = await tx
      .insert(users)
      .values({
        email: normalized,
        name: normalized.split("@")[0] ?? normalized,
        isAdmin: true,
        permissionSetId: handles.adminSetId,
        primaryVisibilityGroupId: handles.everyoneGroupId,
      })
      .returning({ id: users.id });
    if (created === undefined) {
      throw new AppError(ERROR_IDS.DB_INVARIANT, "bootstrap user insert failed");
    }
    await tx
      .insert(visibilityGroupMembers)
      .values({ groupId: handles.everyoneGroupId, userId: created.id })
      .onConflictDoNothing();
    if (bootstrapOpen) {
      await tx.update(settings).set({ bootstrappedAt: new Date() }).where(eq(settings.id, true));
    }
    return created.id;
  });

  signal.throwIfAborted();
  return ok(userId === null ? null : { userId });
}
