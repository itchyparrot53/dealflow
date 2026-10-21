import { eq } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { documentPayments, documents } from "@/db/schema";
import { formatCents, parseCents } from "@/features/currency/money";
import { moneyString } from "@/features/currency/schemas";
import { loadEditableDeal } from "@/features/deals/dealAuth";
import { emitDomainEvent } from "@/features/events/emit";
import type { PermSetUser } from "@/features/permissions/effective";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, type Result } from "@/types/result";
import { type DocumentView, getDocument, toDocumentError, todayUtc } from "./documents";
import type { DocStatus } from "./transitions";
import { nextStatus } from "./transitions";

// Payments are recorded by hand against issued invoices. Money is summed on
// integer minor units; reaching the total marks the invoice paid, and deleting a
// payment from a paid invoice returns it to sent or overdue.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const paymentInput = z.object({
  documentId: z.string().uuid(),
  amount: moneyString,
  paidOn: z.string().regex(ISO_DATE),
  method: z.enum(["bank_transfer", "card", "cash", "other"]),
  reference: z.string().trim().max(200).nullable().optional(),
});

export const paymentIdInput = z.object({ id: z.string().uuid() });

type DocumentRow = typeof documents.$inferSelect;

function notFound(id: string): AppError {
  return new AppError(ERROR_IDS.DOC_NOT_FOUND, "Document not found", { documentId: id });
}

function transitionNotAllowed(status: string): AppError {
  return new AppError(ERROR_IDS.DOC_TRANSITION, "Transition not allowed", { status });
}

async function lockDocument(tx: DbOrTx, id: string): Promise<DocumentRow | undefined> {
  const [row] = await tx.select().from(documents).where(eq(documents.id, id)).for("update");
  return row;
}

export async function recordPayment(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<DocumentView, AppError>> {
  const parsed = paymentInput.safeParse(raw);
  if (!parsed.success) {
    return err(new AppError(ERROR_IDS.DOC_INPUT_INVALID, "payment input failed validation"));
  }
  const input = parsed.data;
  const amount = parseCents(input.amount);
  if (amount <= 0n) {
    return err(new AppError(ERROR_IDS.DOC_INPUT_INVALID, "payment amount must be positive"));
  }

  return db.transaction(async (tx) => {
    const row = await lockDocument(tx, input.documentId);
    if (row === undefined) return err(notFound(input.documentId));
    const editable = await loadEditableDeal(tx, actor, row.dealId, signal);
    if (!editable.ok) return err(toDocumentError(editable.error));

    // Only issued invoices can take money; a quote or a draft is a 003.
    if (row.kind !== "invoice" || nextStatus("invoice", row.status as DocStatus, "pay") === null) {
      return err(transitionNotAllowed(row.status));
    }

    const payments = await tx
      .select({ amount: documentPayments.amount })
      .from(documentPayments)
      .where(eq(documentPayments.documentId, row.id));
    let paid = 0n;
    for (const payment of payments) paid += parseCents(payment.amount);
    const total = parseCents(row.total);
    const outstanding = total - paid;
    if (amount > outstanding) {
      return err(
        new AppError(ERROR_IDS.DOC_OVERPAYMENT, "Payment above the outstanding amount", {
          documentId: row.id,
          outstanding: formatCents(outstanding),
        }),
      );
    }

    await tx.insert(documentPayments).values({
      documentId: row.id,
      amount: formatCents(amount),
      paidOn: input.paidOn,
      method: input.method,
      reference: input.reference ?? null,
      recordedBy: actor.id,
    });
    if (paid + amount >= total) {
      await tx
        .update(documents)
        .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
        .where(eq(documents.id, row.id));
      await emitDomainEvent(
        tx,
        { type: "invoice.paid", entityType: "invoice", entityId: row.id, actorId: actor.id },
        signal,
      );
    }
    signal.throwIfAborted();
    return getDocument(tx, actor, row.id, signal);
  });
}

export async function deletePayment(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<DocumentView, AppError>> {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(documentPayments)
      .where(eq(documentPayments.id, id))
      .for("update");
    if (payment === undefined) {
      return err(new AppError(ERROR_IDS.DOC_NOT_FOUND, "Payment not found", { paymentId: id }));
    }
    const row = await lockDocument(tx, payment.documentId);
    if (row === undefined) {
      return err(new AppError(ERROR_IDS.DOC_NOT_FOUND, "Document not found", { paymentId: id }));
    }
    const editable = await loadEditableDeal(tx, actor, row.dealId, signal);
    if (!editable.ok) return err(toDocumentError(editable.error));

    await tx.delete(documentPayments).where(eq(documentPayments.id, id));
    if (row.status === "paid") {
      // Back to sent, then overdue when the due date has already passed.
      const unpay = nextStatus("invoice", "paid", "unpay") ?? "sent";
      const today = todayUtc();
      const status = row.dueDate !== null && row.dueDate < today ? "overdue" : unpay;
      await tx
        .update(documents)
        .set({ status, paidAt: null, updatedAt: new Date() })
        .where(eq(documents.id, row.id));
    }
    signal.throwIfAborted();
    return getDocument(tx, actor, row.id, signal);
  });
}
