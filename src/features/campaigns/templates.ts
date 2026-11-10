import { desc, eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { campaignTemplates } from "@/db/schema";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import { campaignDocumentSchema } from "./blocks/schema";

// Saved templates (2.4). The starters live in blocks/starters.ts; these are the rows a team keeps.

export interface CampaignTemplateView {
  id: string;
  name: string;
  content: unknown;
  updatedAt: string;
}

function deny(actor: PermSetUser): AppError {
  return new AppError(ERROR_IDS.PERM_DENIED, "campaigns.edit required", { userId: actor.id });
}

export async function listCampaignTemplates(
  db: Db,
  signal: AbortSignal,
): Promise<CampaignTemplateView[]> {
  const rows = await db
    .select({
      id: campaignTemplates.id,
      name: campaignTemplates.name,
      content: campaignTemplates.content,
      updatedAt: campaignTemplates.updatedAt,
    })
    .from(campaignTemplates)
    .orderBy(desc(campaignTemplates.updatedAt));
  signal.throwIfAborted();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    content: row.content,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function saveCampaignTemplate(
  db: Db,
  actor: PermSetUser,
  input: { name: string; content: unknown; id?: string },
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "campaigns.edit")) return err(deny(actor));
  const name = input.name.trim();
  if (name === "" || name.length > 120) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_INPUT_INVALID, "template name is invalid", {}));
  }
  const parsed = campaignDocumentSchema.safeParse(input.content);
  if (!parsed.success) {
    return err(
      new AppError(ERROR_IDS.CAMPAIGN_INPUT_INVALID, "template content is not a block document", {
        issues: parsed.error.issues.length,
      }),
    );
  }

  if (input.id !== undefined) {
    const [row] = await db
      .update(campaignTemplates)
      .set({ name, content: parsed.data, updatedAt: new Date() })
      .where(eq(campaignTemplates.id, input.id))
      .returning({ id: campaignTemplates.id });
    if (row === undefined) {
      return err(
        new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "template not found", { id: input.id }),
      );
    }
    return ok({ id: row.id });
  }

  const [row] = await db
    .insert(campaignTemplates)
    .values({ name, content: parsed.data, createdBy: actor.id })
    .returning({ id: campaignTemplates.id });
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.DB_INSERT_FAILED, "template insert returned no row"));
  }
  return ok({ id: row.id });
}

export async function deleteCampaignTemplate(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "campaigns.edit")) return err(deny(actor));
  const [row] = await db
    .delete(campaignTemplates)
    .where(eq(campaignTemplates.id, id))
    .returning({ id: campaignTemplates.id });
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "template not found", { id }));
  }
  return ok(undefined);
}

export async function duplicateCampaignTemplate(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "campaigns.edit")) return err(deny(actor));
  const [source] = await db
    .select({ name: campaignTemplates.name, content: campaignTemplates.content })
    .from(campaignTemplates)
    .where(eq(campaignTemplates.id, id))
    .limit(1);
  if (source === undefined) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "template not found", { id }));
  }
  return saveCampaignTemplate(
    db,
    actor,
    { name: `${source.name} copy`.slice(0, 120), content: source.content },
    signal,
  );
}
