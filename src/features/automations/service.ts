import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { automations } from "@/db/schema";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";
import { automationDefinitionSchema } from "./definition";

// Automation CRUD. Every mutation is admin-only through the `automations.manage` capability;
// reads stay open to signed-in users because the list and editor are gated at the page.

export type Automation = typeof automations.$inferSelect;

const nameSchema = z.string().trim().min(1).max(120);

export const automationInputSchema = z.object({
  name: nameSchema,
  description: z.string().max(2000).nullable().optional(),
  definition: automationDefinitionSchema,
  enabled: z.boolean().optional(),
});

export const automationPatchSchema = z.object({
  name: nameSchema.optional(),
  description: z.string().max(2000).nullable().optional(),
  definition: automationDefinitionSchema.optional(),
  enabled: z.boolean().optional(),
});

function denied(actor: PermSetUser): AppError {
  return new AppError(ERROR_IDS.PERM_DENIED, "automations.manage required", { userId: actor.id });
}

function invalid(issues: unknown): AppError {
  return new AppError(ERROR_IDS.AUTOMATION_INPUT_INVALID, "automation input invalid", { issues });
}

function notFound(id: string): AppError {
  return new AppError(ERROR_IDS.AUTOMATION_NOT_FOUND, "Automation not found", { automationId: id });
}

export function canManageAutomations(actor: PermSetUser): boolean {
  return can(actor, "automations.manage");
}

export async function listAutomations(db: DbOrTx, signal: AbortSignal): Promise<Automation[]> {
  signal.throwIfAborted();
  return db.select().from(automations).orderBy(desc(automations.updatedAt));
}

export async function getAutomation(
  db: DbOrTx,
  id: string,
  signal: AbortSignal,
): Promise<Automation | null> {
  signal.throwIfAborted();
  const [row] = await db.select().from(automations).where(eq(automations.id, id));
  return row ?? null;
}

export async function createAutomation(
  db: DbOrTx,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<Automation, AppError>> {
  if (!canManageAutomations(actor)) return err(denied(actor));
  const parsed = automationInputSchema.safeParse(raw);
  if (!parsed.success) return err(invalid(parsed.error.issues));
  signal.throwIfAborted();

  const [row] = await db
    .insert(automations)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      definition: parsed.data.definition,
      enabled: parsed.data.enabled ?? false,
      createdBy: actor.id,
    })
    .returning();
  if (row === undefined) {
    return err(
      new AppError(ERROR_IDS.AUTOMATION_NOT_FOUND, "Automation insert returned no row", {}),
    );
  }
  return ok(row);
}

export async function updateAutomation(
  db: DbOrTx,
  actor: PermSetUser,
  id: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<Automation, AppError>> {
  if (!canManageAutomations(actor)) return err(denied(actor));
  const parsed = automationPatchSchema.safeParse(raw);
  if (!parsed.success) return err(invalid(parsed.error.issues));
  signal.throwIfAborted();

  const [row] = await db
    .update(automations)
    .set({
      ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }),
      ...(parsed.data.description === undefined ? {} : { description: parsed.data.description }),
      ...(parsed.data.definition === undefined ? {} : { definition: parsed.data.definition }),
      ...(parsed.data.enabled === undefined ? {} : { enabled: parsed.data.enabled }),
      updatedAt: new Date(),
    })
    .where(eq(automations.id, id))
    .returning();
  if (row === undefined) return err(notFound(id));
  return ok(row);
}

export async function setAutomationEnabled(
  db: DbOrTx,
  actor: PermSetUser,
  id: string,
  enabled: boolean,
  signal: AbortSignal,
): Promise<Result<Automation, AppError>> {
  return updateAutomation(db, actor, id, { enabled }, signal);
}

export async function deleteAutomation(
  db: DbOrTx,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  if (!canManageAutomations(actor)) return err(denied(actor));
  signal.throwIfAborted();
  const [row] = await db.delete(automations).where(eq(automations.id, id)).returning({
    id: automations.id,
  });
  if (row === undefined) return err(notFound(id));
  return ok(undefined);
}

export async function duplicateAutomation(
  db: DbOrTx,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<Automation, AppError>> {
  if (!canManageAutomations(actor)) return err(denied(actor));
  const source = await getAutomation(db, id, signal);
  if (source === null) return err(notFound(id));
  return createAutomation(
    db,
    actor,
    {
      name: `${source.name} (copy)`.slice(0, 120),
      description: source.description,
      definition: source.definition,
      enabled: false,
    },
    signal,
  );
}
