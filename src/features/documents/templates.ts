import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { documentTemplates } from "@/db/schema";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";
import type { DocKind } from "./transitions";

// Quote and invoice templates. A kind with no template gets the shipped default
// on first list, so creating a document never blocks on configuration.

export interface DocumentTemplateView {
  id: string;
  kind: DocKind;
  name: string;
  body: string;
  terms: string | null;
  includeProducts: boolean;
  isDefault: boolean;
  updatedAt: string;
}

const DEFAULT_TEMPLATES: Record<DocKind, { name: string; body: string; terms: string }> = {
  quote: {
    name: "Standard quote",
    body: [
      "# Quote {{document.number}} for {{organization.name}}",
      "Prepared for {{person.name}} by {{owner.name}}, {{company.name}}.",
      "## Summary",
      "{{deal.title}}",
      "{{products}}",
    ].join("\n"),
    terms: "This quote is valid until {{document.valid_until}}.",
  },
  invoice: {
    name: "Standard invoice",
    body: [
      "# Invoice {{document.number}}",
      "Billed to {{person.name}}, {{organization.name}}.",
      "{{products}}",
    ].join("\n"),
    terms: "Payment is due by {{document.due_date}}.",
  },
};

const templateInput = z.object({
  kind: z.enum(["quote", "invoice"]),
  name: z.string().trim().min(1).max(120),
  body: z.string().min(1).max(20000),
  terms: z
    .string()
    .max(5000)
    .nullable()
    .transform((value) => (value === "" ? null : value)),
  includeProducts: z.boolean(),
});

const templateUpdateInput = templateInput.omit({ kind: true }).extend({ id: z.string().uuid() });

function toView(row: typeof documentTemplates.$inferSelect): DocumentTemplateView {
  return {
    id: row.id,
    kind: row.kind as DocKind,
    name: row.name,
    body: row.body,
    terms: row.terms,
    includeProducts: row.includeProducts,
    isDefault: row.isDefault,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function deny(actor: PermSetUser): AppError {
  return new AppError(ERROR_IDS.PERM_DENIED, "documents.manage required", { userId: actor.id });
}

function notFound(id: string): AppError {
  return new AppError(ERROR_IDS.DOC_TEMPLATE_NOT_FOUND, "Template not found", { templateId: id });
}

function invalid(): AppError {
  return new AppError(ERROR_IDS.DOC_INPUT_INVALID, "template input failed");
}

async function ensureDefaultTemplate(
  db: DbOrTx,
  kind: DocKind,
  signal: AbortSignal,
): Promise<void> {
  const [existing] = await db
    .select({ id: documentTemplates.id })
    .from(documentTemplates)
    .where(eq(documentTemplates.kind, kind))
    .limit(1);
  if (existing !== undefined) return;
  const def = DEFAULT_TEMPLATES[kind];
  // Another first-time caller may insert first; the partial unique index then
  // makes this a no-op instead of a failure.
  await db
    .insert(documentTemplates)
    .values({ kind, name: def.name, body: def.body, terms: def.terms, isDefault: true })
    .onConflictDoNothing();
  signal.throwIfAborted();
}

export async function listTemplates(
  db: Db,
  kind: DocKind,
  signal: AbortSignal,
): Promise<DocumentTemplateView[]> {
  signal.throwIfAborted();
  await ensureDefaultTemplate(db, kind, signal);
  const rows = await db
    .select()
    .from(documentTemplates)
    .where(eq(documentTemplates.kind, kind))
    .orderBy(desc(documentTemplates.isDefault), asc(documentTemplates.name));
  signal.throwIfAborted();
  return rows.map(toView);
}

export async function createTemplate(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<DocumentTemplateView, AppError>> {
  if (!can(actor, "documents.manage")) return err(deny(actor));
  const parsed = templateInput.safeParse(raw);
  if (!parsed.success) return err(invalid());
  signal.throwIfAborted();

  const [existing] = await db
    .select({ id: documentTemplates.id })
    .from(documentTemplates)
    .where(eq(documentTemplates.kind, parsed.data.kind))
    .limit(1);
  const [row] = await db
    .insert(documentTemplates)
    .values({
      ...parsed.data,
      // The first template of a kind becomes its default, so one always exists.
      isDefault: existing === undefined,
      createdBy: actor.id,
    })
    .returning();
  if (row === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "createTemplate: insert returned no rows");
  }
  return ok(toView(row));
}

export async function updateTemplate(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<DocumentTemplateView, AppError>> {
  if (!can(actor, "documents.manage")) return err(deny(actor));
  const parsed = templateUpdateInput.safeParse(raw);
  if (!parsed.success) return err(invalid());
  const { id, ...values } = parsed.data;
  signal.throwIfAborted();
  const [row] = await db
    .update(documentTemplates)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(documentTemplates.id, id))
    .returning();
  if (row === undefined) return err(notFound(id));
  return ok(toView(row));
}

export async function deleteTemplate(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  if (!can(actor, "documents.manage")) return err(deny(actor));
  signal.throwIfAborted();

  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(documentTemplates).where(eq(documentTemplates.id, id));
    if (target === undefined) return err(notFound(id));

    const siblings = await tx
      .select({ id: documentTemplates.id })
      .from(documentTemplates)
      .where(eq(documentTemplates.kind, target.kind));
    if (siblings.length <= 1) {
      return err(
        new AppError(ERROR_IDS.DOC_LAST_TEMPLATE, "A kind must keep one template", {
          templateId: id,
        }),
      );
    }

    await tx.delete(documentTemplates).where(eq(documentTemplates.id, id));
    // Deleting the default leaves the kind without one; promote the oldest other.
    if (target.isDefault) {
      const [next] = await tx
        .select({ id: documentTemplates.id })
        .from(documentTemplates)
        .where(eq(documentTemplates.kind, target.kind))
        .orderBy(asc(documentTemplates.createdAt))
        .limit(1);
      if (next !== undefined) {
        await tx
          .update(documentTemplates)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(documentTemplates.id, next.id));
      }
    }
    return ok(undefined);
  });
}

export async function setDefaultTemplate(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<DocumentTemplateView, AppError>> {
  if (!can(actor, "documents.manage")) return err(deny(actor));
  signal.throwIfAborted();

  const result = await db.transaction(async (tx) => {
    const [target] = await tx.select().from(documentTemplates).where(eq(documentTemplates.id, id));
    if (target === undefined) return err(notFound(id));
    // Clear first so the partial unique index never sees two defaults at once.
    await tx
      .update(documentTemplates)
      .set({ isDefault: false })
      .where(and(eq(documentTemplates.kind, target.kind), eq(documentTemplates.isDefault, true)));
    const [row] = await tx
      .update(documentTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(documentTemplates.id, id))
      .returning();
    if (row === undefined) {
      throw new AppError(ERROR_IDS.DB_WRITE_FAILED, "setDefaultTemplate: update returned no rows");
    }
    return ok(toView(row));
  });
  return result;
}
