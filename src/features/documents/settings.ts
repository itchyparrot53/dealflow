import { eq } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { documentSettings } from "@/db/schema";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";

// Document settings: one row holding the number prefixes, the default validity
// and due windows, the company block and the invoice footer. First read inserts
// the column defaults so a fresh install can create a document immediately.

export interface DocumentSettingsView {
  quotePrefix: string;
  invoicePrefix: string;
  quoteValidDays: number;
  invoiceDueDays: number;
  companyName: string | null;
  companyAddress: string | null;
  companyTaxId: string | null;
  paymentInstructions: string | null;
  footer: string | null;
}

const PREFIX = /^[A-Z0-9]{1,8}$/;

// An empty form field is stored as null, never as "", so the view has one
// representation for "not set".
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value === "" ? null : value));
}

export const documentSettingsInput = z.object({
  quotePrefix: z.string().trim().regex(PREFIX),
  invoicePrefix: z.string().trim().regex(PREFIX),
  quoteValidDays: z.number().int().min(1).max(365),
  invoiceDueDays: z.number().int().min(1).max(365),
  companyName: optionalText(200),
  companyAddress: optionalText(2000),
  companyTaxId: optionalText(100),
  paymentInstructions: optionalText(4000),
  footer: optionalText(4000),
});

function toView(row: typeof documentSettings.$inferSelect): DocumentSettingsView {
  return {
    quotePrefix: row.quotePrefix,
    invoicePrefix: row.invoicePrefix,
    quoteValidDays: row.quoteValidDays,
    invoiceDueDays: row.invoiceDueDays,
    companyName: row.companyName,
    companyAddress: row.companyAddress,
    companyTaxId: row.companyTaxId,
    paymentInstructions: row.paymentInstructions,
    footer: row.footer,
  };
}

async function readRow(db: DbOrTx): Promise<typeof documentSettings.$inferSelect | undefined> {
  const [row] = await db.select().from(documentSettings).where(eq(documentSettings.id, true));
  return row;
}

export async function getDocumentSettings(
  db: DbOrTx,
  signal: AbortSignal,
): Promise<DocumentSettingsView> {
  signal.throwIfAborted();
  const existing = await readRow(db);
  if (existing !== undefined) return toView(existing);
  // The column defaults are the shipped defaults, so an id-only insert is the
  // whole first-use path. A concurrent first read may win the insert.
  await db.insert(documentSettings).values({ id: true }).onConflictDoNothing();
  signal.throwIfAborted();
  const created = await readRow(db);
  if (created === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "getDocumentSettings: defaults not readable");
  }
  return toView(created);
}

export async function updateDocumentSettings(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<DocumentSettingsView, AppError>> {
  if (!can(actor, "documents.manage")) {
    return err(
      new AppError(ERROR_IDS.PERM_DENIED, "documents.manage required", { userId: actor.id }),
    );
  }
  const parsed = documentSettingsInput.safeParse(raw);
  if (!parsed.success) {
    return err(new AppError(ERROR_IDS.DOC_INPUT_INVALID, "document settings input failed"));
  }
  signal.throwIfAborted();
  const values = parsed.data;
  const [row] = await db
    .insert(documentSettings)
    .values({ id: true, ...values })
    .onConflictDoUpdate({
      target: documentSettings.id,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  if (row === undefined) {
    throw new AppError(
      ERROR_IDS.DB_INSERT_FAILED,
      "updateDocumentSettings: upsert returned no rows",
    );
  }
  return ok(toView(row));
}
