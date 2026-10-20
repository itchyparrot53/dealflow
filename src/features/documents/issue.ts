import { eq, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { documentCounters, documents } from "@/db/schema";
import { loadEditableDeal } from "@/features/deals/dealAuth";
import type { PermSetUser } from "@/features/permissions/effective";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, type Result } from "@/types/result";
import {
  addDaysToDate,
  type DocumentView,
  getDocument,
  toDocumentError,
  todayUtc,
} from "./documents";
import { formatDocNumber } from "./numbering";
import { getDocumentSettings } from "./settings";
import { type DocKind, type DocStatus, nextStatus } from "./transitions";

// Issuing turns a draft into a numbered document and is the only path that takes
// a counter value. The counter row is updated with INSERT ... ON CONFLICT DO
// UPDATE, so two concurrent issues can never pick the same number.

export interface IssueOptions {
  via: "issue" | "markSent";
}

function notFound(id: string): AppError {
  return new AppError(ERROR_IDS.DOC_NOT_FOUND, "Document not found", { documentId: id });
}

function transitionNotAllowed(status: string): AppError {
  return new AppError(ERROR_IDS.DOC_TRANSITION, "Transition not allowed", { status });
}

async function takeNumber(tx: DbOrTx, kind: DocKind, year: number): Promise<number> {
  const [row] = await tx
    .insert(documentCounters)
    .values({ kind, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [documentCounters.kind, documentCounters.year],
      set: { lastNumber: sql`${documentCounters.lastNumber} + 1` },
    })
    .returning({ lastNumber: documentCounters.lastNumber });
  if (row === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "takeNumber: upsert returned no rows");
  }
  return row.lastNumber;
}

export async function issueDocument(
  db: Db,
  actor: PermSetUser,
  id: string,
  options: IssueOptions,
  signal: AbortSignal,
): Promise<Result<DocumentView, AppError>> {
  return db.transaction(async (tx) => {
    // Lock the row first: two "issue" clicks must not both take a number.
    const [row] = await tx.select().from(documents).where(eq(documents.id, id)).for("update");
    if (row === undefined) return err(notFound(id));
    const editable = await loadEditableDeal(tx, actor, row.dealId, signal);
    if (!editable.ok) return err(toDocumentError(editable.error));

    const kind = row.kind as DocKind;
    const next = nextStatus(kind, row.status as DocStatus, options.via);
    if (next === null) return err(transitionNotAllowed(row.status));

    const settings = await getDocumentSettings(tx, signal);
    const today = todayUtc();
    const year = Number(today.slice(0, 4));
    let number = row.number;
    if (number === null) {
      const sequence = await takeNumber(tx, kind, year);
      const prefix = kind === "quote" ? settings.quotePrefix : settings.invoicePrefix;
      number = formatDocNumber(prefix, year, sequence);
    }

    const [updated] = await tx
      .update(documents)
      .set({
        number,
        status: next,
        issueDate: today,
        // Invoices get their due window at issue, not at creation.
        dueDate: kind === "invoice" ? addDaysToDate(today, settings.invoiceDueDays) : row.dueDate,
        sentAt: row.sentAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning({ id: documents.id });
    if (updated === undefined) {
      throw new AppError(ERROR_IDS.DB_WRITE_FAILED, "issueDocument: update returned no rows");
    }
    signal.throwIfAborted();
    return getDocument(tx, actor, id, signal);
  });
}

// Voiding keeps the number: it is the audit trail that an invoice existed.
export async function voidInvoice(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<DocumentView, AppError>> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(documents).where(eq(documents.id, id)).for("update");
    if (row === undefined) return err(notFound(id));
    const editable = await loadEditableDeal(tx, actor, row.dealId, signal);
    if (!editable.ok) return err(toDocumentError(editable.error));

    const kind = row.kind as DocKind;
    const next = nextStatus(kind, row.status as DocStatus, "void");
    if (next === null) return err(transitionNotAllowed(row.status));

    const [updated] = await tx
      .update(documents)
      .set({ status: next, voidedAt: new Date(), updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning({ id: documents.id });
    if (updated === undefined) {
      throw new AppError(ERROR_IDS.DB_WRITE_FAILED, "voidInvoice: update returned no rows");
    }
    signal.throwIfAborted();
    return getDocument(tx, actor, id, signal);
  });
}
